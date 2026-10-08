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
package org.craftercms.studio.api.v2.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.Before;
import org.junit.Test;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.DefaultCsrfToken;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class StudioCsrfTokenRequestHandlerTest {

	private StudioCsrfTokenRequestHandler handler;
	private CsrfToken csrfToken;
	private HttpServletRequest request;

	@Before
	public void setUp() {
		handler = new StudioCsrfTokenRequestHandler();
		csrfToken = new DefaultCsrfToken("X-XSRF-TOKEN", "_csrf", "12345678-1234-1234-1234-123456789abc");
		request = mock(HttpServletRequest.class);
	}

	@Test
	public void testResolveCsrfTokenValueWithNullToken() {
		when(request.getHeader("X-XSRF-TOKEN")).thenReturn(null);
		when(request.getParameter("_csrf")).thenReturn(null);

		String resolved = handler.resolveCsrfTokenValue(request, csrfToken);
		assertNull(resolved);
	}

	@Test
	public void testResolveCsrfTokenValueWithRawToken() {
		String rawToken = "12345678-1234-1234-1234-123456789abc";
		when(request.getHeader("X-XSRF-TOKEN")).thenReturn(rawToken);

		String resolved = handler.resolveCsrfTokenValue(request, csrfToken);
		assertEquals(rawToken, resolved);
	}
}
