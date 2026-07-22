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

package org.craftercms.studio.impl.v2.service.workflow.internal;

import java.time.Instant;
import static java.time.Instant.now;
import java.util.Collection;
import java.util.List;

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.dal.AuditLog;
import static org.craftercms.studio.api.v2.dal.AuditLog.createAuditLogEntry;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_APPROVE_PUBLISH_PACKAGE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_CANCEL_PUBLISH_PACKAGE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_REJECT_PUBLISH_PACKAGE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.ORIGIN_API;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_PUBLISH_PACKAGE;
import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.dal.item.ContentItem;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.APPROVED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.ApprovalState.REJECTED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.CANCELLED;
import org.craftercms.studio.api.v2.event.workflow.WorkflowEvent;
import org.craftercms.studio.api.v2.exception.publish.InvalidPackageStateException;
import org.craftercms.studio.api.v2.exception.publish.PackageAlreadyApprovedException;
import org.craftercms.studio.api.v2.exception.publish.PublishPackageNotFoundException;
import org.craftercms.studio.api.v2.service.audit.ActivityStreamService;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.api.v2.service.item.ItemService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.service.workflow.WorkflowService;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getPublishPackageLockKey;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getSandboxRepoLockKey;
import org.craftercms.studio.impl.v2.utils.DateUtils;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getAuthentication;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getCurrentUser;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationEventPublisherAware;

public class WorkflowServiceInternalImpl implements WorkflowService, ApplicationEventPublisherAware {

	private final static Logger logger = LoggerFactory.getLogger(WorkflowServiceInternalImpl.class);

	private ItemService itemService;
	private SitesService siteService;
	private GeneralLockService generalLockService;
	private ActivityStreamService activityStreamService;
	private AuditService auditService;
	private PublishDAO publishDao;
	private ServicesConfig servicesConfig;
	private ApplicationEventPublisher eventPublisher;
	private RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;

	@Override
	public int getItemStatesTotal(String siteId, String path, Long states) {
		return itemService.getItemByStatesTotal(siteId, path, states, null);
	}

	@Override
	public List<ContentItem> getItemsByStates(String siteId, String path, Long states, int offset, int limit) throws SiteNotFoundException {
		return itemService.getItemsByStates(siteId, path, states, null, null, offset, limit);
	}

	@Override
	public void updateItemStates(String siteId, List<String> paths, boolean clearSystemProcessing, boolean clearUserLocked, Boolean live, Boolean staged, Boolean isNew, Boolean modified) {
		itemService.updateItemStates(siteId, paths, clearSystemProcessing, clearUserLocked, live, staged, isNew, modified);
	}

	@Override
	public void updateItemStatesByQuery(String siteId, String path, Long states, boolean clearSystemProcessing, boolean clearUserLocked, Boolean live, Boolean staged, Boolean isNew, Boolean modified) {
		itemService.updateItemStatesByQuery(siteId, path, states, clearSystemProcessing, clearUserLocked,
			live, staged, isNew, modified);
	}

	@Override
	public void approvePackages(final String siteId, final Collection<Long> packageIds,
				   final Instant schedule, final boolean updateSchedule, final String comment)
		throws AuthenticationException, ServiceLayerException {
		for (Long packageId : packageIds) {
			doReviewPackage(siteId, packageId, p -> {
				if (APPROVED == p.getApprovalState()) {
					throw new PackageAlreadyApprovedException(siteId, packageId);
				}
				if (updateSchedule) {
					p.setSchedule(schedule);
				}
				p.setApprovalState(APPROVED);
				p.setReviewerComment(comment);
			}, OPERATION_APPROVE_PUBLISH_PACKAGE, WorkflowEvent.WorkFlowEventType.APPROVE);
		}
	}

	@Override
	public void cancelPackages(final String siteId, Collection<Long> packageIds, String comment)
			throws ServiceLayerException, AuthenticationException {
		String sandboxRepoLockKey = getSandboxRepoLockKey(siteId);
		generalLockService.lock(sandboxRepoLockKey);
		try {
			for (Long packageId : packageIds) {
				doReviewPackage(siteId, packageId, p -> {
					p.setPackageState(CANCELLED.value);
					p.setReviewerComment(comment);
				}, OPERATION_CANCEL_PUBLISH_PACKAGE, WorkflowEvent.WorkFlowEventType.CANCEL);
			}
		} finally {
			generalLockService.unlock(sandboxRepoLockKey);
		}
	}

	@Override
	public void rejectPackages(final String siteId, final Collection<Long> packageIds, final String comment)
		throws ServiceLayerException, AuthenticationException {
		for (Long packageId : packageIds) {
			doReviewPackage(siteId, packageId, p -> {
				p.setApprovalState(REJECTED);
				p.setPackageState(CANCELLED.value);
				p.setReviewerComment(comment);
			}, OPERATION_REJECT_PUBLISH_PACKAGE, WorkflowEvent.WorkFlowEventType.REJECT);
		}
	}

	/**
	 * Update a packageState and/or approvalState of a package
	 *
	 * @param siteId        the site id
	 * @param packageId     the package id
	 * @param packageReview the package review operation
	 * @param operation     the operation being performed (e.g. cancel, reject, approve)
	 * @param eventType     the workflow event type to be triggered if the update is completed
	 * @throws ServiceLayerException   if the package is not found or is not in a valid state
	 * @throws AuthenticationException if there is an error trying to retrieve the current user
	 */
	private void doReviewPackage(final String siteId, final long packageId,
				     final PackageReview packageReview,
				     final String operation, final WorkflowEvent.WorkFlowEventType eventType)
		throws ServiceLayerException, AuthenticationException {
		Site site = siteService.getSite(siteId);
		User user = getCurrentUser();

		PublishPackage publishPackage = publishDao.getById(site.getId(), packageId);
		if (publishPackage == null) {
			throw new PublishPackageNotFoundException(siteId, packageId);
		}

		String packageLockKey = getPublishPackageLockKey(packageId);
		generalLockService.lock(packageLockKey);
		try {
			publishPackage = publishDao.getById(site.getId(), packageId);
			if (publishPackage.getPackageState() != PublishPackage.PackageState.READY.value) {
				throw new InvalidPackageStateException("Unable to review package because it is not in READY state", siteId, packageId);
			}

			packageReview.reviewPackage(publishPackage);
			publishPackage.setReviewedOn(now());
			publishPackage.setReviewerId(user.getId());

			String liveTarget = servicesConfig.getLiveEnvironment(siteId);
			final PublishPackage finalPublishPackage = publishPackage;
			retryingDatabaseOperationFacade.retry(() ->
					publishDao.reviewPackage(finalPublishPackage, liveTarget)
			);

			createUpdateStatePackageAuditLogEntry(finalPublishPackage, user.getUsername(), operation);

			activityStreamService.insertActivity(site.getId(), user.getId(),
				operation, DateUtils.getCurrentTime(), null, String.valueOf(packageId));
			eventPublisher.publishEvent(new WorkflowEvent(getAuthentication(), siteId, packageId, eventType));
		} finally {
			generalLockService.unlock(packageLockKey);
		}
	}

	/**
	 * Audit package state update: cancellation/rejection/approval
	 *
	 * @param publishPackage the package being cancelled
	 * @param username       the username of the user who cancelled the package
	 * @param operation      the operation being performed
	 */
	private void createUpdateStatePackageAuditLogEntry(final PublishPackage publishPackage,
							   final String username, final String operation) {
		AuditLog auditLog = createAuditLogEntry();
		auditLog.setOrigin(ORIGIN_API);
		auditLog.setOperation(operation);
		auditLog.setActorId(username);
		auditLog.setSiteId(publishPackage.getSiteId());
		auditLog.setPrimaryTargetId(String.valueOf(publishPackage.getId()));
		auditLog.setPrimaryTargetType(TARGET_TYPE_PUBLISH_PACKAGE);
		auditLog.setPrimaryTargetValue(String.valueOf(publishPackage.getId()));
		auditService.insertAuditLog(auditLog);
	}

	public void setItemService(final ItemService itemService) {
		this.itemService = itemService;
	}

	@SuppressWarnings("unused")
	public void setActivityStreamService(final ActivityStreamService activityStreamService) {
		this.activityStreamService = activityStreamService;
	}

	public void setAuditService(final AuditService auditService) {
		this.auditService = auditService;
	}

	public void setGeneralLockService(final GeneralLockService generalLockService) {
		this.generalLockService = generalLockService;
	}

	@SuppressWarnings("unused")
	public void setPublishDao(final PublishDAO publishDao) {
		this.publishDao = publishDao;
	}

	public void setServicesConfig(final ServicesConfig servicesConfig) {
		this.servicesConfig = servicesConfig;
	}

	public void setSiteService(final SitesService siteService) {
		this.siteService = siteService;
	}

	@Override
	public void setApplicationEventPublisher(@NonNull final ApplicationEventPublisher applicationEventPublisher) {
		this.eventPublisher = applicationEventPublisher;
	}

	public void setRetryingDatabaseOperationFacade(final RetryingDatabaseOperationFacade retryingDatabaseOperationFacade) {
		this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
	}

	private interface PackageReview {
		void reviewPackage(PublishPackage publishPackage) throws ServiceLayerException;
	}
}
