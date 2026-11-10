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
package org.craftercms.studio.impl.v2.repository.blob.s3;

import org.apache.commons.collections4.ListUtils;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.apache.commons.lang3.ArrayUtils;
import org.craftercms.commons.aws.AwsUtils;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.commons.file.blob.Blob;
import org.craftercms.commons.file.blob.exception.BlobStoreException;
import org.craftercms.commons.file.blob.impl.s3.AwsS3BlobStore;
import org.craftercms.studio.api.v1.exception.BlobNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v2.dal.publish.PublishItem;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.exception.blob.BlobStoreNotWritableModeException;
import org.craftercms.studio.api.v2.exception.publish.PublishException;
import org.craftercms.studio.api.v2.repository.PublishItemTO;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobStore;
import org.craftercms.studio.api.v2.task.TaskProgress;
import org.craftercms.studio.impl.v2.utils.PublishUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.paginators.ListObjectsV2Iterable;

import java.beans.ConstructorProperties;
import java.io.InputStream;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

import static java.lang.String.format;
import static java.util.Collections.emptyList;
import static java.util.stream.Collectors.groupingBy;
import static org.apache.commons.collections4.CollectionUtils.subtract;
import static org.apache.commons.io.FilenameUtils.getExtension;
import static org.apache.commons.lang3.ObjectUtils.isNotEmpty;
import static org.apache.commons.lang3.StringUtils.*;
import static org.craftercms.commons.config.ConfigUtils.getBooleanProperty;
import static org.craftercms.studio.api.v2.dal.publish.PublishItem.Action.ADD;
import static org.craftercms.studio.api.v2.dal.publish.PublishItem.Action.DELETE;
import static org.craftercms.studio.impl.v1.service.aws.AwsUtils.*;

/**
 * Implementation of {@link StudioBlobStore} for AWS S3
 *
 * @author joseross
 * @since 3.1.6
 */
public class StudioAwsS3BlobStore extends AwsS3BlobStore implements StudioBlobStore {


	private static final Logger logger = LoggerFactory.getLogger(StudioAwsS3BlobStore.class);

	protected boolean readOnly;

	private final ThreadPoolTaskExecutor taskExecutor;

	@ConstructorProperties({"taskExecutor"})
	public StudioAwsS3BlobStore(final ThreadPoolTaskExecutor taskExecutor) {
		this.taskExecutor = taskExecutor;
	}

	@Override
	public void doInit(HierarchicalConfiguration<ImmutableNode> config) throws ConfigurationException {
		super.doInit(config);
		readOnly = getBooleanProperty(config, CONFIG_KEY_READ_ONLY, false);
	}


	/**
	 * Checks that the blob store is in writable mode (readOnly = false) and throws
	 * an exception if it is not.
	 *
	 * @throws BlobStoreNotWritableModeException is the blob store is in read-only mode
	 */
	protected void checkReadWriteMode() throws ServiceLayerException {
		if (readOnly) {
			throw new BlobStoreNotWritableModeException(format("BlobStore '%s' is in read-only mode", id));
		}
	}

	protected boolean isFolder(String path) {
		return isEmpty(getExtension(path));
	}

	protected String getFullKey(Mapping mapping, String path) {
		return mapping.target + "/" + getKey(mapping, path);
	}

	@Override
	public Blob getReference(String path) {
		Mapping mapping = getMapping(publishingTargetResolver.getPublishingTarget());
		try {
			HeadObjectRequest headObjectRequest = HeadObjectRequest.builder()
				.bucket(mapping.target)
				.key(getKey(mapping, path))
				.build();
			HeadObjectResponse headObjectResponse = getClient().headObject(headObjectRequest);
			return new Blob(id, headObjectResponse.eTag());
		} catch (Exception e) {
			throw new BlobStoreException(format("Error creating reference for content at '%s'", getFullKey(mapping, path)), e);
		}
	}

	@Override
	public boolean isReadOnly() {
		return readOnly;
	}

	// Start API 1

	@Override
	public boolean contentExists(String site, String path) {
		Mapping mapping = getMapping(publishingTargetResolver.getPublishingTarget());
		logger.debug("Check if content exists at site '{}' path '{}'", site, getFullKey(mapping, path));
		try {
			HeadObjectRequest headObjectRequest = HeadObjectRequest.builder()
				.bucket(mapping.target)
				.key(getKey(mapping, path))
				.build();
			getClient().headObject(headObjectRequest);
			return true;
		} catch (NoSuchKeyException e) {
			return false;
		} catch (Exception e) {
			logger.error("Failed to check if content exists at site '{}' path '{}'",
				site, getFullKey(mapping, path), e);
			throw new BlobStoreException(format("Failed to check if content exists at site '%s' path '%s'",
				site, getFullKey(mapping, path)), e);
		}
	}

	@Override
	public void checkContentExists(String site, String path) throws ServiceLayerException {
		if (!contentExists(site, path)) {
			throw new BlobNotFoundException(path, site, format("Content does not exist in S3 Blobstore at '%s' for site '%s'", path, site));
		}
	}

	@Override
	public boolean shallowContentExists(String site, String path) {
		return false;
	}

	@Override
	public InputStream getContent(String site, String path, boolean shallow) {
		Mapping previewMapping = getMapping(publishingTargetResolver.getPublishingTarget());
		logger.debug("Get content from site '{}' path '{}'", site, getFullKey(previewMapping, path));
		try {
			GetObjectRequest getObjectRequest = GetObjectRequest.builder()
				.bucket(previewMapping.target)
				.key(getKey(previewMapping, path))
				.build();
			return getClient().getObject(getObjectRequest);
		} catch (Exception e) {
			logger.error("Failed to get content from site '{}' path '{}'",
				site, getFullKey(previewMapping, path), e);
			throw new BlobStoreException(format("Failed to get content from site '%s' path '%s'",
				site, getFullKey(previewMapping, path)), e);
		}
	}

	@Override
	public long getContentSize(String site, String path) {
		Mapping previewMapping = getMapping(publishingTargetResolver.getPublishingTarget());
		logger.debug("Get content size from site '{}' path '{}'", site, getFullKey(previewMapping, path));
		try {
			HeadObjectRequest headObjectRequest = HeadObjectRequest.builder()
				.bucket(previewMapping.target)
				.key(getKey(previewMapping, path))
				.build();
			HeadObjectResponse headObjectResponse = getClient().headObject(headObjectRequest);
			return headObjectResponse.contentLength();
		} catch (Exception e) {
			logger.error("Failed to get content size from site '{}' path '{}'",
				site, getFullKey(previewMapping, path), e);
			throw new BlobStoreException(format("Failed to get content size from site '%s' path '%s'",
				site, getFullKey(previewMapping, path)), e);
		}
	}

	@Override
	public void writeContent(String site, String path, InputStream content) throws ServiceLayerException {
		checkReadWriteMode();
		Mapping previewMapping = getMapping(publishingTargetResolver.getPublishingTarget());
		logger.debug("Upload content to site '{}' path '{}'", site, getFullKey(previewMapping, path));
		try {
			uploadStream(previewMapping.target,
				getKey(previewMapping, path), getClient(), MIN_PART_SIZE, path, content);
		} catch (Exception e) {
			logger.error("Failed to upload content to site '{}' path '{}'",
				site, getFullKey(previewMapping, path), e);
			throw new BlobStoreException(format("Failed to upload content to site '%s' path '%s'",
				site, getFullKey(previewMapping, path)), e);
		}
	}

	@Override
	public void createFolder(String site, String path, String name) throws ServiceLayerException {
		checkReadWriteMode();
		// Do nothing, S3 has no folders
	}

	@Override
	public void createFolder(String site, String path) throws ServiceLayerException {
		checkReadWriteMode();
		// Do nothing, S3 has no folders
	}

	@Override
	public void deleteContent(String site, String path) throws ServiceLayerException {
		checkReadWriteMode();
		Mapping previewMapping = getMapping(publishingTargetResolver.getPublishingTarget());
		logger.debug("Delete content at site '{}' path '{}'", site, getFullKey(previewMapping, path));
		if (!isFolder(path)) {
			try {
				deleteS3Object(getClient(), previewMapping.target, getKey(previewMapping, path));
			} catch (Exception e) {
				logger.error("Failed to delete content at site '{}' path '{}'",
					site, getFullKey(previewMapping, path), e);
				throw new BlobStoreException(format("Failed to delete content at site '%s' path '%s'",
					site, getFullKey(previewMapping, path)), e);
			}
		} else {
			ListObjectsV2Request request = ListObjectsV2Request.builder()
				.bucket(previewMapping.target)
				.prefix(appendIfMissing(getKey(previewMapping, path), "/"))
				.build();
			try {
				ListObjectsV2Iterable result = getClient().listObjectsV2Paginator(request);
				for (ListObjectsV2Response page : result) {
					String[] keys = page.contents().stream()
						.map(S3Object::key)
						.toList()
						.toArray(new String[]{});
					if (ArrayUtils.isNotEmpty(keys)) {
						logger.trace("Delete content items at site '{}' paths '{}' from bucket '{}'",
							site, Arrays.toString(keys), previewMapping.target);
						try {
							deleteS3Objects(getClient(), previewMapping.target, keys);
						} catch (Exception e) {
							logger.error("Failed to delete content items at site '{}' paths '{}' from bucket '{}'",
								site, Arrays.toString(keys), previewMapping.target, e);
							throw new BlobStoreException(format("Failed to delete content items at site '%s' " +
									"paths '%s' from bucket '%s'",
								site, Arrays.toString(keys), previewMapping.target), e);
						}
					}
				}
			} catch (Exception e) {
				logger.error("Failed to list content items at site '{}' path '{}'",
					site, getFullKey(previewMapping, path), e);
				throw new BlobStoreException(format("Failed to list content items at site '%s' path '%s'",
					site, getFullKey(previewMapping, path)), e);
			}
		}
	}

	@Override
	public void moveContent(String site, String fromPath, String toPath) throws ServiceLayerException {
		checkReadWriteMode();
		Mapping previewMapping = getMapping(publishingTargetResolver.getPublishingTarget());
		logger.debug("Move content in site '{}' from '{}' to '{}'", site,
				getFullKey(previewMapping, fromPath), getFullKey(previewMapping, toPath));
		try {
			if (isFolder(fromPath)) {
				moveFolder(site, fromPath, toPath, previewMapping);
			} else {
				copyFile(previewMapping.target, getKey(previewMapping, fromPath),
						previewMapping.target, getKey(previewMapping, toPath), COPY_PART_SIZE, this::getClient);
				deleteS3Object(getClient(), previewMapping.target, getKey(previewMapping, fromPath));
			}
		} catch (Exception e) {
			logger.error("Failed to move content in site '{}' from '{}' to '{}'",
					site,
					getFullKey(previewMapping, fromPath),
					getFullKey(previewMapping, toPath),
					e);
			throw new BlobStoreException(format("Failed to move content in site '%s' from '%s' to '%s'",
					site,
					getFullKey(previewMapping, fromPath),
					getFullKey(previewMapping, toPath)), e);
		}
	}

	/**
	 * Move a folder from one path to another in the S3 bucket.
	 * @param site the site id
	 * @param fromPath the path to move the content from
	 * @param toPath the path to move the content to
	 * @param previewMapping the mapping for the preview target
	 */
	protected void moveFolder(String site, String fromPath, String toPath, Mapping previewMapping) {
		ListObjectsV2Request request = ListObjectsV2Request.builder()
				.bucket(previewMapping.target)
				.prefix(appendIfMissing(getKey(previewMapping, fromPath), "/"))
				.build();
		ListObjectsV2Iterable result = getClient().listObjectsV2Paginator(request);
		for (ListObjectsV2Response page : result) {
			String[] keys = page.contents().stream()
					.map(S3Object::key)
					.toList()
					.toArray(new String[]{});
			copyKeys(site, fromPath, toPath, previewMapping, keys);
			try {
				if (isNotEmpty(keys)) {
					deleteS3Objects(getClient(), previewMapping.target, keys);
				}
			} catch (Exception e) {
				logger.error("Failed to delete content in site '{}' paths '{}' from bucket '{}'",
						site, Arrays.toString(keys), previewMapping.target, e);
				throw new BlobStoreException(format("Failed to delete content in site '%s' paths " +
								"'%s' from bucket '%s'",
						site, Arrays.toString(keys), previewMapping.target), e);
			}
		}
	}

	@Override
	public void copyContent(String site, String fromPath, String toPath) throws ServiceLayerException {
		checkReadWriteMode();
		Mapping previewMapping = getMapping(publishingTargetResolver.getPublishingTarget());
		logger.debug("Copy content in site '{}' from '{}' to '{}'",
				site, getFullKey(previewMapping, fromPath), getFullKey(previewMapping, toPath));
		try {
			if (isFolder(fromPath)) {
				copyFolder(site, fromPath, toPath, previewMapping);
			} else {
				copyFile(previewMapping.target, getKey(previewMapping, fromPath), previewMapping.target,
						getKey(previewMapping, toPath), COPY_PART_SIZE, this::getClient);
			}
		} catch (Exception e) {
			logger.error("Failed to copy content in site '{}' from '{}' to '{}'",
					site,
					getFullKey(previewMapping, fromPath),
					getFullKey(previewMapping, toPath),
					e);
			throw new BlobStoreException(format("Failed to copy content in site '%s' from '%s' to '%s'",
					site,
					getFullKey(previewMapping, fromPath),
					getFullKey(previewMapping, toPath)), e);
		}
	}

	/**
	 * Copy a folder from one path to another in the S3 bucket.
	 *
	 * @param site           the site id
	 * @param fromPath       the path to copy the content from
	 * @param toPath         the path to copy the content to
	 * @param previewMapping the mapping for the preview target
	 */
	protected void copyFolder(String site, String fromPath, String toPath, Mapping previewMapping) {
		ListObjectsV2Request request = ListObjectsV2Request.builder()
				.bucket(previewMapping.target)
				.prefix(appendIfMissing(getKey(previewMapping, fromPath), "/"))
				.build();
		ListObjectsV2Iterable result = getClient().listObjectsV2Paginator(request);
		for (ListObjectsV2Response page : result) {
			String[] keys = page.contents().stream()
					.map(S3Object::key)
					.toList()
					.toArray(new String[]{});
			copyKeys(site, fromPath, toPath, previewMapping, keys);
		}
	}

	/**
	 * Copy the keys from one path to another in the S3 bucket.
	 *
	 * @param site           the site id
	 * @param fromPath       the path to copy the content from
	 * @param toPath         the path to copy the content to
	 * @param previewMapping the mapping for the preview target
	 * @param keys           the keys to copy
	 */
	protected void copyKeys(String site, String fromPath, String toPath, Mapping previewMapping, String[] keys) {
		for (String key : keys) {
			String filePath =
					Paths.get(getKey(previewMapping, fromPath)).relativize(Paths.get(key)).toString();
			logger.trace("Copy content in site '{}' from '{}' to '{}'",
					site,
					getFullKey(previewMapping, key),
					getFullKey(previewMapping, toPath + "/" + filePath));
			try {
				copyFile(previewMapping.target, key, previewMapping.target,
						getKey(previewMapping, toPath + "/" + filePath), COPY_PART_SIZE, this::getClient);
			} catch (Exception e) {
				logger.error("Failed to copy content in site '{}' from '{}' to '{}'",
						site,
						getFullKey(previewMapping, key),
						getFullKey(previewMapping, toPath + "/" + filePath),
						e);
				throw new BlobStoreException(format("Failed to copy content in site '%s' from '%s' to '%s'",
						site,
						getFullKey(previewMapping, key),
						getFullKey(previewMapping, toPath + "/" + filePath)), e);
			}
		}
	}

	@Override
	public <T extends PublishItemTO> PublishChangeSet<T> publish(final PublishPackage publishPackage,
								     final String publishingTarget,
								     final Collection<T> blobStoreItems,
								     final TaskProgress.Stage stage) {
		final String siteId = publishPackage.getSite().getSiteId();
		// If readonly, fail everything so shadow files are not committed
		if (readOnly) {
			logger.warn("Publish request ignored in blobstore '{}' for site '{}', package '{}' because it is readonly",
				id, siteId, publishPackage.getId());
			return new PublishChangeSet<>(blobStoreItems, emptyList());
		}

		Mapping previewMapping = getMapping(publishingTargetResolver.getPublishingTarget());
		Mapping targetMapping = getMapping(publishingTarget);

		logger.info("Perform Publish for site '{}' to target '{}'", siteId, targetMapping);

		Map<PublishItem.Action, List<T>> itemsByAction = blobStoreItems.stream().collect(groupingBy(PublishItemTO::getAction, Collectors.toList()));
		Collection<T> failedItems = new ArrayList<>();
		for (List<? extends PublishItemTO> batch : ListUtils.partition(new LinkedList<>(itemsByAction.computeIfAbsent(DELETE, k -> emptyList())), DELETE_BATCH_SIZE)) {
			String[] keys = batch.stream().map(PublishItemTO::getPath).map(path -> getKey(targetMapping, path)).toArray(String[]::new);
			deleteS3Objects(getClient(), targetMapping.target, keys);
			batch.forEach(PublishItemTO::setCompleted);
			stage.advance(batch.size());
		}

		List<AwsUtils.CopyPathRequest> updatedPaths = itemsByAction.computeIfAbsent(ADD, k -> emptyList()).stream()
			.map(i -> getRequest(i, failedItems, stage))
			.toList();

		if (isNotEmpty(updatedPaths)) {
			AwsUtils.copyObjectsResultAware(getAsyncClient(), taskExecutor.getThreadPoolExecutor(),
				previewMapping.target, previewMapping.prefix,
				targetMapping.target, targetMapping.prefix, updatedPaths);
		}
		logger.info("Completed Publish for site '{}', package '{}' to target '{}'", siteId, publishPackage.getId(), publishingTarget);
		return new PublishChangeSet<>(subtract(blobStoreItems, failedItems), failedItems);
	}

	private <T extends PublishItemTO> AwsUtils.CopyPathRequest getRequest(final T publishItemTO, final Collection<T> failedItems, TaskProgress.Stage stage) {
		return new AwsUtils.CopyPathRequest() {
			@Override
			public String getPath() {
				return publishItemTO.getPath();
			}

			@Override
			public void fail(Throwable throwable) {
				try {
					publishItemTO.setFailed(PublishUtils.translateItemException(throwable));
					failedItems.add(publishItemTO);
					stage.advanceOne();
					stage.setErrors();
				} catch (PublishException e) {
					throw new BlobStoreException(format("Unable to continue publish package: %s", e.getMessage()), e);
				}
			}

			@Override
			public void complete() {
				publishItemTO.setCompleted();
				stage.advanceOne();
			}
		};
	}

	@Override
	public void copyBlobs(final StudioBlobStore source, final String sourceEnvironment, final String targetEnvironment, final List<String> items) {
		if (!(source instanceof StudioAwsS3BlobStore sourceStudioBlobStore)) {
			throw new UnsupportedOperationException("Source blob store is not an instance of StudioAwsS3BlobStore");
		}

		Mapping sourceMapping = sourceStudioBlobStore.getMapping(sourceEnvironment);
		Mapping targetMapping = getMapping(targetEnvironment);

		if (targetMapping.equals(sourceMapping)) {
			logger.info("Source and target mappings are the same, skipping copy operation");
			return;
		}
		AwsUtils.copyObjects(getAsyncClient(), taskExecutor.getThreadPoolExecutor(),
			sourceMapping.target, sourceMapping.prefix,
			targetMapping.target, targetMapping.prefix, items,
			AwsUtils.ignoreMissingObject());
	}

	/**
	 * Delete an S3 object
	 *
	 * @param client     instance of {@link S3Client}
	 * @param bucketName bucket name
	 * @param keyName    key name
	 */
	private void deleteS3Object(S3Client client, String bucketName, String keyName) {
		DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
			.bucket(bucketName)
			.key(keyName)
			.build();
		client.deleteObject(deleteObjectRequest);
	}

	/**
	 * Delete an array of S3 objects
	 *
	 * @param client     instance of {@link S3Client}
	 * @param bucketName bucket name
	 * @param keys       list of key name
	 */
	private void deleteS3Objects(S3Client client, String bucketName, String[] keys) {
		List<ObjectIdentifier> identifiers = new ArrayList<>();
		for (String key : keys) {
			identifiers.add(ObjectIdentifier.builder().key(key).build());
		}
		DeleteObjectsRequest request = DeleteObjectsRequest.builder()
			.bucket(bucketName)
			.delete(Delete.builder().objects(identifiers).build())
			.build();
		client.deleteObjects(request);
		identifiers.clear();
	}
}
