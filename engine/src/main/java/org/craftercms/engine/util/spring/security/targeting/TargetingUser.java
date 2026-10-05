/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.engine.util.spring.security.targeting;

import java.util.Collection;
import java.util.Map;

import org.craftercms.engine.util.spring.security.profile.ProfileUser;
import org.springframework.security.core.GrantedAuthority;

/**
 * {@link ProfileUser} used for Studio targeting.
 *
 * @author joseross
 * @since 3.1.9
 */
public class TargetingUser extends ProfileUser {

    public TargetingUser(final String username,
                         final Collection<? extends GrantedAuthority> authorities,
                         final Map<String, Object> attributes) {
        super(username, "N/A", authorities);
        setAttributes(attributes);
    }

}
