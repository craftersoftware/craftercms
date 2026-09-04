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
package org.craftercms.studio.impl.v2.security.authentication.db;

import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.model.AuthenticatedUser;
import org.craftercms.studio.model.AuthenticationType;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;

/**
 * Extension of {@link DaoAuthenticationProvider} that returns an instance of {@link AuthenticatedUser}
 *
 * @author joseross
 * @since 4.0
 */
public class DbAuthenticationProvider extends DaoAuthenticationProvider {
	public DbAuthenticationProvider(final UserDetailsService userDetailsService) {
		super(userDetailsService);
	}

    @Override
    protected Authentication createSuccessAuthentication(Object principal, Authentication authentication,
                                                         UserDetails user) {
        var authenticatedUser = new AuthenticatedUser((User) principal);
        authenticatedUser.setAuthenticationType(AuthenticationType.DB);

        return super.createSuccessAuthentication(authenticatedUser, authentication, user);
    }

}
