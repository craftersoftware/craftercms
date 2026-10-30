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

package org.craftercms.engine.store.s3;

import org.craftercms.core.service.ContextImpl;
import org.craftercms.core.store.ContentStoreAdapter;
import org.craftercms.core.store.ContentStoreIndex;
import org.craftercms.engine.exception.s3.S3BucketNotConfiguredException;
import software.amazon.awssdk.services.s3.S3Uri;

import java.util.Map;

/**
 * Implementation of {@link org.craftercms.core.service.Context} for AWS S3.
 *
 * @author joseross
 */
public class S3Context extends ContextImpl {

	/**
	 * AWS S3 bucket uri to use as root folder for the site.
	 */
	protected S3Uri rootFolderUri;

	/**
	 * True after a manifest load has completed. A resolved index may still be null when the manifest object is absent.
	 */
	private volatile boolean contentStoreIndexResolved;

	/**
	 * Directory index built from the content store manifest. Null when the manifest object does not exist.
	 */
	private volatile ContentStoreIndex contentStoreIndex;

	/**
	 * True when the last manifest load failed. The deployment events watcher retries the load on its next cycle.
	 */
	private volatile boolean contentStoreManifestLoadFailed;

	/**
	 * ETag of the manifest object the current index was built from. Null when the manifest is absent or the last load failed.
	 */
	private volatile String contentStoreManifestETag;

	private final Object contentStoreIndexLock = new Object();

	public S3Context(final String id, final ContentStoreAdapter storeAdapter, final String rootFolderPath,
					 final boolean mergingOn, final boolean cacheOn, final int maxAllowedItemsInCache,
					 final boolean ignoreHiddenFiles, final S3Uri rootFolderUri,
					 final Map<String, String> configurationVariables) {
		super(id, storeAdapter, rootFolderPath, mergingOn, cacheOn, maxAllowedItemsInCache, ignoreHiddenFiles, configurationVariables);
		this.rootFolderUri = rootFolderUri;
	}

	/**
	 * Returns the name of the bucket.
	 */
	public String getBucket() {
		return rootFolderUri.bucket().orElseThrow(S3BucketNotConfiguredException::new);
	}

	/**
	 * Returns the key of the folder.
	 */
	public String getKey() {
		return rootFolderUri.key().orElse("");
	}

	/**
	 * @return true when a manifest load has finished for this context
	 */
	public boolean isContentStoreIndexResolved() {
		return contentStoreIndexResolved;
	}

	/**
	 * @return the index built from the manifest, or null when the load has resolved and the object is absent
	 */
	public ContentStoreIndex getContentStoreIndex() {
		return contentStoreIndex;
	}

	/**
	 * @return the lock that guards index load and replacement
	 */
	public Object getContentStoreIndexLock() {
		return contentStoreIndexLock;
	}

	/**
	 * @return true when the last manifest load failed and should be retried
	 */
	public boolean isContentStoreManifestLoadFailed() {
		return contentStoreManifestLoadFailed;
	}

	/**
	 * @return the ETag of the manifest the current index was built from, or null when there is nothing to revalidate
	 */
	public String getContentStoreManifestETag() {
		return contentStoreManifestETag;
	}

	/**
	 * Stores the index built from a manifest load. A null index means the manifest object does not exist and
	 * folder lookups should list S3. A successful store clears a previous load failure and any ETag.
	 *
	 * @param contentStoreIndex the index built from the manifest, or null when the manifest is absent
	 */
	public void setContentStoreIndex(ContentStoreIndex contentStoreIndex) {
		setContentStoreIndex(contentStoreIndex, null);
	}

	/**
	 * Stores the index and the ETag of the manifest it was built from. A null index clears the ETag.
	 * A successful store clears a previous load failure.
	 *
	 * @param contentStoreIndex the index built from the manifest, or null when the manifest is absent
	 * @param eTag              the manifest ETag, kept only while an index is stored
	 */
	public void setContentStoreIndex(ContentStoreIndex contentStoreIndex, String eTag) {
		this.contentStoreIndex = contentStoreIndex;
		this.contentStoreManifestETag = contentStoreIndex == null ? null : eTag;
		this.contentStoreIndexResolved = true;
		this.contentStoreManifestLoadFailed = false;
	}

	/**
	 * Keeps the current index and ETag after S3 reports that the manifest has not changed.
	 */
	public void retainContentStoreManifest() {
		this.contentStoreIndexResolved = true;
		this.contentStoreManifestLoadFailed = false;
	}

	/**
	 * Clears the index and records that the manifest load failed. Folder lookups list S3 until a later load succeeds.
	 */
	public void markContentStoreManifestLoadFailed() {
		this.contentStoreIndex = null;
		this.contentStoreManifestETag = null;
		this.contentStoreIndexResolved = true;
		this.contentStoreManifestLoadFailed = true;
	}

}
