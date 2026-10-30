/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.engine.util.deployment;

import org.apache.commons.lang3.StringUtils;
import org.craftercms.core.exception.StoreException;
import org.craftercms.core.service.CachingOptions;
import org.craftercms.core.service.Content;
import org.craftercms.core.service.ContentStoreService;
import org.craftercms.core.service.Context;
import org.craftercms.engine.event.*;
import org.craftercms.engine.service.context.SiteContext;
import org.craftercms.engine.service.context.SiteContextManager;
import org.craftercms.engine.store.s3.S3ContentStoreAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEvent;
import org.springframework.context.ApplicationListener;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Utility class that runs on a cron job (configurable) and checks every site to see if they have a deployment
 * events file (by default {@code deployment-events.properties}, which should contain timestamps sent by the
 * Deployer indicating requests for clearing the site cache and/or rebuilding the context.
 *
 * @author avasquez
 */
public class DeploymentEventsWatcher implements ApplicationListener<ApplicationEvent> {

	private static final Logger logger = LoggerFactory.getLogger(DeploymentEventsWatcher.class);

	public static final String DEFAULT_DEPLOYMENT_EVENTS_FILE_URL = "deployment-events.properties";

	protected static final String CLEAR_CACHE_EVENT_KEY = "events.deployment.clearCache";
	protected static final String REBUILD_CONTEXT_EVENT_KEY = "events.deployment.rebuildContext";
	protected static final String REBUILD_GRAPHQL_EVENT_KEY = "events.deployment.rebuildGraphQL";

	protected String deploymentEventsFileUrl;
	protected SiteContextManager siteContextManager;
	protected volatile boolean startupCompleted;
	protected Map<String, Properties> latestDeploymentEventsPerSite;

	public DeploymentEventsWatcher(SiteContextManager siteContextManager) {
		this.deploymentEventsFileUrl = DEFAULT_DEPLOYMENT_EVENTS_FILE_URL;
		this.startupCompleted = false;
		this.latestDeploymentEventsPerSite = new ConcurrentHashMap<>();
		this.siteContextManager = siteContextManager;
	}

	public void setDeploymentEventsFileUrl(String deploymentEventsFileUrl) {
		this.deploymentEventsFileUrl = deploymentEventsFileUrl;
	}

	public void checkForEvents() {
		if (startupCompleted) {
			logger.debug("Deployment events watcher running...");

			siteContextManager.syncContexts();

			for (SiteContext siteContext : siteContextManager.listContexts()) {
				checkForSiteEvents(siteContext);
			}
		}
	}

	public void checkForSiteEvents(SiteContext siteContext) {
		String siteName = siteContext.getSiteName();
		Properties latestDeploymentEvents = latestDeploymentEventsPerSite.get(siteName);
		Properties currentDeploymentEvents;

		try {
			currentDeploymentEvents = loadDeploymentEvents(siteContext);
		} catch (IOException | StoreException e) {
			// A failed read must not abort the poll for the remaining sites.
			logger.error("Unable to load deployment events for site '{}'", siteName, e);
			return;
		}

		logger.debug("Checking deployment events for site {}...", siteName);

		if (latestDeploymentEvents == null) {
			logger.debug("No previous deployment events detected for site {}. Refreshing content store manifest and saving latest...", siteName);

			// createContext may have loaded the manifest before a publish wrote a newer one.
			// Refresh once here so that publish is visible without waiting for a later event.
			try {
				S3ContentStoreAdapter.refreshContentStoreManifest(siteContext.getContext());
			} catch (RuntimeException e) {
				logger.warn("Unable to load content store manifest for site '{}'", siteName, e);
			}

			latestDeploymentEventsPerSite.put(siteName, currentDeploymentEvents);
		} else if (Objects.equals(currentDeploymentEvents, latestDeploymentEvents)) {
			if (S3ContentStoreAdapter.isContentStoreManifestLoadFailed(siteContext.getContext())) {
				logger.debug("Retrying content store manifest load for site {}", siteName);
				try {
					S3ContentStoreAdapter.refreshContentStoreManifest(siteContext.getContext());
				} catch (RuntimeException e) {
					logger.warn("Unable to load content store manifest for site '{}'", siteName, e);
				}
			} else {
				logger.debug("No new deployment events for site {}", siteName);
			}
		} else {
			logger.debug("New deployment events received for site {}", siteName);

			try {
				S3ContentStoreAdapter.refreshContentStoreManifest(siteContext.getContext());
			} catch (RuntimeException e) {
				logger.warn("Unable to load content store manifest for site '{}'", siteName, e);
			}

			long latestRebuildContextEvent = getEventProperty(latestDeploymentEvents, REBUILD_CONTEXT_EVENT_KEY);
			long currentRebuildContextEvent = getEventProperty(currentDeploymentEvents, REBUILD_CONTEXT_EVENT_KEY);

			if (latestRebuildContextEvent < currentRebuildContextEvent) {
				logger.info("Rebuild context deployment event received. Rebuilding context for site {}...", siteName);

				siteContextManager.startContextRebuild(
					siteContext.getSiteName(),
					siteContext.isFallback(),
					newContext -> logger.info("Context rebuild for site {} completed", siteName));
			} else {
				long latestCacheClearEvent = getEventProperty(latestDeploymentEvents, CLEAR_CACHE_EVENT_KEY);
				long currentClearCacheEvent = getEventProperty(currentDeploymentEvents, CLEAR_CACHE_EVENT_KEY);

				if (latestCacheClearEvent < currentClearCacheEvent) {
					logger.info("Clear cache deployment event received. Clearing cache for site {}...", siteName);

					siteContext.startCacheClear(
						() -> logger.info("Clear cache for site {} completed", siteName));
				}

				long latestRebuildGraphQLEvent = getEventProperty(latestDeploymentEvents, REBUILD_GRAPHQL_EVENT_KEY);
				long currentRebuildGraphQLEvent = getEventProperty(currentDeploymentEvents, REBUILD_GRAPHQL_EVENT_KEY);

				if (latestRebuildGraphQLEvent < currentRebuildGraphQLEvent) {
					logger.info("Rebuild GraphQL deployment event received. Rebuilding schema for site {}...", siteName);

					siteContext.startGraphQLSchemaBuild(
						() -> logger.info("GraphQL schema rebuild for site {} completed", siteName));
				}
			}

			latestDeploymentEventsPerSite.put(siteName, currentDeploymentEvents);
		}
	}

	@Override
	public void onApplicationEvent(ApplicationEvent event) {
		if (event instanceof SiteContextsBootstrappedEvent) {
			startupCompleted = true;
		} else if (event instanceof SiteContextRemovedEvent) {
			String siteName = ((SiteEvent) event).getSiteContext().getSiteName();

			logger.debug("Clearing all deployment events info for removed site '{}'", siteName);

			// The site was completely removed, so remove all related event info
			latestDeploymentEventsPerSite.remove(siteName);
		}
	}

	@Override
	public boolean supportsAsyncExecution() {
		return false;
	}

	private Properties loadDeploymentEvents(SiteContext siteContext) throws IOException {
		ContentStoreService contentStoreService = siteContext.getStoreService();
		Context context = siteContext.getContext();
		CachingOptions cachingOptions = CachingOptions.CACHE_OFF_CACHING_OPTIONS;
		Content content = contentStoreService.findContent(context, cachingOptions, deploymentEventsFileUrl);
		Properties events = new Properties();

		if (content != null) {
			try (InputStream is = content.getInputStream();
			     InputStreamReader reader = new InputStreamReader(is, StandardCharsets.UTF_8)) {
				events.load(reader);
			}
		}

		return events;
	}

	private long getEventProperty(Properties deploymentEvents, String name) {
		String eventTimestamp = deploymentEvents.getProperty(name);
		if (StringUtils.isNotEmpty(eventTimestamp)) {
			return Instant.parse(eventTimestamp).toEpochMilli();
		} else {
			return 0;
		}
	}

}
