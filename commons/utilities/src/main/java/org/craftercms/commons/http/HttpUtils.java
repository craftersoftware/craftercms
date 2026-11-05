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
package org.craftercms.commons.http;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.collections4.MapUtils;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.rest.RestServiceException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;

/**
 * Utility methods for HTTP related stuff.
 *
 * @author avasquez
 */
public class HttpUtils {

	public static final String HTTP_SCHEME = "http";
	public static final String HTTPS_SCHEME = "https";
	public static final int DEFAULT_HTTP_PORT = 80;
	public static final int DEFAULT_HTTPS_PORT = 443;

	public static final String PRAGMA_HEADER_NAME = "Pragma";
	public static final String CACHE_CONTROL_HEADER_NAME = "Cache-Control";
	public static final String EXPIRES_HEADER_NAME = "Expires";
	public static final String LEFT_CURLY_BRACE = "{";
	public static final String RIGHT_CURLY_BRACE = "}";

	/**
	 * Returns the portion from the URL that includes the scheme, server name and port number, without the server
	 * path.
	 *
	 * @param request    the request object used to build the base URL
	 * @param forceHttps if HTTPS should be enforced
	 * @return the base request URL
	 */
	public static StringBuilder getBaseRequestUrl(HttpServletRequest request, boolean forceHttps) {
		String scheme = forceHttps ? HTTPS_SCHEME : request.getScheme();
		String serverName = request.getServerName();
		int serverPort = request.getServerPort();
		StringBuilder url = new StringBuilder();

		url.append(scheme).append("://").append(serverName);

		if (!(scheme.equals(HTTP_SCHEME) && serverPort == DEFAULT_HTTP_PORT) &&
			!(scheme.equals(HTTPS_SCHEME) && serverPort == DEFAULT_HTTPS_PORT)) {
			url.append(":").append(serverPort);
		}

		return url;
	}

	/**
	 * Returns the full URL for the relative URL based in the specified request. The full URL includes the scheme,
	 * server name, port number, context path and server path.
	 *
	 * @param request     the request object used to build the base URL
	 * @param relativeUrl the relative URL
	 * @return the full URL
	 */
	public static String getFullUrl(HttpServletRequest request, String relativeUrl) {
		StringBuilder baseUrl = getBaseRequestUrl(request, false);
		String contextPath = request.getContextPath();
		String servletPath = request.getServletPath();

		if (contextPath.equals("/")) {
			contextPath = "";
		}
		if (servletPath.equals("/")) {
			servletPath = "";
		}

		return baseUrl.append(contextPath).append(servletPath).append(relativeUrl).toString();
	}

	/**
	 * Returns the request URI without the context path.
	 *
	 * @param request the request where to get the URI from
	 */
	public static final String getRequestUriWithoutContextPath(HttpServletRequest request) {
		String uri = request.getRequestURI().substring(request.getContextPath().length());
		if (!uri.isEmpty()) {
			return uri;
		} else {
			return "/";
		}
	}

	/**
	 * Returns the full request URI, including scheme, server name, port number and server path. The query string
	 * is optional.
	 *
	 * @param request            the request object used to build the URI
	 * @param includeQueryString if the query string should be appended to the URI
	 * @return the full request URI
	 */
	public static final String getFullRequestUri(HttpServletRequest request, boolean includeQueryString) {
		StringBuilder uri = getBaseRequestUrl(request, false).append(request.getRequestURI());

		if (includeQueryString) {
			String queryStr = request.getQueryString();
			if (StringUtils.isNotEmpty(queryStr)) {
				uri.append('?').append(queryStr);
			}
		}

		return uri.toString();
	}

	/**
	 * Returns the cookie with the given name for the given request
	 *
	 * @param name    the name of the cookie
	 * @param request the request where to extract the request from
	 * @return the cookie object, or null if not found
	 */
	public static Cookie getCookie(String name, HttpServletRequest request) {
		Cookie[] cookies = request.getCookies();
		if (ArrayUtils.isNotEmpty(cookies)) {
			for (Cookie cookie : cookies) {
				if (cookie.getName().equals(name)) {
					return cookie;
				}
			}
		}

		return null;
	}

	/**
	 * Returns the cookie value with the given name for the given request
	 *
	 * @param name    the name of the cookie
	 * @param request the request where to extract the request from
	 * @return the cookie value, or null if no cookie found
	 */
	public static String getCookieValue(String name, HttpServletRequest request) {
		Cookie cookie = getCookie(name, request);
		if (cookie != null) {
			return cookie.getValue();
		} else {
			return null;
		}
	}

	/**
	 * Adds a param value to a params map. If value is null, nothing is done.
	 *
	 * @param key    the param key
	 * @param value  the param value
	 * @param params the params map
	 */
	public static void addValue(String key, Object value, MultiValueMap<String, String> params) {
		if (value != null) {
			params.add(key, value.toString());
		}
	}

	/**
	 * Adds a collection of param values to a params map. If the collection is null, nothing is done.
	 *
	 * @param key    the param key
	 * @param values the collection of param values
	 * @param params the params map
	 */
	public static void addValues(String key, Collection<String> values, MultiValueMap<String, String> params) {
		if (values != null) {
			for (String value : values) {
				params.add(key, value);
			}
		}
	}

	/**
	 * Adds an array of param values to a params map. If the array is null, nothing is done.
	 *
	 * @param key    the param key
	 * @param values the array of param values
	 * @param params the params map
	 */
	public static void addValues(String key, String[] values, MultiValueMap<String, String> params) {
		if (values != null) {
			for (String value : values) {
				params.add(key, value);
			}
		}
	}

	/**
	 * Returns a map with the extracted parameters from the specified query string. A multi value map is used
	 * since there can be several values for the same param.
	 *
	 * @param queryString the query string to extract the params from
	 * @return the param map
	 */
	@SuppressWarnings("unchecked")
	public static MultiValueMap<String, String> getParamsFromQueryString(String queryString) {
		MultiValueMap queryParams = new LinkedMultiValueMap<>();

		if (StringUtils.isNotEmpty(queryString)) {
			String[] params = queryString.split("&");
			for (String param : params) {
				String[] splitParam = param.split("=");
				String paramName = splitParam[0];
				String paramValue = splitParam[1];

				queryParams.add(paramName, paramValue);
			}
		}

		return queryParams;
	}

	/**
	 * Builds a query string from the specified params. The param names and the values are always encoded. UTF-8 is used as the encoding
	 * charset.
	 *
	 * @param queryParams the params to build the query string with
	 * @return the query string
	 */
	public static String getQueryStringFromParams(MultiValueMap<String, String> queryParams) {
		return getQueryStringFromParams(queryParams, true);
	}

	/**
	 * Builds a query string from the specified params. The param names are always encoded, but the values are only encoded
	 * if {@code encodeValues} is true. UTF-8 is used as the encoding charset.
	 *
	 * @param queryParams  the params to build the query string with
	 * @param encodeValues if the param values should be encoded
	 * @return the query string
	 */
	public static String getQueryStringFromParams(MultiValueMap<String, String> queryParams, boolean encodeValues) {
		try {
			return getQueryStringFromParams(queryParams, "UTF-8", encodeValues);
		} catch (UnsupportedEncodingException e) {
			// Should NEVER happen
			throw new IllegalStateException("UTF-8 should always be supported by the JVM", e);
		}
	}

	/**
	 * Builds a query string from the specified params. The param names are always encoded, but the values are only encoded
	 * if {@code encodeValues} is true.
	 *
	 * @param queryParams  the params to build the query string with
	 * @param charset      the charset to use for URL encoding
	 * @param encodeValues if the param values should be encoded
	 * @return the query string
	 */
	public static String getQueryStringFromParams(MultiValueMap<String, String> queryParams,
						      String charset, boolean encodeValues) throws UnsupportedEncodingException {
		StringBuilder queryString = new StringBuilder();

		if (MapUtils.isNotEmpty(queryParams)) {
			for (Map.Entry<String, List<String>> entry : queryParams.entrySet()) {
				String paramName = URLEncoder.encode(entry.getKey(), charset);

				for (String paramValue : entry.getValue()) {
					if (queryString.length() > 0) {
						queryString.append('&');
					}

					if (encodeValues) {
						paramValue = URLEncoder.encode(paramValue, charset);
					}

					queryString.append(paramName).append('=').append(paramValue);
				}
			}

			queryString.insert(0, '?');
		}

		return queryString.toString();
	}

	/**
	 * Creates a map from the parameters in the specified request. Multi value parameters will be in an array.
	 *
	 * @param request the request
	 */
	public static Map<String, Object> createRequestParamsMap(HttpServletRequest request) {
		Map<String, Object> paramsMap = new HashMap<>();
		for (Enumeration paramNameEnum = request.getParameterNames(); paramNameEnum.hasMoreElements(); ) {
			String paramName = (String) paramNameEnum.nextElement();
			String[] paramValues = request.getParameterValues(paramName);

			if (paramValues.length == 1) {
				paramsMap.put(paramName, paramValues[0]);
			} else {
				paramsMap.put(paramName, paramValues);
			}
		}

		return paramsMap;
	}

	/**
	 * Creates a map from the request attributes in the specified request.
	 *
	 * @param request the request
	 */
	public static Map<String, Object> createRequestAttributesMap(HttpServletRequest request) {
		Map<String, Object> attributesMap = new HashMap<>();
		for (Enumeration attributeNameEnum = request.getAttributeNames(); attributeNameEnum.hasMoreElements(); ) {
			String attributeName = (String) attributeNameEnum.nextElement();

			attributesMap.put(attributeName, request.getAttribute(attributeName));
		}

		return attributesMap;
	}

	/**
	 * Creates a map from the headers in the specified request. Multi value headers will be in an array.
	 *
	 * @param request the request
	 */
	public static Map<String, Object> createHeadersMap(HttpServletRequest request) {
		Map<String, Object> headersMap = new HashMap<>();
		for (Enumeration headerNameEnum = request.getHeaderNames(); headerNameEnum.hasMoreElements(); ) {
			String headerName = (String) headerNameEnum.nextElement();
			List<String> headerValues = new ArrayList<String>();

			CollectionUtils.addAll(headerValues, request.getHeaders(headerName));

			if (headerValues.size() == 1) {
				headersMap.put(headerName, headerValues.get(0));
			} else {
				headersMap.put(headerName, headerValues.toArray(new String[headerValues.size()]));
			}
		}

		return headersMap;
	}

	/**
	 * Creates a map from the cookies in the specified request.
	 *
	 * @param request the request
	 */
	public static Map<String, String> createCookiesMap(HttpServletRequest request) {
		Map<String, String> cookiesMap = new HashMap<String, String>();
		Cookie[] cookies = request.getCookies();

		if (ArrayUtils.isNotEmpty(cookies)) {
			for (Cookie cookie : request.getCookies()) {
				cookiesMap.put(cookie.getName(), cookie.getValue());
			}
		}

		return cookiesMap;
	}

	/**
	 * Creates a map from the session attributes in the specified request.
	 *
	 * @param request the request
	 */
	public static Map<String, Object> createSessionMap(HttpServletRequest request) {
		Map<String, Object> sessionMap = new HashMap<>();
		HttpSession session = request.getSession(false);

		if (session != null) {
			for (Enumeration attributeNameEnum = session.getAttributeNames(); attributeNameEnum.hasMoreElements(); ) {
				String attributeName = (String) attributeNameEnum.nextElement();
				sessionMap.put(attributeName, session.getAttribute(attributeName));
			}
		}

		return sessionMap;
	}

	/**
	 * Disable caching in the client.
	 *
	 * @param response the response to add the headers for disabling caching.
	 */
	public static void disableCaching(HttpServletResponse response) {
		response.addHeader(PRAGMA_HEADER_NAME, "no-cache");
		response.addHeader(CACHE_CONTROL_HEADER_NAME, "no-cache, no-store, max-age=0");
		response.addDateHeader(EXPIRES_HEADER_NAME, 1L);
	}

	/**
	 * Encode an URL to valid the macro characters
	 *
	 * @param url URL string
	 * @return encoded version of the URL
	 */
	public static String encodeUrlMacro(String url) {
		if (StringUtils.isEmpty(url)) {
			return url;
		}

		return url.replace(LEFT_CURLY_BRACE, URLEncoder.encode(LEFT_CURLY_BRACE, StandardCharsets.UTF_8))
			.replace(RIGHT_CURLY_BRACE, URLEncoder.encode(RIGHT_CURLY_BRACE, StandardCharsets.UTF_8));
	}

	/**
	 * Returns true when the client error is a 404.
	 * Clients in this project report HTTP errors as {@link RestServiceException}, not {@link HttpStatusCodeException}.
	 */
	public static boolean isNotFound(RestClientException exception) {
		return hasStatus(exception, HttpStatus.NOT_FOUND);
	}

	/**
	 * Returns true when the client error is a 409.
	 */
	public static boolean isConflict(RestClientException exception) {
		return hasStatus(exception, HttpStatus.CONFLICT);
	}

	/**
	 * Returns true when {@code exception} carries {@code expected}.
	 * {@link RestServiceException} stores the status directly. {@link HttpStatusCodeException} is also accepted.
	 */
	public static boolean hasStatus(RestClientException exception, HttpStatusCode expected) {
		HttpStatusCode status = null;
		if (exception instanceof RestServiceException restServiceException) {
			status = restServiceException.getResponseStatus();
		} else if (exception instanceof HttpStatusCodeException httpStatusCodeException) {
			status = httpStatusCodeException.getStatusCode();
		}
		return status != null && status.isSameCodeAs(expected);
	}

}
