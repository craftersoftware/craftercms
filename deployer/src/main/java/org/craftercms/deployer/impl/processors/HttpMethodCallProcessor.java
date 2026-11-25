/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.deployer.impl.processors;

import org.apache.commons.configuration2.Configuration;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpEntity;
import org.apache.http.client.methods.*;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.deployer.api.ChangeSet;
import org.craftercms.deployer.api.Deployment;
import org.craftercms.deployer.api.ProcessorExecution;
import org.craftercms.deployer.api.exceptions.DeployerException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import static org.craftercms.commons.config.ConfigUtils.getRequiredStringProperty;

/**
 * Processor that does an HTTP method call. A processor instance can be configured with the following YAML properties:
 *
 * <ul>
 *     <li><strong>url:</strong> The URL to call</li>
 *     <li><strong>method:</strong> The HTTP method</li>
 *     <li><strong>headers:</strong> Optional list of request headers, each with {@code name} and {@code value}.
 *     Header names are logged; values are not.</li>
 * </ul>
 *
 * @author avasquez
 */
public class HttpMethodCallProcessor extends AbstractMainDeploymentProcessor {

	private static final Logger logger = LoggerFactory.getLogger(HttpMethodCallProcessor.class);

	protected static final String URL_CONFIG_KEY = "url";
	protected static final String METHOD_CONFIG_KEY = "method";
	protected static final String HEADERS_CONFIG_KEY = "headers";
	protected static final String HEADER_NAME_CONFIG_KEY = "name";
	protected static final String HEADER_VALUE_CONFIG_KEY = "value";

	// Config properties (populated on init)

	protected String url;
	protected String method;
	protected List<RequestHeader> headers = List.of();
	protected CloseableHttpClient httpClient;

	@Override
	protected void doInit(Configuration config) throws ConfigurationException {
		url = getRequiredStringProperty(config, URL_CONFIG_KEY);
		method = getRequiredStringProperty(config, METHOD_CONFIG_KEY);
		headers = readHeaders(config);
		httpClient = headers.isEmpty() ? HttpClients.createDefault()
				: HttpClients.custom().disableRedirectHandling().build();
	}

	@SuppressWarnings("unchecked")
	protected List<RequestHeader> readHeaders(Configuration config) throws ConfigurationException {
		if (!(config instanceof HierarchicalConfiguration)) {
			return List.of();
		}
		HierarchicalConfiguration<ImmutableNode> hierarchical = (HierarchicalConfiguration<ImmutableNode>) config;
		List<HierarchicalConfiguration<ImmutableNode>> headerConfigs;
		try {
			headerConfigs = hierarchical.configurationsAt(HEADERS_CONFIG_KEY);
		} catch (Exception e) {
			throw new ConfigurationException("Failed to read HTTP headers", e);
		}
		if (headerConfigs == null || headerConfigs.isEmpty()) {
			return List.of();
		}
		List<RequestHeader> result = new ArrayList<>();
		for (HierarchicalConfiguration<ImmutableNode> headerConfig : headerConfigs) {
			String headerName = headerConfig.getString(HEADER_NAME_CONFIG_KEY);
			if (StringUtils.isEmpty(headerName)) {
				continue;
			}
			String headerValue = headerConfig.getString(HEADER_VALUE_CONFIG_KEY, "");
			result.add(new RequestHeader(headerName, headerValue));
		}
		return List.copyOf(result);
	}

	@Override
	protected void doDestroy() {
		// Do nothing
	}

	@Override
	protected ChangeSet doMainProcess(Deployment deployment, ProcessorExecution execution,
					  ChangeSet filteredChangeSet, ChangeSet originalChangeSet) throws DeployerException {
		HttpUriRequest request = createRequest();
		URI uri = request.getURI();
		String safeURI = StringUtils.EMPTY;
		try {
			// Try to hide sensitive data from the URL: username/password and query params
			safeURI = new URI(uri.getScheme(), null, uri.getHost(), uri.getPort(), uri.getPath(), null,
				uri.getFragment()).toString();
		} catch (URISyntaxException e) {
			logger.error("Error parsing URI", e);
		}
		String safeRequest = String.join(StringUtils.SPACE, request.getMethod(), safeURI);
		String headerNames = headers.stream().map(RequestHeader::name).collect(Collectors.joining(", "));

		if (StringUtils.isEmpty(headerNames)) {
			logger.info("Executing request {}...", safeRequest);
		} else {
			logger.info("Executing request {} with headers [{}]...", safeRequest, headerNames);
		}

		try (CloseableHttpResponse response = httpClient.execute(request)) {
			int status = response.getStatusLine().getStatusCode();
			HttpEntity entity = response.getEntity();
			String body = entity != null ? EntityUtils.toString(entity) : null;

			if (StringUtils.isEmpty(body)) {
				body = "empty";
			}

			if (status >= 200 && status < 300) {
				logger.info("Successful response for request {}: status = {}, body = {}", safeRequest, status, body);

				execution.setStatusDetails("Successful response for request " + safeRequest + ": status = " + status);
			} else {
				logger.error("Error response for request {}: status = {}, body = {}", safeRequest, status, body);

				execution.setStatusDetails("Error response for request " + safeRequest + ": status = " + status);
				execution.endExecution(Deployment.Status.FAILURE);
			}
		} catch (IOException e) {
			throw new DeployerException("IO error on HTTP request " + safeRequest, e);
		}

		return null;
	}

	protected HttpUriRequest createRequest() throws DeployerException {
		HttpUriRequest request;
		if (method.equalsIgnoreCase("get")) {
			request = new HttpGet(url);
		} else if (method.equalsIgnoreCase("post")) {
			request = new HttpPost(url);
		} else if (method.equalsIgnoreCase("put")) {
			request = new HttpPut(url);
		} else if (method.equalsIgnoreCase("delete")) {
			request = new HttpDelete(url);
		} else if (method.equalsIgnoreCase("head")) {
			request = new HttpHead(url);
		} else if (method.equalsIgnoreCase("options")) {
			request = new HttpOptions(url);
		} else if (method.equalsIgnoreCase("trace")) {
			request = new HttpTrace(url);
		} else {
			throw new DeployerException("HTTP method '" + method + " not recognized");
		}
		for (RequestHeader header : headers) {
			request.setHeader(header.name(), header.value());
		}
		return request;
	}

	protected record RequestHeader(String name, String value) {
	}

}
