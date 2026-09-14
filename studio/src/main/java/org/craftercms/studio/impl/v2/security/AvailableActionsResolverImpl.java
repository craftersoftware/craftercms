/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.impl.v2.security;

import java.util.List;

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.dal.Group;
import org.craftercms.studio.api.v2.security.AvailableActionsResolver;
import org.craftercms.studio.api.v2.security.PermissionMappingsProvider;
import org.craftercms.studio.api.v2.security.SitePermissionMappings;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Default implementation of {@link AvailableActionsResolver}
 */
public class AvailableActionsResolverImpl implements AvailableActionsResolver {

	private static final Logger logger = LoggerFactory.getLogger(AvailableActionsResolverImpl.class);

	private final UserService userService;
	private final PermissionMappingsProvider permissionMappingsProvider;

	public AvailableActionsResolverImpl(UserService userService,
										PermissionMappingsProvider permissionMappingsProvider) {
		this.userService = userService;
		this.permissionMappingsProvider = permissionMappingsProvider;
	}

	@Override
	public long getContentItemAvailableActions(String username, String siteId, String path)
		throws ServiceLayerException, UserNotFoundException {
		SitePermissionMappings sitePermissionMappings = permissionMappingsProvider.getPermissionMappings(siteId);
		return calculateAvailableActions(username, path, sitePermissionMappings);
	}

	@Override
	public long getSiteWideActions(String siteId, String username) throws ServiceLayerException, UserNotFoundException {
		List<Group> groups = userService.getUserGroups(-1, username);
		SitePermissionMappings sitePermissionMappings = permissionMappingsProvider.getPermissionMappings(siteId);
		return sitePermissionMappings.getSiteWideItemAvailableActions(username, groups, userService.isSystemAdmin(username));
	}

	private long calculateAvailableActions(String username, String path,
										   SitePermissionMappings sitePermissionMappings)
		throws ServiceLayerException, UserNotFoundException {
		List<Group> groups = userService.getUserGroups(-1, username);
		return sitePermissionMappings.getAvailableActions(username, groups, path);
	}

}
