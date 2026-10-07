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
package org.craftercms.commons.rest;

import org.springframework.http.HttpHeaders;

import java.net.URI;
import java.util.regex.Pattern;

/**
 * Redacts management tokens from request URIs and headers before they are written to logs.
 */
public final class RequestLogSanitizer {

    public static final String REDACTED = "[redacted]";

    private static final Pattern TOKEN_QUERY_PARAMETER = Pattern.compile(
            "(?i)([?&]" + ManagementToken.QUERY_PARAMETER + "=)[^&]*");

    private RequestLogSanitizer() {
    }

    /**
     * Returns the URI with the value of the {@code token} query parameter replaced.
     */
    public static String sanitizeUri(URI uri) {
        if (uri == null) {
            return "";
        }
        return sanitizeUri(uri.toString());
    }

    /**
     * Returns the URI string with the value of the {@code token} query parameter replaced.
     */
    public static String sanitizeUri(String uri) {
        if (uri == null) {
            return "";
        }
        return TOKEN_QUERY_PARAMETER.matcher(uri).replaceAll("$1" + REDACTED);
    }

    /**
     * Returns a copy of the headers with management-token, authorization, cookie,
     * and proxy-authorization values replaced.
     */
    public static HttpHeaders sanitizeHeaders(HttpHeaders headers) {
        HttpHeaders sanitized = new HttpHeaders();
        if (headers == null) {
            return sanitized;
        }
        headers.forEach((name, values) -> {
            if (isSensitiveHeader(name)) {
                if (values == null || values.isEmpty()) {
                    sanitized.add(name, REDACTED);
                } else {
                    values.forEach(value -> sanitized.add(name, REDACTED));
                }
            } else if (values != null) {
                values.forEach(value -> sanitized.add(name, value));
            }
        });
        return sanitized;
    }

    private static boolean isSensitiveHeader(String name) {
        return ManagementToken.HEADER_NAME.equalsIgnoreCase(name)
                || HttpHeaders.AUTHORIZATION.equalsIgnoreCase(name)
                || HttpHeaders.COOKIE.equalsIgnoreCase(name)
                || HttpHeaders.PROXY_AUTHORIZATION.equalsIgnoreCase(name);
    }

}
