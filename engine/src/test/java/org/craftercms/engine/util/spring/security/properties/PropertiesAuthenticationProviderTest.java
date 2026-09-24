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

package org.craftercms.engine.util.spring.security.properties;

import java.util.Properties;

import org.craftercms.engine.util.spring.security.profile.ProfileUser;
import org.junit.Before;
import org.junit.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class PropertiesAuthenticationProviderTest {

	private PropertiesUserDetailsService userDetailsService;
	private PropertiesAuthenticationProvider authenticationProvider;

	@Before
	public void setUp() {
		Properties users = new Properties();
		users.setProperty("user", "{noop}password,ROLE_USER");
		userDetailsService = new PropertiesUserDetailsService(users);
		authenticationProvider = new PropertiesAuthenticationProvider(
			userDetailsService, PasswordEncoderFactories.createDelegatingPasswordEncoder());
	}

	@Test
	public void testLoadsProfileUser() {
		UserDetails user = userDetailsService.loadUserByUsername("user");

		assertTrue(user instanceof ProfileUser);
		assertEquals("ROLE_USER", user.getAuthorities().iterator().next().getAuthority());
	}

	@Test
	public void testAuthenticatesAsProfileUser() {
		Authentication authentication = authenticationProvider.authenticate(
			UsernamePasswordAuthenticationToken.unauthenticated("user", "password"));

		assertTrue(authentication.isAuthenticated());
		assertTrue(authentication.getPrincipal() instanceof ProfileUser);
		assertEquals("user", authentication.getName());
	}

	@Test(expected = UsernameNotFoundException.class)
	public void testMissingUser() {
		userDetailsService.loadUserByUsername("missing");
	}

}
