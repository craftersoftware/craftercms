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

import org.craftercms.engine.util.spring.security.profile.ProfileUser;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Authenticates properties-backed users and exposes them as {@link ProfileUser} principals.
 */
public class PropertiesAuthenticationProvider extends DaoAuthenticationProvider {

	public PropertiesAuthenticationProvider(final UserDetailsService userDetailsService,
	                                        final PasswordEncoder passwordEncoder) {
		super(userDetailsService);
		setPasswordEncoder(passwordEncoder);
	}

	@Override
	protected Authentication createSuccessAuthentication(final Object principal,
	                                                     final Authentication authentication,
	                                                     final UserDetails user) {
		ProfileUser profileUser = user instanceof ProfileUser
			? (ProfileUser) user
			: new ProfileUser(user);
		Authentication successAuthentication =
			super.createSuccessAuthentication(profileUser, authentication, profileUser);
		profileUser.setAuthentication(successAuthentication);
		return successAuthentication;
	}

}
