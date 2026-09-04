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

package org.craftercms.studio.impl.v2.service.proxy.internal;

import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.proxy.ProxyUtils;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.service.proxy.ProxyService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.beans.ConstructorProperties;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.List;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_MANAGEMENT_PREVIEW_AUTHORIZATION_TOKEN;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_MANAGEMENT_PREVIEW_PROTECTED_URLS;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.PROXY_ENGINE;

/**
 * Default internal implementation for {@link ProxyService}.
 */
public class ProxyServiceInternalImpl implements ProxyService {

    protected final StudioConfiguration studioConfiguration;

    protected final ServicesConfig servicesConfig;

    protected final RestTemplate restTemplate = new RestTemplate();

    @ConstructorProperties({"studioConfiguration", "servicesConfig"})
    public ProxyServiceInternalImpl(final StudioConfiguration studioConfiguration, final ServicesConfig servicesConfig) {
        this.studioConfiguration = studioConfiguration;
        this.servicesConfig = servicesConfig;
    }

    @Override
    public ResponseEntity<Object> getSiteLogEvents(final String body,
                                                   final String siteId,
                                                   final HttpServletRequest request) throws URISyntaxException {
        return proxyEngine(body, siteId, request);
    }

    @Override
    @Valid
    public ResponseEntity<Object> proxyEngine(final String body, final String siteId,
                                              final HttpServletRequest request) throws URISyntaxException {
        URI uri = getProxyRequestUri(siteId, request);
        HttpEntity<Object> httpEntity = new HttpEntity<>(body, getProxyRequestHeaders(request));
        try {
            ResponseEntity response = restTemplate.exchange(uri, HttpMethod.valueOf(request.getMethod()), httpEntity, Object.class);
            return new ResponseEntity<>(response.getBody(), getProxyResponseHeaders(response), response.getStatusCode());
        } catch (HttpStatusCodeException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .headers(e.getResponseHeaders())
                    .body(e.getResponseBodyAsString());
        }
    }

    /**
     * Returns the request path sending to proxy server (internal engine server)
     * @param request the current request from Studio
     * @return proxy path
     */
    private String getProxyPath(HttpServletRequest request) {
        String requestUrl = request.getRequestURI();
        String proxiedUrl = StringUtils.replace(requestUrl, request.getContextPath(), StringUtils.EMPTY);
        proxiedUrl = StringUtils.replace(proxiedUrl, PROXY_ENGINE, StringUtils.EMPTY);

        return proxiedUrl;
    }

    /**
     * Returns the request URI sending to proxy server (internal engine server)
     * @param siteId the current side id
     * @param request the current request from Studio
     * @return proxying URI object
     * @throws URISyntaxException if there are exceptions while forming the URI
     */
    private URI getProxyRequestUri(String siteId, HttpServletRequest request) throws URISyntaxException {
        String proxyPath = getProxyPath(request);
        List<String> engineProtectedUrls = getEngineProtectedUrls();
        boolean managementTokenRequired = engineProtectedUrls.contains(proxyPath);
        URI uri = new URI(getAuthoringUrl(siteId));
        UriComponentsBuilder uriComponentsBuilder = UriComponentsBuilder.fromUri(uri)
                .path(proxyPath)
                .query(request.getQueryString())
                .replaceQueryParam("site", siteId);
        if (managementTokenRequired) {
            uriComponentsBuilder = uriComponentsBuilder.queryParam("token", getEngineManagementTokenValue());
        }
        uri = uriComponentsBuilder.build(true).toUri();

        return uri;
    }

    /**
     * Returns headers which should be passed to the proxy server (internal engine server)
     * @param request the current request from Studio
     * @return headers sending to proxy server
     */
    private HttpHeaders getProxyRequestHeaders(HttpServletRequest request) {
        HttpHeaders headers = new HttpHeaders();
        Enumeration<String> headerNames = request.getHeaderNames();
        // Add all headers except an ignored list and the cookie header
        while (headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            if (!ProxyUtils.IGNORE_REQUEST_HEADERS.contains(headerName.toLowerCase()) && !headerName.equalsIgnoreCase(HttpHeaders.COOKIE)) {
                headers.set(headerName, request.getHeader(headerName));
            }
        }

        // rebuild cookie headers to remove ignored list of cookies
        headers.set(HttpHeaders.COOKIE, ProxyUtils.getProxyCookieHeader(request));

        return headers;
    }

    /**
     * Returns headers sending back Studio from proxy server (internal engine server)
     * @param response the response to Studio
     * @return headers object send back to Studio
     */
    private HttpHeaders getProxyResponseHeaders(ResponseEntity response) {
        HttpHeaders headers = new HttpHeaders();
        // https://www.rfc-editor.org/rfc/rfc9112#name-transfer-encoding
        // A sender MUST NOT apply the chunked transfer coding more than once to a message body
        response.getHeaders().forEach((key, value) -> {
            if (!key.equals(HttpHeaders.TRANSFER_ENCODING)) {
                headers.addAll(key, value);
            }
        });

        return headers;
    }

    /**
     * Returns the full authoring url used for preview
     */
    protected String getAuthoringUrl(String siteId) {
        return servicesConfig.getAuthoringUrl(siteId);
    }

    /**
     * Returns the management token for preview
     */
    protected String getEngineManagementTokenValue() {
        return studioConfiguration.getProperty(CONFIGURATION_MANAGEMENT_PREVIEW_AUTHORIZATION_TOKEN);
    }

    /**
     * Returns the list of preview URLs that require the management token
     */
    protected List<String> getEngineProtectedUrls() {
        return Arrays.asList(
                studioConfiguration.getProperty(CONFIGURATION_MANAGEMENT_PREVIEW_PROTECTED_URLS).split("\\s*,\\s*"));
    }
}
