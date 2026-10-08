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
package org.craftercms.commons.rest;

/**
 * Request credentials used to call management APIs.
 */
public final class ManagementToken {

    /**
     * Header carrying the Crafter management token for target operations.
     */
    public static final String HEADER_NAME = "X-Crafter-Management-Token";

    /**
     * Query parameter still used by management APIs that have not moved to {@link #HEADER_NAME}.
     * Deployer target operations do not accept this parameter.
     */
    public static final String QUERY_PARAMETER = "token";

    private ManagementToken() {
    }

}
