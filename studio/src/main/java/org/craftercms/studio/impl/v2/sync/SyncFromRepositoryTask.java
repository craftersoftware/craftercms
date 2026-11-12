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

package org.craftercms.studio.impl.v2.sync;

import java.beans.ConstructorProperties;
import java.io.IOException;
import static java.lang.String.format;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Timestamp;
import static java.time.Instant.now;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collection;
import static java.util.Comparator.comparing;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import static java.util.Objects.isNull;
import java.util.Set;
import java.util.stream.Stream;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.collections4.ListUtils;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang.ArrayUtils;
import static org.apache.commons.lang3.StringUtils.EMPTY;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.apache.commons.lang3.Strings.CS;
import org.apache.ibatis.session.ExecutorType;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.craftercms.commons.lang.RegexUtils;
import static org.craftercms.studio.api.v1.constant.DmConstants.ROOT_PATTERN_ASSETS;
import static org.craftercms.studio.api.v1.constant.DmConstants.ROOT_PATTERN_PAGES;
import static org.craftercms.studio.api.v1.constant.DmConstants.SLASH_INDEX_FILE;
import static org.craftercms.studio.api.v1.constant.DmConstants.XML_PATTERN;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_FOLDER;
import static org.craftercms.studio.api.v1.constant.StudioConstants.FILE_SEPARATOR;
import static org.craftercms.studio.api.v1.constant.StudioXmlConstants.DOCUMENT_ELM_CONTENT_TYPE;
import static org.craftercms.studio.api.v1.constant.StudioXmlConstants.DOCUMENT_ELM_DISABLED;
import static org.craftercms.studio.api.v1.constant.StudioXmlConstants.DOCUMENT_ELM_INTERNAL_TITLE;
import static org.craftercms.studio.api.v1.constant.StudioXmlConstants.DOCUMENT_ELM_SAVED_AS_DRAFT;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.dal.AuditLog;
import static org.craftercms.studio.api.v2.dal.AuditLog.createAuditLogEntry;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.ACTOR_ID_GIT;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_CANCEL_PUBLISH_PACKAGE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_GIT_CHANGES;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.ORIGIN_GIT;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_PUBLISH_PACKAGE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_SITE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_SYNCED_COMMIT;
import org.craftercms.studio.api.v2.dal.AuditLogParameter;
import org.craftercms.studio.api.v2.dal.DependencyDAO;
import org.craftercms.studio.api.v2.dal.Item;
import org.craftercms.studio.api.v2.dal.ItemDAO;
import static org.craftercms.studio.api.v2.dal.ItemState.DISABLED;
import static org.craftercms.studio.api.v2.dal.ItemState.NEW;
import static org.craftercms.studio.api.v2.dal.ItemState.SAVE_ON_MASK;
import static org.craftercms.studio.api.v2.dal.ItemState.SYNC_FROM_REPOSITORY_OFF_MASK;
import org.craftercms.studio.api.v2.dal.ProcessedCommitsDAO;
import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.dal.repository.RepoOperation;
import org.craftercms.studio.api.v2.event.repository.RepositoryEvent;
import org.craftercms.studio.api.v2.event.site.SyncFromRepoEvent;
import org.craftercms.studio.api.v2.event.workflow.WorkflowEvent;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.repository.GitContentRepository;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.api.v2.service.dependency.DependencyService;
import org.craftercms.studio.api.v2.service.item.ItemService;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.DalUtils;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_PATH_PATTERNS;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.REPO_SYNC_CANCELLED_PACKAGE_COMMENT;
import org.craftercms.studio.api.v2.utils.StudioUtils;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getPublishPackageLockKey;
import static org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants.EMPTY_FILE;
import static org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants.GIT_REPO_USER_USERNAME;
import static org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants.IGNORE_FILES;
import org.craftercms.studio.impl.v1.util.ContentUtils;
import static org.craftercms.studio.impl.v1.util.ContentUtils.getContentTypeClass;
import org.craftercms.studio.impl.v2.utils.DependencyUtils;
import org.craftercms.studio.impl.v2.utils.TimeUtils;
import org.dom4j.Document;
import org.dom4j.DocumentException;
import org.dom4j.Element;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.event.Level;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationEventPublisherAware;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;

/**
 * Listens to {@link SyncFromRepoEvent} events and performs the sync from repository.
 */
public class SyncFromRepositoryTask implements ApplicationEventPublisherAware {

	private static final Logger logger = LoggerFactory.getLogger(SyncFromRepositoryTask.class);
	private static final String DEFAULT_CANCELLED_PACKAGE_COMMENT = "Cancelled because of conflicts with changes from repository sync process";

	private static final Set<RepoOperation.Action> CREATED_PATH_ACTIONS = Set.of(RepoOperation.Action.CREATE, RepoOperation.Action.COPY, RepoOperation.Action.MOVE);
	private static final String EMPTY_FILE_END = FILE_SEPARATOR + EMPTY_FILE;

	private final SitesService sitesService;
	private final GeneralLockService generalLockService;
	private final AuditService auditService;
	private final DependencyService dependencyServiceInternal;
	private final UserService userService;
	private final ItemService itemServiceInternal;
	private final ContentService contentService;
	private final ConfigurationService configurationService;
	private final GitContentRepository contentRepository;
	private final StudioConfiguration studioConfiguration;
	private final ProcessedCommitsDAO processedCommitsDAO;
	private final PublishDAO publishDao;
	private final SqlSessionFactory sqlSessionFactory;
	private final ServicesConfig servicesConfig;
	protected final RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;
	private ApplicationEventPublisher eventPublisher;

	@ConstructorProperties({"sitesService", "generalLockService",
		"auditService",
		"dependencyServiceInternal",
		"userService", "itemService",
		"contentService", "configurationService",
		"contentRepository", "studioConfiguration",
		"processedCommitsDAO", "publishDao", "sqlSessionFactory",
		"servicesConfig", "retryingDatabaseOperationFacade"})
	public SyncFromRepositoryTask(SitesService sitesService, GeneralLockService generalLockService,
				      AuditService auditService,
				      DependencyService dependencyServiceInternal,
				      UserService userService, ItemService itemServiceInternal,
				      ContentService contentService, ConfigurationService configurationService,
				      GitContentRepository contentRepository, StudioConfiguration studioConfiguration,
				      ProcessedCommitsDAO processedCommitsDAO, PublishDAO publishDao, SqlSessionFactory sqlSessionFactory,
				      ServicesConfig servicesConfig, RetryingDatabaseOperationFacade retryingDatabaseOperationFacade) {
		this.sitesService = sitesService;
		this.generalLockService = generalLockService;
		this.auditService = auditService;
		this.dependencyServiceInternal = dependencyServiceInternal;
		this.userService = userService;
		this.itemServiceInternal = itemServiceInternal;
		this.contentService = contentService;
		this.configurationService = configurationService;
		this.contentRepository = contentRepository;
		this.studioConfiguration = studioConfiguration;
		this.processedCommitsDAO = processedCommitsDAO;
		this.publishDao = publishDao;
		this.sqlSessionFactory = sqlSessionFactory;
		this.servicesConfig = servicesConfig;
		this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
	}

	@Async
	@EventListener
	public void syncRepoListener(SyncFromRepoEvent event) throws Exception {
		TimeUtils.logExecutionTimeThrowing(() -> syncRepository(event.getSiteId()),
			logger,
			format("Sync from repository for site '%s'", event.getSiteId()), Level.DEBUG);
	}

	/**
	 * Sync the database with the repository in the given site.
	 *
	 * @param siteId The site ID.
	 * @throws ServiceLayerException If an error occurs while syncing the database with the repository.
	 */
	private void syncRepository(final String siteId) throws ServiceLayerException {
		logger.debug("Sync the database with the repository in site '{}'", siteId);

		Site site = sitesService.getSite(siteId);
		if (!sitesService.checkSiteUuid(siteId, site.getSiteUuid())) {
			logger.warn("Site '{}' has a different UUID than the one in the database. " +
				"The site will not be synced with the repository.", siteId);
			return;
		}
		// Locking sandbox repo to avoid additional commits from being added to
		// the processed_commits table (to avoid unintended deletes at the end of this block)
		// This will also prevent multiple simultaneous executions of this method for the same site
		String sandboxRepoLockKey = StudioUtils.getSandboxRepoLockKey(siteId);
		generalLockService.lock(sandboxRepoLockKey);
		try {
			// Get the last commit to be used along the sync process (instead of 'HEAD',
			// commits added after this point will be processed in subsequent executions of this method)
			final String lastCommitInRepo = contentRepository.getRepoLastCommitId(siteId);
			final String lastProcessedCommit = sitesService.getLastCommitId(siteId);
			if (CS.equals(lastCommitInRepo, lastProcessedCommit)) {
				logger.debug("Site '{}' is already synced with the repository up to commit '{}'", siteId, lastCommitInRepo);
				return;
			}
			// Some of these (the ones created by Studio APIs) will already be in the audit table
			List<String> unprocessedCommits = contentRepository.getCommitIdsBetween(siteId, lastProcessedCommit, lastCommitInRepo);

			String currentLastProcessedCommit = lastProcessedCommit;
			String lastUnprocessedCommit = null;
			// This loop will iterate throw commits and find commit sequences that are not audited yet
			for (String commitId : unprocessedCommits) {
				if (processedCommitsDAO.isProcessed(site.getId(), commitId)) {
					// If commit is already audited, ingest the changes in between, if any
					if (lastUnprocessedCommit != null) {
						ingestChanges(site, currentLastProcessedCommit, lastUnprocessedCommit);
						lastUnprocessedCommit = null;
					}
					// Move site.commitId to the current commit
					updateLastCommitId(siteId, commitId);
					currentLastProcessedCommit = commitId;
				} else {
					// Continue until we find a commit that is already in the audit table
					lastUnprocessedCommit = commitId;
				}
			}
			if (lastUnprocessedCommit != null) {
				ingestChanges(site, currentLastProcessedCommit, lastUnprocessedCommit);
				updateLastCommitId(siteId, lastUnprocessedCommit);
			}
			completeSyncFromRepo(site, lastCommitInRepo);

			logger.debug("Site '{}' is now synced with the repository up to commit '{}'", siteId, lastCommitInRepo);
		} catch (Exception e) {
			throw new ServiceLayerException(format("Failed to sync repository for site '%s'", siteId), e);
		} finally {
			generalLockService.unlock(sandboxRepoLockKey);
		}
	}

	// Wrap the sync from repo operation up to lastCommitInRepo
	private void completeSyncFromRepo(final Site site, final String lastCommitInRepo) {
		// Sync all preview deployers
		try {
			logger.debug("Sync preview for site '{}'", site.getSiteId());
			eventPublisher.publishEvent(new RepositoryEvent(site.getSiteId()));
		} catch (Exception e) {
			logger.error("Failed to sync preview for site '{}'", site.getSiteId(), e);
		}
		logger.debug("Removing processed_commits records for site '{}' previous to commit '{}'", site.getSiteId(), lastCommitInRepo);
		retryingDatabaseOperationFacade.retry(() -> processedCommitsDAO.deleteBefore(site.getId(), lastCommitInRepo));
	}

	private void updateLastCommitId(String siteId, String commitId) {
		sitesService.updateLastCommitId(siteId, commitId);
	}

	/**
	 * Extracts the operations between the given commits and updates the database accordingly.
	 *
	 * @param site       the site to be updated.
	 * @param commitFrom the commit to start from.
	 * @param commitTo   the commit to end with.
	 * @throws IOException           if an error occurs while reading the repository.
	 * @throws GitAPIException       if an error occurs while reading the repository.
	 * @throws UserNotFoundException if a user cannot be found for any of the operations.
	 * @throws ServiceLayerException if an error occurs while updating the database.
	 */
	private void ingestChanges(final Site site, final String commitFrom, final String commitTo)
		throws Exception {
		List<RepoOperation> operationsFromDelta = contentRepository.getOperationsFromDelta(site.getSiteId(), commitFrom, commitTo);
		cancelWorkflow(site, operationsFromDelta);
		syncDatabaseWithRepo(site, operationsFromDelta.stream().sorted(comparing(RepoOperation::getAction)).toList());
		auditChangesFromGit(site, commitFrom, commitTo);
		retryingDatabaseOperationFacade.retry(() -> processedCommitsDAO.insertCommit(site.getId(), commitTo));
	}

	/**
	 * Cancel workflow for all paths in the given operations list.
	 *
	 * @param site                the site to cancel the workflow for.
	 * @param operationsFromDelta the list of operations being processed
	 */
	private void cancelWorkflow(final Site site, final List<RepoOperation> operationsFromDelta) throws UserNotFoundException, ServiceLayerException {
		for (RepoOperation repoOperation : operationsFromDelta) {
			String path = repoOperation.getPath();
			cancelAllPackagesForPath(site.getSiteId(), path);
		}
	}

	/**
	 * Cancel packages containing the given path.
	 */
	private void cancelAllPackagesForPath(final String siteId, final String path)
		throws UserNotFoundException, ServiceLayerException {
		// Try to cancel ready packages
		Collection<PublishPackage> packages = publishDao.getReadyPackagesForItem(siteId, path);
		User gitRepoUser = userService.getUserByIdOrUsername(-1, GIT_REPO_USER_USERNAME);
		for (PublishPackage publishPackage : packages) {
			cancelPackage(siteId, publishPackage, gitRepoUser);
		}

		// Wait for processing package (if any) to complete
		PublishPackage processingPackage = publishDao.getPackageForItem(siteId, path, PublishPackage.PackageState.PROCESSING.value);
		if (processingPackage != null) {
			logger.debug("Package with id '{}' is in PROCESSING state, waiting for it to finish", processingPackage.getId());
			String packageLockKey = getPublishPackageLockKey(processingPackage.getId());
			generalLockService.lock(packageLockKey);
			try {
				logger.debug("Publishing of package with id '{}' has completed and lock has been released. Path '{}' is no longer in workflow", processingPackage.getId(), path);
			} finally {
				generalLockService.unlock(packageLockKey);
			}
		}
	}

	/**
	 * Cancel a package.
	 * This method will cancel a package if its state is READY.
	 * It will also update the state bits of the items in the package to cancel the workflow.
	 *
	 * @param siteId         the site id
	 * @param publishPackage the package to cancel
	 */
	private void cancelPackage(final String siteId, final PublishPackage publishPackage, final User gitRepoUser) throws SiteNotFoundException {
		String packageLockKey = getPublishPackageLockKey(publishPackage.getId());
		generalLockService.lock(packageLockKey);
		try {
			if (publishPackage.getPackageState() != PublishPackage.PackageState.READY.value) {
				logger.debug("Package with id '{}' is not in READY state, it cannot be cancelled", publishPackage.getId());
				return;
			}
			publishPackage.setPackageState(PublishPackage.PackageState.CANCELLED.value);
			publishPackage.setReviewerId(gitRepoUser.getId());
			publishPackage.setReviewerComment(studioConfiguration
				.getProperty(REPO_SYNC_CANCELLED_PACKAGE_COMMENT, String.class, DEFAULT_CANCELLED_PACKAGE_COMMENT));
			publishPackage.setReviewedOn(now());
			String liveTarget = servicesConfig.getLiveEnvironment(siteId);
			retryingDatabaseOperationFacade.retry(() ->
					publishDao.reviewPackage(publishPackage, liveTarget)
			);
			createCancelPackageAuditLogEntry(publishPackage);
			eventPublisher.publishEvent(new WorkflowEvent(siteId, publishPackage.getId(), WorkflowEvent.WorkFlowEventType.CANCEL));
		} finally {
			generalLockService.unlock(packageLockKey);
		}
	}

	private void createCancelPackageAuditLogEntry(final PublishPackage publishPackage) {
		AuditLog auditLog = createAuditLogEntry();
		auditLog.setOrigin(ORIGIN_GIT);
		auditLog.setOperation(OPERATION_CANCEL_PUBLISH_PACKAGE);
		auditLog.setActorId(ACTOR_ID_GIT);
		auditLog.setSiteId(publishPackage.getSiteId());
		auditLog.setPrimaryTargetId(String.valueOf(publishPackage.getId()));
		auditLog.setPrimaryTargetType(TARGET_TYPE_PUBLISH_PACKAGE);
		auditLog.setPrimaryTargetValue(String.valueOf(publishPackage.getId()));
		auditService.insertAuditLog(auditLog);
	}

	/**
	 * Creates an audit log entry indicating the sync of git history up from commitFrom up to commitTo <br/>
	 * It will add as audit log parameters any commit between commitFrom and commitTo.
	 *
	 * @param site       The site being synced
	 * @param commitFrom The last previously synced commit id
	 * @param commitTo   The new synced commit id
	 */
	private void auditChangesFromGit(final Site site, final String commitFrom, final String commitTo) throws RepositoryException {
		AuditLog auditLogEntry = createAuditLogEntry();
		auditLogEntry.setSiteId(site.getId());
		auditLogEntry.setOperation(OPERATION_GIT_CHANGES);
		auditLogEntry.setOrigin(ORIGIN_GIT);
		auditLogEntry.setCommitId(commitTo);
		auditLogEntry.setActorId(ACTOR_ID_GIT);
		auditLogEntry.setActorDetails(ACTOR_ID_GIT);
		auditLogEntry.setPrimaryTargetId(site.getSiteId());
		auditLogEntry.setPrimaryTargetType(TARGET_TYPE_SITE);
		auditLogEntry.setPrimaryTargetValue(site.getName());

		List<String> commitIds = contentRepository.getIntroducedCommits(site.getSiteId(), commitFrom, commitTo);
		List<AuditLogParameter> auditParameters = new ArrayList<>();
		for (String commitId : commitIds) {
			AuditLogParameter auditParameter = new AuditLogParameter();
			auditParameter.setTargetId(commitId);
			auditParameter.setTargetType(TARGET_TYPE_SYNCED_COMMIT);
			auditParameter.setTargetValue(commitId);
			auditParameters.add(auditParameter);
		}
		auditLogEntry.setParameters(auditParameters);
		auditService.insertAuditLog(auditLogEntry);
	}

	/**
	 * Syncs the database with the repository by applying the given repo operations
	 *
	 * @param site                The site being synced
	 * @param repoOperationsDelta The repo operations to apply
	 */
	private void syncDatabaseWithRepo(Site site, List<RepoOperation> repoOperationsDelta) {
		final Set<String> allAncestors = new HashSet<>();
		TimeUtils.logExecutionTime(() -> processRepoOperations(site, repoOperationsDelta, allAncestors), logger, "Process repo operations", Level.DEBUG);
		TimeUtils.logExecutionTime(() -> itemServiceInternal.updateParentId(site.getId(), getCreatedPaths(repoOperationsDelta)), logger, "Update parent id", Level.DEBUG);
		TimeUtils.logExecutionTime(() -> addMissingEmptyFiles(site, getCreatedPaths(repoOperationsDelta)), logger, "Add missing empty files", Level.DEBUG);
		TimeUtils.logExecutionTime(() -> itemServiceInternal.updateParentId(site.getId(), allAncestors.stream().toList()), logger, "Update parent id for created paths' ancestors", Level.DEBUG);
	}

	/**
	 * Get the paths for the actions that created paths in the repo, i.e.: create, copy, move
	 * Update or delete will not affect parent id updates
	 */
	private List<String> getCreatedPaths(List<RepoOperation> chunk) {
		return chunk.stream()
			.filter(repoOperation -> CREATED_PATH_ACTIONS.contains(repoOperation.getAction()))
			.map(RepoOperation::getPath)
			.filter(p -> !p.endsWith(EMPTY_FILE_END))
			.toList();
	}

	/**
	 * Create missing empty files and commit to git repository
	 * @param site site id
	 * @param paths list of created paths to resolve missing empty files
	 */
	private void addMissingEmptyFiles(Site site, List<String> paths) throws RepositoryException {
		if (CollectionUtils.isEmpty(paths)) {
			return;
		}

		List<String> pathsToCreate = paths.stream()
				.flatMap(path -> {
					Path currentPath = Paths.get(path).getParent();
					return Stream.iterate(currentPath, Objects::nonNull, Path::getParent)
							.map(p -> p.resolve(EMPTY_FILE).toString())
							.filter(keepFile -> !isIgnoreEmptyFile(keepFile))
							.filter(keepFile -> !contentService.contentExists(site.getSiteId(), keepFile));
				}).toList();

		if (CollectionUtils.isNotEmpty(pathsToCreate)) {
			contentRepository.createEmptyFiles(site.getSiteId(), pathsToCreate);
		}
	}

	/**
	 * Check if the .keep file should be ignored from creating. The following cases are ignored:
	 * Root directory: /.keep
	 * Any direct children of root: /site/.keep, /static-assets/.keep, /templates/.keep, etc.
	 * Hidden directories: /static-assets/.hidden/.keep, etc.
	 * @param keepFile the path for the .keep file
	 * @return true if the .keep file should be ignored from creating, false otherwise
	 */
	private boolean isIgnoreEmptyFile(String keepFile) {
		Path filePath = Paths.get(keepFile);
		Path parentPath = filePath.getParent();

		// Exclude .keep in root directory or directly under root
		if (parentPath == null || parentPath.getParent() == null) {
			return true;
		}

		// Exclude .keep in hidden folders
		for (Path part : parentPath) {
			if (part.toString().startsWith(".")) {
				return true;
			}
		}

		return false;
	}

	/**
	 * This method will try to get a User object for the given operation author. If the user is not found, it will
	 * return the {@value org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants#GIT_REPO_USER_USERNAME}
	 * fallback user.
	 *
	 * @param operationAuthor The username of the operation author
	 * @param cachedUsers     A map of already retrieved users, to avoid querying the database multiple times for the same values
	 * @return The User object for the given operation author, or the fallback user if the author is not found
	 * @throws UserNotFoundException if neither the author nor the fallback user are found
	 * @throws ServiceLayerException if an error occurs while trying to retrieve the user
	 */
	private User getRepoOperationUser(String operationAuthor, Map<String, User> cachedUsers)
		throws UserNotFoundException, ServiceLayerException {
		User result = cachedUsers.computeIfAbsent(operationAuthor, key -> {
			try {
				return userService.getUserByIdOrUsername(-1, key);
			} catch (UserNotFoundException | ServiceLayerException e) {
				logger.debug("User '{}' not found while syncing operations from repository", key);
				return null;
			}
		});
		if (result == null) {
			// Map the absent username to fallback, so we don't query the database again
			try {
				result = userService.getUserByIdOrUsername(-1, GIT_REPO_USER_USERNAME);
				cachedUsers.put(operationAuthor, result);
			} catch (UserNotFoundException e) {
				logger.error("User '{}' not found while syncing operations from repository", GIT_REPO_USER_USERNAME);
				throw e;
			}
		}
		return result;
	}

	/**
	 * Processes the given repo operations and apply database update
	 *
	 * @param site                     The site being synced
	 * @param repoOperations           The repo operations to apply
	 */
	private void processRepoOperations(Site site, List<RepoOperation> repoOperations,
									   Set<String> allAncestors) throws UserNotFoundException, ServiceLayerException {
		Map<String, User> cachedUsers = new HashMap<>();
		try (SqlSession sqlSession = sqlSessionFactory.openSession(ExecutorType.BATCH)) {
			ItemDAO itemDao = sqlSession.getMapper(ItemDAO.class);
			DependencyDAO dependencyDao = sqlSession.getMapper(DependencyDAO.class);
			for (List<RepoOperation> batchRepoOperations : ListUtils.partition(repoOperations, DalUtils.MY_BATIS_QUERY_BATCH_SIZE)) {
				for (RepoOperation repoOperation : batchRepoOperations) {
					User user = getRepoOperationUser(repoOperation.getAuthor(), cachedUsers);
					switch (repoOperation.getAction()) {
						case CREATE, COPY -> processCreate(itemDao, dependencyDao, sqlSession, site, repoOperation, user, allAncestors);
						case UPDATE -> processUpdate(itemDao, dependencyDao, sqlSession, site, repoOperation, user);
						case DELETE -> processDelete(itemDao, dependencyDao, site, repoOperation);
						case MOVE -> processMove(itemDao, dependencyDao, sqlSession, site, repoOperation, user, allAncestors);
						default -> logger.error("Failed to process unknown repo operation '{}' in site '{}'",
							site.getSiteId(), repoOperation.getAction());
					}
					invalidateConfigurationCacheIfRequired(site.getSiteId(), repoOperation.getPath());
				}
				sqlSession.flushStatements();
			}
			sqlSession.commit();
		}
	}

	/**
	 * Gets the item metadata for the given site and path when the item is an XML file.
	 * When the file is not an XML, metadata is not extracted from the item file
	 * and result will contain default values.
	 *
	 * @param siteId The site id
	 * @param path   The path to the item
	 * @return The item metadata
	 */
	private ItemMetadata getItemMetadata(String siteId, String path) throws SiteNotFoundException, ContentNotFoundException {
		ItemMetadata result = new ItemMetadata(path);
		if (CS.startsWith(path, ROOT_PATTERN_PAGES) ||
			CS.startsWith(path, ROOT_PATTERN_ASSETS)) {
			result.previewUrl = itemServiceInternal.getBrowserUrl(siteId, path);
		}
		if (!CS.endsWith(path, XML_PATTERN)) {
			return result;
		}
		try {
			Document contentDoc = ContentUtils.convertStreamToXml(contentService.getContent(siteId, path));
			if (contentDoc != null) {
				Element rootElement = contentDoc.getRootElement();
				String internalName = rootElement.valueOf(DOCUMENT_ELM_INTERNAL_TITLE);
				if (isNotEmpty(internalName)) {
					result.label = internalName;
				}
				result.contentTypeId = rootElement.valueOf(DOCUMENT_ELM_CONTENT_TYPE);
				result.disabled = Boolean.parseBoolean(rootElement.valueOf(DOCUMENT_ELM_DISABLED));
				result.savedAsDraft = Boolean.parseBoolean(rootElement.valueOf(DOCUMENT_ELM_SAVED_AS_DRAFT));
			}
		} catch (DocumentException e) {
			logger.error("Failed to extract metadata from the XML site '{}' path '{}'",
				siteId, path, e);
		}
		return result;
	}

	/**
	 * Process batch create operation
	 * process a batch move operation
	 * @param itemDao item mapper
	 * @param dependencyDao dependency mapper
	 * @param sqlSession sql session
	 * @param site {@link Site} to perform the operation
	 * @param repoOperation {@link RepoOperation} repository operation detail
	 * @param user modified {@link User}
	 * @param allAncestors list of ancestors
	 */
	private void processCreate(ItemDAO itemDao, DependencyDAO dependencyDao, SqlSession sqlSession,
							   Site site, RepoOperation repoOperation, User user, Set<String> allAncestors) throws SiteNotFoundException, ContentNotFoundException {
		ItemMetadata metadata = getItemMetadata(site.getSiteId(), repoOperation.getPath());
		processAncestors(itemDao, site.getSiteId(), repoOperation.getPath(), user.getId(),
			repoOperation.getDateTime(), allAncestors);
		long state = NEW.value;
		if (metadata.disabled) {
			state = state | DISABLED.value;
		}

		if (ArrayUtils.contains(IGNORE_FILES, FilenameUtils.getName(repoOperation.getPath()))) {
			return;
		}

		Item item = itemServiceInternal.instantiateItem(site.getSiteId(), repoOperation.getPath())
			.withPreviewUrl(metadata.previewUrl)
			.withState(state)
			.withLockedBy(null)
			.withCreatedBy(user.getId())
			.withCreatedOn(repoOperation.getDateTime())
			.withLastModifiedBy(user.getId())
			.withLastModifiedOn(repoOperation.getDateTime())
			.withLastPublishedOn(null)
			.withLabel(metadata.label)
			.withContentTypeId(metadata.contentTypeId)
			.withSystemType(getContentTypeClass(servicesConfig, studioConfiguration, site.getSiteId(), repoOperation.getPath()))
			.withMimeType(StudioUtils.getMimeType(FilenameUtils.getName(repoOperation.getPath())))
			.withLocaleCode(Locale.US.toString())
			.withTranslationSourceId(null)
			.withSize(contentRepository.getContentSize(site.getSiteId(), repoOperation.getPath()))
			.withSavedAsDraft(metadata.savedAsDraft)
			.build();
		itemDao.upsertEntry(item);

		logger.trace("Extract dependencies from site '{}' path '{}' while processing batch create", site.getSiteId(), repoOperation.getPath());
		DependencyUtils.updateDependencies(site.getSiteId(), repoOperation.getPath(), null,
			dependencyServiceInternal, dependencyDao, sqlSession, false, true);
	}

	/**
	 * Process batch update operation
	 * process a batch move operation
	 * @param itemDao item mapper
	 * @param dependencyDao dependency mapper
	 * @param sqlSession sql session
	 * @param site {@link Site} to perform the operation
	 * @param repoOperation {@link RepoOperation} repository operation detail
	 * @param user modified {@link User}
	 */
	private void processUpdate(ItemDAO itemDao, DependencyDAO dependencyDao, SqlSession sqlSession,
							   Site site, RepoOperation repoOperation, User user) throws SiteNotFoundException, ContentNotFoundException {
		if (ArrayUtils.contains(IGNORE_FILES, FilenameUtils.getName(repoOperation.getPath()))) {
			return;
		}
		ItemMetadata metadata = getItemMetadata(site.getSiteId(), repoOperation.getPath());
		long onStateBitMap = SAVE_ON_MASK;
		long offStateBitmap = SYNC_FROM_REPOSITORY_OFF_MASK;
		if (metadata.disabled) {
			onStateBitMap = onStateBitMap | DISABLED.value;
		} else {
			offStateBitmap = offStateBitmap | DISABLED.value;
		}

		updateItemRow(itemDao, site.getId(),
			repoOperation.getPath(), metadata.previewUrl, onStateBitMap, offStateBitmap, user.getId(),
			repoOperation.getDateTime(), metadata.label, metadata.contentTypeId,
				getContentTypeClass(servicesConfig, studioConfiguration, site.getSiteId(), repoOperation.getPath()),
			StudioUtils.getMimeType(FilenameUtils.getName(repoOperation.getPath())),
			contentRepository.getContentSize(site.getSiteId(), repoOperation.getPath()),
				metadata.savedAsDraft);

		logger.trace("Extract dependencies from site '{}' path '{}' while processing batch update", site.getSiteId(), repoOperation.getPath());
		DependencyUtils.updateDependencies(site.getSiteId(), repoOperation.getPath(), null,
			dependencyServiceInternal, dependencyDao, sqlSession, true, false);
	}

	/**
	 * process a batch move operation
	 * @param itemDao item mapper
	 * @param dependencyDao dependency mapper
	 * @param sqlSession sql session
	 * @param site {@link Site} to perform the operation
	 * @param repoOperation {@link RepoOperation} repository operation detail
	 * @param user modified {@link User}
	 * @param allAncestors list af ancestors
	 */
	private void processMove(ItemDAO itemDao, DependencyDAO dependencyDao, SqlSession sqlSession,
							 Site site, RepoOperation repoOperation, User user,
							 Set<String> allAncestors) throws SiteNotFoundException, ContentNotFoundException {
		ItemMetadata metadata = getItemMetadata(site.getSiteId(), repoOperation.getMoveToPath());
		processAncestors(itemDao, site.getSiteId(), repoOperation.getMoveToPath(), user.getId(),
				repoOperation.getDateTime(), allAncestors);
		long onStateBitMap = SAVE_ON_MASK;
		long offStateBitmap = SYNC_FROM_REPOSITORY_OFF_MASK;
		if (metadata.disabled) {
			onStateBitMap = onStateBitMap | DISABLED.value;
		} else {
			offStateBitmap = offStateBitmap | DISABLED.value;
		}
		if (!ArrayUtils.contains(IGNORE_FILES, FilenameUtils.getName(repoOperation.getPath())) &&
				!ArrayUtils.contains(IGNORE_FILES, FilenameUtils.getName(repoOperation.getMoveToPath()))) {
			itemDao.moveItemForSyncTask(site.getSiteId(), repoOperation.getPath(), repoOperation.getMoveToPath(), onStateBitMap, offStateBitmap);

			updateItemRow(itemDao, site.getId(),
					repoOperation.getPath(), metadata.previewUrl, onStateBitMap, offStateBitmap, user.getId(),
					repoOperation.getDateTime(), metadata.label, metadata.contentTypeId,
					getContentTypeClass(servicesConfig, studioConfiguration, site.getSiteId(), repoOperation.getMoveToPath()),
					StudioUtils.getMimeType(FilenameUtils.getName(repoOperation.getPath())),
					contentRepository.getContentSize(site.getSiteId(), repoOperation.getPath()),
					metadata.savedAsDraft);

			DependencyUtils.updateDependencies(site.getSiteId(), repoOperation.getMoveToPath(),
					repoOperation.getPath(), dependencyServiceInternal, dependencyDao, sqlSession);
		}
		invalidateConfigurationCacheIfRequired(site.getSiteId(), repoOperation.getMoveToPath());
	}

	/**
	 * Update an item row in DB
	 * @param itemDao          the Item mapper
	 * @param siteId           the site identifier
	 * @param path             the path to update
	 * @param previewUrl       the preview url
	 * @param onStatesBitMap   the on state bit map
	 * @param offStatesBitMap  the off state bit map
	 * @param lastModifiedBy   the last modified user
	 * @param lastModifiedOn   last modified date
	 * @param label            the label
	 * @param contentTypeId    content type id
	 * @param systemType       system type
	 * @param mimeType         mime type
	 * @param size             content size
	 */
	private void updateItemRow(ItemDAO itemDao, long siteId, String path, String previewUrl, long onStatesBitMap,
									   long offStatesBitMap, Long lastModifiedBy, ZonedDateTime lastModifiedOn,
									   String label, String contentTypeId, String systemType, String mimeType,
									   Long size, boolean savedAsDraft) {
		Timestamp sqlTsLastModified = new Timestamp(lastModifiedOn.toInstant().toEpochMilli());
		String fileName = FilenameUtils.getName(path);
		boolean ignored = org.apache.commons.lang3.ArrayUtils.contains(IGNORE_FILES, fileName);
		itemDao.updateItemForSyncTask(siteId, path, previewUrl, onStatesBitMap, offStatesBitMap,
				lastModifiedBy, sqlTsLastModified.toString(), label, contentTypeId, systemType, mimeType, size, ignored, savedAsDraft);
	}

	/**
	 * Processes a batch delete operation
	 * @param itemDao item mapper
	 * @param dependencyDao dependency mapper
	 * @param site {@link Site} to perform the operation
	 * @param repoOperation {@link RepoOperation} repository operation detail
	 */
	private void processDelete(ItemDAO itemDao, DependencyDAO dependencyDao, Site site, RepoOperation repoOperation) {
		String folder = FILE_SEPARATOR + FilenameUtils.getPathNoEndSeparator(repoOperation.getPath());
		boolean folderExists = contentRepository.contentExists(site.getSiteId(), folder);
		// If the folder exists and the deleted file is the index file, then we need to update the parent id for the children
		if (folderExists && CS.startsWith(repoOperation.getPath(), ROOT_PATTERN_PAGES) &&
			CS.endsWith(repoOperation.getPath(), SLASH_INDEX_FILE)) {
			itemDao.updateDeletedPageChildren(site.getId(), folder);
		}
		itemDao.deleteBySiteAndPath(site.getId(), repoOperation.getPath(), false);
		if (!folderExists) {
			itemDao.deleteBySiteAndPath(site.getId(), folder, false);
		}

		dependencyDao.deleteItemDependencies(site.getSiteId(), repoOperation.getPath());
		dependencyDao.invalidateDependencies(site.getSiteId(), repoOperation.getPath());
	}

	protected void invalidateConfigurationCacheIfRequired(String siteId, String path) throws SiteNotFoundException {
		String[] configurationPatterns = studioConfiguration.getArray(CONFIGURATION_PATH_PATTERNS, String.class);
		if (RegexUtils.matchesAny(path, configurationPatterns)) {
			configurationService.invalidateConfiguration(siteId, path);
		}
	}

	/**
	 * Insert the parents of the given path.
	 *
	 * @param itemDao              The Item mapper
	 * @param siteId               The site id
	 * @param path                 The path
	 * @param userId               The user id
	 * @param now                  The current date time
	 */
	private void processAncestors(ItemDAO itemDao, String siteId, String path, long userId, ZonedDateTime now,
								  Set<String> allAncestors) {
		Path p = Paths.get(path);
		if (isNull(p.getParent())) {
			return;
		}

		List<Path> parts = new LinkedList<>();
		p.getParent().iterator().forEachRemaining(parts::add);
		String currentPath = EMPTY;
		for (Path ancestor : parts) {
			if (isNotEmpty(ancestor.toString())) {
				currentPath = currentPath + FILE_SEPARATOR + ancestor;
				if (allAncestors.contains(currentPath)) {
					continue;
				}
				Item item = itemServiceInternal.instantiateItem(siteId, currentPath)
					.withPreviewUrl(null)
					.withState(NEW.value)
					.withLockedBy(null)
					.withCreatedBy(userId)
					.withCreatedOn(now)
					.withLastModifiedBy(userId)
					.withLastModifiedOn(now)
					.withLastPublishedOn(null)
					.withLabel(ancestor.toString())
					.withContentTypeId(null)
					.withSystemType(CONTENT_TYPE_FOLDER)
					.withMimeType(null)
					.withLocaleCode(Locale.US.toString())
					.withTranslationSourceId(null)
					.withSize(0L)
					.withSavedAsDraft(false)
					.build();
				itemDao.upsertEntry(item);
				allAncestors.add(currentPath);
			}
		}
	}

	@Override
	public void setApplicationEventPublisher(@NonNull final ApplicationEventPublisher applicationEventPublisher) {
		this.eventPublisher = applicationEventPublisher;
	}

	/**
	 * Convenience class to store item metadata, so we can load the content item only once.
	 */
	private static class ItemMetadata {
		String previewUrl = null;
		String label;
		String contentTypeId = EMPTY;
		boolean disabled = false;
		boolean savedAsDraft = false;

		public ItemMetadata(final String path) {
			label = FilenameUtils.getName(path);
		}
	}
}
