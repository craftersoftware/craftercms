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
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;

/**
 * Loads Engine users from Spring Security's standard user properties format.
 */
public class PropertiesUserDetailsService extends InMemoryUserDetailsManager {

	public PropertiesUserDetailsService(final Properties users) {
		super(users);
	}

	@Override
	public UserDetails loadUserByUsername(final String username) {
		return new ProfileUser(super.loadUserByUsername(username));
	}

}
