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

import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.api.v2.dal.publish.PublishPackageId;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState;
import org.craftercms.studio.api.v2.event.publish.RequestPublishEvent;
import org.craftercms.studio.api.v2.job.ThrottledJob;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationEventPublisherAware;

import static org.craftercms.studio.api.v2.dal.Site.State.READY;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.PROCESSING;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.READY;

import java.beans.ConstructorProperties;
import java.util.List;

/**
 * Task to probe the publishing queue and trigger events for each site.
 */
public class PublishingQueueProbeTask extends ThrottledJob implements ApplicationEventPublisherAware {

	private static final Logger logger = LoggerFactory.getLogger(PublishingQueueProbeTask.class);

	private final PublishDAO publishDAO;
	private ApplicationEventPublisher eventPublisher;
	private final int period;
	private final RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;
	private boolean processingPackagesResetComplete = false;

	@ConstructorProperties({"publishDAO", "period", "retryingDatabaseOperationFacade"})
	public PublishingQueueProbeTask(final PublishDAO publishDAO, final int period, final RetryingDatabaseOperationFacade retryingDatabaseOperationFacade) {
		this.publishDAO = publishDAO;
		this.period = period;
		this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
	}

	/**
	 * Reset packages left PROCESSING by an interrupted publish so the scheduler can
	 * pick them up again.
	 * This method only tries to reset the packages once.
	 */
	private void resetProcessingPackagesIfNeeded() {
		try {
			if (!processingPackagesResetComplete) {
				retryingDatabaseOperationFacade
						.retry(() -> publishDAO.resetProcessingPackages(PackageState.READY.value, PROCESSING.value));
			}
		} catch (Exception e) {
			logger.error("Error resetting processing packages", e);
		} finally {
			processingPackagesResetComplete = true;
		}
	}

	@Override
	public void doExecute() {
		resetProcessingPackagesIfNeeded();
		publishDAO.getNextPublishPackages().forEach((siteId, packages) -> {
			List<Long> packageIds = packages.stream()
					.map(PublishPackageId::packageId).toList();
			eventPublisher.publishEvent(new RequestPublishEvent(siteId, packageIds));
		});
	}

	@Override
	protected int getPeriod() {
		return period;
	}

	@Override
	public void setApplicationEventPublisher(@NonNull final ApplicationEventPublisher applicationEventPublisher) {
		this.eventPublisher = applicationEventPublisher;
	}
}
