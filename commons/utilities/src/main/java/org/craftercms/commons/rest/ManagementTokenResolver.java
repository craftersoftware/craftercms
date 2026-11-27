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

import jakarta.servlet.http.HttpServletRequest;

/**
 * Resolves the management token from a request.
 * <p>
 * The {@link ManagementToken#HEADER_NAME} header is checked first. When that header is present, including when
 * its value is blank or does not match the configured token, the query parameter is not consulted.
 * The {@link ManagementToken#QUERY_PARAMETER} query parameter is used only when the header is absent.
 * The resolved value is not logged.
 */
public final class ManagementTokenResolver {

    private ManagementTokenResolver() {
    }

    /**
     * @param request the current request, or null
     * @return the header value when the header is present, otherwise the query value, or null when neither is present
     */
    public static String resolve(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String header = request.getHeader(ManagementToken.HEADER_NAME);
        if (header != null) {
            return header;
        }
        return request.getParameter(ManagementToken.QUERY_PARAMETER);
    }

}
