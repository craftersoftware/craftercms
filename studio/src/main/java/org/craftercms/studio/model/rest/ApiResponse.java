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

package org.craftercms.studio.model.rest;

import org.apache.commons.lang3.StringUtils;

/**
 * Represents the response of an API operation.
 *
 * @author Dejan Brkic
 * @author avasquez
 */
public class ApiResponse {

	// 1 - 1000
	public static final ApiResponse OK =
		new ApiResponse(0, "OK", StringUtils.EMPTY, StringUtils.EMPTY);
	public static final ApiResponse CREATED =
		new ApiResponse(1, "Created", StringUtils.EMPTY, StringUtils.EMPTY);
	public static final ApiResponse DELETED =
		new ApiResponse(2, "Deleted", StringUtils.EMPTY, StringUtils.EMPTY);

	public static final ApiResponse COMPLETED_WITH_ERRORS =
		new ApiResponse(3, "Completed with errors", StringUtils.EMPTY, StringUtils.EMPTY);

	// 1000 - 2000
	public static final ApiResponse INTERNAL_SYSTEM_FAILURE =
		new ApiResponse(1000, "Internal system failure", "Contact support", StringUtils.EMPTY);
	public static final ApiResponse INVALID_PARAMS = new ApiResponse(1001, "Invalid parameter(s)",
		"Check API and make sure you're sending the correct parameters", StringUtils.EMPTY);
	public static final ApiResponse DEPRECATED = new ApiResponse(1002, "Deprecated",
		"This API has been deprecated", StringUtils.EMPTY);
	public static final ApiResponse MISSING_REQUEST_PART = new ApiResponse(1003, "Missing request part",
		"Check the required multipart params are present in the request", StringUtils.EMPTY);

	// 2000 - 3000
	public static final ApiResponse UNAUTHENTICATED =
		new ApiResponse(2000, "Unauthenticated", "Please login first", StringUtils.EMPTY);
	public static final ApiResponse UNAUTHORIZED = new ApiResponse(2001, "Unauthorized",
		"You don't have permission to perform this task, please contact your administrator", StringUtils.EMPTY);
	public static final ApiResponse PEER_REVIEW_CHECK_FAILED = new ApiResponse(2002, "Peer-review check failed",
		"Users are not allowed to approve their own packages when peer-review is enabled", StringUtils.EMPTY);
	public static final ApiResponse PACKAGE_SUBMITTER_CHECK_FAILED = new ApiResponse(2003, "Package submitter check failed",
		"Users are not allowed to update publish packages that they did not submit", StringUtils.EMPTY);

	// 4000 - 5000
	public static final ApiResponse GROUP_NOT_FOUND = new ApiResponse(4000, "Group not found",
		"Check if you sent in the right Group Id", StringUtils.EMPTY);
	public static final ApiResponse GROUP_ALREADY_EXISTS = new ApiResponse(4001, "Group already exists",
		"Try a different group name", StringUtils.EMPTY);
	public static final ApiResponse GROUP_EXTERNALLY_MANAGED = new ApiResponse(4002, "Group is externally managed",
		"Update the group in the main identity system (e.g. LDAP)", StringUtils.EMPTY);

	// 5000 - 6000
	public static final ApiResponse SITE_NOT_FOUND = new ApiResponse(5000, "Site not found",
		"Check if you sent in the right Site Id", StringUtils.EMPTY);
	public static final ApiResponse SITE_ALREADY_EXISTS = new ApiResponse(5001, "Site already exists",
		"Try a different site name", StringUtils.EMPTY);
	public static final ApiResponse INVALID_SITE_STATE = new ApiResponse(5002, "Invalid site state",
		"Requested site is not in the required state for this operation", StringUtils.EMPTY);
	public static final ApiResponse SITE_BOOTSTRAP_NOT_COMPLETE = new ApiResponse(5003, "Site bootstrap not complete",
			"Wait for the site bootstrap to complete before performing this operation", StringUtils.EMPTY);

	// 6000 - 7000
	public static final ApiResponse USER_NOT_FOUND = new ApiResponse(6000, "User not found",
		"Check if you're using the correct User ID or username", StringUtils.EMPTY);
	public static final ApiResponse USER_ALREADY_EXISTS = new ApiResponse(6001, "User already exists",
		"Try a different username", StringUtils.EMPTY);
	public static final ApiResponse USER_EXTERNALLY_MANAGED = new ApiResponse(6002, "User is externally managed",
		"Update the user in the main identity system (e.g. LDAP)", StringUtils.EMPTY);
	public static final ApiResponse USER_PASSWORD_REQUIREMENTS_FAILED =
		new ApiResponse(6003, "User password does not fulfill requirements",
			"Use password that will fulfill password requirements", StringUtils.EMPTY);
	public static final ApiResponse USER_PASSWORD_DOES_NOT_MATCH =
		new ApiResponse(6004, "User current password does not match",
			"Use correct current password", StringUtils.EMPTY);

	// 7000 - 8000
	public static final ApiResponse CONTENT_NOT_FOUND = new ApiResponse(7000, "Content not found",
		"Check if you sent in the right Content Id", StringUtils.EMPTY);
	public static final ApiResponse CONTENT_ALREADY_EXISTS = new ApiResponse(7001, "Content already exists",
		"Edit the existing item or delete it before creating it again", StringUtils.EMPTY);
	public static final ApiResponse CONTENT_ALREADY_LOCKED = new ApiResponse(7002, "Content already locked",
		"The user that locked the item or the administrator must unlock the item first", StringUtils.EMPTY);
	public static final ApiResponse CONTENT_MOVE_INVALID_LOCATION = new ApiResponse(7004,
		"Paste destination folder is invalid (did you paste the item onto itself?)",
		"Try pasting the content to a different folder", StringUtils.EMPTY);
	public static final ApiResponse BLOB_NOT_FOUND = new ApiResponse(7005, "Content not found in blob store",
		"Check your blob store configurations", StringUtils.EMPTY);
	public static final ApiResponse CONTENT_IN_PUBLISH_QUEUE = new ApiResponse(7006, "Cannot edit content that is part of an active publish package",
		"Cancel affected publish packages and retry", StringUtils.EMPTY);
	public static final ApiResponse PUBLISH_PACKAGE_NOT_FOUND = new ApiResponse(7007, "Publish package not found",
		"Check if you sent in the right Publish Package Id", StringUtils.EMPTY);
	public static final ApiResponse INVALID_PACKAGE_STATE = new ApiResponse(7008, "Requested publish package is not in the required state for this operation",
		"Check the current publish package state", StringUtils.EMPTY);
	public static final ApiResponse PACKAGE_ALREADY_APPROVED = new ApiResponse(7009, "Requested publish package is already APPROVED",
		"Check the current publish package state", StringUtils.EMPTY);
	public static final ApiResponse EMPTY_CHANGESET = new ApiResponse(7010, "Empty changeset",
		"Site repository already contains the specified content in the given path", StringUtils.EMPTY);
	public static final ApiResponse INVALID_PUBLISH_TARGET = new ApiResponse(7011, "Invalid publish target",
		"Check if you sent in the right publish target", StringUtils.EMPTY);

	// 8000 - 9000
	public static final ApiResponse PUBLISHING_DISABLED = new ApiResponse(8000, "Publishing is disabled",
		"Advise the user to enable publishing", StringUtils.EMPTY);

	// 9000 - 10000
	public static final ApiResponse SEARCH_UNREACHABLE = new ApiResponse(9000, "Search is unreachable",
		"Advise the user that the search engine is not reachable", StringUtils.EMPTY);

	// 10000 - 11000
	public static final ApiResponse LOV_NOT_FOUND = new ApiResponse(10000, "LoV not found",
		"Check if you sent in the right LoV Id", StringUtils.EMPTY);

	// 11000 - 12000
	public static final ApiResponse CLUSTER_MEMBER_NOT_FOUND = new ApiResponse(11000, "Cluster member not found",
		"Check if you sent in the right Cluster Member Id", StringUtils.EMPTY);
	public static final ApiResponse CLUSTER_MEMBER_ALREADY_EXISTS =
		new ApiResponse(11001, "Cluster member already exists",
			"Get the list of cluster members to validate", StringUtils.EMPTY);

	// 12000 - 13000
	public static final ApiResponse REMOTE_REPOSITORY_NOT_FOUND = new ApiResponse(12000, "Remote repository not found",
		"Check if you sent in the right remote repository name", StringUtils.EMPTY);
	public static final ApiResponse REMOTE_REPOSITORY_ALREADY_EXISTS =
		new ApiResponse(12001, "Remote repository already exists",
			"Get the list of remote repositories to validate", StringUtils.EMPTY);
	public static final ApiResponse PULL_FROM_REMOTE_REPOSITORY_CONFLICT =
		new ApiResponse(12002, "Pull from remote repository resulted in conflict",
			"Resolve conflicts before continuing work with repository", StringUtils.EMPTY);
	public static final ApiResponse ADD_REMOTE_INVALID =
		new ApiResponse(12003, "Remote is invalid. Not added to remote repositories",
			"Add new remote repository with valid parameters.", StringUtils.EMPTY);
	public static final ApiResponse REMOVE_REMOTE_FAILED =
		new ApiResponse(12004, "Failed to remove remote repository",
			"Contact your system administrator.", StringUtils.EMPTY);
	public static final ApiResponse PUSH_TO_REMOTE_FAILED =
		new ApiResponse(12005, "Push to remote repository failed",
			"Check your repository settings or contact your system administrator.", StringUtils.EMPTY);
	public static final ApiResponse REMOTE_REPOSITORY_NOT_REMOVABLE =
		new ApiResponse(12006, "Failed to remove remote repository",
			"Remote repository is cluster node repository. Can't be removed.", StringUtils.EMPTY);
	public static final ApiResponse REMOTE_REPOSITORY_AUTHENTICATION_FAILED =
		new ApiResponse(12007, "Remote repository authentication failed",
			"Recreate the remote repository with the correct authentication credentials " +
				"and make sure you have write access.", StringUtils.EMPTY);
	public static final ApiResponse REPOSITORY_NOT_FOUND = new ApiResponse(12008, "Repository not found",
			"Check if you sent in the right repository type and site id", StringUtils.EMPTY);
	public static final ApiResponse REPOSITORY_IN_MERGE_STATE =
			new ApiResponse(12009, "Repository is in merge state",
					"Conclude merge before writing content", StringUtils.EMPTY);
	public static final ApiResponse REPOSITORY_NOT_IN_MERGE_STATE =
			new ApiResponse(12010, "Repository is NOT in merge state",
					"No conflict to resolve if repository is not merging", StringUtils.EMPTY);

	// 40000 - 41000
	public static final ApiResponse MARKETPLACE_NOT_INITIALIZED =
		new ApiResponse(40000, "Marketplace service is not initialized",
			"Contact your system administrator.", StringUtils.EMPTY);

	public static final ApiResponse MARKETPLACE_UNREACHABLE =
		new ApiResponse(40001, "Marketplace server is unreachable",
			"Check the configuration to make sure the Marketplace URL is correct", StringUtils.EMPTY);

	public static final ApiResponse PLUGIN_ALREADY_INSTALLED =
		new ApiResponse(40002, "Plugin is already installed",
			"Check that the site id, plugin id and plugin version are correct", StringUtils.EMPTY);

	public static final ApiResponse PLUGIN_INSTALLATION_ERROR =
		new ApiResponse(40003, "Error installing plugin",
			"Check the plugin requirements", StringUtils.EMPTY);

	// 50000 - 51000

	// 51000 - 52000

	// 52000 - 53000
	public static final ApiResponse AWS_UNREACHABLE = new ApiResponse(52000, "AWS is unreachable",
		"Advise the user that AWS engine is not reachable", StringUtils.EMPTY);
	public static final ApiResponse S3_UNREACHABLE = new ApiResponse(52001, "S3 is unreachable",
		"Check your network configuration and S3 availability", StringUtils.EMPTY);
	public static final ApiResponse S3_BUCKET_NOT_FOUND = new ApiResponse(52002, "S3 bucket not found",
		"Check the configured bucket name is correct", StringUtils.EMPTY);
	public static final ApiResponse S3_UNAUTHORIZED = new ApiResponse(52003, "S3 unauthorized access",
		"Check your AWS credentials", StringUtils.EMPTY);
	public static final ApiResponse S3_FORBIDDEN = new ApiResponse(52004, "S3 FORBIDDEN",
		"Check your AWS credentials", StringUtils.EMPTY);
	public static final ApiResponse S3_KEY_NOT_FOUND = new ApiResponse(52005, "S3 key not found",
		"Check your network configuration and S3 availability", StringUtils.EMPTY);

	// 53000 - 54000
	public static final ApiResponse LOGGER_NOT_FOUND = new ApiResponse(53000, "The logger was not found",
		"Check if you sent in the right logger name or " +
			"add 'createIfAbsent=true' parameter to create the logger if it does not exist", StringUtils.EMPTY);
	// 54000 - 55000
	public static final ApiResponse CONFIGURATION_PROFILE_NOT_FOUND = new ApiResponse(54000, "The profile was not found",
		"Check if you sent in the right profileId name", StringUtils.EMPTY);

	// 55000 - 56000
	public static final ApiResponse MAINTENANCE_MODE = new ApiResponse(55000, "System is in maintenance mode",
			"Please wait for the maintenance window to complete or contact your system administrator for more information.", StringUtils.EMPTY);

	// 56000 - 57000
	public static final ApiResponse CONTENT_TYPE_IN_USE = new ApiResponse(56000, "The content type cannot be deleted because it is still in use by content items",
			"Check if you sent in the right content type id or add 'deleteDependencies' to force delete", StringUtils.EMPTY);
	public static final ApiResponse CONTENT_TYPE_INVALID_LOCATION = new ApiResponse(56001, "The content type does not allow the specified location",
			"Check the content type configuration", StringUtils.EMPTY);

	private int code;
	private String message;
	private String remedialAction;
	private String documentationUrl;

	public ApiResponse(ApiResponse response) {
		code = response.code;
		message = response.message;
		remedialAction = response.remedialAction;
		documentationUrl = response.documentationUrl;
	}

	private ApiResponse(int code, String message, String remedialAction, String documentationUrl) {
		this.code = code;
		this.message = message;
		this.remedialAction = remedialAction;
		this.documentationUrl = documentationUrl;
	}

	/**
	 * Returns the response code.
	 */
	public int getCode() {
		return code;
	}

	/**
	 * Sets the response code.
	 */
	public void setCode(int code) {
		this.code = code;
	}

	/**
	 * Returns the detailed message of the response.
	 */
	public String getMessage() {
		return message;
	}

	/**
	 * Sets the detailed message of the response.
	 */
	public void setMessage(String message) {
		this.message = message;
	}

	/**
	 * Returns what the user can do in order to address the issue indicated by the response.
	 */
	public String getRemedialAction() {
		return remedialAction;
	}

	/**
	 * Sets what the user can do in order to address the issue indicated by the response.
	 */
	public void setRemedialAction(String remedialAction) {
		this.remedialAction = remedialAction;
	}

	/**
	 * Returns the URL to documentation related to the response.
	 */
	public String getDocumentationUrl() {
		return documentationUrl;
	}

	/**
	 * Sets the URL to documentation related to the response.
	 */
	public void setDocumentationUrl(String documentationUrl) {
		this.documentationUrl = documentationUrl;
	}

	@Override
	public String toString() {
		return "ApiResponse{" +
			"code=" + code +
			", message='" + message + '\'' +
			", remedialAction='" + remedialAction + '\'' +
			", documentationUrl='" + documentationUrl + '\'' +
			'}';
	}

}
