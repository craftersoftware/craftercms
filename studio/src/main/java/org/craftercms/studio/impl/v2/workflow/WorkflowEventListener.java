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

package org.craftercms.studio.impl.v2.workflow;

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime;
import org.craftercms.studio.api.v2.dal.publish.PublishItem;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.event.publish.PublishErrorEvent;
import org.craftercms.studio.api.v2.event.workflow.WorkflowEvent;
import org.craftercms.studio.api.v2.exception.publish.PublishPackageNotFoundException;
import org.craftercms.studio.api.v2.service.notification.NotificationService;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;

import java.beans.ConstructorProperties;
import java.util.Collection;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.WORKFLOW_NOTIFICATION_ENABLED;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.WORKFLOW_NOTIFICATION_MAX_ITEM_COUNT;

/**
 * Listener for workflow events
 * <p>
 * It will listen for workflow events and send notifications accordingly
 */
public class WorkflowEventListener {

	private final Logger logger = LoggerFactory.getLogger(WorkflowEventListener.class);

	private static final int DEFAULT_MAX_ITEM_COUNT = 10;

	private final NotificationService notificationService;
	private final StudioConfiguration studioConfiguration;
	private final PublishService publishService;

	@ConstructorProperties({"notificationService", "studioConfiguration", "publishService"})
	public WorkflowEventListener(final NotificationService notificationService, final StudioConfiguration studioConfiguration,
								 final PublishService publishService) {
		this.notificationService = notificationService;
		this.studioConfiguration = studioConfiguration;
		this.publishService = publishService;
	}

	/**
	 * Check if notifications are enabled
	 */
	private boolean notificationsEnabled() {
		return studioConfiguration.getProperty(WORKFLOW_NOTIFICATION_ENABLED, Boolean.class, true);
	}

	/**
	 * Get the maximum number of items to include in the notification message
	 */
	private int getMaxPublishItems() {
		return studioConfiguration.getProperty(WORKFLOW_NOTIFICATION_MAX_ITEM_COUNT, Integer.class, DEFAULT_MAX_ITEM_COUNT);
	}

	@Async
	@EventListener
	@LogExecutionTime
	public void handleEvent(final WorkflowEvent event) throws ServiceLayerException, UserNotFoundException {
		if (!notificationsEnabled()) {
			logger.debug("Workflow notifications are disabled, ignoring workflow event: {}", event);
			return;
		}
		PublishPackage publishPackage = publishService.getPackage(event.getSiteId(), event.getPackageId());
		switch (event.getWorkflowEventType()) {
			case SUBMIT -> notificationService.notifyPackageSubmission(publishPackage, getPackagePaths(publishPackage));
			case APPROVE -> notificationService.notifyPackageApproval(publishPackage, getPackagePaths(publishPackage));
			case REJECT -> notificationService.notifyPackageRejection(publishPackage, getPackagePaths(publishPackage));
		}
	}


	@Async
	@EventListener
	@LogExecutionTime
	public void handleEvent(final PublishErrorEvent event) throws ServiceLayerException, UserNotFoundException {
		PublishPackage publishPackage = publishService.getPackage(event.getSiteId(), event.getPackageId());
		Collection<PublishItem> failedItems = publishService.getFailedPublishItems(publishPackage.getSite().getSiteId(),
			publishPackage.getId(), 0, getMaxPublishItems());
		notificationService.notifyPublishError(publishPackage, event.getException(), failedItems);
	}

	/**
	 * Get the paths of the first {@link #getMaxPublishItems()} items in the package
	 *
	 * @param publishPackage the package
	 * @return list of paths of the first {@link #getMaxPublishItems()} items in the package
	 */
	private Collection<String> getPackagePaths(final PublishPackage publishPackage) throws PublishPackageNotFoundException, SiteNotFoundException {
		Collection<PublishItem> publishItems = publishService.getPublishItems(publishPackage.getSite().getSiteId(),
			publishPackage.getId(), 0, getMaxPublishItems());
		return publishItems.stream().map(PublishItem::getPath).toList();
	}
}
