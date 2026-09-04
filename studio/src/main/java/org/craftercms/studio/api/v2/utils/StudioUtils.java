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

package org.craftercms.studio.api.v2.utils;

import jakarta.activation.MimetypesFileTypeMap;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.IOUtils;
import org.craftercms.commons.http.RequestContext;
import org.craftercms.studio.api.v1.constant.StudioConstants;
import org.craftercms.studio.model.contentType.ContentType;
import org.dom4j.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;

import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.apache.commons.io.FilenameUtils.directoryContains;
import static org.apache.commons.lang3.StringUtils.isEmpty;
import static org.craftercms.studio.api.v1.constant.DmConstants.*;
import static org.craftercms.studio.api.v1.constant.StudioConstants.*;
import static org.craftercms.studio.controller.rest.v2.RequestConstants.REQUEST_PARAM_SITEID;

/**
 * General utility methods for Crafter Studio
 */
public abstract class StudioUtils {
	private static final String TEMP_DIR_SYSTEM_PROPERTY = "java.io.tmpdir";

	private static final Logger logger = LoggerFactory.getLogger(StudioUtils.class);

	protected static final Pattern COMPONENT_CONTENT_TYPE_ID_PATTERN = Pattern.compile("^/component/.*");
	protected static final Pattern PAGE_CONTENT_TYPE_ID_PATTERN = Pattern.compile("^/page/.*");

	public static String getMimeType(String filename) {
		MimetypesFileTypeMap mimeMap = new MimetypesFileTypeMap();
		return mimeMap.getContentType(filename);
	}

	/**
	 * Obtains the siteId from the current request, always fails if called out of a request context
	 *
	 * @return the siteId
	 */
	public static String getSiteId() {
		var context = RequestContext.getCurrent();
		if (context == null) {
			throw new IllegalStateException("There is no request to get the siteId");
		}

		var request = context.getRequest();
		var siteId = request.getParameter(REQUEST_PARAM_SITEID);
		if (isEmpty(siteId)) {
			throw new IllegalStateException("There is no parameter to get the siteId");
		}

		return siteId;
	}

	public static boolean matchesPatterns(String path, List<String> patterns) {
		if (patterns != null) {
			for (String pattern : patterns) {
				if (path.matches(pattern)) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Gets the top level folder where {@code path} is contained.
	 * The result will be a value from the list defined at StudioConstants.TOP_LEVEL_FOLDERS, if found, null otherwise.
	 *
	 * @param path the content path
	 * @return top level root path, if matched, or null otherwise
	 */
	public static String getTopLevelFolder(final String path) {
		return StudioConstants.TOP_LEVEL_FOLDERS.stream()
			// Remove index file at the end of the path (to support /site/website/index.xml case) so we always get a folder path
			.map(folder -> folder.replaceFirst(StudioConstants.FILE_SEPARATOR + StudioConstants.INDEX_FILE + "$", ""))
			.filter(path::startsWith)
			.findFirst()
			.orElse(null);
	}

	@NonNull
	public static Path getStudioTemporaryFilesRoot() {
		String tempDir = System.getProperty(TEMP_DIR_SYSTEM_PROPERTY);
		return Paths.get(tempDir, STUDIO_TEMPORARY_ROOT_DIR);
	}

	/**
	 * Creates a temporary file in the Crafter Studio temporary files root directory
	 *
	 * @param name the name of the file. Result file will have a random name but will preserve the extension of this param
	 * @return the path to the temporary file
	 * @throws IOException if an error occurs while creating the file
	 */
	public static Path createTempFile(String name) throws IOException {
		Files.createDirectories(getStudioTemporaryFilesRoot());
		return Files.createTempFile(getStudioTemporaryFilesRoot(), UUID.randomUUID().toString(), "." +
			FilenameUtils.getExtension(name));
	}

	/**
	 * Creates a temporary file in the Crafter Studio temporary files root directory and
	 * writes the given content to it
	 *
	 * @param name    the name of the file. Result file will have a random name but will preserve the extension of this param
	 * @param content the content to write to the file
	 * @return the path to the temporary file
	 * @throws IOException if an error occurs while creating the file or writing the content
	 */
	public static Path createTempFile(String name, InputStream content) throws IOException {
		Path tmpFile = createTempFile(name);
		try (content; OutputStream out = Files.newOutputStream(tmpFile)) {
			IOUtils.copy(content, out);
		}
		return tmpFile;
	}

	/**
	 * Creates a temporary file in the Crafter Studio temporary files root directory and
	 * writes the document into it
	 *
	 * @param name     the name of the file. Result file will have a random name but will preserve the extension of this param
	 * @param document the document to write to the file
	 * @return the path to the temporary file
	 * @throws IOException if an error occurs while creating the file or writing the content
	 */
	public static Path createTempFile(String name, Document document) throws IOException {
		Path tmpFile = createTempFile(name);
		try (FileWriter writer = new FileWriter(tmpFile.toFile())) {
			document.write(writer);
		}
		return tmpFile;
	}

	/**
	 * Get the key for sandbox repo operations lock
	 *
	 * @param siteId the site id
	 * @return the lock key
	 */
	public static String getSandboxRepoLockKey(final String siteId) {
		return SITE_SANDBOX_REPOSITORY_GIT_LOCK.replaceAll(PATTERN_SITE, siteId);
	}

	/**
	 * Get the key for the lock used to ensure publishing operations do not overlap for a site
	 *
	 * @param siteId the site id
	 * @return the lock key
	 */
	public static String getPublishingLockKey(final String siteId) {
		return SITE_PUBLISHING_LOCK.replaceAll(PATTERN_SITE, siteId);
	}

	/**
	 * Get the key for the lock used to ensure exclusive access to a publish package
	 *
	 * @param packageId the package id
	 * @return the lock key
	 */
	public static String getPublishPackageLockKey(long packageId) {
		return PUBLISH_PACKAGE_LOCK.replaceAll(PATTERN_PACKAGE_ID, String.valueOf(packageId));
	}

	/**
	 * to be stored under <code>/site/</code>
	 * Check if the given path is under the descriptor root subtree. i.e. /site,
	 *
	 * @param path the path to check
	 * @return true if the path is in the descriptor root subtree, false otherwise
	 */
	public static boolean underDescriptorRoot(String path) {
		return path.startsWith(DESCRIPTOR_ROOT_PATH);
	}

	/**
	 * Check if the given path is a page /index.xml file
	 *
	 * @param path the path to check
	 * @return true if the path is a page, false otherwise
	 */
	public static boolean isPageDescriptor(String path) {
		return underPagesRoot(path) && path.endsWith(SLASH_INDEX_FILE);
	}

	/**
	 * Check if the given path is a descriptor file, i.e. it is under the descriptor root and ends with .xml
	 *
	 * @param path the path to check
	 * @return true if the path is a descriptor file, false otherwise
	 */
	public static boolean isDescriptor(String path) {
		return underDescriptorRoot(path) && path.endsWith(XML_PATTERN);
	}

	/**
	 * Check if a path is a page path, i.e. it starts with /site/website/
	 *
	 * @param path the path to check
	 * @return true if the path is a page path, false otherwise
	 */
	public static boolean underPagesRoot(String path) {
		return directoryContains(ROOT_PATTERN_PAGES, path);
	}

	/**
	 * Transform a source path to a target path by replacing a source root (prefix)
	 * by a target root.
	 * e.g. if the source root is /site/website and the target root is /site/website2,
	 * and the source path is /site/website/some/path/file.xml, the result will be
	 * /site/website2/some/path/file.xml.
	 *
	 * @param sourceRoot the source root to replace
	 * @param targetRoot the target root to use
	 * @param sourcePath the source path to transform (this should start with the source root)
	 * @return the transformed path, which will start with the target root
	 */
	public static String movePath(String sourceRoot, String targetRoot, String sourcePath) {
		return Path.of(targetRoot).resolve(Path.of(sourceRoot).relativize(Path.of(sourcePath))).toString();
	}

	/**
	 * Get the content type type by its id, which is determined by the content type naming convention.
	 *
	 * @param contentTypeId the content type id to check
	 * @return <ul>
	 * <li><b>component</b> if the name matches component naming convention</li>
	 * <li><b>page</b> if the name matches page naming convention</li>
	 * <li><b>unknown</b> if name don't match any known convention</li>
	 * </ul>
	 */
	public static ContentType.Type getContentTypeTypeById(String contentTypeId) {
		if (isEmpty(contentTypeId)) {
			return ContentType.Type.unknown;
		}

		if (COMPONENT_CONTENT_TYPE_ID_PATTERN.matcher(contentTypeId).matches()) {
			return ContentType.Type.component;
		}
		if (PAGE_CONTENT_TYPE_ID_PATTERN.matcher(contentTypeId).matches()) {
			return ContentType.Type.page;
		}
		return ContentType.Type.unknown;
	}

	/**
	 * Get the cookie domain for the given hostname and useBaseDomain flag
	 *
	 * @param hostname      the hostname to get the cookie domain for
	 * @param useBaseDomain the useBaseDomain flag
	 * @return the cookie domain
	 */
	public static String getCookieDomain(String hostname, boolean useBaseDomain) {
		if (!useBaseDomain || !hostname.contains(".") || hostname.matches("\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b")) {
			return hostname;
		}
		String[] segments = hostname.split("\\.");
		return segments[segments.length - 2] + "." + segments[segments.length - 1];
	}
}
