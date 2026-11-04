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
package org.craftercms.studio.impl.v2.deployment;

import org.apache.commons.lang3.StringUtils;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.deployment.Deployer;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.spring.context.SiteBootstrapStateProvider;
import org.craftercms.studio.impl.v2.utils.spring.event.SitesUpgradeFinishedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;

import java.beans.ConstructorProperties;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Creates the staging delivery target after startup, outside the database upgrade.
 * <p>
 * The staging-enabled backfill used to call Deployer while that upgrade was still running. The upgrade blocks
 * Studio from becoming ready, and with serverless delivery a down or slow Deployer failed it. Sites are marked
 * ready during the sites upgrade, which runs after the system is already up. This class creates the target then.
 * The sites upgrade calls {@link #ensureStagingTarget(String)} as soon as a site is marked ready, including a task
 * that finishes after the upgrade timeout. {@link #ensureForReadySites()} runs when that upgrade attempt ends.
 * Create-if-not-exists makes a repeat safe. A failed attempt is retried on the next publish and the next startup.
 * The Deployer call runs on a background thread so a slow Deployer does not block publishing or bootstrap.
 */
public class StagingDeployerTargetEnsurer {

	private static final Logger logger = LoggerFactory.getLogger(StagingDeployerTargetEnsurer.class);

	private final SitesService sitesService;
	private final ServicesConfig servicesConfig;
	private final SiteBootstrapStateProvider siteBootstrapStateProvider;
	private final Deployer deployer;
	private final Executor executor;
	private final Set<String> ensuredSites = ConcurrentHashMap.newKeySet();
	private final Set<String> pendingSites = ConcurrentHashMap.newKeySet();

	@ConstructorProperties({"sitesService", "servicesConfig", "siteBootstrapStateProvider", "deployer", "executor"})
	public StagingDeployerTargetEnsurer(SitesService sitesService, ServicesConfig servicesConfig,
										 SiteBootstrapStateProvider siteBootstrapStateProvider, Deployer deployer,
										 Executor executor) {
		this.sitesService = sitesService;
		this.servicesConfig = servicesConfig;
		this.siteBootstrapStateProvider = siteBootstrapStateProvider;
		this.deployer = deployer;
		this.executor = executor;
	}

	/**
	 * Single daemon thread for Deployer calls. A down Deployer can block for the client timeout, and that wait
	 * must not occupy the bootstrap thread or the publish pool.
	 */
	public static ExecutorService daemonExecutor() {
		return Executors.newSingleThreadExecutor(runnable -> {
			Thread thread = new Thread(runnable, "staging-deployer-target");
			thread.setDaemon(true);
			return thread;
		});
	}

	/**
	 * Create staging targets for sites that finished startup with staging enabled.
	 * One site's failure does not stop the others, and this method does not throw.
	 */
	@EventListener(SitesUpgradeFinishedEvent.class)
	public void ensureForReadySites() {
		List<Site> sites;
		try {
			sites = sitesService.getAllSites();
		} catch (RuntimeException e) {
			logger.warn("Failed to list sites for staging deployer target creation", e);
			return;
		}
		for (Site site : sites) {
			if (site.isStagingEnabled() && siteBootstrapStateProvider.isSiteReady(site.getSiteId())) {
				ensureStagingTarget(site.getSiteId());
			}
		}
	}

	/**
	 * Create the staging delivery target unless this process has already done so.
	 * A failure is logged and left for the next call. This method does not throw.
	 */
	public void ensureStagingTarget(String siteId) {
		if (StringUtils.isEmpty(siteId) || ensuredSites.contains(siteId)) {
			return;
		}
		if (!pendingSites.add(siteId)) {
			return;
		}
		try {
			executor.execute(() -> {
				try {
					createTarget(siteId);
				} finally {
					pendingSites.remove(siteId);
				}
			});
		} catch (RuntimeException e) {
			pendingSites.remove(siteId);
			logger.warn("Failed to schedule the staging deployer target for site '{}'", siteId, e);
		}
	}

	private void createTarget(String siteId) {
		try {
			if (!servicesConfig.isStagingEnvironmentEnabled(siteId)) {
				return;
			}
		} catch (SiteNotFoundException e) {
			logger.debug("Site '{}' no longer exists. Skipping the staging deployer target", siteId);
			return;
		} catch (RuntimeException e) {
			logger.warn("Failed to create the staging deployer target for site '{}'. The next publish will retry", siteId, e);
			return;
		}
		if (!ensuredSites.add(siteId)) {
			return;
		}
		try {
			deployer.createStagingTarget(siteId);
			logger.debug("Ensured staging deployer target for site '{}'", siteId);
		} catch (RuntimeException e) {
			ensuredSites.remove(siteId);
			logger.warn("Failed to create the staging deployer target for site '{}'. The next publish will retry", siteId, e);
		}
	}
}
