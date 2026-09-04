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
package org.craftercms.engine.servlet.filter;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.http.client.utils.URIUtils;
import org.craftercms.commons.lang.RegexUtils;
import org.craftercms.commons.proxy.ProxyUtils;
import org.craftercms.engine.exception.proxy.HttpProxyException;
import org.craftercms.engine.service.context.SiteContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.craftercms.engine.util.spring.security.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.util.LinkedCaseInsensitiveMap;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.mvc.Controller;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.beans.ConstructorProperties;
import java.io.IOException;
import java.net.URI;
import java.util.*;
import java.util.stream.Stream;

import static java.util.Collections.*;
import static java.util.stream.Collectors.toList;
import static org.apache.commons.lang.StringUtils.isEmpty;
import static org.apache.commons.lang.StringUtils.isNotEmpty;
import static org.craftercms.engine.util.servlet.ConfigAwareProxyServlet.ATTR_TARGET_HOST;
import static org.craftercms.engine.util.servlet.ConfigAwareProxyServlet.ATTR_TARGET_URI;

/**
 * Implementation of {@link jakarta.servlet.Filter} that delegates requests to a proxy
 *
 * @author joseross
 * @since 3.1.7
 */
public class HttpProxyFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(HttpProxyFilter.class);

    public static final String CONFIG_KEY_SERVERS = "servers.server";

    public static final String CONFIG_KEY_PATTERNS = "patterns.pattern";

    public static final String CONFIG_KEY_ID = "id";

    public static final String CONFIG_KEY_URL = "url";
    public static final String CONFIG_KEY_HEADERS_SERVER = "headersToServer";
    public static final String CONFIG_KEY_HEADERS_CLIENT = "headersToClient";
    public static final String CONFIG_KEY_HEADER = "header";
    public static final String CONFIG_KEY_NAME = "name";
    public static final String CONFIG_KEY_VALUE = "value";

    /**
     * Indicates if the proxy is enabled
     */
    protected boolean enabled;

    /**
     * The proxy to use
     */
    protected Controller proxyController;

    protected RequestMatcher excludedMatcher;

    @ConstructorProperties({"enabled", "proxyController", "excludedUrls"})
    public HttpProxyFilter(boolean enabled, Controller proxyController, String[] excludedUrls) {
        this.enabled = enabled;
        this.proxyController = proxyController;
        excludedMatcher = new OrRequestMatcher(Stream.of(excludedUrls)
                .map(AntPathRequestMatcher::new)
                .collect(toList()));
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled || excludedMatcher.matches(request);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
            logger.debug("Trying to execute proxy request for {}", request.getRequestURI());
        try {
            String requestUri = request.getRequestURI();

            // get the target url from the site config
            String targetUrl = getTargetUrl(SiteContext.getCurrent(), request.getRequestURI());

            if (isEmpty(targetUrl) || request.getRequestURL().toString().contains(targetUrl)) {
                logger.debug("Resolved target url for request {} is local, will skip proxy", requestUri);
            } else {
                logger.debug("Resolved target url {} for proxy request {}", targetUrl, requestUri);
                // set the new target url
                request.setAttribute(ATTR_TARGET_URI, targetUrl);

                // set the new target host
                request.setAttribute(ATTR_TARGET_HOST, URIUtils.extractHost(URI.create(targetUrl)));

                // Additional request headers from configuration
                Map<String, String> requestHeaders = getHeaders(SiteContext.getCurrent(), request.getRequestURI(), CONFIG_KEY_HEADERS_SERVER);
                HttpProxyServletRequestWrapper requestWrapper = new HttpProxyServletRequestWrapper(request, requestHeaders);

                // Additional response headers from configuration
                Map<String, String> responseHeaders = getHeaders(SiteContext.getCurrent(), requestWrapper.getRequestURI(), CONFIG_KEY_HEADERS_CLIENT);
                if (!responseHeaders.isEmpty()) {
                    for (Map.Entry<String, String> header: responseHeaders.entrySet()) {
                        response.setHeader(header.getKey(), header.getValue());
                    }
                }

                // execute the proxy request
                logger.debug("Starting execution of proxy request for {}", requestUri);
                proxyController.handleRequest(requestWrapper, response);
                return;
            }
        } catch (HttpProxyException e) {
            logger.debug("Continue with local execution for request " + request.getRequestURI(), e);
        } catch (Exception e) {
            throw new ServletException("Error executing proxy request for " + request.getRequestURI(), e);
        }

        // Proxy url is local, continue with normal execution
        filterChain.doFilter(request, response);
    }

    @SuppressWarnings("rawtypes, unchecked")
    protected String getTargetUrl(SiteContext siteContext, String requestUri) {
        HierarchicalConfiguration proxyConfig = siteContext.getProxyConfig();

        if (proxyConfig == null) {
            throw new HttpProxyException("No proxy configuration found for site " + siteContext.getSiteName());
        }

        List<HierarchicalConfiguration> servers = proxyConfig.configurationsAt(CONFIG_KEY_SERVERS);
        for (HierarchicalConfiguration server : servers) {
            List<String> patterns = server.getList(String.class, CONFIG_KEY_PATTERNS);
            if (RegexUtils.matchesAny(requestUri, patterns)) {
                logger.debug("Found matching server '{}' for proxy request {}",
                        server.getString(CONFIG_KEY_ID), requestUri);
                return server.getString(CONFIG_KEY_URL, null);
            }
        }

        return null;
    }

    @SuppressWarnings("rawtypes, unchecked")
    protected Map<String, String> getHeaders(SiteContext siteContext, String requestUri, String headerType) {
        HierarchicalConfiguration proxyConfig = siteContext.getProxyConfig();

        if (proxyConfig == null) {
            throw new HttpProxyException("No proxy configuration found for site " + siteContext.getSiteName());
        }

        Map<String, String> headers = new HashMap<>();
        List<HierarchicalConfiguration> servers = proxyConfig.configurationsAt(CONFIG_KEY_SERVERS);
        for (HierarchicalConfiguration server : servers) {
            List<String> patterns = server.getList(String.class, CONFIG_KEY_PATTERNS);
            if (RegexUtils.matchesAny(requestUri, patterns)) {
                logger.debug("Found matching server '{}' for proxy request {}",
                        server.getString(CONFIG_KEY_ID), requestUri);
                List<HierarchicalConfiguration> headersConfigList = server.configurationsAt(headerType);
                for (HierarchicalConfiguration headersConfig: headersConfigList) {
                    List<HierarchicalConfiguration> list = headersConfig.configurationsAt(CONFIG_KEY_HEADER);
                    for (HierarchicalConfiguration header: list) {
                        String name = header.getString(CONFIG_KEY_NAME, null);
                        String value = header.getString(CONFIG_KEY_VALUE, null);
                        if (isNotEmpty(name) && isNotEmpty(value)) {
                            headers.put(name, value);
                        }
                    }
                }
            }
        }

        return headers;
    }

    /**
     * A wrapper to request object to add additional request headers
     */
    private static class HttpProxyServletRequestWrapper extends HttpServletRequestWrapper {

        protected Map<String, List<String>> headers = new LinkedCaseInsensitiveMap<>();

        public HttpProxyServletRequestWrapper(HttpServletRequest request, Map<String, String> additionalHeaders) {
            super(request);

            // Add all headers except an ignored list and the cookie header
            Enumeration<String> headerNames = request.getHeaderNames();
            while (headerNames.hasMoreElements()) {
                String headerName = headerNames.nextElement();
                if (!ProxyUtils.IGNORE_REQUEST_HEADERS.contains(headerName.toLowerCase()) && !headerName.equalsIgnoreCase(HttpHeaders.COOKIE)) {
                    headers.put(headerName, list(request.getHeaders(headerName)));
                }
            }

            // rebuild cookie headers to remove ignored list of cookies keys
            headers.put(HttpHeaders.COOKIE, singletonList(ProxyUtils.getProxyCookieHeader(request)));

            // Additional headers from configuration
            for (Map.Entry<String, String> header: additionalHeaders.entrySet()) {
                headers.put(header.getKey(), singletonList(header.getValue()));
            }
        }

        @Override
        public String getHeader(String name) {
            return headers.getOrDefault(name, singletonList(null)).get(0);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            return enumeration(headers.getOrDefault(name, emptyList()));
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            return enumeration(headers.keySet());
        }

    }
}
