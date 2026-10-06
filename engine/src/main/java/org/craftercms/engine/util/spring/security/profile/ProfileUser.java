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

package org.craftercms.engine.util.spring.security.profile;

import java.util.Collection;
import java.util.Set;

import org.craftercms.engine.util.spring.security.CustomUser;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import static java.util.stream.Collectors.toSet;

/**
 * {@link CustomUser} principal used by Engine authentication.
 *
 * <p>The wrapped user now comes from Engine's properties file instead of
 * Crafter Profile.</p>
 */
public class ProfileUser extends CustomUser {

	private Authentication authentication;

	public ProfileUser(final UserDetails user) {
		super(user.getUsername(), user.getPassword(), user.isEnabled(),
			user.isAccountNonExpired(), user.isCredentialsNonExpired(), user.isAccountNonLocked(),
			user.getAuthorities());
		if (user instanceof CustomUser customUser) {
			setAttributes(customUser.getAttributes());
		}
	}

	public ProfileUser(final String username, final String password,
	                   final Collection<? extends GrantedAuthority> authorities) {
		super(username, password, authorities);
	}

	public Authentication getAuthentication() {
		return authentication;
	}

	public void setAuthentication(final Authentication authentication) {
		this.authentication = authentication;
	}

	/**
	 * Preserves the legacy model property while Profile is represented by this principal.
	 */
	public ProfileUser getProfile() {
		return this;
	}

	public Set<String> getRoles() {
		return getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(toSet());
	}

}
