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

package org.craftercms.studio.impl.v2.service.publish.internal;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.rest.parameters.SortField;
import org.craftercms.commons.security.exception.ActionDeniedException;
import org.craftercms.commons.security.permissions.PermissionEvaluator;
import org.craftercms.commons.security.permissions.annotations.ProtectedResourceId;
import org.craftercms.studio.api.v1.constant.DmConstants;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.*;
import org.craftercms.studio.api.v2.dal.item.LightItem;
import org.craftercms.studio.api.v2.dal.publish.*;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageType;
import org.craftercms.studio.api.v2.dal.repository.RepoOperation;
import org.craftercms.studio.api.v2.event.publish.RequestPublishEvent;
import org.craftercms.studio.api.v2.event.workflow.WorkflowEvent;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.exception.publish.InvalidPackageStateException;
import org.craftercms.studio.api.v2.exception.publish.InvalidTargetException;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.exception.security.PeerReviewCheckException;
import org.craftercms.studio.api.v2.repository.GitContentRepository;
import org.craftercms.studio.api.v2.security.PermissionCheckingUtils;
import org.craftercms.studio.api.v2.security.SemanticsAvailableActionsResolver;
import org.craftercms.studio.api.v2.security.publish.PublishPackageAvailableActionResolver;
import org.craftercms.studio.api.v2.service.audit.ActivityStreamService;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.api.v2.service.dependency.DependencyService;
import org.craftercms.studio.api.v2.service.item.ItemService;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.impl.v2.utils.DateUtils;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.craftercms.studio.model.publish.PublishingTarget;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.function.Predicate;

import static java.lang.String.format;
import static java.util.Collections.emptyList;
import static java.util.stream.Collectors.*;
import static org.apache.commons.collections4.CollectionUtils.*;
import static org.apache.commons.collections4.CollectionUtils.isNotEmpty;
import static org.apache.commons.lang3.ArrayUtils.contains;
import static org.apache.commons.lang3.StringUtils.defaultIfEmpty;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.apache.commons.lang3.Strings.CS;
import static org.apache.tika.io.FilenameUtils.getName;
import static org.craftercms.studio.api.v2.dal.AuditLog.createAuditLogEntry;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.*;
import static org.craftercms.studio.api.v2.dal.ItemState.IN_WORKFLOW;
import static org.craftercms.studio.api.v2.dal.ItemState.isNew;
import static org.craftercms.studio.api.v2.dal.publish.PublishDAO.ACTIVE_APPROVAL_STATES;
import static org.craftercms.studio.api.v2.dal.publish.PublishItem.Action.*;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.APPROVED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.REJECTED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.SUBMITTED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.PROCESSING;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.READY;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageType.*;
import static org.craftercms.studio.api.v2.event.workflow.WorkflowEvent.WorkFlowEventType.DIRECT_PUBLISH;
import static org.craftercms.studio.api.v2.event.workflow.WorkflowEvent.WorkFlowEventType.SUBMIT;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getPublishPackageLockKey;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getSandboxRepoLockKey;
import static org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants.IGNORE_FILES;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getAuthentication;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getCurrentUsername;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_PUBLISH_REQUEST;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_PUBLISH_REVIEW;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.SITE_ID_RESOURCE_ID;
import static org.springframework.util.CollectionUtils.isEmpty;


public class PublishServiceInternalImpl implements PublishService, ApplicationContextAware {

	private static final Logger logger = LoggerFactory.getLogger(PublishServiceInternalImpl.class);

	private final GitContentRepository contentRepository;
	private final RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;

	protected final ItemService itemService;

	protected ApplicationContext applicationContext;
	private final ServicesConfig servicesConfig;
	private final AuditService auditService;
	private final DependencyService dependencyService;
	private final PublishDAO publishDao;
	private final ItemTargetDAO itemTargetDao;
	private final SitesService siteService;
	private final GeneralLockService generalLockService;
	private final PublishPackageAvailableActionResolver publishPackageAvailableActionResolver;
	private final ActivityStreamService activityService;
	private final PermissionEvaluator<String, Object> permissionEvaluator;

	@ConstructorProperties({"contentRepository", "retryingDatabaseOperationFacade", "itemService", "servicesConfig",
			"auditService", "dependencyService", "publishDao", "itemTargetDao", "siteService",
			"generalLockService", "publishPackageAvailableActionResolver",
			"activityService", "permissionEvaluator"})
	public PublishServiceInternalImpl(GitContentRepository contentRepository, RetryingDatabaseOperationFacade retryingDatabaseOperationFacade,
									  ItemService itemService, ServicesConfig servicesConfig, AuditService auditService,
									  DependencyService dependencyService, PublishDAO publishDao,
									  ItemTargetDAO itemTargetDao,
									  SitesService siteService, GeneralLockService generalLockService,
									  PublishPackageAvailableActionResolver publishPackageAvailableActionResolver,
									  ActivityStreamService activityService, PermissionEvaluator<String, Object> permissionEvaluator) {
		this.contentRepository = contentRepository;
		this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
		this.itemService = itemService;
		this.servicesConfig = servicesConfig;
		this.auditService = auditService;
		this.dependencyService = dependencyService;
		this.publishDao = publishDao;
		this.itemTargetDao = itemTargetDao;
		this.siteService = siteService;
		this.generalLockService = generalLockService;
		this.publishPackageAvailableActionResolver = publishPackageAvailableActionResolver;
		this.activityService = activityService;
		this.permissionEvaluator = permissionEvaluator;
	}

	@Override
	public long getPublishPackagesCount(final String siteId, final String target,
										final Long states, final Collection<PublishPackage.ApprovalState> approvalStates,
										final String submitter, final String reviewer,
										final Boolean isScheduled) {
		return publishDao.getPublishPackagesCount(siteId, target, states,
			approvalStates, submitter, reviewer, isScheduled);
	}

	@Override
	public Collection<PublishPackage> getPublishPackages(final String siteId, final String target,
														 final Long states, final Collection<PublishPackage.ApprovalState> approvalStates,
														 final String submitter, final String reviewer,
														 final Boolean isScheduled, final Collection<SortField> sort,
														 final int offset, final int limit) throws ServiceLayerException, UserNotFoundException {
		Collection<PublishPackage> packages = publishDao.getPublishPackages(siteId, target,
			states, approvalStates,
			submitter, reviewer, isScheduled,
			sort, offset, limit);
		for (PublishPackage publishPackage : packages) {
			calculateAvailableActions(publishPackage);
		}
		return packages;
	}

	@Override
	public Collection<PublishItemWithMetadata> getPublishPackageItems(String siteId, long packageId,
																	  String path, Collection<String> systemTypes, String internalName,
																	  int offset, int limit) {
		return publishDao.getPublishItemsWithMetadata(siteId, packageId, path, systemTypes, internalName, offset, limit);
	}

	@Override
	public int getPublishPackageItemCount(String siteId, long packageId, String path, List<String> systemType, String internalName) {
		return publishDao.getMatchingPublishItemCount(siteId, packageId, path, systemType, internalName);
	}

	@Override
	public List<PublishingTarget> getAvailablePublishingTargets(@SiteId String siteId) throws SiteNotFoundException {
		var availablePublishingTargets = new ArrayList<PublishingTarget>();
		var liveTarget = new PublishingTarget();
		liveTarget.setName(servicesConfig.getLiveEnvironment(siteId));
		availablePublishingTargets.add(liveTarget);
		if (servicesConfig.isStagingEnvironmentEnabled(siteId)) {
			var stagingTarget = new PublishingTarget();
			stagingTarget.setName(servicesConfig.getStagingEnvironment(siteId));
			availablePublishingTargets.add(stagingTarget);
		}
		return availablePublishingTargets;
	}

	@Override
	public boolean isSitePublished(@ProtectedResourceId(SITE_ID_RESOURCE_ID) String siteId) throws RepositoryException {
		// Site is published if PUBLISHED repo exists
		return contentRepository.publishedRepositoryExists(siteId);
	}

	@Override
	public int getNumberOfPublishes(String siteId, int days) {
		return publishDao.getNumberOfPublishes(siteId, days);
	}

	@Override
	public CalculatedPublishPackageResult calculatePublishPackage(final String siteId, final String publishingTarget,
																  final Collection<PublishRequestPath> publishRequestPaths,
																  final Collection<String> commitIds) throws ServiceLayerException, IOException {
		Site site = siteService.getSite(siteId);
		Set<String> corePackagePaths = expandPublishRequestPaths(site, publishingTarget, publishRequestPaths);

		SequencedCollection<String> sortedCommits = contentRepository.validatePublishCommits(site.getSiteId(), commitIds);
		List<RepoOperation> commitOperations = new LinkedList<>();
		for (String commitId : sortedCommits) {
			commitOperations.addAll(contentRepository.getOperationsFromFirstParentDiff(site.getSiteId(), commitId));
		}
		Map<Boolean, List<String>> filteredOperations = commitOperations.stream()
			.filter(getCommitRepoOperationsFilter(site))
			.collect(partitioningBy(op -> op.getAction() == RepoOperation.Action.DELETE,
				mapping(RepoOperation::getPath, toList())));

		// Add non-delete operations
		corePackagePaths.addAll(filteredOperations.get(false));

		Collection<String> deletedPaths = filteredOperations.get(true);

		return buildCalculatedPublishPackageResult(siteId, publishingTarget, corePackagePaths, deletedPaths);
	}

	@Override
	public CalculatedPublishPackageResult recalculatePublishPackage(String siteId, long packageId, String target)
			throws ServiceLayerException {
		Map<Boolean, List<String>> publishPaths = publishDao.getUserRequestedPathMap(siteId, packageId);

		Set<String> corePackagePaths = new HashSet<>(publishPaths.get(false));
		Collection<String> deletedPaths = publishPaths.get(true);

		return buildCalculatedPublishPackageResult(siteId, target, corePackagePaths, deletedPaths);
	}

	/**
	 * Calculate the dependencies and build a CalculatedPublishPackageResult
	 *
	 * @param siteId           the site id
	 * @param target           the publishing target
	 * @param corePackagePaths the core package paths (user requested)
	 * @param deletedPaths     the deleted paths
	 * @return the calculated publish package result
	 * @throws ServiceLayerException if an error occurs while calculating dependencies
	 */
	private CalculatedPublishPackageResult buildCalculatedPublishPackageResult(String siteId, String target, Set<String> corePackagePaths, Collection<String> deletedPaths)
			throws ServiceLayerException {
		Collection<LightItem> softDependencies = dependencyService.getPublishingSoftDependencies(siteId, corePackagePaths, target);
		// Get hard deps of them all
		Collection<LightItem> hardDependencies = dependencyService.getHardDependencies(siteId, target, corePackagePaths);
		Collection<LightItem> coreItems = isNotEmpty(corePackagePaths) ? publishDao.getMetadata(siteId, corePackagePaths) : emptyList();
		return new CalculatedPublishPackageResult(getPublishDependencies(siteId, coreItems), deletedPaths,
		 getPublishDependencies(siteId, hardDependencies), getPublishDependencies(siteId, softDependencies));
	}

	/**
	 * Map LightItem List to PublishDependency List
	 *
	 * @param siteId the site id
	 * @param items  the LightItem List
	 * @return the PublishDependency List, contains canApprove and canRequestPublish
	 *         for each item
	 */
	private Collection<PublishDependency> getPublishDependencies(String siteId, Collection<LightItem> items) {
		return items.stream()
				.map(item -> {
					Object resource = PermissionCheckingUtils.getSecuredResource(siteId, List.of(item.getPath()));
					boolean canApprove = permissionEvaluator.isAllowed(resource, PERMISSION_PUBLISH_REVIEW);
					boolean canRequestPublish = permissionEvaluator.isAllowed(resource, PERMISSION_PUBLISH_REQUEST);
					return new PublishDependency(item, canApprove, canRequestPublish);
				})
				.collect(toList());
	}

	@Override
	public PublishPackage getReadyPackageForItem(final String siteId, final String path, final boolean includeChildren) {
		return publishDao.getReadyPackageForItem(siteId, path, includeChildren);
	}

	@Override
	public Collection<PublishPackage> getActivePackagesForItems(final String siteId, final List<String> paths, final boolean includeChildren) throws ServiceLayerException {
		Collection<PublishPackage> itemPackages = publishDao.getItemPackages(siteId, null, paths,
				READY.value + PROCESSING.value,
				ACTIVE_APPROVAL_STATES, includeChildren);
		if (CollectionUtils.isEmpty(itemPackages)) {
			return itemPackages;
		}
		for (PublishPackage p : itemPackages) {
			try {
				p.setAvailableActions(publishPackageAvailableActionResolver.getPublishPackageAvailableActions(p));
			} catch (UserNotFoundException e) {
				throw new ServiceLayerException("Failed to get current user while calculating available actions for publish package with id " + p.getId(), e);
			}
		}
		return itemPackages;
	}

	@Override
	public long publishDelete(String siteId, Collection<String> userRequestedPaths,
							  Collection<String> dependencies, String title, String comment) throws ServiceLayerException {
		try {
			if (!contentRepository.publishedRepositoryExists(siteId)) {
				logger.warn("Site '{}' is not published, publish DELETE operations will be ignored", siteId);
				return 0;
			}
			String liveTarget = servicesConfig.getLiveEnvironment(siteId);
			PublishPackage publishPackage = createPackage(siteService.getSite(siteId), liveTarget, ITEM_LIST, false, null, title, comment);
			Collection<PublishItem> publishItems = createDeletePublishItems(siteId, userRequestedPaths, dependencies);
			if (CollectionUtils.isEmpty(publishItems)) {
				logger.debug("Deleted items are not published, nothing to do.");
				return 0;
			}
			retryingDatabaseOperationFacade.retry(() -> publishDao.insertPackageAndItems(publishPackage, publishItems, true));
			auditPublishSubmission(publishPackage, OPERATION_PUBLISH);
			return publishPackage.getId();
		} catch (Exception e) {
			String message = format("Failed to submit delete publish package for site '%s'", siteId);
			logger.error(message, e);
			throw new ServiceLayerException(message, e);
		}
	}

	@Override
	public PublishPackage getPackage(final String siteId, final long packageId) throws ServiceLayerException, UserNotFoundException {
		PublishPackage publishPackage = publishDao.getByStringSiteId(siteId, packageId);
		calculateAvailableActions(publishPackage);
		return publishPackage;
	}

	/**
	 * Calculate and set current user available actions for the publish package.
	 */
	private void calculateAvailableActions(final PublishPackage publishPackage) throws ServiceLayerException, UserNotFoundException {
		publishPackage.setAvailableActions(publishPackageAvailableActionResolver.getPublishPackageAvailableActions(publishPackage));
	}

	@Override
	public Collection<PublishItem> getPublishItems(final String siteId, final long packageId,
												   final Integer offset, final Integer limit) {
		return publishDao.getPublishItems(siteId, packageId, offset, limit);
	}

	@Override
	public Collection<PublishItem> getFailedPublishItems(String siteId, long packageId, Integer offset, Integer limit) {
		return publishDao.getFailedPublishItems(siteId, packageId, offset, limit);
	}

	@Override
	public int getNumberOfPublishedItemsByAction(final String siteId, final int days, final PublishItem.Action action) {
		return publishDao.getNumberOfPublishedItemsByAction(siteId, days, action);
	}

	private Collection<PublishItem> createDeletePublishItems(final String siteId, final Collection<String> userRequestedPaths,
															 final Collection<String> dependencies) throws SiteNotFoundException {
		Site site = siteService.getSite(siteId);
		Map<String, List<ItemTarget>> itemTargetsByPath = itemTargetDao.getItemTargetsByPath(site.getId(),
			union(userRequestedPaths, dependencies));

		Collection<PublishItem> publishItems = new ArrayList<>();
		publishItems.addAll(userRequestedPaths.stream()
			.map(path -> createPublishItem(path, DELETE, true))
			.toList());

		publishItems.addAll(dependencies.stream()
			.map(path -> createPublishItem(path, DELETE, false))
			.toList());

		publishItems.addAll(union(dependencies, userRequestedPaths).stream()
			.filter(path -> path.endsWith(DmConstants.SLASH_INDEX_FILE))
			.map(path -> CS.removeEnd(path, DmConstants.SLASH_INDEX_FILE))
			.map(path -> createPublishItem(path, DELETE, false))
			.toList());

		return publishItems.stream()
			.filter(item -> itemTargetsByPath.containsKey(item.getPath()))
			.peek(item -> setPreviousPaths(item, siteId, itemTargetsByPath.get(item.getPath())))
			.toList();
	}

	/**
	 * Set the previous paths (stagingPreviousPath, livePreviousPath) to the publish item based on the item targets.
	 */
	private void setPreviousPaths(final PublishItem item, final String siteId, final Collection<ItemTarget> itemTargets) {
		try {
			String liveEnvironment = servicesConfig.getLiveEnvironment(siteId);
			itemTargets.stream()
				.filter(itemTarget -> StringUtils.isNotEmpty(itemTarget.getPreviousPath()))
				.forEach(itemTarget -> {
					boolean isLiveTarget = CS.equals(liveEnvironment, itemTarget.getTarget());
					if (isLiveTarget) {
						item.setLivePreviousPath(itemTarget.getPreviousPath());
					} else {
						item.setStagingPreviousPath(itemTarget.getPreviousPath());
					}
				});
		} catch (SiteNotFoundException e) {
			logger.warn("Failed to get live environment for site '{}'", siteId);
		}
	}

	/**
	 * Get common filter for commit repo operations to be included in publish dependencies
	 * or actual publish package submission
	 */
	private Predicate<RepoOperation> getCommitRepoOperationsFilter(final Site site) {
		return op -> !contains(IGNORE_FILES, getName(op.getMoveToPath()))
			&& !contains(IGNORE_FILES, getName(op.getPath()))
			// Ignore deletes if the path exists in current version
			&& (op.getAction() != RepoOperation.Action.DELETE || !contentRepository.contentExists(site.getSiteId(), op.getPath()));
	}

	/**
	 * Audit publish submission
	 *
	 * @param p         the publish package
	 * @param operation the audit operation
	 */
	private void auditPublishSubmission(final PublishPackage p, final String operation) throws AuthenticationException {
		AuditLog auditLog = createAuditLogEntry();
		auditLog.setOperation(operation);
		auditLog.setActorId(getCurrentUsername());
		auditLog.setSiteId(p.getSiteId());
		auditLog.setPrimaryTargetId(String.valueOf(p.getId()));
		auditLog.setPrimaryTargetType(TARGET_TYPE_PUBLISH_PACKAGE);
		auditLog.setPrimaryTargetValue(String.valueOf(p.getId()));

		AuditLogParameter commentParam = new AuditLogParameter();
		commentParam.setTargetId(TARGET_TYPE_SUBMISSION_COMMENT);
		commentParam.setTargetType(TARGET_TYPE_SUBMISSION_COMMENT);
		commentParam.setTargetValue(defaultIfEmpty(p.getSubmitterComment(), ""));

		auditLog.setParameters(List.of(commentParam));
		auditService.insertAuditLog(auditLog);

		activityService.insertActivity(p.getSiteId(), SecurityUtils.getCurrentUser().getId(), operation, DateUtils.getCurrentTime(), null, Long.toString(p.getId()));
	}

	/**
	 * Create publish items from commit ids.
	 * Extract operations from commit ids and create publish items.
	 * Notice that delete operations will not be processed if new version of the path exists.
	 */
	private void createPublishItemsFromCommitIds(final Site site, final Collection<String> commitIds,
												 final Map<String, PublishItem> publishItemsByPath)
		throws ServiceLayerException, IOException {
		if (isEmpty(commitIds)) {
			return;
		}
		// Validate and sort commits
		SequencedCollection<String> sortedCommits = contentRepository.validatePublishCommits(site.getSiteId(), commitIds);
		List<RepoOperation> commitOperations = new LinkedList<>();
		for (String commitId : sortedCommits) {
			commitOperations.addAll(contentRepository.getOperationsFromFirstParentDiff(site.getSiteId(), commitId));
		}

		publishItemsByPath.putAll(commitOperations.stream()
			.filter(getCommitRepoOperationsFilter(site))
			.map(op -> createPublishItem(op.getPath(),
				translateRepoAction(op.getAction()), true))
			.collect(toMap(PublishItem::getPath, item -> item)));
	}

	private PublishItem.Action translateRepoAction(RepoOperation.Action repoAction) {
		return switch (repoAction) {
			case DELETE -> DELETE;
			case MOVE, UPDATE -> UPDATE;
			default -> ADD;
		};
	}

	private PublishItem createPublishItem(final String path,
										  final PublishItem.Action action, final boolean userRequested) {
		PublishItem publishItem = new PublishItem();
		publishItem.setAction(action);
		publishItem.setPath(path);
		publishItem.setUserRequested(userRequested);
		return publishItem;
	}

	/**
	 * Create publish items from list of {@link PublishRequestPath}.
	 * For each PublishRequest path:
	 * - Add the path if it is not a folder
	 * - Include soft deps if requested
	 * - Include children if requested
	 */
	private void createPublishItemsFromPaths(final Site site, final Collection<PublishRequestPath> publishRequestPaths,
											 final Map<String, PublishItem> publishItemsByPath, final String target) throws ServiceLayerException {
		if (isEmpty(publishRequestPaths)) {
			return;
		}

		Set<String> allPaths = expandPublishRequestPaths(site, target, publishRequestPaths);

		if (isNotEmpty(allPaths)) {
			Map<String, ItemPathAndState> statesByPath = itemService.getItemStates(site.getSiteId(), allPaths);
			publishItemsByPath.putAll(
				allPaths.stream()
					.filter(path -> !publishItemsByPath.containsKey(path))
					.map(path -> {
						long itemState = statesByPath.get(path).getState();
						return createPublishItem(path, isNew(itemState) ? ADD : UPDATE, true);
					})
					.collect(toMap(PublishItem::getPath, item -> item)));
		}
	}

	/**
	 * Expand a list of {@link PublishRequestPath} objects into a set of paths.
	 * The {@link PublishRequestPath}'s path itself will be added.
	 * Then the children if includeChildren is true
	 * Then the soft dependencies if includeSoftDeps is true
	 */
	private Set<String> expandPublishRequestPaths(final Site site, final String target,
												  final Collection<PublishRequestPath> publishRequestPaths) throws ServiceLayerException {
		Set<String> allPaths = new HashSet<>();
		Set<String> softDepsPaths = new HashSet<>();
		for (PublishRequestPath requestPath : emptyIfNull(publishRequestPaths)) {
			Set<String> expandedPathList = expandPublishRequestPath(site, requestPath);
			allPaths.addAll(expandedPathList);
			if (requestPath.includeSoftDeps()) {
				softDepsPaths.addAll(expandedPathList);
			}
		}
		if (!softDepsPaths.isEmpty()) {
			allPaths.addAll(dependencyService.getPublishingSoftDependencies(site.getSiteId(), softDepsPaths, target).stream().map(LightItem::getPath).collect(toSet()));
		}
		return allPaths;
	}

	/**
	 * Expand publish request path.
	 * - Include the path itself if not a folder
	 * - Include non-folder children if requested, recursively
	 */
	private Set<String> expandPublishRequestPath(final Site site, final PublishRequestPath publishPath) throws ServiceLayerException {
		Set<String> paths = new HashSet<>();
		contentRepository.checkContentExists(site.getSiteId(), publishPath.path());
		if (!contentRepository.isFolder(site.getSiteId(), publishPath.path())) {
			paths.add(publishPath.path());
		}
		if (publishPath.includeChildren()) {
			// Notice that we are publishing regardless of the item's state, consistent
			// with current behavior when publishing a live item directly
			paths.addAll(itemService.getChildrenPaths(site.getId(), publishPath.path()));
		}
		return paths;
	}

	/**
	 * Create publish items for hard dependencies.
	 * For each non-delete PublishItem, get hard dependencies and add them to the publishItemsByPath map.
	 */
	private void createPublishItemsForHardDeps(Site site, String target, Map<String, PublishItem> publishItemsByPath) throws ServiceLayerException {
		Collection<String> paths = publishItemsByPath.keySet().stream()
			.filter(p -> publishItemsByPath.get(p).getAction() != DELETE)
			.collect(toList());
		if (isEmpty(paths)) {
			return;
		}
		publishItemsByPath.putAll(
			dependencyService.getHardDependencies(site.getSiteId(), target, paths).stream()
				.map(LightItem::getPath)
				.filter(dep -> !publishItemsByPath.containsKey(dep))
				.map(dep -> createPublishItem(dep, ADD, false))
				.collect(toMap(PublishItem::getPath, item -> item)));
	}


	@Override
	public long publish(final String siteId, final String publishingTarget, final List<PublishRequestPath> paths,
						final List<String> commitIds, final Instant schedule, final String title, final String comment, final boolean publishAll)
		throws ServiceLayerException, AuthenticationException {
		return routePackageSubmission(siteId, publishingTarget, paths, commitIds, schedule, title, comment, false, publishAll);
	}

	@Override
	public long requestPublish(final String siteId, final String publishingTarget, final List<PublishRequestPath> paths,
							   final List<String> commitIds, final Instant schedule, final String title, final String comment, final boolean publishAll)
		throws AuthenticationException, ServiceLayerException {
		return routePackageSubmission(siteId, publishingTarget, paths, commitIds, schedule, title, comment, true, publishAll);
	}

	@Override
	public void updatePublishPackage(String siteId, long packageId, Instant schedule,
			boolean updateSchedule, String submitterComment, String title, boolean requestApproval)
			throws InvalidPackageStateException, AuthenticationException, SiteNotFoundException {
		boolean resubmit = false;
		String packageLockKey = getPublishPackageLockKey(packageId);
		generalLockService.lock(packageLockKey);
		try {
			PublishPackage publishPackage = publishDao.getByStringSiteId(siteId, packageId);
			if (publishPackage.getApprovalState() == REJECTED) {
				throw new InvalidPackageStateException(
						"Updating a rejected publish package is not allowed", siteId,
						packageId);
			}
			if (!READY.matches(publishPackage.getPackageState())) {
				throw new InvalidPackageStateException(
						"Updating a non-ready publish package is not allowed", siteId,
						packageId);
			}
			if (publishPackage.getApprovalState() == APPROVED) {
				if (requestApproval) {
					publishPackage.setApprovalState(SUBMITTED);
					resubmit = true;
				} else {
					if (servicesConfig.isRequirePeerReview(siteId)) {
						throw new PeerReviewCheckException(
								"Users are not allowed to update approved packages when peer-review is enabled");
					}
					PermissionCheckingUtils.checkPermissions(permissionEvaluator,
							publishDao, siteId, packageId, List.of(PERMISSION_PUBLISH_REVIEW));
				}
			}

			if (isNotEmpty(submitterComment)) {
				publishPackage.setSubmitterComment(submitterComment);
			}
			if (isNotEmpty(title)) {
				publishPackage.setTitle(title);
			}
			if (updateSchedule) {
				publishPackage.setSchedule(schedule);
			}
			retryingDatabaseOperationFacade.retry(() -> publishDao.updatePackage(publishPackage));
			if (resubmit) {
				retryingDatabaseOperationFacade.retry(() ->
								publishDao.updateItemStateBits(publishPackage.getId(), IN_WORKFLOW.value, 0L));
				auditPublishSubmission(publishPackage, OPERATION_REQUEST_PUBLISH);
				applicationContext.publishEvent(new WorkflowEvent(getAuthentication(), siteId, packageId, SUBMIT));
			} else {
				auditPublishSubmission(publishPackage, OPERATION_UPDATE_PUBLISH_PACKAGE);
			}
		} finally {
			generalLockService.unlock(packageLockKey);
		}
	}

	/**
	 * Routes the request to the appropriate method based on the site's publishing
	 * repo status.
	 */
	protected long routePackageSubmission(final String siteId, final String publishingTarget,
										final List<PublishRequestPath> paths, final List<String> commitIds,
										final Instant schedule, final String title, final String comment,
										final boolean requestApproval, final boolean publishAll)
		throws ServiceLayerException, AuthenticationException {
		validateTarget(siteId, publishingTarget);
		Site site = siteService.getSite(siteId);
		String lockKey = getSandboxRepoLockKey(site.getSiteId());
		generalLockService.lock(lockKey);
		try {
			if (!site.getPublishedRepoCreated()) {
				return buildInitialPublishPackage(site, publishingTarget, requestApproval, title, comment);
			}

			if (publishAll) {
				if (schedule != null) {
					throw new InvalidParametersException("Failed to submit publish package: Cannot schedule a publish all operation");
				}
				if(requestApproval) {
					throw new InvalidParametersException("Failed to submit publish package: Cannot submit a publish all operation for approval");
				}
				return buildPublishAllPackage(site, publishingTarget, title, comment);
			}

			return buildItemListPackage(site, publishingTarget,
				paths, commitIds, requestApproval, schedule, title, comment);
		} finally {
			generalLockService.unlock(lockKey);
		}
	}

	/**
	 * Validate the publishing target. If the target is not valid, an exception will be thrown.
	 *
	 * @param siteId           the site id
	 * @param publishingTarget the publishing target to validate
	 * @throws SiteNotFoundException  if the site is not found
	 * @throws InvalidTargetException if the publishing target is not valid for the site
	 */
	protected void validateTarget(String siteId, String publishingTarget) throws SiteNotFoundException, InvalidTargetException {
		String liveTarget = servicesConfig.getLiveEnvironment(siteId);
		if (!CS.equals(publishingTarget, liveTarget)) {
			if (!servicesConfig.isStagingEnvironmentEnabled(siteId)) {
				throw new InvalidTargetException(format("Invalid publishing target '%s'. The only valid target for site '%s' is: '%s'",
						publishingTarget, siteId, liveTarget), liveTarget);
			}
			String stagingTarget = servicesConfig.getStagingEnvironment(siteId);
			if (!CS.equals(publishingTarget, stagingTarget)) {
				throw new InvalidTargetException(format("Invalid publishing target '%s'. Valid targets for site '%s' are: '%s' and '%s'",
						publishingTarget, siteId, liveTarget, stagingTarget), liveTarget, stagingTarget);
			}
		}
	}

	@Override
	public void setApplicationContext(@NonNull final ApplicationContext applicationContext) throws BeansException {
		this.applicationContext = applicationContext;
	}

	/**
	 * Create a new publish package and populate it with the necessary information.
	 *
	 * @return the newly created publish package
	 * @throws AuthenticationException if unable to find the current user
	 */
	protected PublishPackage createPackage(final Site site,
										   final String target,
										   final PackageType packageType,
										   final boolean requestApproval,
										   final Instant schedule,
										   final String title,
										   final String comment) throws AuthenticationException {
		PublishPackage publishPackage = new PublishPackage();
		publishPackage.setPackageType(packageType);
		publishPackage.setSite(site);
		publishPackage.setSiteId(site.getId());
		publishPackage.setTarget(target);
		publishPackage.setSchedule(schedule);
		publishPackage.setTitle(title);
		publishPackage.setSubmitterComment(comment);
		publishPackage.setSubmitterId(SecurityUtils.getCurrentUser().getId());
		publishPackage.setCommitId(site.getLastCommitId());
		publishPackage.setApprovalState(requestApproval ? SUBMITTED : APPROVED);
		return publishPackage;
	}

	/**
	 * Template method to build a publish package and its items.
	 *
	 * @return the id of the created package
	 */
	protected long buildPublishPackage(final Site site,
									   final String target,
									   final PackageType packageType,
									   final Collection<PublishRequestPath> paths,
									   final Collection<String> commitIds,
									   final boolean requestApproval,
									   final Instant schedule,
									   final String title,
			final String comment,
			final Collection<PublishItem> publishItems)
			throws ServiceLayerException, AuthenticationException {
		PublishPackage publishPackage = submitPublishPackage(site, target, packageType, requestApproval,
				schedule, title, comment, publishItems);

		auditPublishSubmission(publishPackage, requestApproval ? OPERATION_REQUEST_PUBLISH : OPERATION_PUBLISH);

		applicationContext.publishEvent(new WorkflowEvent(getAuthentication(),
				site.getSiteId(), publishPackage.getId(), requestApproval ? SUBMIT : DIRECT_PUBLISH));
		if (!requestApproval) {
			notifyPublisher(publishPackage, site);
		}
		return publishPackage.getId();
	}

	private PublishPackage submitPublishPackage(Site site, String target, PackageType packageType, boolean requestApproval,
												Instant schedule, String title, String comment,
												Collection<PublishItem> publishItems) throws AuthenticationException, ServiceLayerException {
		Collection<String> allPaths = null;
		boolean clearSystemProcessing = false;
		try {
			allPaths = publishItems.stream()
				.map(PublishItem::getPath)
				.collect(toSet());

			if (itemService.isSystemProcessing(site.getSiteId(), allPaths)) {
				throw new ServiceLayerException("Failed to submit publish package: Some items are being processed by the system");
			}
			clearSystemProcessing = true;
			itemService.setSystemProcessingBulk(site.getSiteId(), allPaths, true);
			// Create package
			PublishPackage publishPackage = createPackage(site, target, packageType,
				requestApproval, schedule, title, comment);

			boolean isLiveTarget = CS.equals(servicesConfig.getLiveEnvironment(site.getSiteId()), target);
			retryingDatabaseOperationFacade.retry(() -> publishDao.insertPackageAndItems(publishPackage, publishItems, isLiveTarget));
			return publishPackage;
		} finally {
			if (clearSystemProcessing) {
				itemService.setSystemProcessingBulk(site.getSiteId(), allPaths, false);
			}
		}
	}

	/**
	 * Notify (if needed) the publisher to process the publish package.
	 *
	 * @param publishPackage the newly created publish package
	 * @param site           the site
	 */
	protected void notifyPublisher(final PublishPackage publishPackage, Site site) {
		if (publishPackage.getSchedule() == null) {
			applicationContext.publishEvent(
				new RequestPublishEvent(site.getSiteId(), publishPackage.getId()));
		}
	}

	/**
	 * Build an initial publish package for a site.
	 *
	 * @param site             the site
	 * @param publishingTarget the publishing target
	 * @param requestApproval  whether to request approval
	 * @param comment          the comment
	 * @return created package id
	 */
	protected long buildInitialPublishPackage(Site site, String publishingTarget, boolean requestApproval, String title,
			String comment)
			throws AuthenticationException, ServiceLayerException {
		checkPublishPermissions(site.getSiteId(), requestApproval, emptyList());

		return buildPublishPackage(site, publishingTarget, INITIAL_PUBLISH, emptyList(), emptyList(), requestApproval,
				null, title, comment, emptyList());
	}

	/**
	 * Check if the current user has the necessary permissions to submit a publish
	 * operation.
	 * It checks the user has the right permissions for each path. If paths is empty
	 * (publish all or initial publish), it checks the user has the right
	 * permissions for the site.
	 *
	 * @param siteId          the site id
	 * @param requestApproval whether to request approval
	 * @param paths           the paths to check permissions for, empty for publish
	 *                        all or initial publish
	 * @throws ActionDeniedException if the current user does not have the necessary
	 *                               permissions
	 */
	protected void checkPublishPermissions(String siteId, boolean requestApproval, Collection<String> paths) {
		List<String> actions = requestApproval ? List.of(PERMISSION_PUBLISH_REQUEST)
				: List.of(PERMISSION_PUBLISH_REQUEST, PERMISSION_PUBLISH_REVIEW);

		if (isEmpty(paths)) {
			PermissionCheckingUtils.checkPermissions(permissionEvaluator,
					PermissionCheckingUtils.getSecuredResource(siteId),
					actions);
		} else {
			PermissionCheckingUtils.checkPermissions(permissionEvaluator,
					PermissionCheckingUtils.getSecuredResource(siteId, paths),
					actions);
		}
	}

	/**
	 * Create a collection of {@link PublishItem} objects for a publish all request.
	 *
	 * @param site the site
	 * @return the collection of publish items
	 */
	@NonNull
	protected Collection<PublishItem> getPublishAllItems(final Site site)
		throws InvalidParametersException {
		Collection<String> unpublishedPaths = itemService.getUnpublishedPaths(site.getId()).stream()
			.filter(path -> !contentRepository.isFolder(site.getSiteId(), path))
			.toList();
		if (isEmpty(unpublishedPaths)) {
			throw new InvalidParametersException("Failed to submit publish package: No items to publish");
		}
		Map<String, ItemPathAndState> statesByPath = itemService.getItemStates(site.getSiteId(), unpublishedPaths);
		List<PublishItem> publishItems = unpublishedPaths.stream()
			.map(path -> {
				long itemState = statesByPath.get(path).getState();
				return createPublishItem(path, isNew(itemState) ? ADD:UPDATE, true);
			})
			.toList();
		return publishItems;
	}

	/**
	 * Build a publish all package for a site.
	 *
	 * @param site             the site
	 * @param publishingTarget the publishing target
	 * @param title            the title
	 * @param comment          the comment
	 * @return created package id
	 */
	protected long buildPublishAllPackage(Site site, String publishingTarget, String title,
			String comment) throws AuthenticationException, ServiceLayerException {
		checkPublishPermissions(site.getSiteId(), false, emptyList());

		return buildPublishPackage(site, publishingTarget, PUBLISH_ALL, emptyList(), emptyList(),
			false, null, title, comment, getPublishAllItems(site));
	}

	/**
	 * Create a collection of {@link PublishItem} objects for a list package request.
	 *
	 * @param site      the site
	 * @param paths     the publish paths
	 * @param commitIds the commit ids
	 * @return the collection of publish items
	 */
	@NonNull
	protected Collection<PublishItem> getItemListPackageItems(final Site site, final Collection<PublishRequestPath> paths,
															  final Collection<String> commitIds, final String target) throws ServiceLayerException, IOException {
		// Combine list of paths and list of commit changes
		Map<String, PublishItem> publishItemsByPath = new HashMap<>();
		createPublishItemsFromCommitIds(site, commitIds, publishItemsByPath);
		createPublishItemsFromPaths(site, paths, publishItemsByPath, target);
		createPublishItemsForHardDeps(site, target, publishItemsByPath);

		if (publishItemsByPath.isEmpty()) {
			throw new InvalidParametersException("Failed to submit publish package: No items to publish");
		}
		return publishItemsByPath.values();
	}

	/**
	 * Build an item list package for a site.
	 *
	 * @param site            the site
	 * @param target          the publishing target
	 * @param paths           the publish paths
	 * @param commitIds       the commit ids
	 * @param requestApproval whether to request approval
	 * @param schedule        the schedule
	 * @param comment         the comment
	 * @return created package id
	 */
	protected long buildItemListPackage(Site site, String target, Collection<PublishRequestPath> paths,
			Collection<String> commitIds, boolean requestApproval, Instant schedule,
			String title, String comment)
			throws ServiceLayerException, AuthenticationException {

		Collection<PublishItem> publishItems;
		try {
			publishItems = getItemListPackageItems(site, paths, commitIds, target);
		} catch (IOException e) {
			logger.error("Failed to submit publish package", e);
			throw new ServiceLayerException("Failed to submit publish package", e);
		}

		Collection<String> publishPaths = publishItems.stream()
				.map(PublishItem::getPath)
				.collect(toSet());

		checkPublishPermissions(site.getSiteId(), requestApproval, publishPaths);

		return buildPublishPackage(site, target, ITEM_LIST, paths, commitIds, requestApproval, schedule, title, comment,
				publishItems);
	}

}
