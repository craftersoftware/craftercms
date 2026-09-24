/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.apache.commons.lang.StringUtils;
import org.craftercms.engine.controller.rest.preview.ProfileRestController;
import org.craftercms.engine.util.spring.security.ConfigAwarePreAuthenticationFilter;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.*;

import static org.apache.commons.collections4.MapUtils.isNotEmpty;

/**
 * Implementation of {@link ConfigAwarePreAuthenticationFilter} for Studio targeting
 *
 * @author joseross
 * @since 3.1.5
 */
public class TargetingPreAuthenticatedFilter extends ConfigAwarePreAuthenticationFilter {

    public TargetingPreAuthenticatedFilter() {
        // always enabled
        super(null);
        setAlwaysEnabled(true);
        setSupportedPrincipalClass(TargetingUser.class);

        setCheckForPrincipalChanges(true);
    }

    @Override
    @SuppressWarnings("unchecked")
    protected Object getPreAuthenticatedPrincipal(final HttpServletRequest request) {
        HttpSession session = request.getSession();
        if (session != null) {
            Map<String, Object> attributes = (Map<String, Object>)
                session.getAttribute(ProfileRestController.PROFILE_SESSION_ATTRIBUTE);

            if (isNotEmpty(attributes)) {
                if (logger.isDebugEnabled()) {
                    logger.debug("Non-anonymous persona set: " + attributes);
                }

                Object rolesAttr = attributes.get("roles");
                String[] roles = null;
                if (rolesAttr instanceof String[]) {
                    roles = (String[]) rolesAttr;
                } else if (rolesAttr instanceof ArrayList<?>) {
                    roles = ((ArrayList<?>) rolesAttr).toArray(new String[0]);
                } else if (rolesAttr instanceof String) {
                    roles = ((String) rolesAttr).split(",");
                }
                Collection<SimpleGrantedAuthority> authorities = roles == null
                    ? List.of()
                    : Arrays.stream(roles)
                        .filter(StringUtils::isNotBlank)
                        .map(SimpleGrantedAuthority::new)
                        .toList();

                Map<String, Object> customAttributes = new HashMap<>(attributes);
                customAttributes.remove("id");
                customAttributes.remove("username");
                customAttributes.remove("roles");

                return new TargetingUser("preview", authorities, customAttributes);
            }
        }
        if (logger.isDebugEnabled()) {
            logger.debug("No persona set. Trying to resolve authentication normally");
        }
        return null;
    }

    @Override
    protected Object getPreAuthenticatedCredentials(final HttpServletRequest request) {
        return "N/A";
    }
    
}
