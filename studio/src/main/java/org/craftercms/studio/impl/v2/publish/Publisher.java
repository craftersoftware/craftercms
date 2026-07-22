/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.impl.v2.publish;

import java.beans.ConstructorProperties;
import java.io.IOException;
import static java.lang.String.format;
import static java.time.Instant.now;
import java.util.ArrayList;
import java.util.Collection;
import static java.util.Collections.emptyList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.apache.commons.collections4.ListUtils;
import static org.apache.commons.lang3.Strings.CS;
import org.apache.ibatis.session.ExecutorType;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.annotation.LogExecutionTime;
import org.craftercms.studio.api.v2.dal.AuditLog;
import static org.craftercms.studio.api.v2.dal.AuditLog.createAuditLogEntry;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_INITIAL_PUBLISH;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_ITEM_LIST_PUBLISHED;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_PUBLISH_ALL;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_PUBLISH_START;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_PUBLISH_PACKAGE;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.SiteDAO;
import org.craftercms.studio.api.v2.dal.publish.ItemTargetDAO;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.api.v2.dal.publish.PublishItem;
import static org.craftercms.studio.api.v2.dal.publish.PublishItem.Action.DELETE;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.COMPLETED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.PROCESSING;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.READY;
import org.craftercms.studio.api.v2.event.publish.PublishErrorEvent;
import org.craftercms.studio.api.v2.event.publish.PublishEvent;
import org.craftercms.studio.api.v2.event.publish.RequestPublishEvent;
import org.craftercms.studio.api.v2.repository.ContentRepository;
import org.craftercms.studio.api.v2.repository.PublishItemTO;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobAwareContentRepository;
import org.craftercms.studio.api.v2.repository.publish.GitPublishChangeSet;
import org.craftercms.studio.api.v2.service.audit.ActivityStreamService;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.api.v2.task.TaskManager;
import org.craftercms.studio.api.v2.task.TaskProgress;
import org.craftercms.studio.api.v2.task.TaskProgress.Stage;
import org.craftercms.studio.api.v2.utils.StudioUtils;
import org.craftercms.studio.impl.v2.utils.DateUtils;
import org.craftercms.studio.impl.v2.utils.PublishUtils;
import org.craftercms.studio.impl.v2.utils.db.DBUtils;
import org.craftercms.studio.model.task.PublishTask;
import org.craftercms.studio.model.task.PublishTask.PublishTaskId;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationEventPublisherAware;
import org.springframework.context.event.EventListener;
import static org.springframework.data.util.Predicates.negate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * Listen for {@link RequestPublishEvent} and handle accordingly.
 */
public class Publisher implements ApplicationEventPublisherAware {

	private static final Logger logger = LoggerFactory.getLogger(Publisher.class);
	// Format for transaction name: PUBLISH-{siteId}-{packageId}-{target}
	private static final String PUBLISH_TRANSACTION_NAME_FORMAT = "PUBLISH-%s-%d-%s";

	private final SiteDAO siteDao;
	private final PublishDAO publishDao;
	private ApplicationEventPublisher eventPublisher;
	private final AuditService auditService;
	private final StudioBlobAwareContentRepository contentRepository;
	private final GeneralLockService generalLockService;
	private final ServicesConfig servicesConfig;
	private final ItemTargetDAO itemTargetDAO;
	private final PlatformTransactionManager transactionManager;
	private final ActivityStreamService activityService;
	private final TaskManager taskManager;
	private final SqlSessionFactory sqlSessionFactory;

	@ConstructorProperties({"siteDao", "publishDao", "auditService",
		"contentRepository", "generalLockService", "servicesConfig", "itemTargetDAO", "transactionManager",
		"activityService", "taskManager", "sqlSessionFactory"})
	public Publisher(final SiteDAO siteDao, final PublishDAO publishDao,
			 final AuditService auditService,
			 final StudioBlobAwareContentRepository contentRepository,
			 final GeneralLockService generalLockService,
			 final ServicesConfig servicesConfig,
			 final ItemTargetDAO itemTargetDAO,
			 final PlatformTransactionManager transactionManager,
			 final ActivityStreamService activityService,
			 final TaskManager taskManager,
			 final SqlSessionFactory sqlSessionFactory) {
		this.siteDao = siteDao;
		this.publishDao = publishDao;
		this.auditService = auditService;
		this.contentRepository = contentRepository;
		this.generalLockService = generalLockService;
		this.servicesConfig = servicesConfig;
		this.itemTargetDAO = itemTargetDAO;
		this.transactionManager = transactionManager;
		this.activityService = activityService;
		this.taskManager = taskManager;
		this.sqlSessionFactory = sqlSessionFactory;
	}

	@Async
	@EventListener
	@LogExecutionTime
	public void handleRequestPublishEvent(final RequestPublishEvent event) throws ServiceLayerException {
		Collection<Long> packageIds = event.getPackageIds();
		String siteId = event.getSiteId();
		logger.debug("Received request to publish packages '{}' for site: '{}'", packageIds, siteId);
		Site site = siteDao.getSite(siteId);
		if (!site.getPublishingEnabled()) {
			logger.warn("Site '{}' is not enabled for publishing. Ignoring request to publish packages '{}'", siteId, packageIds);
			return;
		}
		if (!Site.State.READY.equals(site.getState())) {
			logger.warn("Site '{}' is not in a ready state. Ignoring request to publish packages '{}'", siteId, packageIds);
			return;
		}
		String lockKey = StudioUtils.getPublishingLockKey(siteId);
		boolean lockAcquired = generalLockService.tryLock(lockKey);
		if (!lockAcquired) {
			logger.warn("Failed to acquire publishing lock for site '{}'", siteId);
			return;
		}

		try {
			for (Long packageId : packageIds) {
				lockAndPublish(site.getId(), packageId);
			}
		} finally {
			generalLockService.unlock(lockKey);
		}
	}

	protected void lockAndPublish(final long siteId, final long packageId) throws ServiceLayerException {
		String packageIdLockKey = StudioUtils.getPublishPackageLockKey(packageId);
		logger.debug("Trying to acquire lock for publish package '{}'", packageId);
		boolean lockAcquired = generalLockService.tryLock(packageIdLockKey);
		if (!lockAcquired) {
			logger.warn("Failed to acquire lock for publish package '{}' for site '{}'", packageId, siteId);
			return;
		}
		try {
			PublishPackage publishPackage = publishDao.getById(siteId, packageId);
			doPublish(publishPackage);
		} finally {
			generalLockService.unlock(packageIdLockKey);
		}
	}

	/*
	 * Process a publish package
	 */
	protected void doPublish(final PublishPackage publishPackage) throws ServiceLayerException {
		long packageId = publishPackage.getId();
		String siteId = publishPackage.getSite().getSiteId();
		publishPackage.updatePackageState(PROCESSING.value, READY.value);
		publishDao.updatePackage(publishPackage);
		TaskProgress<PublishTaskId, Long> taskProgress = taskManager.registerTask(new PublishTask(siteId, packageId));
		taskProgress.start();
		String activityOperation = null;
		try {
			Stage itemLoadStage = taskProgress.startStage("Loading items list");
			publishDao.updatePublishItemsState(packageId, PublishItem.PublishState.PROCESSING.value, PublishItem.PublishState.PENDING.value);
			Collection<PublishItem> publishItems = publishDao.getPublishItems(publishPackage.getSite().getSiteId(), packageId);
			auditPublishOperation(publishPackage, OPERATION_PUBLISH_START);
			itemLoadStage.complete();

			switch (publishPackage.getPackageType()) {
				case INITIAL_PUBLISH -> {
					logger.debug("Processing initial publish package '{}' for site '{}'", packageId, siteId);
					activityOperation = OPERATION_INITIAL_PUBLISH;
					doInitialPublish(publishPackage);
				}
				case PUBLISH_ALL -> {
					logger.debug("Processing publish-all package '{}' for site '{}'", packageId, siteId);
					activityOperation = OPERATION_PUBLISH_ALL;
					doPublishItemList(publishPackage, publishItems, this::doPublishAllTarget);
				}
				case ITEM_LIST -> {
					logger.debug("Processing publish package '{}' for site '{}'", packageId, siteId);
					activityOperation = OPERATION_ITEM_LIST_PUBLISHED;
					doPublishItemList(publishPackage, publishItems, this::doPublishItemListTarget);
				}
				default -> throw new ServiceLayerException(format("Unknown package type '%s' for package '%d' for site '%s'",
					publishPackage.getPackageType(), packageId, siteId));
			}
		} finally {
			Stage completeStage = taskProgress.startStage("Save completed package");
			if (activityOperation != null) {
				auditPublishOperation(publishPackage, activityOperation);
				activityService.insertActivity(publishPackage.getSiteId(), publishPackage.getSubmitterId(), activityOperation, DateUtils.getCurrentTime(),
					null, Long.toString(packageId));
			}
			eventPublisher.publishEvent(new PublishEvent(siteId));
			publishPackage.setPublishedOn(now());
			publishPackage.updatePackageState(COMPLETED.value, PROCESSING.value);
			publishDao.updatePackage(publishPackage);
			publishDao.updatePublishItemsState(packageId, 0, PublishItem.PublishState.PROCESSING.value);
			completeStage.complete();
			taskProgress.complete(publishPackage.getPackageState());
		}
	}

	/**
	 * Process a package that contains a list of items to publish (i.e. a package with type equal to either PUBLISH_ALL or ITEM_LIST)
	 */
	protected void doPublishItemList(final PublishPackage publishPackage,
					 final Collection<PublishItem> publishItems,
					 final TargetPublisherFunction targetPublisher) throws SiteNotFoundException {
		String siteId = publishPackage.getSite().getSiteId();
		String target = publishPackage.getTarget();

		boolean isLiveTarget = CS.equals(servicesConfig.getLiveEnvironment(siteId), target);

		if (isLiveTarget && servicesConfig.isStagingEnvironmentEnabled(siteId)) {
			String stagingEnvironment = servicesConfig.getStagingEnvironment(siteId);
			runTargetPublisher(publishPackage, publishItems, targetPublisher, false, stagingEnvironment);
		}
		runTargetPublisher(publishPackage, publishItems, targetPublisher, isLiveTarget, target);
	}

	/**
	 * Helper function to run the "target publisher" and handle exception.
	 * On exception, it will update the package and its PublishItems with the target-aware failing state
	 */
	private void runTargetPublisher(final PublishPackage publishPackage,
					final Collection<PublishItem> publishItems,
					final TargetPublisherFunction targetPublisher,
					final boolean isLiveTarget,
					final String target) throws SiteNotFoundException {
		PublishPackageTO packageTO = getPublishPackageTO(publishPackage, isLiveTarget);
		try {
			runInTransaction(targetPublisher).run(packageTO, target, publishItems);
		} catch (Exception e) {
			logger.error("Failed to publish package '{}' to target '{}' for site '{}'", publishPackage.getId(), target, publishPackage.getSite().getSiteId(), e);
			publishPackage.updatePackageState(packageTO.getFailedOnBits(), 0);
			packageTO.setError(PublishUtils.translatePackageException(e));
			publishDao.updatePackage(publishPackage);
			publishDao.updatePublishItemsState(publishPackage.getId(), packageTO.getFailedOnBits(), 0);
			eventPublisher.publishEvent(new PublishErrorEvent(publishPackage.getSite().getSiteId(), publishPackage.getId(), e));
		} finally {
			publishDao.updateItemStatesForCompletePackage(packageTO.getId(),
				packageTO.getItemSuccessOnMask(),
				packageTO.getItemSuccessOffMask(),
				packageTO.getItemFailureOffMask(),
				packageTO.getItemSuccessState(),
				servicesConfig.getLiveEnvironment(publishPackage.getSite().getSiteId()));
		}
	}

	private PublishPackageTO getPublishPackageTO(final PublishPackage publishPackage, final boolean isLiveTarget) {
		return new PublishPackageTO(publishPackage, isLiveTarget);
	}

	/**
	 * Convenience method to call doPublishTarget using ContentRepository publish function
	 *
	 * @param publishPackage the package to publish
	 * @param target         the target to publish to
	 * @param publishItems   the list of items to publish
	 */
	private void doPublishItemListTarget(final PublishPackageTO publishPackage,
					     final String target, final Collection<PublishItem> publishItems) throws ServiceLayerException, IOException {
		doPublishTarget(publishPackage, target, publishItems, contentRepository::publish);
	}

	private List<PublishItemTOImpl> expandPublishItem(final PublishItem pi, final String target, final boolean isLiveTarget) {
		List<PublishItemTOImpl> items = new ArrayList<>();
		items.add(new PublishItemTOImpl(pi, pi.getPath(), pi.getAction(), isLiveTarget));
		String previousPath = pi.getPreviousPath(target, isLiveTarget);
		if (previousPath != null) {
			items.add(new PublishItemTOImpl(pi, previousPath, DELETE, isLiveTarget));
		}
		return items;
	}

	/**
	 * Process a list of items to publish for a specific target
	 * Notice that for packages with target 'live', this method should
	 * be called twice, once for the staging target and once for the live target
	 */
	private void doPublishTarget(final PublishPackageTO packageTO,
				     final String target,
				     final Collection<PublishItem> publishItems,
				     final RepoPublishFunction repoPublishFunction) throws ServiceLayerException, IOException {
		PublishPackage publishPackage = packageTO.getPackage();
		String siteId = packageTO.getSite().getSiteId();
		long packageId = packageTO.getId();
		TaskProgress<PublishTaskId, Long> taskProgress = taskManager.getTask(new PublishTaskId(siteId, packageId));

		String liveTarget = servicesConfig.getLiveEnvironment(siteId);
		boolean isLiveTarget = CS.equals(liveTarget, target);
		if (!isLiveTarget && !contentRepository.isTargetPublished(siteId, target)) {
			Stage initStaging = taskProgress.startStage("Init staging");
			itemTargetDAO.initStaging(packageTO.getSite().getId(), target, liveTarget);
			initStaging.complete();
		}

		Stage prepareStage = taskProgress.startStage("Prepare items for '%s'".formatted(target), publishItems.size());
		List<PublishItemTOImpl> publishItemTOs = publishItems.stream()
			.peek(pi -> logger.debug("Processing publish item '{}' for package '{}' to target '{}', site '{}'", pi.getPath(), packageId, target, siteId))
			.map(pi -> expandPublishItem(pi, target, isLiveTarget))
			.peek(pi -> prepareStage.advanceOne())
			.flatMap(List::stream)
			.toList();
		prepareStage.complete();

		GitPublishChangeSet<PublishItemTOImpl> publishChangeSet = repoPublishFunction.run(publishPackage, target, publishItemTOs);

		Stage updateStatesStage = taskProgress.startStage("Update item states for '%s' target".formatted(target));
		updateStatesOnTargetComplete(packageTO, target, publishChangeSet);
		updateStatesStage.complete();

		if (publishChangeSet.completed()) {
			Stage refStage = taskProgress.startStage("Update ref for '%s' branch".formatted(target));
			contentRepository.updateRef(siteId, packageId, publishChangeSet.commitId(), target);
			refStage.complete();
		}
		if (publishChangeSet.hasFailedItems()) {
			eventPublisher.publishEvent(new PublishErrorEvent(siteId, packageId));
		}
	}

	/**
	 * Update the states of the package and the items affected after a target has been published
	 */
	private void updateStatesOnTargetComplete(PublishPackageTO packageTO, String target,
						  GitPublishChangeSet<PublishItemTOImpl> publishChangeSet) {
		String siteId = packageTO.getSite().getSiteId();
		long packageId = packageTO.getId();
		Set<PublishItem> failedItems = publishChangeSet.failedItems().stream()
			.peek(pi -> logger.error("Failed to publish item '{}' for package '{}' to target '{}', site '{}'", pi.getPath(), packageId, target, siteId))
			.map(PublishItemTOImpl::getPublishItem)
			.collect(Collectors.toSet());

		List<PublishItem> successfulItems = publishChangeSet.successfulItems().stream()
			.peek(pi -> logger.debug("Successfully published item '{}' for package '{}' to target '{}', site '{}'", pi.getPath(), packageId, target, siteId))
			.map(PublishItemTOImpl::getPublishItem)
			.filter(negate(failedItems::contains))
			.toList();

		if (failedItems.isEmpty()) {
			publishDao.updatePublishItemsState(packageId, packageTO.getItemSuccessState(), 0);
			if (packageTO.getPackageType() == PublishPackage.PackageType.PUBLISH_ALL) {
				cancelOutstandingTargetPackages(packageTO.getSite().getId(), target);
			}
		} else {
			publishDao.updatePublishItemListState(ListUtils.union(successfulItems, new ArrayList<>(failedItems)));
		}

		long packageStateOnBits;
		if (publishChangeSet.completed()) {
			itemTargetDAO.updateForCompletePackage(packageId, publishChangeSet.commitId(), target, packageTO.getItemSuccessState());
			packageTO.setPublishedCommitId(publishChangeSet.commitId());
			publishDao.updatePackage(packageTO.getPackage());
			if (publishChangeSet.hasFailedItems()) {
				packageStateOnBits = packageTO.getCompletedWithErrorsOnBits();
			} else {
				packageStateOnBits = packageTO.getSuccessOnBits();
			}
		} else {
			packageStateOnBits = packageTO.getFailedOnBits();
		}
		packageTO.getPackage().updatePackageState(packageStateOnBits, 0);
		publishDao.updatePackage(packageTO.getPackage());
	}

	/**
	 * Convenience method to call doPublishTarget using ContentRepository publishAll function
	 *
	 * @param publishPackage the package to publish
	 * @param target         the target to publish to
	 * @param publishItems   the list of items to publish
	 */
	private void doPublishAllTarget(final PublishPackageTO publishPackage,
					final String target,
					final Collection<PublishItem> publishItems) throws ServiceLayerException, IOException {
		doPublishTarget(publishPackage, target, publishItems, contentRepository::publish);
	}

	private TargetPublisherFunction runInTransaction(TargetPublisherFunction publisher) {
		return (publishPackage,
			publishingTarget,
			publishItems) ->
			DBUtils.runInTransaction(transactionManager,
				format(PUBLISH_TRANSACTION_NAME_FORMAT, publishPackage.getSite().getSiteId(), publishPackage.getId(), publishingTarget),
				() -> publisher.run(publishPackage, publishingTarget, publishItems));
	}

	/**
	 * Convenience functional interface for a method that publishes a package to a target
	 */
	@FunctionalInterface
	protected interface TargetPublisherFunction {
		void run(final PublishPackageTO publishPackage,
			 final String target,
			 final Collection<PublishItem> publishItems)
			throws Exception;
	}

	/**
	 * Convenience functional interface for a {@link ContentRepository} publish method
	 */
	@FunctionalInterface
	private interface RepoPublishFunction {
		GitPublishChangeSet<PublishItemTOImpl> run(PublishPackage publishPackage,
							   String publishingTarget,
							   Collection<PublishItemTOImpl> publishItems) throws ServiceLayerException, IOException;
	}

	/**
	 * Process an initial publish package
	 */
	private void doInitialPublish(final PublishPackage publishPackage) throws SiteNotFoundException {
		String siteId = publishPackage.getSite().getSiteId();
		long packageId = publishPackage.getId();
		String liveTarget = servicesConfig.getLiveEnvironment(siteId);
		boolean stagingEnabled = servicesConfig.isStagingEnvironmentEnabled(siteId);
		String stagingTarget = servicesConfig.getStagingEnvironment(siteId);

		Map<String, PublishItem> failedItems = new HashMap<>();
		if (stagingEnabled) {
			runTargetPublisher(publishPackage, emptyList(), (packageTO, target, __) -> doInitialPublishTarget(packageTO, target, failedItems, false),
				false, stagingTarget);
		}

		runTargetPublisher(publishPackage, emptyList(), (packageTO, target, __) -> doInitialPublishTarget(packageTO, target, failedItems, true),
			true, liveTarget);

		if (failedItems.isEmpty()) {
			cancelAllOutstandingPackages(publishPackage.getSite().getId());
		} else {
			try (SqlSession batchSqlSession = sqlSessionFactory.openSession(ExecutorType.BATCH)) {
				PublishDAO batchPublishDao = batchSqlSession.getMapper(PublishDAO.class);
				// Insert failed items to publish_item table
				batchPublishDao.insertInitialPublishItems(packageId, failedItems.values());
				batchSqlSession.commit();
			}
		}
		// The items' states are updated after we have inserted the failed items into the publish_item table
		if (stagingEnabled) {
			updateStatesOnInitialPublish(publishPackage, stagingTarget, false);
		}
		updateStatesOnInitialPublish(publishPackage, liveTarget, true);
	}

	private PublishItem getInitialPublishItem(final long packageId, final String path) {
		PublishItem pi = new PublishItem();
		pi.setPackageId(packageId);
		pi.setAction(PublishItem.Action.ADD);
		pi.setPath(path);
		pi.setUserRequested(true);
		return pi;
	}

	private void doInitialPublishTarget(final PublishPackageTO packageTO, final String target,
					    final Map<String, PublishItem> failedItems,
					    final boolean isLiveTarget)
		throws ServiceLayerException {
		PublishPackage publishPackage = packageTO.getPackage();
		GitPublishChangeSet<? extends PublishItemTO> initialPublishResult = contentRepository.initialPublish(publishPackage, target);

		long packageOnBits = packageTO.getSuccessOnBits();
		if (initialPublishResult.hasFailedItems()) {
			initialPublishResult.failedItems().forEach(publishItemTO -> {
				String path = publishItemTO.getPath();
				PublishItem publishItem = failedItems.computeIfAbsent(path, p -> getInitialPublishItem(packageTO.getId(), p));
				PublishItemTOImpl itemTO = new PublishItemTOImpl(publishItem, path, PublishItem.Action.ADD, isLiveTarget);
				itemTO.setFailed(publishItemTO.getError());
			});
			packageOnBits = packageTO.getCompletedWithErrorsOnBits();
		}
		packageTO.setPublishedCommitId(initialPublishResult.commitId());
		publishPackage.updatePackageState(packageOnBits, 0);
		publishDao.updatePackage(publishPackage);

		if (initialPublishResult.hasFailedItems()) {
			eventPublisher.publishEvent(new PublishErrorEvent(publishPackage.getSite().getSiteId(), publishPackage.getId()));
		}
	}

	/**
	 * Update the package state and published commit id after an initial publish has been completed
	 * Also insert the item_target records for the initial publish and update the item table state bits
	 */
	private void updateStatesOnInitialPublish(final PublishPackage publishPackage, final String target,
						  final boolean isLiveTarget) {
		PublishPackageTO packageTO = getPublishPackageTO(publishPackage, isLiveTarget);
		long failedItemState = isLiveTarget ? PublishItem.PublishState.LIVE_FAILED.value : PublishItem.PublishState.STAGING_FAILED.value;

		itemTargetDAO.insertForInitialPublish(packageTO.getSite().getId(), publishPackage.getId(),
			failedItemState, target, packageTO.getPublishedCommitId(), publishPackage.getPublishedOn());

		publishDao.updateItemStatesForInitialPublish(packageTO.getSite().getId(),
			packageTO.getId(),
			failedItemState,
			packageTO.getItemSuccessOnMask(),
			packageTO.getItemSuccessOffMask(),
			packageTO.getItemFailureOffMask());
	}

	private void cancelAllOutstandingPackages(final long siteId) {
		try {
			publishDao.cancelAllOutstandingPackages(siteId);
		} catch (Exception e) {
			logger.error("Failed to cancel outstanding packages for site '{}'", siteId, e);
		}
	}

	private void cancelOutstandingTargetPackages(final long siteId, final String target) {
		try {
			publishDao.cancelOutstandingPackages(siteId, target);
		} catch (Exception e) {
			logger.error("Failed to cancel outstanding packages for site '{}', target '{}'", siteId, target, e);
		}
	}

	/**
	 * Audit a publish operation
	 *
	 * @param p         the publish package
	 * @param operation the operation
	 */
	protected void auditPublishOperation(final PublishPackage p, final String operation) {
		AuditLog auditLog = createAuditLogEntry();
		auditLog.setOperation(operation);
		String actorId = p.getSubmitter() != null ? p.getSubmitter().getUsername() : String.valueOf(p.getSubmitterId());
		auditLog.setActorId(actorId);
		auditLog.setSiteId(p.getSiteId());
		auditLog.setPrimaryTargetId(String.valueOf(p.getId()));
		auditLog.setPrimaryTargetType(TARGET_TYPE_PUBLISH_PACKAGE);
		auditLog.setPrimaryTargetValue(String.valueOf(p.getId()));
		auditService.insertAuditLog(auditLog);
	}

	@Override
	public void setApplicationEventPublisher(@NonNull final ApplicationEventPublisher applicationEventPublisher) {
		this.eventPublisher = applicationEventPublisher;
	}
}
