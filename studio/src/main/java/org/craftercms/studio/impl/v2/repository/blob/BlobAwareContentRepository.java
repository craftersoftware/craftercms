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
package org.craftercms.studio.impl.v2.repository.blob;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import static java.lang.String.format;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collection;
import static java.util.Collections.emptyList;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.SequencedCollection;
import java.util.Set;
import static java.util.stream.Collectors.toList;
import java.util.stream.Stream;

import static org.apache.commons.collections4.CollectionUtils.isEmpty;
import static org.apache.commons.collections4.CollectionUtils.union;
import org.apache.commons.collections4.keyvalue.MultiKey;
import org.apache.commons.collections4.map.MultiKeyMap;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import static org.apache.commons.lang3.StringUtils.appendIfMissing;
import static org.apache.commons.lang3.StringUtils.removeStart;
import org.craftercms.commons.config.PublishingTargetResolver;
import org.craftercms.commons.file.blob.Blob;
import org.craftercms.commons.file.blob.exception.BlobStoreConfigurationMissingException;
import org.craftercms.commons.git.utils.AuthenticationType;
import org.craftercms.core.service.Item;
import org.craftercms.studio.api.v1.constant.GitRepositories;
import static org.craftercms.studio.api.v1.constant.StudioConstants.FILE_SEPARATOR;
import org.craftercms.studio.api.v1.exception.BlobNotFoundException;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryCredentialsException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryException;
import org.craftercms.studio.api.v1.exception.repository.RemoteRepositoryNotFoundException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageType.PUBLISH_ALL;
import org.craftercms.studio.api.v2.dal.repository.RepoOperation;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.repository.ContentWriteItem;
import org.craftercms.studio.api.v2.repository.GitPublishCapableRepository;
import org.craftercms.studio.api.v2.repository.PublishItemTO;
import org.craftercms.studio.api.v2.repository.RepositoryItem;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobAwareContentRepository;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobStore;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobStoreResolver;
import org.craftercms.studio.api.v2.repository.publish.GitPublishChangeSet;
import org.craftercms.studio.api.v2.task.TaskManager;
import org.craftercms.studio.api.v2.task.TaskProgress;
import org.craftercms.studio.api.v2.task.TaskProgress.Stage;
import org.craftercms.studio.model.history.ItemVersion;
import org.craftercms.studio.model.history.RepositoryVersion;
import org.craftercms.studio.model.task.PublishTask;
import static org.eclipse.jgit.lib.Constants.HEAD;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.function.ThrowingConsumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;

/**
 * Implementation of {@link org.craftercms.studio.api.v2.repository.ContentRepository}
 * that delegates calls to a {@link StudioBlobStore} when appropriate
 *
 * @author joseross
 * @since 3.1.6
 */
public class BlobAwareContentRepository implements StudioBlobAwareContentRepository {

	private static final Logger logger = LoggerFactory.getLogger(BlobAwareContentRepository.class);

	/**
	 * The extension for the blob files
	 */
	protected String fileExtension;

	protected GitPublishCapableRepository localRepository;

	protected StudioBlobStoreResolver blobStoreResolver;
	private ServicesConfig servicesConfig;
	private TaskManager taskManager;

	protected final ObjectMapper objectMapper = new XmlMapper().enable(SerializationFeature.INDENT_OUTPUT);

	public void setServicesConfig(final ServicesConfig servicesConfig) {
		this.servicesConfig = servicesConfig;
	}

	@SuppressWarnings("unused")
	public void setTaskManager(final TaskManager taskManager) {
		this.taskManager = taskManager;
	}

	public void setFileExtension(String fileExtension) {
		this.fileExtension = fileExtension;
	}

	@SuppressWarnings("unused")
	public void setLocalRepository(GitPublishCapableRepository localRepository) {
		this.localRepository = localRepository;
	}

	@SuppressWarnings("unused")
	public void setBlobStoreResolver(StudioBlobStoreResolver blobStoreResolver) {
		this.blobStoreResolver = blobStoreResolver;
	}

	protected String getOriginalPath(String path) {
		return StringUtils.removeEnd(path, "." + fileExtension);
	}

	protected String getPointerPath(String siteId, String path) {
		return isFolder(siteId, path) ? path : appendIfMissing(path, "." + fileExtension);
	}

	protected boolean isBlobPath(final String path) {
		return path.endsWith("." + fileExtension);
	}

	protected String normalize(String path) {
		return Paths.get(path).normalize().toString();
	}

	protected StudioBlobStore getBlobStore(String site, String... paths)
			throws ServiceLayerException {
		if (StringUtils.isEmpty(site)) {
			return null;
		}

		if (ArrayUtils.isEmpty(paths)) {
			throw new IllegalArgumentException("At least one path needs to be provided");
		}

		return blobStoreResolver.getByPaths(site, paths);
	}

	protected boolean pointersExist(String siteId, String... paths) {
		return Stream.of(paths).
				allMatch(path -> {
					// Check if the pointer path is not the same (this happens for folders)
					String pointerPath = getPointerPath(siteId, path);
					return !StringUtils.equals(path, pointerPath)
							&& localRepository.contentExists(siteId, pointerPath);
				});
	}

	// Start API 1

	@Override
	public boolean contentExists(String site, String path) {
		logger.debug("Check if content '{}' exists in site '{}'", path, site);
		try {
			if (!isFolder(site, path) && pointersExist(site, path)) {
				StudioBlobStore store = getBlobStore(site, path);
				if (store != null) {
					return store.contentExists(site, normalize(path));
				}
			}
			return localRepository.contentExists(site, path);
		} catch (Exception e) {
			logger.error("Failed to check if content exists in site '{}' path '{}'", site, path, e);
			return false;
		}
	}

	@Override
	public void checkContentExists(String site, String path) throws ServiceLayerException {
		if (!isFolder(site, path) && pointersExist(site, path)) {
			StudioBlobStore store = getBlobStore(site, path);
			if (store == null) {
				logger.error("Pointer exists for path '{}' in site '{}', but blob store could not be found", path, site);
				throw new BlobNotFoundException(path, site, format("Pointer exists for path '%s' in site '%s', " +
						"but blob store could not be found", path, site));
			}

			store.checkContentExists(site, normalize(path));
		} else if (!localRepository.contentExists(site, path)) {
			throw new ContentNotFoundException(path, site, "Content not found");
		}
	}

	@Override
	public boolean shallowContentExists(String site, String path) {
		logger.debug("Shallow-check if content '{}' exists in site '{}'", path, site);
		try {
			// Return only if the pointer exists, otherwise do the regular call
			if (!isFolder(site, path) && pointersExist(site, path)) {
				return true;
			}
			return localRepository.shallowContentExists(site, path);
		} catch (Exception e) {
			logger.error("Failed to check if content exists in site '{}' path '{}'", site, path, e);
			return false;
		}
	}

	@Override
	public InputStream getContent(String site, String path, boolean shallow) throws ContentNotFoundException {
		logger.debug("Get content from site '{}' path '{}'", site, path);
		try {
			if (!isFolder(site, path) && pointersExist(site, path)) {
				StudioBlobStore store = getBlobStore(site, path);
				if (store != null) {
					return store.getContent(site, normalize(path), shallow);
				}
			}
			return localRepository.getContent(site, path, shallow);
		} catch (ContentNotFoundException e) {
			throw e;
		} catch (ServiceLayerException e) {
			logger.error("Failed to get content from site '{}' path '{}'. Failed to get a blob store for path", site, path);
			throw new ContentNotFoundException(path, site, format("Failed to get content from site '%s' path '%s'. " +
					"Failed to get a blob store for path", site, path), e);
		}
	}

	@Override
	public long getContentSize(String site, String path) {
		logger.debug("Get content size from site '{}' path '{}'", site, path);
		try {
			if (pointersExist(site, path)) {
				StudioBlobStore store = getBlobStore(site, path);
				if (store != null) {
					// Don't populate the file size for blob-store backed files due to performance reasons
					logger.trace("Returning -1 for the blobstore item size to avoid a slow API call");
					return -1L;
					// return store.getContentSize(site, normalize(path));
				}
			}
			return localRepository.getContentSize(site, path);
		} catch (Exception e) {
			logger.error("Failed to get content size from site '{}' path '{}'", site, path, e);
			return -1L;
		}
	}

	@Override
	public String writeContent(String site, String path, InputStream content) throws ServiceLayerException, UserNotFoundException {
		logger.debug("Write content to site '{}' path '{}'", site, path);
		try (content) {
			StudioBlobStore store = getBlobStore(site, path);
			if (store != null) {
				store.writeContent(site, normalize(path), content);
				Blob reference = store.getReference(normalize(path));
				return localRepository.writeContent(site, getPointerPath(site, path),
						new ByteArrayInputStream(objectMapper.writeValueAsBytes(reference)));
			}
			return localRepository.writeContent(site, path, content);
		} catch (BlobStoreConfigurationMissingException e) {
			logger.debug("No blob store configuration found for site '{}', " +
					"will write '{}' to the local repository", site, path);
			return localRepository.writeContent(site, path, content);
		} catch (ServiceLayerException e) {
			logger.error("Failed to write content to site '{}' path '{}'", site, path, e);
			throw e;
		} catch (IOException e) {
			logger.error("Failed to write content to site '{}' path '{}'", site, path, e);
			throw new ServiceLayerException(e);
		}
	}

	@Override
	public String createFolder(String site, String path) throws ServiceLayerException, UserNotFoundException {
		logger.debug("Create folder in site '{}' path '{}'", site, path);
		try {
			StudioBlobStore store = getBlobStore(site, path);
			if (store != null) {
				store.createFolder(site, normalize(path));
			}
		} catch (BlobStoreConfigurationMissingException e) {
			logger.debug("No blob store configuration found for site '{}', " +
					"will create folder '{}' in the local repository only", site, path);
		} catch (Exception e) {
			logger.error("Failed to create folder in site '{}' path '{}'", site, path, e);
			throw e;
		}
		return localRepository.createFolder(site, path);
	}

	@Override
	public String writeContent(String siteId, Collection<? extends ContentWriteItem> writeItems, Set<String> newFolders, String comment)
			throws ServiceLayerException, UserNotFoundException {
		logger.debug("Write content in site '{}' with lifecycle items '{}'", siteId, writeItems);
		try {
			List<ContentWriteItem> localWriteItems = writeItemsToBlobStores(siteId, writeItems, newFolders);
			return localRepository.writeContent(siteId, localWriteItems, newFolders, comment);
		} catch (IOException e) {
			throw new ServiceLayerException("Failed to continue write operation. Failed to read input", e);
		} catch (BlobStoreConfigurationMissingException e) {
			logger.debug("No blob store configuration found for site '{}', " +
					"will write list of items '{}' to the local repository", siteId, writeItems);
			return localRepository.writeContent(siteId, writeItems, newFolders, comment);
		}
	}

	@Override
	public String deleteContent(final String siteId, final Collection<String> paths,
								Collection<? extends ContentWriteItem> additionalItems,
								Set<String> newFolders)
			throws ServiceLayerException {
		logger.debug("Delete content in site '{}' path '{}'", siteId, paths);
		try {
			List<StudioBlobStore> blobStores = blobStoreResolver.getAll(siteId);
			List<String> gitRepoPaths = new LinkedList<>();
			MultiValueMap<StudioBlobStore, String> pathsByBlobStore = new LinkedMultiValueMap<>();
			for (String path : paths) {
				blobStores.stream()
						.filter(store -> store.isCompatible(path)).findFirst()
						.ifPresentOrElse(store -> {
									pathsByBlobStore.add(store, path);
									gitRepoPaths.add(getPointerPath(siteId, path));
								},
								() -> gitRepoPaths.add(path));
			}
			for (Map.Entry<StudioBlobStore, List<String>> entry : pathsByBlobStore.entrySet()) {
				StudioBlobStore store = entry.getKey();
				for (String path : entry.getValue()) {
					store.deleteContent(siteId, path);
				}
			}
			return localRepository.deleteContent(siteId, gitRepoPaths, writeItemsToBlobStores(siteId, additionalItems, newFolders), newFolders);
		} catch (ServiceLayerException ex) {
			throw ex;
		} catch (Exception e) {
			logger.error("Failed to delete content in site '{}' path '{}'", siteId, paths, e);
			throw new ServiceLayerException(format("Failed to delete content in site '%s' path '%s'", siteId, paths), e);
		}
	}

	@Override
	public void createEmptyFiles(String siteId, Collection<String> paths) throws RepositoryException {
		localRepository.createEmptyFiles(siteId, paths);
	}

	/**
	 * Writes each item to the blob stores (if a store exist for the path) and return a reference
	 * item to be written to the local repository. If a blob store does not exist for the path, the same {@link ContentWriteItem}
	 * is included in the response list.
	 *
	 * @param siteId     the site id
	 * @param writeItems the items to be written
	 * @return the list of items to be written to the local repository
	 * @throws IOException           if there is an error reading the content
	 * @throws ServiceLayerException if there is an error writing the content to the blob store
	 */
	protected List<ContentWriteItem> writeItemsToBlobStores(String siteId, Collection<? extends ContentWriteItem> writeItems,
															Set<String> newFolders) throws IOException, ServiceLayerException {
		for (String newFolder : newFolders) {
			StudioBlobStore store = getBlobStore(siteId, newFolder);
			if (store != null) {
				String parentPath = FILE_SEPARATOR + FilenameUtils.getPathNoEndSeparator(newFolder);
				String name = FilenameUtils.getName(newFolder);
				store.createFolder(siteId, normalize(parentPath), name);
			}
		}
		List<ContentWriteItem> localWriteItems = new ArrayList<>(writeItems.size());
		for (ContentWriteItem item : writeItems) {
			StudioBlobStore store = getBlobStore(siteId, item.repoPath());
			if (store != null) {
				try (InputStream in = item.content()) {
					store.writeContent(siteId, normalize(item.repoPath()), in);
				}
				Blob reference = store.getReference(normalize(item.repoPath()));
				localWriteItems.add(
						new BlobStoreReferenceWriteItem(getPointerPath(siteId, item.repoPath()),
								reference));
			} else {
				localWriteItems.add(item);
			}
		}
		return localWriteItems;
	}

	@Override
	public String moveContent(String site, String fromPath, String toPath, Collection<? extends ContentWriteItem> additionalItems,
							  Set<String> newFolders) throws ServiceLayerException {
		logger.debug("Move content in site '{}' from '{}' to '{}'", site, fromPath, toPath);
		try {
			StudioBlobStore store = getBlobStore(site, fromPath, toPath);
			String localFromPath = fromPath;
			String localToPath = toPath;
			if (store != null) {
				store.moveContent(site, normalize(fromPath), normalize(toPath));
				boolean isFolder = isFolder(site, fromPath);
				localFromPath = isFolder ? fromPath : getPointerPath(site, fromPath);
				localToPath = isFolder ? toPath : getPointerPath(site, toPath);
			}
			return localRepository.moveContent(site, localFromPath, localToPath, writeItemsToBlobStores(site, additionalItems, newFolders), newFolders);
		} catch (ServiceLayerException e) {
			throw e;
		} catch (Exception e) {
			logger.error("Failed to move content in site '{}' from '{}' to '{}'", site, fromPath, toPath, e);
			throw new ServiceLayerException("Failed to move content in site '%s' from '%s' to '%s'".formatted(site, fromPath, toPath), e);
		}
	}

	@Override
	public String copy(String siteId, String sourcePath, String targetPath,
					   Collection<? extends ContentWriteItem> additionalItems, Set<String> newFolders)
			throws ServiceLayerException, UserNotFoundException {
		logger.debug("Copy content in site '{}' from '{}' to '{}'", siteId, sourcePath, targetPath);
		try {
			StudioBlobStore store = getBlobStore(siteId, sourcePath, targetPath);
			String localFromPath = sourcePath;
			String localToPath = targetPath;
			if (store != null) {
				store.copyContent(siteId, normalize(sourcePath), normalize(targetPath));
				boolean isFolder = isFolder(siteId, sourcePath);
				localFromPath = isFolder ? sourcePath : getPointerPath(siteId, sourcePath);
				localToPath = isFolder ? targetPath : getPointerPath(siteId, targetPath);
			}
			return localRepository.copy(siteId, localFromPath, localToPath, writeItemsToBlobStores(siteId, additionalItems, newFolders), newFolders);
		} catch (ServiceLayerException | UserNotFoundException e) {
			logger.error("Failed to copy content in site '{}' from '{}' to '{}'", siteId, sourcePath, targetPath, e);
			throw e;
		} catch (IOException e) {
			logger.error("Failed to copy content in site '{}' from '{}' to '{}'", siteId, sourcePath, targetPath, e);
			throw new ServiceLayerException("Failed to copy content in site '%s' from '%s' to '%s'".formatted(siteId, sourcePath, targetPath), e);
		}
	}

	@Override
	public Collection<RepositoryItem> getContentChildren(String site, String path) throws ServiceLayerException {
		Collection<RepositoryItem> children = localRepository.getContentChildren(site, path);
		return children.stream()
				.map(item -> new RepositoryItem(item.path(), getOriginalPath(item.name()), item.isFolder()))
				.toList();
	}

	@Override
	public List<ItemVersion> getContentItemHistory(String site, String path) throws ServiceLayerException {
		logger.debug("Get version history for site '{}' path '{}'", site, path);
		try {
			if (pointersExist(site, path)) {
				StudioBlobStore store = getBlobStore(site, path);
				if (store != null) {
					return localRepository.getContentItemHistory(site, getPointerPath(site, path));
				}
			}
			return localRepository.getContentItemHistory(site, path);
		} catch (Exception e) {
			logger.error("Failed to get version history for site '{}' path '{}'", site, path, e);
			throw e;
		}
	}

	@Override
	public void duplicateSite(String sourceSiteId, String siteId, String sourceSandboxBranch, String sandboxBranch) throws IOException, ServiceLayerException {
		localRepository.duplicateSite(sourceSiteId, siteId, sourceSandboxBranch, sandboxBranch);
	}

	@Override
	public void duplicateBlobs(String sourceSiteId, String siteId) throws ServiceLayerException {
		logger.info("Duplicating preview blobs from site '{}' to site '{}'", sourceSiteId, siteId);
		duplicateBlobs(sourceSiteId, siteId, GitRepositories.SANDBOX, PublishingTargetResolver.PREVIEW, HEAD);

		if (publishedRepositoryExists(siteId)) {
			if (servicesConfig.isStagingEnvironmentEnabled(siteId)) {
				logger.info("Duplicating staging blobs from site '{}' to site '{}'", sourceSiteId, siteId);
				String stagingEnvironment = servicesConfig.getStagingEnvironment(siteId);
				if (localRepository.commitIdExists(sourceSiteId, GitRepositories.PUBLISHED, stagingEnvironment)) {
					duplicateBlobs(sourceSiteId, siteId, GitRepositories.PUBLISHED, stagingEnvironment, stagingEnvironment);
				}
			}

			logger.info("Duplicating live blobs from site '{}' to site '{}'", sourceSiteId, siteId);
			String liveEnvironment = servicesConfig.getLiveEnvironment(siteId);
			duplicateBlobs(sourceSiteId, siteId, GitRepositories.PUBLISHED, liveEnvironment, liveEnvironment);
		}
	}

	/**
	 * Duplicates the blobs from the source site to the target site
	 *
	 * @param sourceSiteId the source site
	 * @param siteId       the target site
	 * @param repoType     the repository type
	 * @param environment  the environment
	 * @param revstr       A git object references expression (e.g.: HEAD, branch name, commit id)
	 * @throws ServiceLayerException if an error occurs during the operation
	 */
	private void duplicateBlobs(String sourceSiteId, String siteId, GitRepositories repoType, String environment, String revstr) throws ServiceLayerException {
		List<String> siteItemPaths = localRepository.getItemPaths(sourceSiteId, repoType, revstr)
				.stream().filter(this::isBlobPath).toList();
		MultiKeyMap<StudioBlobStore, List<String>> copyItems = new MultiKeyMap<>();
		for (String path : siteItemPaths) {
			String assetPath = getOriginalPath(path);
			StudioBlobStore sourceBlobStore = blobStoreResolver.getByPaths(sourceSiteId, assetPath);
			StudioBlobStore targetBlobStore = blobStoreResolver.getByPaths(siteId, assetPath);
			copyItems.compute(new MultiKey<>(sourceBlobStore, targetBlobStore),
					(MultiKey<? extends StudioBlobStore> k, List<String> currentPaths) -> {
						if (currentPaths == null) {
							currentPaths = new LinkedList<>();
						}
						currentPaths.add(assetPath);
						return currentPaths;
					});
		}

		for (Map.Entry<MultiKey<? extends StudioBlobStore>, List<String>> copyItem : copyItems.entrySet()) {
			StudioBlobStore sourceBlobStore = copyItem.getKey().getKey(0);
			StudioBlobStore targetBlobStore = copyItem.getKey().getKey(1);
			List<String> paths = copyItem.getValue();
			try {
				targetBlobStore.copyBlobs(sourceBlobStore, environment, paths);
			} catch (Exception e) {
				logger.error("Failed to copy blob from source site '{}' to target site '{}'", sourceSiteId, siteId, e);
				throw e;
			}
		}
	}

	@Override
	public Optional<Resource> getContentByCommitId(String site, String path, String commitId) throws ServiceLayerException {
		return localRepository.getContentByCommitId(site, path, commitId);
	}

	@Override
	public void lockItem(String site, String path) throws RepositoryException {
		localRepository.lockItem(site, path);
	}

	@Override
	public boolean isFolder(String siteId, String path) {
		return localRepository.isFolder(siteId, path);
	}

	@Override
	public boolean deleteSite(String siteId) {
		return localRepository.deleteSite(siteId);
	}

	@Override
	public String getRepoLastCommitId(String site) throws RepositoryException {
		return localRepository.getRepoLastCommitId(site);
	}

	@Override
	public void garbageCollectGitRepositories(String siteId) throws RepositoryException {
		localRepository.garbageCollectGitRepositories(siteId);
	}

	// Start API 2

	@Override
	public void createSiteFromBlueprint(String blueprintLocation, String siteId, String sandboxBranch,
										   Map<String, String> params, String creator) throws ServiceLayerException {
		localRepository.createSiteFromBlueprint(blueprintLocation, siteId, sandboxBranch, params, creator);
	}

	@Override
	public boolean commitIdExists(String site, GitRepositories repoType, String commitId) {
		return localRepository.commitIdExists(site, repoType, commitId);
	}

	@Override
	public void createSiteCloneRemote(String siteId, String sandboxBranch, String remoteName, String remoteUrl,
										 String remoteBranch, boolean singleBranch, AuthenticationType authenticationType,
										 String remoteUsername, String remotePassword, String remoteToken,
										 String remotePrivateKey, Map<String, String> params, boolean createAsOrphan,
										 String creator)
			throws InvalidRemoteRepositoryException, InvalidRemoteRepositoryCredentialsException,
			RemoteRepositoryNotFoundException, ServiceLayerException {
		localRepository.createSiteCloneRemote(siteId, sandboxBranch, remoteName, remoteUrl, remoteBranch,
				singleBranch, authenticationType, remoteUsername, remotePassword, remoteToken, remotePrivateKey,
				params, createAsOrphan, creator);
	}

	@Override
	public boolean removeRemote(String siteId, String remoteName) throws RepositoryException {
		return localRepository.removeRemote(siteId, remoteName);
	}

	@Override
	public boolean repositoryExists(String site, GitRepositories repoType) {
		return localRepository.repositoryExists(site, repoType);
	}

	@Override
	public List<String> getSubtreeItems(String site, String path, GitRepositories repoType, String branch) throws RepositoryException {
		return localRepository.getSubtreeItems(site, path, repoType, branch).stream()
				.map(this::getOriginalPath)
				.collect(toList());
	}

	@Override
	public List<RepoOperation> getOperationsFromDelta(String site, String commitIdFrom, String commitIdTo) throws ServiceLayerException {
		return localRepository.getOperationsFromDelta(site, commitIdFrom, commitIdTo).stream()
				.peek(operation -> {
					operation.setPath(getOriginalPath(operation.getPath()));
					operation.setMoveToPath(getOriginalPath(operation.getMoveToPath()));
				})
				.collect(toList());
	}

	@Override
	public Item getItem(String siteId, String path, boolean flatten) {
		return localRepository.getItem(siteId, path, flatten);
	}

	@Override
	public boolean isTargetPublished(final String siteId, final String target) throws RepositoryException, IOException {
		return localRepository.isTargetPublished(siteId, target);
	}

	@Override
	@LogExecutionTime
	public void forAllSitePaths(String siteId,
								ThrowingConsumer<String> directoryProcessor,
								ThrowingConsumer<String> fileProcessor) throws Exception {
		localRepository.forAllSitePaths(siteId, directoryProcessor, f -> fileProcessor.acceptWithException(getOriginalPath(f)));
	}

	@Override
	public void unlockItem(String site, String path) throws RepositoryException {
		localRepository.unlockItem(site, path);
	}

	@Override
	public boolean publishedRepositoryExists(String siteId) throws RepositoryException {
		return localRepository.publishedRepositoryExists(siteId);
	}

	@Override
	public GitPublishChangeSet<? extends PublishItemTO> initialPublish(final PublishPackage publishPackage, final String target) throws ServiceLayerException {
		String siteId = publishPackage.getSite().getSiteId();
		long packageId = publishPackage.getId();
		List<StudioBlobStore> blobStores = blobStoreResolver.getAll(siteId);

		TaskProgress<PublishTask.PublishTaskId, ?> taskProgress = taskManager.getTask(new PublishTask.PublishTaskId(siteId, packageId));
		MultiValueMap<StudioBlobStore, BlobAwareInitialPublishItemTO> pathsByBlobStore = scanRepoForBlobPaths(taskProgress, siteId, blobStores);

		Collection<BlobAwareInitialPublishItemTO> failedItems = initialPublishBlobs(publishPackage, taskProgress, target, pathsByBlobStore);
		List<String> ignoredRepoPaths = failedItems.stream().map(BlobAwareInitialPublishItemTO::getRepoPath).toList();
		String commitId = localRepository.initialPublish(publishPackage, ignoredRepoPaths, target);
		return new GitPublishChangeSet<>(commitId, emptyList(), failedItems.stream().toList());
	}

	/**
	 * Scan the repository for blob paths.
	 * This method will iterate over all the site paths and will filter out the blob paths, then
	 * it will match them with the blob stores and return a map with the paths grouped by the blob store
	 */
	private @NonNull MultiValueMap<StudioBlobStore, BlobAwareInitialPublishItemTO> scanRepoForBlobPaths(final TaskProgress<PublishTask.PublishTaskId, ?> taskProgress,
																										final String siteId, final List<StudioBlobStore> blobStores)
			throws ServiceLayerException {
		MultiValueMap<StudioBlobStore, BlobAwareInitialPublishItemTO> pathsByBlobStore = new LinkedMultiValueMap<>();
		Stage scanStage = taskProgress.startStage("Scanning repo for blob paths");
		try {
			// Ignore directories
			localRepository.forAllFileSitePaths(siteId, p -> {
				if (isBlobPath(p)) {
					blobStores.stream()
							.filter(store -> store.isCompatible(p)).findFirst()
							.ifPresent(
									store -> pathsByBlobStore.add(store, new BlobAwareInitialPublishItemTO(getOriginalPath(p), getRepoPath(p))));
				}
			});
		} catch (Exception e) {
			throw new ServiceLayerException("Failed to get all site paths for initial publish of site '%s'".formatted(siteId), e);
		}
		scanStage.complete();
		return pathsByBlobStore;
	}

	/**
	 * Publishes the blobs for the initial publish
	 *
	 * @param publishPackage   the publish package
	 * @param taskProgress     the task progress
	 * @param target           the target
	 * @param itemsByBlobStore the items by blob store
	 * @return the failed items
	 * @throws ServiceLayerException if an error occurs during the blobs publishing
	 */
	private Collection<BlobAwareInitialPublishItemTO> initialPublishBlobs(final PublishPackage publishPackage, final TaskProgress<?, ?> taskProgress,
																		  final String target, final MultiValueMap<StudioBlobStore, BlobAwareInitialPublishItemTO> itemsByBlobStore) throws ServiceLayerException {
		Collection<BlobAwareInitialPublishItemTO> failedItems = new LinkedList<>();
		int totalItems = itemsByBlobStore.values().stream().mapToInt(List::size).sum();
		Stage copyBlobsStage = taskProgress.startStage("Publishing blobs for target '%s'".formatted(target), totalItems);
		for (Map.Entry<StudioBlobStore, List<BlobAwareInitialPublishItemTO>> entry : itemsByBlobStore.entrySet()) {
			StudioBlobStore blobStore = entry.getKey();

			StudioBlobStore.PublishChangeSet<BlobAwareInitialPublishItemTO> publishResult = blobStore.publish(publishPackage, target, entry.getValue(), copyBlobsStage);
			failedItems.addAll(publishResult.failedItems());
		}
		copyBlobsStage.complete();
		return failedItems;
	}

	@Override
	public <T extends PublishItemTO> GitPublishChangeSet<T> publish(final PublishPackage publishPackage,
																	final String publishingTarget,
																	final Collection<T> publishItems) throws ServiceLayerException, IOException {
		String siteId = publishPackage.getSite().getSiteId();
		List<StudioBlobStore> blobStores = blobStoreResolver.getAll(siteId);
		List<T> failedItems = new LinkedList<>();

		List<BlobAwarePublishItemTOWrapper<T>> gitRepoItems = new LinkedList<>();
		MultiValueMap<StudioBlobStore, BlobAwarePublishItemTOWrapper<T>> itemsByBlobStore = new LinkedMultiValueMap<>();

		for (T publishItem : publishItems) {
			Optional<StudioBlobStore> blobStore = blobStores.stream().filter(store -> store.isCompatible(publishItem.getPath())).findFirst();
			blobStore.ifPresentOrElse(
					store -> itemsByBlobStore.add(store, new BlobAwarePublishItemTOWrapper<>(publishItem, getOriginalPath(publishItem.getPath()))),
					() -> gitRepoItems.add(new BlobAwarePublishItemTOWrapper<>(publishItem, publishItem.getPath())));
		}

		if (!itemsByBlobStore.isEmpty()) {
			int total = itemsByBlobStore.values().stream().mapToInt(List::size).sum();
			Stage blobStage = taskManager.getTask(new PublishTask.PublishTaskId(siteId, publishPackage.getId()))
					.startStage("Publishing blobs for target '%s'".formatted(publishingTarget), total);
			for (Map.Entry<StudioBlobStore, List<BlobAwarePublishItemTOWrapper<T>>> entry : itemsByBlobStore.entrySet()) {
				StudioBlobStore blobStore = entry.getKey();
				List<BlobAwarePublishItemTOWrapper<T>> blobStoreItems = entry.getValue();
				StudioBlobStore.PublishChangeSet<BlobAwarePublishItemTOWrapper<T>> storeChangeset = blobStore.publish(publishPackage,
						publishingTarget, blobStoreItems, blobStage);

				failedItems.addAll(unwrap(storeChangeset.failedItems()));
				gitRepoItems.addAll(storeChangeset.successfulItems().stream()
						.map(BlobAwarePublishItemTOWrapper::getWrappedItem)
						.map(item -> new BlobAwarePublishItemTOWrapper<>(item, getRepoPath(item.getPath())))
						.toList());
			}
			blobStage.complete();
		}

		if (isEmpty(gitRepoItems)) {
			return new GitPublishChangeSet<>(null, emptyList(), failedItems);
		}

		GitPublishChangeSet<BlobAwarePublishItemTOWrapper<T>> committedChangeset;
		if (isEmpty(failedItems) && publishPackage.getPackageType() == PUBLISH_ALL) {
			committedChangeset = localRepository.publishAll(publishPackage, publishingTarget);
		} else {
			committedChangeset = localRepository.publish(publishPackage, publishingTarget, gitRepoItems);
		}

		return new GitPublishChangeSet<>(committedChangeset.commitId(), unwrap(committedChangeset.successfulItems()),
				union(failedItems, unwrap(committedChangeset.failedItems())));
	}

	private <T extends PublishItemTO> Collection<T> unwrap(Collection<BlobAwarePublishItemTOWrapper<T>> items) {
		return items.stream().map(BlobAwarePublishItemTOWrapper::getWrappedItem).toList();
	}

	/**
	 * Gets an asset path and translate it
	 * to the actual file path in git repo.
	 * e.g.:
	 * /static-assets/test/my-image.png
	 * to
	 * static-assets/test/my-image.png.blob
	 *
	 * @param blobPath the asset path
	 * @return the git repo path
	 */
	protected String getRepoPath(final String blobPath) {
		return removeStart(appendIfMissing(blobPath, "." + fileExtension), File.separator);
	}

	@Override
	public List<String> getCommitIdsBetween(String siteId, final String commitFrom, final String commitTo) throws RepositoryException {
		return localRepository.getCommitIdsBetween(siteId, commitFrom, commitTo);
	}

	@Override
	public List<RepositoryVersion> getHistory(String siteId, String commitFrom, int limit) throws ServiceLayerException {
		return localRepository.getHistory(siteId, commitFrom, limit);
	}

	@Override
	public List<String> getIntroducedCommits(String site, String baseCommit, String commitId) throws RepositoryException {
		return localRepository.getIntroducedCommits(site, baseCommit, commitId);
	}

	@Override
	public SequencedCollection<String> validatePublishCommits(final String siteId, final Collection<String> commitIds) throws IOException, ServiceLayerException {
		return localRepository.validatePublishCommits(siteId, commitIds);
	}

	@Override
	public void updateRef(final String siteId, final long packageId,
						  final String commitId, final String target) throws RepositoryException {
		localRepository.updateRef(siteId, packageId, commitId, target);
	}

	/**
	 * ContentWriteItem implementation to hold a reference to a blob
	 */
	private class BlobStoreReferenceWriteItem implements ContentWriteItem {
		private final String repoPath;
		private final Blob blob;

		public BlobStoreReferenceWriteItem(String repoPath, Blob blob) {
			this.repoPath = repoPath;
			this.blob = blob;
		}

		@Override
		public InputStream content() throws IOException {
			return new ByteArrayInputStream(objectMapper.writeValueAsBytes(blob));
		}

		public String repoPath() {
			return repoPath;
		}
	}
}
