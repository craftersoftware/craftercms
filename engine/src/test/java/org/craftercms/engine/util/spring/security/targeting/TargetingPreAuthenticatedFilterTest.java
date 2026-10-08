/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as published by
 * the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

package org.craftercms.engine.util.spring.security.targeting;

import java.util.HashMap;
import java.util.Map;

import org.junit.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;

import static org.craftercms.engine.controller.rest.preview.ProfileRestController.PROFILE_SESSION_ATTRIBUTE;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class TargetingPreAuthenticatedFilterTest {

	private final TargetingPreAuthenticatedFilter filter = new TargetingPreAuthenticatedFilter();

	@Test
	public void testRoleChangeIsPrincipalChange() {
		Authentication current = authenticate(requestWithRoles("ROLE_A"));

		assertTrue(filter.principalChanged(requestWithRoles("ROLE_B"), current));
	}

	@Test
	public void testSameRolesIsNotPrincipalChange() {
		Authentication current = authenticate(requestWithRoles("ROLE_A, ROLE_B"));

		assertFalse(filter.principalChanged(requestWithRoles("ROLE_B,ROLE_A"), current));
	}

	private Authentication authenticate(MockHttpServletRequest request) {
		Object principal = filter.getPreAuthenticatedPrincipal(request);
		return new PreAuthenticatedAuthenticationToken(principal, "N/A",
			((TargetingUser) principal).getAuthorities());
	}

	private MockHttpServletRequest requestWithRoles(String roles) {
		Map<String, Object> profile = new HashMap<>();
		profile.put("segment", "test");
		profile.put("roles", roles);
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.getSession().setAttribute(PROFILE_SESSION_ATTRIBUTE, profile);
		return request;
	}

}
