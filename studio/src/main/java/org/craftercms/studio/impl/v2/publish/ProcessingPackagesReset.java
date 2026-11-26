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

package org.craftercms.studio.impl.v2.publish;

import java.beans.ConstructorProperties;
import java.util.concurrent.atomic.AtomicBoolean;

import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.impl.v2.utils.spring.event.StartSystemUpgradeEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;

import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.PROCESSING;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.READY;

/**
 * Resets publish packages left {@code PROCESSING} by an interrupted publish back to {@code READY}, once per startup.
 * <p>
 * The reset runs while the {@link StartSystemUpgradeEvent} is handled: after the system upgrade (which brings the
 * database up to date) and before the bootstrap is finished and the system is marked ready. That event is handled
 * synchronously during the root application context refresh, so it also runs before the webapp accepts requests.
 * </p>
 * <p>
 * The reset is attempted only once. A failure is logged and does not stop the startup: packages that could not be
 * reset stay {@code PROCESSING}. {@link Publisher} and {@link PublishingQueueProbeTask} do nothing until the reset
 * has been attempted (see {@link #isResetAttempted()}), so no package is published before the attempt.
 * </p>
 */
public class ProcessingPackagesReset {

	/**
	 * Order of the reset listener. It must run after the system upgrade listener
	 * ({@code StudioUpgradeManagerImpl.startUpgrade}, order 10) and before the bootstrap manager listener that
	 * finishes the bootstrap ({@code BootstrapManagerImpl.onStartSystemUpgrade}, lowest precedence).
	 */
	public static final int RESET_ORDER = 20;

	private static final Logger logger = LoggerFactory.getLogger(ProcessingPackagesReset.class);

	private final PublishDAO publishDao;
	private final RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;
	private final AtomicBoolean resetStarted = new AtomicBoolean(false);
	private volatile boolean resetAttempted = false;

	@ConstructorProperties({"publishDao", "retryingDatabaseOperationFacade"})
	public ProcessingPackagesReset(final PublishDAO publishDao,
								   final RetryingDatabaseOperationFacade retryingDatabaseOperationFacade) {
		this.publishDao = publishDao;
		this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
	}

	/**
	 * Reset the packages left {@code PROCESSING} to {@code READY}. Only the first call runs the reset.
	 */
	@Order(RESET_ORDER)
	@EventListener(StartSystemUpgradeEvent.class)
	public void resetProcessingPackages() {
		if (!resetStarted.compareAndSet(false, true)) {
			logger.debug("Processing publish packages reset was already attempted. Skipping it.");
			return;
		}
		logger.info("Resetting publish packages left processing by a previous run");
		try {
			retryingDatabaseOperationFacade.retry(() -> publishDao.resetProcessingPackages(READY.value, PROCESSING.value));
			logger.info("Publish packages left processing were reset");
		} catch (Exception e) {
			logger.error("Failed to reset the publish packages left processing. The reset will not be retried, " +
					"and packages that were left processing stay in that state", e);
		}
		resetAttempted = true;
	}

	/**
	 * Indicates if the reset has been attempted, whether it succeeded or failed.
	 *
	 * @return true once the reset attempt has finished
	 */
	public boolean isResetAttempted() {
		return resetAttempted;
	}
}
