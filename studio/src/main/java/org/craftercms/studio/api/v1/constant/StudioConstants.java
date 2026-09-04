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
package org.craftercms.studio.api.v1.constant;

import org.craftercms.studio.api.v2.dal.security.NormalizedRole;

import java.util.List;

/**
 * Studio Constants
 *
 * @author Hyanghee Lim
 * @author Sumer Jabri
 */
public final class StudioConstants {

	/**
	 * content encoding
	 **/
	public static final String CONTENT_ENCODING = "UTF-8";

	/**
	 * variable names in configuration properties
	 **/
	public static final String PATTERN_CONTENT_TYPE = "\\{content\\-type\\}";
	public static final String PATTERN_ENVIRONMENT = "\\{environment\\}";
	public static final String PATTERN_MODULE = "\\{module\\}";
	public static final String PATTERN_SANDBOX = "\\$\\{sandbox\\}";
	public static final String PATTERN_SITE = "\\{site\\}";
	public static final String PATTERN_PATH = "\\{path\\}";
	public static final String PATTERN_FROM_PATH = "\\{fromPath\\}";
	public static final String PATTERN_TO_PATH = "\\{toPath\\}";
	public static final String PATTERN_PACKAGE_ID = "\\{packageId\\}";

	/**
	 * Studio Structure Constants
	 **/
	public static final String DESCRIPTOR_ROOT_PATH = "/site/";

	public static final String CONTENT_TYPE = "content-type";

	/**
	 * Repository Constants
	 */
	public static final String BOOTSTRAP_REPO_PATH = "repo-bootstrap";        // Path to repository boostrap
	public static final String BOOTSTRAP_REPO_GLOBAL_PATH = "global";        // Path to the global repository inside the bootstrap repo
	public static final String CONFIG_SITENAME_VARIABLE = "\\{siteName\\}";
	public static final String CONFIG_SITEENV_VARIABLE = "\\{siteEnv\\}";

	/**
	 * Site Constants
	 */
	public static final String SITE_UUID_FILENAME = "site-uuid.txt";
	public static final String SITE_UUID_FILE_COMMENT = "# THIS IS A SYSTEM FILE. PLEASE DO NOT EDIT NOR DELETE IT!!!";

	/**
	 * Content types constants
	 */
	public static final String CONTENT_TYPE_PAGE = "page";
	public static final String CONTENT_TYPE_ASSET = "asset";
	public static final String CONTENT_TYPE_COMPONENT = "component";
	public static final String CONTENT_TYPE_DOCUMENT = "document";
	public static final String CONTENT_TYPE_RENDERING_TEMPLATE = "renderingTemplate";
	public static final String CONTENT_TYPE_UNKNOWN = "unknown";
	public static final String CONTENT_TYPE_TAXONOMY = "taxonomy";
	public static final String CONTENT_TYPE_CONTENT_TYPE = "content type";
	public static final String CONTENT_TYPE_CONFIGURATION = "configuration";
	public static final String CONTENT_TYPE_FOLDER = "folder";
	public static final String CONTENT_TYPE_USER = "user";
	public static final String CONTENT_TYPE_GROUP = "group";
	public static final String CONTENT_TYPE_TAXONOMY_REGEX = "/site/taxonomy/([^<]+)\\.xml";
	public static final String CONTENT_TYPE_CONFIG_REGEX = "/config/([^<]+)\\.xml";
	public static final String CONTENT_TYPE_FORM_DEFINITION = "formDefinition";
	public static final String CONTENT_TYPE_SITE = "site";
	public static final String CONTENT_TYPE_REMOTE_REPOSITORY = "remoteRepository";
	public static final String CONTENT_TYPE_CONFIG_FOLDER = "content-types";
	public static final String CONTENT_TYPE_SCRIPT = "script";
	public static final String CONTENT_TYPE_LEVEL_DESCRIPTOR = "levelDescriptor";
	public static final String CONTENT_TYPE_FILE = "file";
	public static final List<String> SUPPORT_RENAME_CONTENT_TYPES = List.of(
		CONTENT_TYPE_ASSET,
		CONTENT_TYPE_FOLDER,
		CONTENT_TYPE_SCRIPT,
		CONTENT_TYPE_RENDERING_TEMPLATE,
		CONTENT_TYPE_FILE,
		CONTENT_TYPE_PAGE,
		CONTENT_TYPE_COMPONENT
	);

	/**
	 * System constants
	 */
	public static final String FILE_SEPARATOR = "/";
	public static final String SYSTEM_ADMIN_GROUP = "system_admin";
	public static final String SYSTEM_ADMIN_ROLE = "system_admin";
	public static final String ADMIN_ROLE = "admin";
	public static final NormalizedRole SYSTEM_ADMIN_NORMALIZED_ROLE = new NormalizedRole(SYSTEM_ADMIN_ROLE);
	public static final NormalizedRole ADMIN_NORMALIZED_ROLE = new NormalizedRole(ADMIN_ROLE);

	/**
	 * Sentinel value used when a cookie is missing or has not been set.
	 */
	public static final String UNSET = "UNSET";

	/**
	 * Default CSRF header and parameter names (Spring CookieCsrfTokenRepository defaults).
	 */
	public static final String XSRF_HEADER_NAME = "X-XSRF-TOKEN";
	public static final String XSRF_PARAMETER_NAME = "_csrf";

	/**
	 * Cookie that stores the active site ID for Studio UI and preview.
	 */
	public static final String SITE_COOKIE_NAME = "crafterSite";

	/**
	 * Cookie that stores the preferred Studio UI language.
	 */
	public static final String LANGUAGE_COOKIE_NAME = "crafterStudioLanguage";

	/**
	 * Root path / path separator.
	 */
	public static final String ROOT_PATH = "/";

	/**
	 * Path attribute used for Studio cookies that should be available across authoring URLs.
	 */
	public static final String COOKIE_PATH = ROOT_PATH;

	public static final String INDEX_FILE = "index.xml";

	public static final List<String> TOP_LEVEL_FOLDERS = List.of(
		"/site/website/index.xml",
		"/site/components",
		"/site/taxonomy",
		"/static-assets",
		"/templates",
		"/scripts",
		"/sources"
	);

	/**
	 * Site config xml elements
	 */
	public static final String SITE_CONFIG_XML_ELEMENT_PUBLISHED_REPOSITORY = "published-repository";
	public static final String SITE_CONFIG_XML_ELEMENT_ENABLE_STAGING_ENVIRONMENT = "enable-staging-environment";
	public static final String SITE_CONFIG_XML_ELEMENT_STAGING_ENVIRONMENT = "staging-environment";
	public static final String SITE_CONFIG_XML_ELEMENT_LIVE_ENVIRONMENT = "live-environment";
	public static final String SITE_CONFIG_ELEMENT_PLUGIN_FOLDER_PATTERN = "plugin-folder-pattern";
	public static final String SITE_CONFIG_ELEMENT_SITE_URLS = "site-urls";
	public static final String SITE_CONFIG_ELEMENT_AUTHORING_URL = "authoring-url";
	public static final String SITE_CONFIG_ELEMENT_LIVE_URL = "live-url";
	public static final String SITE_CONFIG_ELEMENT_ADMIN_EMAIL_ADDRESS = "admin-email-address";
	public static final String SITE_CONFIG_XML_ELEMENT_WORKFLOW = "workflow";
	public static final String SITE_CONFIG_XML_ELEMENT_PUBLISHER = "publisher";
	public static final String SITE_CONFIG_XML_ELEMENT_REQUIRE_PEER_REVIEW = "requirePeerReview";
	public static final String SITE_CONFIG_XML_ELEMENT_PROTECTED_FOLDER_PATTERNS = "protected-folders-patterns/pattern";
	public static final String SITE_CONFIG_XML_ELEMENT_CONTENT_MONITORING = "contentMonitoring";

	/**
	 * Repository commit messages variables
	 */
	public static final String REPO_COMMIT_MESSAGE_USERNAME_VAR = "{username}";
	public static final String REPO_COMMIT_MESSAGE_PATH_VAR = "{path}";
	public static final String REPO_COMMIT_MESSAGE_USER_COMMENT_VAR = "{userComment}";

	public static final String REMOVE_SYSTEM_ADMIN_MEMBER_LOCK = "remove_system_admin_member_lock";

	/* Modules */
	public static final String MODULE_STUDIO = "studio";

	public static final String DEFAULT_CONFIG_URL = "http://localhost:8080";

	// General Lock Service
	public static final String GLOBAL_REPOSITORY_GIT_LOCK = "GLOBAL_REPOSITORY_GIT_LOCK";
	public static final String SITE_SANDBOX_REPOSITORY_GIT_LOCK = "{site}_SANDBOX_REPOSITORY_GIT_LOCK";
	public static final String SITE_PUBLISHING_LOCK = "{site}_PUBLISHING";
	public static final String SITE_PUBLISHED_REPOSITORY_GIT_LOCK = "{site}_PUBLISHED_REPOSITORY_GIT_LOCK";
	public static final String STUDIO_CLOCK_EXECUTOR_SITE_LOCK = "{site}_STUDIO_CLOCK_EXECUTOR_SITE_LOCK";
	public static final String PUBLISH_PACKAGE_LOCK = "PUBLISH_PACKAGE_{packageId}";

	public static final String STUDIO_TEMPORARY_ROOT_DIR = "studio";

	// DB Configs
	public static final Integer RECURSIVE_ITERATIONS_HARD_LIMIT = 20;

	// File extensions
	public final static String TMP_FILE_SUFFIX = ".tmp";

	// Content Lifecycle controller
	public static final String CONTENT_LIFECYCLE_INCLUDE_APPLICATION_CONTEXT = "studio.contentProcessor.contentLifecycle.includeApplicationContext";
	public static final String CONTENT_LIFECYCLE_INCLUDED_BEANS = "studio.contentProcessor.contentLifecycle.includedBeans";

	// Content items xml
	public static final String INTERNAL_NAME_XPATH = "/*[1]/internal-name";

	public static final String DEFAULT_ORDER_XPATH = "/*[1]/orderDefault_f";
	public static final String PLACE_IN_NAV_XPATH = "/*[1]/placeInNav";

	private StudioConstants() {
	}
}
