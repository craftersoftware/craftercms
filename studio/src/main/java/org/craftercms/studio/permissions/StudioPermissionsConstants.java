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

package org.craftercms.studio.permissions;

import java.util.Set;

public final class StudioPermissionsConstants {

	// TODO: find better way
	//  All values are lower case (configuration has mixed case)
	public static final String PERMISSION_ADD_REMOTE = "add_remote";
	public static final String PERMISSION_AUDIT_LOG = "audit_log";
	public static final String PERMISSION_CANCEL_FAILED_PULL = "cancel_failed_pull";
	public static final String PERMISSION_COMMIT_RESOLUTION = "commit_resolution";
	public static final String PERMISSION_CONTENT_CREATE = "content_create";
	public static final String PERMISSION_FOLDER_CREATE = "folder_create";
	public static final String PERMISSION_CREATE_GROUPS = "create_groups";
	public static final String PERMISSION_CREATE_USERS = "create_users";
	public static final String PERMISSION_CREATE_SITE = "create_site";
	public static final String PERMISSION_DUPLICATE_SITE = "duplicate_site";
	public static final String PERMISSION_DELETE_SITE = "delete_site";
	public static final String PERMISSION_CONTENT_DELETE = "content_delete";
	public static final String PERMISSION_DELETE_GROUPS = "delete_groups";
	public static final String PERMISSION_DELETE_USERS = "delete_users";
	public static final String PERMISSION_EDIT_SITE = "edit_site";
	public static final String PERMISSION_ENCRYPTION_TOOL = "encryption_tool";
	public static final String PERMISSION_GET_CHILDREN = "get_children";
	public static final String PERMISSION_LIST_REMOTES = "list_remotes";

	public static final String PERMISSION_PUBLISH_STATUS = "publish_status";
	public static final String PERMISSION_PUBLISH_CANCEL = "publish_cancel";
	public static final String PERMISSION_PUBLISH_REVIEW = "publish_review";
	public static final String PERMISSION_PUBLISH_REQUEST = "publish_request";
	public static final String PERMISSION_PUBLISH_GET_QUEUE = "publish_get_queue";
	public static final String PERMISSION_START_STOP_PUBLISHER = "start_stop_publisher";

	public static final String PERMISSION_PULL_FROM_REMOTE = "pull_from_remote";
	public static final String PERMISSION_PUSH_TO_REMOTE = "push_to_remote";
	public static final String PERMISSION_CONTENT_READ = "content_read";
	public static final String PERMISSION_CONTENT_COPY = "content_copy";
	public static final String PERMISSION_READ_CLUSTER = "read_cluster";
	public static final String PERMISSION_READ_GROUPS = "read_groups";
	public static final String PERMISSION_READ_USERS = "read_users";
	public static final String PERMISSION_REMOVE_REMOTE = "remove_remote";
	public static final String PERMISSION_RESOLVE_CONFLICT = "resolve_conflict";
	public static final String PERMISSION_S3_READ = "s3_read";
	public static final String PERMISSION_S3_WRITE = "s3_write";
	public static final String PERMISSION_SITE_DIFF_CONFLICTED_FILE = "site_diff_conflicted_file";
	public static final String PERMISSION_SITE_STATUS = "site_status";
	public static final String PERMISSION_UPDATE_GROUPS = "update_groups";
	public static final String PERMISSION_UPDATE_USERS = "update_users";
	public static final String PERMISSION_WEBDAV_READ = "webdav_read";
	public static final String PERMISSION_WEBDAV_WRITE = "webdav_write";
	public static final String PERMISSION_CONTENT_WRITE = "content_write";
	public static final String PERMISSION_WRITE_CONFIGURATION = "write_configuration";
	public static final String PERMISSION_READ_CONFIGURATION = "read_configuration";
	public static final String PERMISSION_WRITE_GLOBAL_CONFIGURATION = "write_global_configuration";
	public static final String PERMISSION_SEARCH_PLUGINS = "search_plugins";
	public static final String PERMISSION_LIST_PLUGINS = "list_plugins";
	public static final String PERMISSION_INSTALL_PLUGINS = "install_plugins";
	public static final String PERMISSION_REMOVE_PLUGINS = "remove_plugins";
	public static final String PERMISSION_ITEM_UNLOCK = "item_unlock";

	public static final String PERMISSION_CONTENT_SEARCH = "content_search";

	public static final String PERMISSION_VIEW_LOGS = "view_logs";
	public static final String PERMISSION_VIEW_LOG_LEVELS = "view_log_levels";
	public static final String PERMISSION_CONFIGURE_LOG_LEVELS = "configure_log_levels";
	public static final String PERMISSION_UNLOCK_REPO = "unlock_repository";
	public static final String PERMISSION_REPAIR_REPOSITORY = "repair_repository";

	public static final String PERMISSION_MANAGE_ACCESS_TOKEN = "manage_access_token";

	public static final String PERMISSION_SET_ITEM_STATES = "set_item_states";

	public static final String PERMISSION_MANAGE_SYSTEM_PROPERTIES = "system_properties_manage";
	public static final String PERMISSION_READ_SYSTEM_PROPERTIES = "system_properties_read";

	public static final String SITE_ID_RESOURCE_ID = "siteId";
	public static final String PATH_RESOURCE_ID = "path";
	public static final String PATH_LIST_RESOURCE_ID = "pathList";
	public static final String DEFAULT_PATH_RESOURCE_VALUE = "/";

	public static final Set<String> SITE_WIDE_RULE_REGEXES = Set.of(".*", "/.*");


	private StudioPermissionsConstants() {
	}
}
