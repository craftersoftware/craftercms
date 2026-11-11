/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as published by
 * the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package org.craftercms.engine.service.context;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.Strings;
import org.craftercms.commons.rest.ManagementToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Lists sites from Studio's management site API.
 */
public class StudioSiteListResolver implements SiteListResolver {

	static final String SITES_PATH = "/api/2/management/sites";
	static final String SITES_FIELD = "sites";

	private static final Logger logger = LoggerFactory.getLogger(StudioSiteListResolver.class);

	private final String studioUrl;
	private final String managementToken;
	private final Duration readTimeout;
	private final HttpClient httpClient;
	private final ObjectMapper objectMapper;

	@ConstructorProperties({"studioUrl", "managementToken", "connectTimeout", "readTimeout"})
	public StudioSiteListResolver(String studioUrl, String managementToken, long connectTimeout, long readTimeout) {
		this.studioUrl = Strings.CI.removeEnd(StringUtils.trimToEmpty(studioUrl), "/");
		this.managementToken = managementToken;
		boolean hasUrl = StringUtils.isNotBlank(this.studioUrl);
		boolean hasToken = StringUtils.isNotBlank(managementToken);
		if (hasUrl != hasToken) {
			logger.warn("Studio site list is not used: crafter.engine.studio.url and "
				+ "crafter.engine.studio.siteManagementToken must both be set");
		}
		this.readTimeout = Duration.ofMillis(readTimeout);
		this.objectMapper = new ObjectMapper();
		this.httpClient = HttpClient.newBuilder()
			.connectTimeout(Duration.ofMillis(connectTimeout))
			.followRedirects(HttpClient.Redirect.NEVER)
			.version(HttpClient.Version.HTTP_1_1)
			.build();
	}

	private boolean isConfigured() {
		return StringUtils.isNotBlank(studioUrl) && StringUtils.isNotBlank(managementToken);
	}

	@Override
	public Collection<String> getSiteList() {
		if (!isConfigured()) {
			return null;
		}

		HttpRequest request = HttpRequest.newBuilder()
			.uri(URI.create(studioUrl + SITES_PATH))
			.header(ManagementToken.HEADER_NAME, managementToken)
			.header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
			.GET()
			.build();

		HttpResponse<String> response = send(request);

		if (response.statusCode() != 200) {
			throw new StudioSiteListException("Studio site list returned HTTP " + response.statusCode());
		}
		return parseSites(response.body());
	}

	/**
	 * Waits until the response body is fully received, or {@code readTimeout} elapses.
	 * {@link HttpRequest.Builder#timeout(Duration)} stops when headers arrive, so it does not cover the body.
	 * A response still being read is cancelled so a stalled body does not hold the connection.
	 */
	private HttpResponse<String> send(HttpRequest request) {
		CompletableFuture<HttpResponse<String>> response = httpClient.sendAsync(
			request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
		try {
			return response.get(readTimeout.toMillis(), TimeUnit.MILLISECONDS);
		} catch (TimeoutException e) {
			throw new StudioSiteListException("Unable to call Studio site list: request timed out", e);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new StudioSiteListException("Studio site list request was interrupted", e);
		} catch (ExecutionException e) {
			Throwable cause = e.getCause() == null ? e : e.getCause();
			if (cause instanceof InterruptedException interrupted) {
				Thread.currentThread().interrupt();
				throw new StudioSiteListException("Studio site list request was interrupted", interrupted);
			}
			if (cause instanceof Error error) {
				throw error;
			}
			if (cause instanceof RuntimeException runtime) {
				throw runtime;
			}
			throw new StudioSiteListException("Unable to call Studio site list: " + cause.getMessage(), cause);
		} finally {
			if (!response.isDone()) {
				response.cancel(true);
			}
		}
	}

	private List<String> parseSites(String body) {
		JsonNode sites;
		try {
			JsonNode root = objectMapper.readTree(body);
			sites = root == null ? null : root.get(SITES_FIELD);
		} catch (IOException e) {
			throw new StudioSiteListException("Studio site list response is not valid JSON", e);
		}
		if (sites == null || !sites.isArray()) {
			throw new StudioSiteListException("Studio site list response has no sites array");
		}

		List<String> siteIds = new ArrayList<>(sites.size());
		for (JsonNode site : sites) {
			if (!site.isTextual()) {
				throw new StudioSiteListException("Studio site list response contains a non-string site id");
			}
			siteIds.add(site.asText());
		}
		return siteIds;
	}

}
