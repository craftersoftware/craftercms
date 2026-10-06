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

import org.junit.Test;
import org.springframework.http.HttpHeaders;

import java.net.URI;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

public class RequestLogSanitizerTest {

    private static final String SECRET = "super-secret-token";

    @Test
    public void queryTokenIsRedacted() throws Exception {
        URI uri = new URI("http://localhost:9191/api/1/target/get-all?token=" + SECRET + "&site=editorial");

        String sanitized = RequestLogSanitizer.sanitizeUri(uri);

        assertEquals("http://localhost:9191/api/1/target/get-all?token=" + RequestLogSanitizer.REDACTED + "&site=editorial",
                sanitized);
        assertFalse(sanitized.contains(SECRET));
    }

    @Test
    public void queryTokenAtEndIsRedacted() {
        String sanitized = RequestLogSanitizer.sanitizeUri(
                "http://localhost:9191/api/1/monitoring/status?site=editorial&TOKEN=" + SECRET);

        assertEquals("http://localhost:9191/api/1/monitoring/status?site=editorial&TOKEN=" + RequestLogSanitizer.REDACTED,
                sanitized);
        assertFalse(sanitized.contains(SECRET));
    }

    @Test
    public void uriWithoutTokenIsUnchanged() {
        String uri = "http://localhost:9191/api/1/target/get-all";

        assertEquals(uri, RequestLogSanitizer.sanitizeUri(uri));
    }

    @Test
    public void credentialHeadersAreRedacted() {
        HttpHeaders headers = new HttpHeaders();
        headers.add(ManagementToken.HEADER_NAME, SECRET);
        headers.add(HttpHeaders.AUTHORIZATION, "Bearer " + SECRET);
        headers.add(HttpHeaders.CONTENT_TYPE, "application/json");

        HttpHeaders sanitized = RequestLogSanitizer.sanitizeHeaders(headers);

        assertEquals(RequestLogSanitizer.REDACTED, sanitized.getFirst(ManagementToken.HEADER_NAME));
        assertEquals(RequestLogSanitizer.REDACTED, sanitized.getFirst(HttpHeaders.AUTHORIZATION));
        assertEquals("application/json", sanitized.getFirst(HttpHeaders.CONTENT_TYPE));
        assertFalse(sanitized.toString().contains(SECRET));
    }

    @Test
    public void cookieAndProxyAuthorizationAreRedacted() {
        String cookieSecret = "cookie-session-secret";
        String secondCookieSecret = "cookie-csrf-secret";
        String proxySecret = "proxy-basic-secret";
        String secondProxySecret = "proxy-bearer-secret";
        HttpHeaders headers = new HttpHeaders();
        headers.add("CoOkIe", "session=" + cookieSecret);
        headers.add("CoOkIe", "csrf=" + secondCookieSecret);
        headers.add("pRoXy-AuThOrIzAtIoN", "Basic " + proxySecret);
        headers.add("pRoXy-AuThOrIzAtIoN", "Bearer " + secondProxySecret);
        headers.add(ManagementToken.HEADER_NAME, SECRET);
        headers.add(HttpHeaders.AUTHORIZATION, "Bearer " + SECRET);
        headers.add(HttpHeaders.ACCEPT, "text/html");
        headers.add(HttpHeaders.ACCEPT, "application/json");

        HttpHeaders sanitized = RequestLogSanitizer.sanitizeHeaders(headers);

        assertEquals(List.of(RequestLogSanitizer.REDACTED, RequestLogSanitizer.REDACTED), sanitized.get("cookie"));
        assertEquals(List.of(RequestLogSanitizer.REDACTED, RequestLogSanitizer.REDACTED),
                sanitized.get("PROXY-AUTHORIZATION"));
        assertEquals(RequestLogSanitizer.REDACTED, sanitized.getFirst(ManagementToken.HEADER_NAME));
        assertEquals(RequestLogSanitizer.REDACTED, sanitized.getFirst(HttpHeaders.AUTHORIZATION));
        assertEquals(List.of("text/html", "application/json"), sanitized.get(HttpHeaders.ACCEPT));
        assertFalse(sanitized.toString().contains(cookieSecret));
        assertFalse(sanitized.toString().contains(secondCookieSecret));
        assertFalse(sanitized.toString().contains(proxySecret));
        assertFalse(sanitized.toString().contains(secondProxySecret));
        assertFalse(sanitized.toString().contains(SECRET));
    }

}
