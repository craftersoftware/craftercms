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

package org.craftercms.studio.api.v2.service.ui;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.model.ui.MenuItem;
import org.craftercms.studio.model.ui.UiBootstrap;

import java.util.List;

/**
 * Service that provides the UI elements the current user has access to.
 *
 * @author avasquez
 */
public interface UiService {

	/**
	 * Returns the global menu items available to the current user.
	 *
	 * @return the list of menu items
	 * @throws AuthenticationException if not user is logged in
	 * @throws ServiceLayerException   if another error occurs
	 */
	List<MenuItem> getGlobalMenu() throws AuthenticationException, ServiceLayerException, UserNotFoundException;

	/**
	 * Returns the active environment.
	 *
	 * @return active environment
	 * @throws AuthenticationException authentication error
	 */
	String getActiveEnvironment() throws AuthenticationException;

	/**
	 * Returns the server-derived context required to start a Studio UI application.
	 *
	 * @param request current HTTP request
	 * @param response current HTTP response
	 * @return bootstrap context; user and site fields are empty when there is no authenticated user
	 */
	UiBootstrap getBootstrap(HttpServletRequest request, HttpServletResponse response)
		throws AuthenticationException, ServiceLayerException, UserNotFoundException;

}
