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
package org.craftercms.deployer.impl.processors.aws;

import org.apache.commons.lang3.ArrayUtils;
import org.craftercms.commons.lang.RegexUtils;

import static org.apache.commons.lang3.Strings.CS;

/**
 * Files published to S3 by {@link S3SyncProcessor} and listed by {@link S3ContentStoreManifestProcessor}.
 * Both processors use this so a regular file left out of the bucket is left out of the manifest.
 */
final class S3PublishedFileSelection {

	private S3PublishedFileSelection() {
	}

	/**
	 * A file is published when it matches {@code includeFiles} and {@code excludeFiles}
	 * and is not a blob pointer that {@code ignoreBlobs} leaves out of the bucket.
	 * Include and exclude matching follows {@code AbstractDeploymentProcessor}.
	 */
	static boolean include(String file, String[] includeFiles, String[] excludeFiles,
			       boolean ignoreBlobs, String blobExtension) {
		return (ArrayUtils.isEmpty(includeFiles) || RegexUtils.matchesAny(file, includeFiles)) &&
			(ArrayUtils.isEmpty(excludeFiles) || !RegexUtils.matchesAny(file, excludeFiles)) &&
			!(ignoreBlobs && CS.endsWith(file, blobExtension));
	}

}
