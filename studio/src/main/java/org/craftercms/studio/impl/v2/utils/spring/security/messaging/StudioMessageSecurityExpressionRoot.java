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
package org.craftercms.studio.impl.v2.utils.spring.security.messaging;

import java.util.function.Supplier;

import org.craftercms.studio.api.v2.service.security.SecurityService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.security.core.Authentication;
import org.springframework.security.messaging.access.expression.MessageSecurityExpressionRoot;

/**
 * Extension of {@link MessageSecurityExpressionRoot} that adds Studio specific security expressions.
 *
 * @author joseross
 * @since 4.0.0
 */
public class StudioMessageSecurityExpressionRoot<T> extends MessageSecurityExpressionRoot<T> {

    private static final Logger logger = LoggerFactory.getLogger(StudioMessageSecurityExpressionRoot.class);
    protected final SecurityService securityService;

    public StudioMessageSecurityExpressionRoot(Supplier<? extends Authentication> authentication, Message<T> message,
                                               SecurityService securityService) {
        super(authentication, message);
        this.securityService = securityService;
    }

    /**
     * Checks if the current user has the {@code system_admin} role
     */
    public boolean isSystemAdmin() {
        return securityService.isSystemAdmin(getAuthentication().getName());
    }

    /**
     * Checks if the current user belongs to any group in the given site
     *
     * @param siteId the id of the site to check
     */
    public boolean isSiteMember(String siteId) {
        return securityService.isSiteMember(getAuthentication().getName(), siteId);
    }

}
