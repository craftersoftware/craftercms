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

package org.craftercms.studio.api.v2.security;

import java.util.Collection;
import java.util.List;
import java.util.Set;

import org.craftercms.studio.api.v2.dal.Group;
import org.craftercms.studio.api.v2.dal.publish.PublishItem;

/**
 * Read-only mapping of user groups to available actions for a given site.
 */
public interface SitePermissionMappings {

	/**
	 * Get the available actions for a given user and path.
	 * The available actions are calculated by merging the available actions for all roles the user belongs to.
	 *
	 * @param username username of the user
	 * @param groups   groups the user belongs to
	 * @param path     path of the content
	 * @return available actions bitmap
	 */
	long getAvailableActions(String username, List<Group> groups, String path);

	/**
	 * Get the site wide available actions for a given user.
	 * Site-wide actions are performed on the item-level, but are allowed on site-wide
	 * permissions. e.g.: publish_review permission will allow PUBLISH_REVIEW
	 * action for any item in the site
	 *
	 * @param username username of the user
	 * @param groups groups the user belongs to
	 * @param isSystemAdmin true if the user is a system admin, false otherwise
	 * @return available actions bitmap
	 */
	long getSiteWideItemAvailableActions(String username, List<Group> groups, boolean isSystemAdmin);

	/**
	 * Get the actions a user has permissions to perform on publish packages
	 *
	 * @param username username of the user
	 * @param groups groups the user belongs to
	 * @param publishItems the publish items
	 * @param isSystemAdmin true if the user is a system admin, false otherwise
	 * @return available actions bitmap
	 */
	long getPublishPackageAvailableActions(String username, List<Group> groups, Collection<PublishItem> publishItems, boolean isSystemAdmin);

	/**
	 * Check if the user is a site admin
	 * @param username username of the user
	 * @param groups groups the user belongs to
	 * @return true if the user is a site admin, false otherwise
	 */
	boolean isSiteAdmin(String username, Collection<Group> groups);

	/**
	 * Get all permissions for a given user.
	 * @param username username of the user
	 * @param groups groups the user belongs to
	 * @param isSystemAdmin true if the user is a system admin, false otherwise
	 * @return list of permissions
	 */
	Set<String> getUserPermissions(String username, Collection<Group> groups, boolean isSystemAdmin);

	/**
	 * Get the permissions for a given user and path.
	 *
	 * @param username username of the user
	 * @param groups groups the user belongs to
	 * @param path path of the content
	 * @param isSystemAdmin true if the user is a system admin, false otherwise
	 * @return set of permissions
	 */
	Set<String> getUserPermissions(String username, Collection<Group> groups, String path, boolean isSystemAdmin);

}
