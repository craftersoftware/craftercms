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

import static org.eclipse.jgit.lib.Constants.DOT_GIT;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.configuration2.Configuration;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.core.store.ContentStoreManifest;
import org.craftercms.deployer.api.ChangeSet;
import org.craftercms.deployer.api.Deployment;
import org.craftercms.deployer.api.ProcessorExecution;
import org.craftercms.deployer.api.exceptions.DeployerException;
import org.eclipse.jgit.lib.ObjectId;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.MetadataDirective;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static java.lang.String.format;
import static org.craftercms.commons.config.ConfigUtils.getBooleanProperty;
import static org.craftercms.deployer.impl.DeploymentConstants.LATEST_COMMIT_ID_PARAM_NAME;
import static org.craftercms.deployer.impl.DeploymentConstants.PREVIOUS_COMMIT_ID_PARAM_NAME;

/**
 * Writes a single content-store manifest to S3.
 * The manifest lists every file in the local repository so Engine can answer folder
 * existence and children lookups without listing the bucket.
 * <p>
 * A publish that only updates existing files does not change that list. When the manifest
 * already in the bucket was built from the previous commit, the processor leaves the file
 * list in place and advances the stored commit id to this deployment. Created files,
 * deleted files, a missing manifest, a manifest from another commit, or a failed
 * commit-id update rebuild it from the local repository.
 * <p>
 * Runs after the S3 sync and before {@link S3DeploymentEventsProcessor}, so the
 * deployment-events signal is published only after the manifest is in place.
 * <p>
 * Blob pointer files are listed only when {@code ignoreBlobs} is false, the same setting that
 * makes {@link S3SyncProcessor} upload them. The default is true. A pointer that was never
 * uploaded would show up in Engine folder listings and then fail when Engine reads it to find
 * the blob store.
 * <p>
 * When {@code s3SyncProcessor} is set, the manifest uses that processor's file selection.
 * A regular file the sync processor excludes is not indexed. This processor's own patterns are used
 * only when no sync processor is set.
 */
public class S3ContentStoreManifestProcessor extends AbstractS3Processor {

	public static final String CONFIG_KEY_IGNORE_BLOBS = "ignoreBlobs";

	private static final String GIT_ROOT = DOT_GIT + "/";

	private static final int NOT_FOUND = 404;

	private static final String MANIFEST_COMMIT_ID_METADATA = "crafter-manifest-commit-id";

	protected String localRepoUrl;

	/**
	 * The extension used for blob files in the repository
	 */
	protected String blobExtension;

	/**
	 * Indicates if blob pointer files should be left out of the manifest
	 */
	protected boolean ignoreBlobs;

	/**
	 * Sync processor whose include and exclude rules decide which regular files are listed.
	 */
	private S3SyncProcessor s3SyncProcessor;

	@ConstructorProperties({"threadPoolTaskExecutor", "localRepoUrl", "blobExtension"})
	public S3ContentStoreManifestProcessor(ThreadPoolTaskExecutor threadPoolTaskExecutor, String localRepoUrl,
					       String blobExtension) {
		super(threadPoolTaskExecutor);
		this.localRepoUrl = localRepoUrl;
		this.blobExtension = blobExtension;
	}

	public void setS3SyncProcessor(S3SyncProcessor s3SyncProcessor) {
		this.s3SyncProcessor = s3SyncProcessor;
	}

	@Override
	protected void doInit(Configuration config) throws ConfigurationException {
		super.doInit(config);
		ignoreBlobs = getBooleanProperty(config, CONFIG_KEY_IGNORE_BLOBS, true);
	}

	@Override
	protected boolean shouldIncludeFile(String file) {
		if (s3SyncProcessor != null) {
			return s3SyncProcessor.shouldIncludeFile(file);
		}
		return S3PublishedFileSelection.include(file, includeFiles, excludeFiles, ignoreBlobs, blobExtension);
	}

	@Override
	protected ChangeSet doMainProcess(Deployment deployment, ProcessorExecution execution, ChangeSet filteredChangeSet,
					  ChangeSet originalChangeSet) throws DeployerException {
		if (!manifestFileListChanged(filteredChangeSet)) {
			String previousCommitId = getCommitId(deployment, PREVIOUS_COMMIT_ID_PARAM_NAME);
			// The HEAD check and the metadata copy share this client.
			if (previousCommitId != null) {
				try (S3Client client = buildClient()) {
					HeadObjectResponse manifest = manifestMatchingPreviousCommit(client, previousCommitId);
					if (manifest != null && advanceManifestCommitId(client, manifest,
						getCommitId(deployment, LATEST_COMMIT_ID_PARAM_NAME))) {
						logger.info("Skipping content store manifest rebuild for s3://{}/{} because it matches the previous commit",
							getBucket(), getS3Key(ContentStoreManifest.FILE_NAME));
						return null;
					}
				}
			}
		}

		Path repoRoot = Path.of(localRepoUrl);
		if (!Files.isDirectory(repoRoot)) {
			throw new DeployerException("Local repository does not exist @ " + repoRoot);
		}

		List<String> paths;
		try {
			paths = listPublishedFiles(repoRoot);
		} catch (IOException e) {
			throw new DeployerException("Error reading local repository @ " + repoRoot, e);
		}

		ContentStoreManifest manifest = ContentStoreManifest.ofPaths(paths);
		byte[] body;
		try {
			body = manifest.toGzipJson();
		} catch (IOException e) {
			throw new DeployerException("Error writing content store manifest", e);
		}

		String key = getS3Key(ContentStoreManifest.FILE_NAME);
		logger.info("Uploading content store manifest with {} files to s3://{}/{}", paths.size(), getBucket(), key);

		try (S3Client client = buildClient()) {
			PutObjectRequest.Builder request = PutObjectRequest.builder()
				.bucket(getBucket())
				.key(key)
				.contentType("application/gzip");
			String commitId = getCommitId(deployment, LATEST_COMMIT_ID_PARAM_NAME);
			if (commitId != null) {
				request.metadata(Map.of(MANIFEST_COMMIT_ID_METADATA, commitId));
			}
			client.putObject(request.build(), RequestBody.fromBytes(body));
		} catch (Exception e) {
			throw new DeployerException(format("Error uploading content store manifest to s3://%s/%s", getBucket(), key), e);
		}

		return null;
	}

	/**
	 * Created and deleted files change the manifest. Updates do not. A missing change set is rebuilt
	 * because the file list cannot be confirmed.
	 */
	protected boolean manifestFileListChanged(ChangeSet changeSet) {
		if (changeSet == null) {
			return true;
		}
		return CollectionUtils.isNotEmpty(changeSet.getCreatedFiles())
			|| CollectionUtils.isNotEmpty(changeSet.getDeletedFiles());
	}

	/**
	 * @param client           the client shared with the metadata update
	 * @param previousCommitId the commit that is the base of this deployment
	 * @return the manifest header when it was built from {@code previousCommitId}.
	 * A missing manifest, missing metadata, a different commit, or a check failure returns null so the caller
	 * rebuilds it.
	 */
	protected HeadObjectResponse manifestMatchingPreviousCommit(S3Client client, String previousCommitId) {
		String bucket = getBucket();
		String key = getS3Key(ContentStoreManifest.FILE_NAME);
		try {
			HeadObjectResponse response = client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build());
			String manifestCommitId = metadataValue(response, MANIFEST_COMMIT_ID_METADATA);
			if (previousCommitId.equals(manifestCommitId)) {
				return response;
			}
			logger.info("Content store manifest s3://{}/{} does not match the previous commit. Rebuilding it",
				bucket, key);
			return null;
		} catch (S3Exception e) {
			if (e.statusCode() == NOT_FOUND) {
				logger.info("Content store manifest s3://{}/{} was not found. Rebuilding it", bucket, key);
			} else {
				logger.warn("Unable to check content store manifest s3://{}/{}. Rebuilding it", bucket, key, e);
			}
			return null;
		} catch (Exception e) {
			logger.warn("Unable to check content store manifest s3://{}/{}. Rebuilding it", bucket, key, e);
			return null;
		}
	}

	/**
	 * Copies the manifest onto itself so its commit id metadata becomes {@code latestCommitId}.
	 * The file list is unchanged. S3 only replaces metadata when the object is copied with
	 * {@link MetadataDirective#REPLACE}.
	 *
	 * @return false when the copy fails, so the caller rebuilds the manifest instead of failing the deployment
	 */
	private boolean advanceManifestCommitId(S3Client client, HeadObjectResponse manifest, String latestCommitId) {
		if (latestCommitId == null || latestCommitId.equals(metadataValue(manifest, MANIFEST_COMMIT_ID_METADATA))) {
			return true;
		}

		String bucket = getBucket();
		String key = getS3Key(ContentStoreManifest.FILE_NAME);
		Map<String, String> metadata = new HashMap<>();
		if (manifest.metadata() != null) {
			metadata.putAll(manifest.metadata());
		}
		metadata.put(MANIFEST_COMMIT_ID_METADATA, latestCommitId);

		CopyObjectRequest.Builder request = CopyObjectRequest.builder()
			.sourceBucket(bucket)
			.sourceKey(key)
			.destinationBucket(bucket)
			.destinationKey(key)
			.metadataDirective(MetadataDirective.REPLACE)
			.metadata(metadata);
		if (manifest.contentType() != null) {
			request.contentType(manifest.contentType());
		}

		logger.info("Updating content store manifest commit id for s3://{}/{} to {}", bucket, key, latestCommitId);
		try {
			client.copyObject(request.build());
			return true;
		} catch (Exception e) {
			logger.warn("Unable to update content store manifest commit id for s3://{}/{}. Rebuilding it",
				bucket, key, e);
			return false;
		}
	}

	private static String metadataValue(HeadObjectResponse response, String name) {
		if (response.metadata() == null) {
			return null;
		}
		return response.metadata().get(name);
	}

	private String getCommitId(Deployment deployment, String paramName) {
		if (deployment == null) {
			return null;
		}
		Object commitId = deployment.getParam(paramName);
		if (commitId instanceof ObjectId) {
			return ((ObjectId) commitId).name();
		}
		return commitId != null ? commitId.toString() : null;
	}

	/**
	 * Lists the files in the local repository that pass the same selection rule as {@link S3SyncProcessor}.
	 * Blob pointer files are included only when {@code ignoreBlobs} is false.
	 * {@code .git} directories are not entered.
	 *
	 * @param repoRoot the local git working tree
	 * @return store paths beginning with {@code /}
	 * @throws IOException if the repository cannot be walked
	 */
	protected List<String> listPublishedFiles(Path repoRoot) throws IOException {
		List<String> paths = new ArrayList<>();
		Files.walkFileTree(repoRoot, new SimpleFileVisitor<>() {
			@Override
			public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
				Path fileName = dir.getFileName();
				if (!dir.equals(repoRoot) && fileName != null && DOT_GIT.equals(fileName.toString())) {
					return FileVisitResult.SKIP_SUBTREE;
				}
				return FileVisitResult.CONTINUE;
			}

			@Override
			public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
				if (!Files.isRegularFile(file)) {
					return FileVisitResult.CONTINUE;
				}
				String relative = repoRoot.relativize(file).toString().replace('\\', '/');
				if (DOT_GIT.equals(relative) || relative.startsWith(GIT_ROOT)) {
					return FileVisitResult.CONTINUE;
				}
				String storePath = "/" + relative;
				if (shouldIncludeFile(storePath)) {
					paths.add(storePath);
				}
				return FileVisitResult.CONTINUE;
			}
		});
		return paths;
	}

}
