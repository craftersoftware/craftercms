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

package org.craftercms.studio.controller.rest.v2;

public final class RequestMappingConstants {

    public static final String ALL_SUB_URLS = "/**";

    /** API 2 Root */
    public static final String API_2 = "/api/2";

    /** Proxy Controller */
    public static final String PROXY_ENGINE = "/engine";

    /** Dashboard Controller */
    public static final String DASHBOARD = "/dashboard";
    public static final String ACTIVITY = "/activity";
    public static final String PENDING_APPROVAL = "/pending_approval";
    public static final String UNPUBLISHED = "/unpublished";
    public static final String PUBLISHING = "/publishing";
    public static final String SCHEDULED = "/scheduled";
    public static final String STATS = "/stats";
    public static final String EXPIRING = "/expiring";
    public static final String EXPIRED = "/expired";

    /** Content controller */
    public static final String CONTENT = "/content";
    public static final String LIST_QUICK_CREATE_CONTENT = "/list_quick_create_content";
    public static final String GET_DELETE_PACKAGE = "/get_delete_package";
    public static final String DELETE = "/delete";
    public static final String GET_CHILDREN_BY_PATH = "/children_by_path";
    public static final String GET_CHILDREN_BY_PATHS = "/{siteId}/children";
    public static final String GET_DESCRIPTOR = "/descriptor";
    public static final String PASTE_ITEMS = "/paste";
    public static final String DUPLICATE_ITEM = "/duplicate";
    public static final String EXISTS = "/exists";
    public static final String ITEM_BY_PATH = "/item_by_path";
    public static final String SANDBOX_ITEMS_BY_PATH = "/sandbox_items_by_path";
    public static final String ITEM_LOCK_BY_PATH = "/item_lock_by_path";
    public static final String ITEM_UNLOCK_BY_PATH = "/item_unlock_by_path";
    public static final String GET_CONTENT_BY_COMMIT_ID = "/get_content_by_commit_id";
    public static final String RENAME = "/rename";
    public static final String ITEM_HISTORY = "/item_history";

    /** Groups controller */
    public static final String GROUPS = "/groups";
    public static final String MEMBERS = "/members";

    /** Users controller */
    public static final String USERS = "/users";
    public static final String PATH_PARAM_ID = "/{id}";
    public static final String ENABLE = "/enable";
    public static final String DISABLE = "/disable";
    public static final String SITES = "/sites";
    public static final String MANAGEMENT_SITES = "/management/sites";
    public static final String PATH_PARAM_SITE = "/{site}";
    public static final String ROLES = "/roles";
    public static final String ME = "/me";
    public static final String LOGOUT_SSO_URL = "/logout/sso/url";
    public static final String FORGOT_PASSWORD = "/forgot_password";
    public static final String CHANGE_PASSWORD = "/change_password";
    public static final String SET_PASSWORD = "/set_password";
    public static final String RESET_PASSWORD = "/reset_password";
    public static final String VALIDATE_TOKEN = "/validate_token";
    public static final String PROPERTIES = "/properties";
    public static final String PERMISSIONS = "/permissions";
    public static final String HAS_PERMISSIONS = "/has_permissions";
    public static final String GLOBAL = "/global";

    /** Repository Management controller **/
    public static final String REPOSITORY = "/repository";
    public static final String ADD_REMOTE = "/add_remote";
    public static final String LIST_REMOTES = "/list_remotes";
    public static final String PULL_FROM_REMOTE = "/pull_from_remote";
    public static final String PUSH_TO_REMOTE = "/push_to_remote";
    public static final String REMOVE_REMOTE = "/remove_remote";
    public static final String STATUS = "/status";
    public static final String RESOLVE_CONFLICT = "/resolve_conflict";
    public static final String DIFF_CONFLICTED_FILE = "/diff_conflicted_file";
    public static final String COMMIT_RESOLUTION = "/commit_resolution";
    public static final String CANCEL_FAILED_PULL = "/cancel_failed_pull";
    public static final String UNLOCK = "/unlock";

    /** Audit controller */
    public static final String AUDIT = "/audit";

    public static final String CORRUPTED = "/corrupted";

    public static final String REPAIR = "/repair";

    /** Publish Controller */
    public static final String PUBLISH = "/publish";
    public static final String PACKAGES = "/packages";
    public static final String PACKAGE = "/package";
    public static final String CANCEL = "/cancel";
    public static final String HISTORY = "/history";
    public static final String AVAILABLE_TARGETS = "/available_targets";
    public static final String HAS_INITIAL_PUBLISH = "/has_initial_publish";

    /** Dependency Controller */
    public static final String DEPENDENCY = "/dependency";
    public static final String DEPENDENCIES = "/dependencies";
    public static final String DEPENDENT_ITEMS = "/dependent_items";

    /** Workflow Controller */
    public static final String WORKFLOW = "/workflow";
    public static final String ITEM_STATES = "/item_states";
    public static final String UPDATE_ITEM_STATES_BY_QUERY = "/update_item_states_by_query";
    public static final String AFFECTED_PATHS = "/affected_paths";
    public static final String REQUEST_PUBLISH = "/request_publish";
    public static final String REJECT = "/reject";
    public static final String APPROVE = "/approve";

	/**
	 * System Controller
	 */
	public static final String SYSTEM = "/system";

     public static final String LOG_MONITOR_ENGINE_PROXY = "/api/1/monitoring/log.json";

    private RequestMappingConstants() {
    }
}
