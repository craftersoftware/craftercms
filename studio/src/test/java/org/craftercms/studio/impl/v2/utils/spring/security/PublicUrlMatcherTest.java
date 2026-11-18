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

package org.craftercms.studio.impl.v2.utils.spring.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.Before;
import org.junit.Test;
import org.springframework.context.support.GenericXmlApplicationContext;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.web.util.matcher.RequestMatcher;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * Loads {@code studio.security.publicUrls} through {@code StudioConfigurationImpl} and builds
 * {@code publicUrlMatcher} the same way the security context does, including the comma split
 * Spring applies to the {@code patterns} constructor argument.
 */
public class PublicUrlMatcherTest {

	private RequestMatcher publicUrlMatcher;

	@Before
	public void setUp() {
		GenericXmlApplicationContext context = new GenericXmlApplicationContext();
		context.load("classpath:crafter/studio/security/public-url-matcher-test-context.xml");
		context.refresh();
		try {
			publicUrlMatcher = context.getBean("publicUrlMatcher", RequestMatcher.class);
		} finally {
			context.close();
		}
	}

	@Test
	public void testPluginScriptReloadIsPublic() {
		assertMatches("/api/2/plugin/mysite/script/reload");
		assertMatches("/api/2/plugin/mysite/script/reload?token=management-token");
		assertMatches("/api/2/plugin/mysite/script/reload.json");
		assertMatches("/api/2/plugin/mysite/script/reload.json?token=management-token");
	}

	@Test
	public void testOtherPluginScriptUrlsAreNotPublic() {
		assertDoesNotMatch("/api/2/plugin/mysite/script/admin?x=/script/reload");
		assertDoesNotMatch("/api/2/plugin/mysite/script/foo/script/reload");
		assertDoesNotMatch("/api/2/plugin/mysite/script/reload/anything");
	}

	private void assertMatches(String url) {
		assertTrue(url + " should be public", publicUrlMatcher.matches(requestFor(url)));
	}

	private void assertDoesNotMatch(String url) {
		assertFalse(url + " should not be public", publicUrlMatcher.matches(requestFor(url)));
	}

	/**
	 * RegexRequestMatcher compares the pattern to servletPath + pathInfo + query string.
	 */
	private static HttpServletRequest requestFor(String url) {
		String path = url;
		String query = null;
		int queryIndex = url.indexOf('?');
		if (queryIndex >= 0) {
			path = url.substring(0, queryIndex);
			query = url.substring(queryIndex + 1);
		}
		MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
		request.setServletPath(path);
		request.setPathInfo(null);
		request.setQueryString(query);
		return request;
	}

}
