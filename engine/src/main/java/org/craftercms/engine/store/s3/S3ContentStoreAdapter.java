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

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.IOUtils;
import org.apache.http.HttpStatus;
import org.craftercms.commons.lang.RegexUtils;
import org.craftercms.core.exception.AuthenticationException;
import org.craftercms.core.exception.InvalidContextException;
import org.craftercms.core.exception.RootFolderNotFoundException;
import org.craftercms.core.exception.StoreException;
import org.craftercms.core.service.CachingOptions;
import org.craftercms.core.service.Content;
import org.craftercms.core.service.Context;
import org.craftercms.core.store.ContentStoreIndex;
import org.craftercms.core.store.ContentStoreManifest;
import org.craftercms.core.store.impl.File;
import org.craftercms.core.util.ContentStoreUtils;
import org.craftercms.core.util.cache.CacheTemplate;
import org.craftercms.core.util.cache.impl.CachingAwareList;
import org.craftercms.engine.util.store.decorators.DecoratedStoreAdapterContext;
import org.craftercms.engine.exception.s3.S3BucketNotConfiguredException;
import org.craftercms.engine.store.AbstractCachedFileBasedContentStoreAdapter;
import org.craftercms.engine.store.s3.util.S3ClientBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.validation.Validator;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Uri;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.paginators.ListObjectsV2Iterable;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.*;
import static org.apache.commons.lang3.Strings.CS;

/**
 * Implementation of {@link org.craftercms.core.store.ContentStoreAdapter} to read files from AWS S3.
 *
 * @author joseross
 */
public class S3ContentStoreAdapter extends AbstractCachedFileBasedContentStoreAdapter implements InitializingBean, DisposableBean {

	private static final Logger logger = LoggerFactory.getLogger(S3ContentStoreAdapter.class);

	public static final String DELIMITER = "/";

	public static final String DEFAULT_DEPLOYMENT_EVENTS_FILE_URL = "deployment-events.properties";

	protected final S3ClientBuilder clientBuilder;
	protected S3Client client;
	protected final int contentMaxLength;
	protected final String[] cacheAllowedPaths;

	/**
	 * Store path of the deployment events file. Lookups for this path read the object from S3
	 * and skip the content store index, because the file is published after the manifest.
	 */
	protected String deploymentEventsFileUrl = DEFAULT_DEPLOYMENT_EVENTS_FILE_URL;

	@ConstructorProperties({"pathValidator", "descriptorFileExtension", "metadataFileExtension", "cacheTemplate",
		"clientBuilder", "contentMaxLength", "cacheAllowedPaths"})
	public S3ContentStoreAdapter(Validator pathValidator, String descriptorFileExtension,
								 String metadataFileExtension, CacheTemplate cacheTemplate,
								 final S3ClientBuilder clientBuilder, final int contentMaxLength, final String[] cacheAllowedPaths) {
		super(pathValidator, descriptorFileExtension, metadataFileExtension, cacheTemplate);
		this.clientBuilder = clientBuilder;
		this.contentMaxLength = contentMaxLength;
		this.cacheAllowedPaths = cacheAllowedPaths;
	}

	@Override
	public void afterPropertiesSet() throws Exception {
		client = clientBuilder.getClient();
	}

	public void destroy() {
		client.close();
	}

	public void setDeploymentEventsFileUrl(String deploymentEventsFileUrl) {
		this.deploymentEventsFileUrl = deploymentEventsFileUrl;
	}

	/**
	 * Check if the result of listing S3 object response is empty
	 *
	 * @param result instance of {@link ListObjectsV2Response}
	 * @return true if the result is empty, false otherwise
	 */
	protected boolean isResultEmpty(ListObjectsV2Response result) {
		return (!result.hasCommonPrefixes() || result.commonPrefixes().isEmpty())
			&& (!result.hasContents() || result.contents().isEmpty());
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	public Context createContext(final String id, final String rootFolderPath, final boolean mergingOn,
								 final boolean cacheOn, final int maxAllowedItemsInCache,
								 final boolean ignoreHiddenFiles, Map<String, String> configurationVariables)
		throws RootFolderNotFoundException, StoreException, AuthenticationException {

		S3Uri uri = client.utilities().parseUri(URI.create(CS.removeEnd(rootFolderPath, DELIMITER)));
		String bucketName = uri.bucket().orElseThrow(S3BucketNotConfiguredException::new);
		String rootKey = uri.key().orElse("");
		// A missing manifest is null and uses the list path below. Any other read failure uses that same
		// path and is marked so the deployment events watcher retries the load.
		ManifestLoad load = null;
		boolean manifestLoadFailed = false;
		try {
			load = fetchContentStoreManifest(bucketName, rootKey, null);
		} catch (RuntimeException e) {
			logger.warn("Unable to load content store manifest from s3://{}/{}. Folder lookups will list S3",
				bucketName, toManifestKey(rootKey), e);
			manifestLoadFailed = true;
		}
		if (load != null && load.index != null) {
			if (load.index.typeOf(ContentStoreIndex.ROOT_PATH) == null) {
				throw new RootFolderNotFoundException(format("Root folder '%s' not found", rootFolderPath));
			}
			S3Context context = new S3Context(id, this, rootFolderPath, mergingOn, cacheOn, maxAllowedItemsInCache,
				ignoreHiddenFiles, uri, configurationVariables);
			context.setContentStoreIndex(load.index, load.eTag);
			return context;
		}

		ListObjectsV2Request request = ListObjectsV2Request.builder()
			.bucket(bucketName)
			.prefix(rootKey)
			.delimiter(DELIMITER).build();
		ListObjectsV2Response result = client.listObjectsV2(request);

		if (isResultEmpty(result)) {
			throw new RootFolderNotFoundException(format("Root folder '%s' not found", rootFolderPath));
		}

		S3Context context = new S3Context(id, this, rootFolderPath, mergingOn, cacheOn, maxAllowedItemsInCache,
			ignoreHiddenFiles, uri, configurationVariables);
		if (manifestLoadFailed) {
			context.markContentStoreManifestLoadFailed();
		} else {
			context.setContentStoreIndex(null);
		}
		return context;
	}

	/**
	 * Reloads the content store manifest for a site context. Called when Engine reads the deployment-events
	 * signal so the next content lookups use the manifest published with that signal.
	 * <p>
	 * Contexts that are not backed by S3 are ignored. A missing manifest leaves the context on the S3 list path.
	 * A failed load is marked on the context so the deployment events watcher can retry it.
	 *
	 * @param context the site context, possibly wrapped by store-adapter decorators
	 */
	public static void refreshContentStoreManifest(Context context) {
		S3Context s3Context = findS3Context(context);
		if (s3Context == null || !(s3Context.getStoreAdapter() instanceof S3ContentStoreAdapter adapter)) {
			return;
		}
		adapter.reloadContentStoreManifest(s3Context);
	}

	/**
	 * @param context the site context, possibly wrapped by store-adapter decorators
	 * @return true when the last manifest load for this S3 context failed
	 */
	public static boolean isContentStoreManifestLoadFailed(Context context) {
		S3Context s3Context = findS3Context(context);
		return s3Context != null && s3Context.isContentStoreManifestLoadFailed();
	}

	/**
	 * Fetches the manifest, builds the directory index, and replaces the one held by the context.
	 * When the context already has a manifest ETag, the fetch is conditional. An unchanged manifest
	 * leaves the current index in place. A failed fetch clears the index under the context lock so
	 * lookups list S3, marks the context so the deployment events watcher retries the load, then rethrows.
	 *
	 * @param context the S3 context
	 */
	public void reloadContentStoreManifest(S3Context context) {
		String currentETag = context.getContentStoreManifestETag();
		ManifestLoad load;
		try {
			load = fetchContentStoreManifest(context.getBucket(), context.getKey(), currentETag);
		} catch (RuntimeException e) {
			synchronized (context.getContentStoreIndexLock()) {
				context.markContentStoreManifestLoadFailed();
			}
			throw e;
		}
		synchronized (context.getContentStoreIndexLock()) {
			if (!load.notModified) {
				context.setContentStoreIndex(load.index, load.eTag);
			} else if (currentETag.equals(context.getContentStoreManifestETag())) {
				context.retainContentStoreManifest();
			}
		}
	}

	@Override
	protected Content getContent(Context context, CachingOptions cachingOptions,
								 File file) throws InvalidContextException, StoreException {
		if (!(file instanceof S3Object s3Object)) {
			throw new StoreException(format("'%s' is not an S3 object", file));
		}

		return s3Object;
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	protected File doFindFile(Context context, String path) throws InvalidContextException, StoreException {
		if (context.ignoreHiddenFiles() && isHidden(path)) {
			return null;
		}

		S3Context s3Context = (S3Context) context;
		String bucketName = s3Context.getBucket();
		String key = toS3Key(s3Context, path);
		if (isDeploymentEventsFile(path)) {
			return getObject(s3Context, client, bucketName, key);
		}
		ContentStoreIndex index = currentIndex(s3Context);
		if (index != null) {
			return findFileInIndex(index, s3Context, bucketName, key, path);
		}

		if (isEmpty(FilenameUtils.getExtension(key))) {
			// If it is a folder, check if there are objects with the prefix
			try {
				logger.debug("Checking if S3 prefix 's3://{}/{}' exists", bucketName, key);

				ListObjectsV2Request request = ListObjectsV2Request.builder()
					.bucket(bucketName)
					.prefix(CS.appendIfMissing(key, DELIMITER))
					.delimiter(DELIMITER)
					.build();
				ListObjectsV2Response result = client.listObjectsV2(request);
				if (!isResultEmpty(result)) {
					return new S3Prefix(bucketName, key);
				}
			} catch (S3Exception e) {
				if (e.statusCode() == HttpStatus.SC_NOT_FOUND) {
					logger.debug("S3 prefix 's3://{}/{}' not found", bucketName, key);
				} else {
					throw new StoreException(format("Error listing objects for S3 prefix 's3://%s/%s'", bucketName, key), e);
				}
			}
		} else {
			// If it is a file, get metadata and content for the file
			return getObject(s3Context, client, bucketName, key);
		}
		return null;
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	protected List<File> doGetChildren(Context context, File dir)
		throws InvalidContextException, StoreException {

		if (!(dir instanceof S3Prefix s3Prefix)) {
			throw new StoreException(format("'%s' is not an S3 prefix", dir));
		}

		S3Context s3Context = (S3Context) context;
		String bucketName = s3Context.getBucket();
		ContentStoreIndex index = currentIndex(s3Context);
		if (index != null) {
			return childrenFromIndex(index, s3Context, bucketName, s3Prefix, context.ignoreHiddenFiles());
		}

		logger.debug("Listing objects for S3 prefix 's3://{}/{}'", bucketName, s3Prefix);

		List<File> children = new CachingAwareList<>();
		ListObjectsV2Request request = ListObjectsV2Request.builder()
			.bucket(bucketName)
			.prefix(s3Prefix.getPrefix())
			.delimiter(DELIMITER)
			.build();
		ListObjectsV2Iterable result = client.listObjectsV2Paginator(request);
		for (ListObjectsV2Response page : result) {
			page.commonPrefixes().stream()
				.filter(p -> !context.ignoreHiddenFiles() || !isHidden(p.prefix()))
				.forEach(p -> children.add(new S3Prefix(bucketName, p.prefix())));

			page.contents().stream()
				.filter(s -> !context.ignoreHiddenFiles() || !isHidden(s.key()))
				.forEach(s -> children.add(new S3File(bucketName, s.key())));
		}

		return children;
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	public boolean validate(final Context context) throws StoreException, AuthenticationException {
		S3Context s3Context = (S3Context) context;
		ContentStoreIndex index = currentIndex(s3Context);
		if (index != null) {
			return index.typeOf(ContentStoreIndex.ROOT_PATH) != null;
		}

		String bucketName = s3Context.getBucket();
		String rootPrefix = s3Context.getKey();

		logger.debug("Listing objects for S3 context root prefix 's3://{}/{}'", bucketName, rootPrefix);

		ListObjectsV2Request request = ListObjectsV2Request.builder()
			.bucket(bucketName)
			.prefix(rootPrefix)
			.delimiter(DELIMITER)
			.maxKeys(1)
			.build();
		ListObjectsV2Response result = client.listObjectsV2(request);

		return !isResultEmpty(result);
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	public void destroyContext(final Context context) throws StoreException, AuthenticationException {
		// Nothing to do ...
	}

	private boolean isHidden(final String path) {
		return FilenameUtils.getName(path).startsWith(".");
	}

	/**
	 * The deployment events file is uploaded after the manifest, so it is not listed in the index.
	 */
	protected boolean isDeploymentEventsFile(String path) {
		if (isEmpty(deploymentEventsFileUrl)) {
			return false;
		}
		return ContentStoreUtils.normalizePath(deploymentEventsFileUrl).equals(ContentStoreUtils.normalizePath(path));
	}

	/**
	 * Returns the directory index for the context, loading the manifest on first use.
	 * A resolved null means the manifest object is absent and callers should list S3.
	 */
	protected ContentStoreIndex currentIndex(S3Context context) {
		if (context.isContentStoreIndexResolved()) {
			return context.getContentStoreIndex();
		}
		synchronized (context.getContentStoreIndexLock()) {
			if (context.isContentStoreIndexResolved()) {
				return context.getContentStoreIndex();
			}
			ManifestLoad load = fetchContentStoreManifest(context.getBucket(), context.getKey(), null);
			context.setContentStoreIndex(load.index, load.eTag);
			return context.getContentStoreIndex();
		}
	}

	/**
	 * GETs the manifest object and builds the directory index from its file list.
	 * A stored ETag is sent as {@code If-None-Match}. {@link NoSuchKeyException} is an absent manifest, not a failed read.
	 * A {@code 304 Not Modified} response does not carry a new index.
	 *
	 * @param bucketName  the site bucket
	 * @param rootKey     the site prefix
	 * @param currentETag the ETag from the previous load, or null to fetch unconditionally
	 */
	protected ManifestLoad fetchContentStoreManifest(String bucketName, String rootKey, String currentETag) {
		String manifestKey = toManifestKey(rootKey);
		logger.debug("Loading content store manifest from s3://{}/{}", bucketName, manifestKey);

		GetObjectRequest.Builder request = GetObjectRequest.builder()
			.bucket(bucketName)
			.key(manifestKey);
		if (isNotEmpty(currentETag)) {
			request.ifNoneMatch(currentETag);
		}
		try (ResponseInputStream<GetObjectResponse> object = client.getObject(request.build())) {
			ContentStoreManifest manifest = ContentStoreManifest.readGzipJson(object);
			logger.info("Loaded content store manifest from s3://{}/{}", bucketName, manifestKey);
			return new ManifestLoad(ContentStoreIndex.from(manifest), object.response().eTag(), false);
		} catch (NoSuchKeyException e) {
			logger.info("Content store manifest s3://{}/{} was not found. Folder lookups will list S3",
				bucketName, manifestKey);
			return new ManifestLoad(null, null, false);
		} catch (S3Exception e) {
			if (e.statusCode() == HttpStatus.SC_NOT_MODIFIED) {
				logger.info("Content store manifest s3://{}/{} is unchanged", bucketName, manifestKey);
				return new ManifestLoad(null, currentETag, true);
			}
			if (e.statusCode() == HttpStatus.SC_NOT_FOUND) {
				logger.info("Content store manifest s3://{}/{} was not found. Folder lookups will list S3",
					bucketName, manifestKey);
				return new ManifestLoad(null, null, false);
			}
			throw new StoreException(format("Error loading content store manifest from s3://%s/%s", bucketName, manifestKey), e);
		} catch (IOException e) {
			throw new StoreException(format("Error reading content store manifest from s3://%s/%s", bucketName, manifestKey), e);
		}
	}

	protected File findFileInIndex(ContentStoreIndex index, S3Context context, String bucketName,
				       String key, String path) {
		String type = index.typeOf(path);
		if (type == null) {
			return null;
		}
		if (ContentStoreIndex.TYPE_DIRECTORY.equals(type)) {
			return new S3Prefix(bucketName, key);
		}
		return getObject(context, client, bucketName, key);
	}

	protected List<File> childrenFromIndex(ContentStoreIndex index, S3Context context, String bucketName,
					       S3Prefix directory, boolean ignoreHiddenFiles) {
		String storePath = storePathFromS3Key(context, directory.getPrefix());
		List<File> children = new CachingAwareList<>();
		for (String childPath : index.childrenOf(storePath)) {
			if (ignoreHiddenFiles && isHidden(childPath)) {
				continue;
			}
			String childKey = toS3Key(context, childPath);
			if (index.isDirectory(childPath)) {
				children.add(new S3Prefix(bucketName, childKey));
			} else {
				children.add(new S3File(bucketName, childKey));
			}
		}
		return children;
	}

	protected String toS3Key(S3Context context, String storePath) {
		String key = CS.appendIfMissing(context.getKey(), DELIMITER) + stripStart(storePath, DELIMITER);
		return stripStart(key, DELIMITER);
	}

	protected String toManifestKey(String rootKey) {
		String root = strip(rootKey, DELIMITER);
		if (isEmpty(root)) {
			return ContentStoreManifest.FILE_NAME;
		}
		return root + DELIMITER + ContentStoreManifest.FILE_NAME;
	}

	protected String storePathFromS3Key(S3Context context, String s3Key) {
		String root = strip(context.getKey(), DELIMITER);
		String key = strip(s3Key, DELIMITER);
		String relative = key;
		if (isNotEmpty(root)) {
			if (key.equals(root)) {
				relative = "";
			} else if (key.startsWith(root + DELIMITER)) {
				relative = key.substring(root.length() + 1);
			}
		}
		return ContentStoreUtils.normalizePath(isEmpty(relative) ? ContentStoreIndex.ROOT_PATH : relative);
	}

	protected static S3Context findS3Context(Context context) {
		Context current = context;
		while (current instanceof DecoratedStoreAdapterContext decorated) {
			current = decorated.getActualContext();
		}
		if (current instanceof S3Context s3Context) {
			return s3Context;
		}
		return null;
	}

	/**
	 * Get S3 object metadata and content
	 *
	 * @param context the S3 context
	 * @param client  instance of {@link S3Client}
	 * @param bucket  bucket name
	 * @param key     key name
	 * @return the S3 object, metadata and content included
	 */
	protected S3Object getObject(S3Context context, S3Client client, String bucket, String key) {
		GetObjectRequest getObjectRequest = GetObjectRequest.builder()
			.bucket(bucket)
			.key(key)
			.build();

		logger.debug("Getting S3 object 's3://{}/{}'", bucket, key);

		try (ResponseInputStream<GetObjectResponse> objectIS = client.getObject(getObjectRequest)) {
			GetObjectResponse objectResp = objectIS.response();
			long lastModified = objectResp.lastModified().toEpochMilli();
			long contentLength = objectResp.contentLength();

			if (shouldCache(context, key, contentLength)) {
				byte[] content = IOUtils.toByteArray(objectIS, contentLength);
				return new S3CachedObject(bucket, key, lastModified, contentLength, content);
			} else {
				objectIS.abort();

				return new S3Object(
					bucket,
					key,
					lastModified,
					contentLength,
					getContentSupplierForS3Object(bucket, key, lastModified));
			}
		} catch (NoSuchKeyException e) {
			logger.debug("No S3 object found at 's3://{}/{}'", bucket, key);

			return null;
		} catch (Exception e) {
			throw new StoreException(format("Error getting S3 object 's3://%s/%s'", bucket, key), e);
		}
	}

	/**
	 * Indicates if the content should be cached in memory.
	 * Content is cached if path matches the 'cacheAllowedPaths` and
	 * the content length is not greater than contentMaxLength
	 *
	 * @param context       the S3 context
	 * @param key           the S3 object key
	 * @param contentLength the S3 object content length
	 * @return true if the content should be cached in memory, false otherwise
	 */
	protected boolean shouldCache(S3Context context, String key, long contentLength) {
		String folderPrefix = context.getKey();
		String path = CS.removeStart(stripStart(key, DELIMITER), stripStart(folderPrefix, DELIMITER));

		if (!RegexUtils.matchesAny(path, cacheAllowedPaths)) {
			return false;
		}

		return contentLength <= contentMaxLength;
	}

	protected Supplier<InputStream> getContentSupplierForS3Object(String bucket, String key, long lastModified) {
		GetObjectRequest getObjectRequest = GetObjectRequest.builder()
			.bucket(bucket)
			.key(key)
			.ifUnmodifiedSince(Instant.ofEpochMilli(lastModified))
			.build();

		return () -> client.getObject(getObjectRequest);
	}

	/**
	 * Result of reading the content store manifest. {@code notModified} means S3 returned 304 and {@code index} is unset.
	 */
	private static final class ManifestLoad {

		private final ContentStoreIndex index;
		private final String eTag;
		private final boolean notModified;

		private ManifestLoad(ContentStoreIndex index, String eTag, boolean notModified) {
			this.index = index;
			this.eTag = eTag;
			this.notModified = notModified;
		}

	}

}
