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

package org.craftercms.studio.api.v2.dal;

public abstract class AuditLogConstants {

	/**
	 * Operation
	 **/
	public static final String OPERATION_CREATE = "CREATE";
	public static final String OPERATION_DUPLICATE = "DUPLICATE";
	public static final String OPERATION_UPDATE = "UPDATE";
	public static final String OPERATION_START_DELETE = "START_DELETE";
	public static final String OPERATION_DELETE = "DELETE";
	public static final String OPERATION_MOVE = "MOVE";
	public static final String OPERATION_ADD_MEMBERS = "ADD_MEMBERS";
	public static final String OPERATION_REMOVE_MEMBERS = "REMOVE_MEMBERS";
	public static final String OPERATION_LOGIN = "LOGIN";
	public static final String OPERATION_LOGIN_FAILED = "LOGIN_FAILED";
	public static final String OPERATION_SESSION_TIMEOUT = "SESSION_TIMEOUT";
	public static final String OPERATION_LOGOUT = "LOGOUT";
	public static final String OPERATION_ADD_REMOTE = "ADD_REMOTE";
	public static final String OPERATION_REMOVE_REMOTE = "REMOVE_REMOTE";
	public static final String OPERATION_PUSH_TO_REMOTE = "PUSH_TO_REMOTE";
	public static final String OPERATION_PULL_FROM_REMOTE = "PULL_FROM_REMOTE";
	public static final String OPERATION_REQUEST_PUBLISH = "REQUEST_PUBLISH";
	public static final String OPERATION_APPROVE_SCHEDULED = "APPROVE_SCHEDULED";
	public static final String OPERATION_ITEM_LIST_PUBLISHED = "PUBLISH_ITEM_LIST_COMPLETE";
	public static final String OPERATION_REVERT = "REVERT";
	public static final String OPERATION_ENABLE = "ENABLE";
	public static final String OPERATION_DISABLE = "DISABLE";
	public static final String OPERATION_START_PUBLISHER = "START_PUBLISHER";
	public static final String OPERATION_STOP_PUBLISHER = "STOP_PUBLISHER";
	public static final String OPERATION_APPROVE_PUBLISH_PACKAGE = "APPROVE_PUBLISH_PACKAGE";
	public static final String OPERATION_CANCEL_PUBLISH_PACKAGE = "CANCEL_PUBLISH_PACKAGE";
	public static final String OPERATION_REJECT_PUBLISH_PACKAGE = "REJECT_PUBLISH_PACKAGE";
	public static final String OPERATION_PUBLISH = "PUBLISH";
	public static final String OPERATION_INITIAL_PUBLISH = "INITIAL_PUBLISH_COMPLETE";
	public static final String OPERATION_SYSTEM_PROPERTY_UPDATE = "SYSTEM_PROPERTY_UPDATE";
	public static final String OPERATION_PUBLISH_START = "PUBLISH_START";
	public static final String OPERATION_PUBLISH_ALL = "PUBLISH_ALL_COMPLETE";
	public static final String OPERATION_GIT_CHANGES = "GIT_SYNC";
	public static final String OPERATION_UNKNOWN = "UNKNOWN";

	public static final String ACTOR_ID_GIT = "GIT";

	/**
	 * Origin
	 **/
	public static final String ORIGIN_API = "API";
	public static final String ORIGIN_GIT = "GIT";

	/**
	 * Target Type
	 **/
	public static final String TARGET_TYPE_USER = "User";
	public static final String TARGET_TYPE_SITE = "Site";
	public static final String TARGET_TYPE_GROUP = "Group";
	public static final String TARGET_TYPE_FOLDER = "Folder";
	public static final String TARGET_TYPE_CONTENT_ITEM = "Content Item";
	// Audit log parameter for operations where there is a source: duplicate, copy, move, rename, etc.
	public static final String TARGET_TYPE_SOURCE_PATH = "Source Path";
	public static final String TARGET_TYPE_REMOTE_REPOSITORY = "Remote Repository";
	public static final String TARGET_TYPE_ACCESS_TOKEN = "Access Token";
	public static final String TARGET_TYPE_REFRESH_TOKEN = "Refresh Token";
	public static final String TARGET_TYPE_ENCRYPTION_TOKEN = "Encryption Token";
	public static final String TARGET_TYPE_BLUEPRINT = "Blueprint";
	public static final String TARGET_TYPE_SOURCE_SITE = "Source";
	public static final String TARGET_TYPE_PUBLISH_PACKAGE = "Publish Package";
	public static final String TARGET_TYPE_SUBMISSION_COMMENT = "Submission Comment";
	public static final String TARGET_TYPE_REJECTION_COMMENT = "Rejection Comment";
	public static final String TARGET_TYPE_SYNCED_COMMIT = "Synced Commit";
	public static final String TARGET_TYPE_SYSTEM_PROPERTY = "System Property";
	public static final String TARGET_TYPE_UNKNOWN = "unknown";
	public static final String TARGET_TYPE_CONTENT_PACKAGE = "Write Content Package";

}
