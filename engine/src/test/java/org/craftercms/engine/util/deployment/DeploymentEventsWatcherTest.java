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

package org.craftercms.engine.util.deployment;

import org.craftercms.core.exception.StoreException;
import org.craftercms.core.service.Content;
import org.craftercms.core.service.ContentStoreService;
import org.craftercms.core.service.Context;
import org.craftercms.engine.service.context.SiteContext;
import org.craftercms.engine.service.context.SiteContextManager;
import org.craftercms.engine.store.s3.S3ContentStoreAdapter;
import org.craftercms.engine.store.s3.S3Context;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Uri;
import software.amazon.awssdk.services.s3.S3Utilities;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Properties;
import java.util.function.Consumer;

import static org.craftercms.core.service.CachingOptions.*;
import static org.craftercms.engine.util.deployment.DeploymentEventsWatcher.*;
import static org.mockito.Mockito.*;

/**
 * Unit test for {@link DeploymentEventsWatcher}
 *
 * @author avasquez
 * @since 4.4.5
 */
public class DeploymentEventsWatcherTest {

	private static final String SITENAME = "mysite";

	@Mock
	private Context context;
	@Mock
	private SiteContext siteContext;
	@Mock
	private ContentStoreService contentStoreService;
	@Mock
	private SiteContextManager siteContextManager;

	private AutoCloseable closeable;
	private DeploymentEventsWatcher watcher;

	@Before
	public void setUp() throws Exception {
		closeable = MockitoAnnotations.openMocks(this);

		when(siteContext.getSiteName()).thenReturn(SITENAME);
		when(siteContext.getContext()).thenReturn(context);
		when(siteContext.getStoreService()).thenReturn(contentStoreService);
		when(siteContextManager.listContexts()).thenReturn(Collections.singletonList(siteContext));

		watcher = spy(new DeploymentEventsWatcher(siteContextManager));
		watcher.startupCompleted = true;
		watcher.latestDeploymentEventsPerSite = spy(watcher.latestDeploymentEventsPerSite);
	}

	@After
	public void tearDown() throws Exception {
		closeable.close();
	}

	@Test
	public void checkForNoPreviousEventsTest() throws IOException {
		Instant now = Instant.now();
		Properties deploymentEvents = createDeploymentEvents(now, now, now);
		Content deploymentEventsContent = getDeploymentEventsAsContent(deploymentEvents);

		when(contentStoreService.findContent(context, CACHE_OFF_CACHING_OPTIONS, DEFAULT_DEPLOYMENT_EVENTS_FILE_URL)).thenReturn(deploymentEventsContent);

		watcher.checkForEvents();

		verify(siteContextManager, never()).startContextRebuild(anyString(), anyBoolean(), any(Consumer.class));
		verify(siteContext, never()).startCacheClear(any(Runnable.class));
		verify(siteContext, never()).startGraphQLSchemaBuild(any(Runnable.class));
		verify(watcher.latestDeploymentEventsPerSite, times(1)).put(SITENAME, deploymentEvents);
	}

	@Test
	public void checkRefreshesManifestOnFirstPoll() throws IOException {
		S3ContentStoreAdapter adapter = mock(S3ContentStoreAdapter.class);
		S3Context s3Context = s3Context(adapter);
		when(siteContext.getContext()).thenReturn(s3Context);

		Instant now = Instant.now();
		Properties deploymentEvents = createDeploymentEvents(now, now, now);
		Content deploymentEventsContent = getDeploymentEventsAsContent(deploymentEvents);
		when(contentStoreService.findContent(s3Context, CACHE_OFF_CACHING_OPTIONS, DEFAULT_DEPLOYMENT_EVENTS_FILE_URL))
			.thenReturn(deploymentEventsContent);

		watcher.checkForEvents();

		verify(adapter).reloadContentStoreManifest(s3Context);
		verify(siteContextManager, never()).startContextRebuild(anyString(), anyBoolean(), any(Consumer.class));
		verify(siteContext, never()).startCacheClear(any(Runnable.class));
		verify(siteContext, never()).startGraphQLSchemaBuild(any(Runnable.class));
		verify(watcher.latestDeploymentEventsPerSite, times(1)).put(SITENAME, deploymentEvents);
	}

	@Test
	public void checkFirstPollStoresEventsWhenManifestRefreshFails() throws IOException {
		S3ContentStoreAdapter adapter = mock(S3ContentStoreAdapter.class);
		S3Context s3Context = s3Context(adapter);
		when(siteContext.getContext()).thenReturn(s3Context);
		doThrow(new RuntimeException("manifest read failed")).when(adapter).reloadContentStoreManifest(s3Context);

		Instant now = Instant.now();
		Properties deploymentEvents = createDeploymentEvents(now, now, now);
		Content deploymentEventsContent = getDeploymentEventsAsContent(deploymentEvents);
		when(contentStoreService.findContent(s3Context, CACHE_OFF_CACHING_OPTIONS, DEFAULT_DEPLOYMENT_EVENTS_FILE_URL))
			.thenReturn(deploymentEventsContent);

		watcher.checkForEvents();

		verify(adapter).reloadContentStoreManifest(s3Context);
		verify(siteContextManager, never()).startContextRebuild(anyString(), anyBoolean(), any(Consumer.class));
		verify(watcher.latestDeploymentEventsPerSite, times(1)).put(SITENAME, deploymentEvents);
	}

	@Test
	public void checkContinuesAfterStoreException() throws IOException {
		String otherSiteName = "othersite";
		SiteContext otherSite = mock(SiteContext.class);
		Context otherContext = mock(Context.class);
		ContentStoreService otherStore = mock(ContentStoreService.class);
		when(otherSite.getSiteName()).thenReturn(otherSiteName);
		when(otherSite.getContext()).thenReturn(otherContext);
		when(otherSite.getStoreService()).thenReturn(otherStore);
		when(siteContextManager.listContexts()).thenReturn(List.of(siteContext, otherSite));

		when(contentStoreService.findContent(context, CACHE_OFF_CACHING_OPTIONS, DEFAULT_DEPLOYMENT_EVENTS_FILE_URL))
			.thenThrow(new StoreException("unable to read deployment events"));

		Instant now = Instant.now();
		Properties deploymentEvents = createDeploymentEvents(now, now, now);
		Content deploymentEventsContent = getDeploymentEventsAsContent(deploymentEvents);
		when(otherStore.findContent(otherContext, CACHE_OFF_CACHING_OPTIONS, DEFAULT_DEPLOYMENT_EVENTS_FILE_URL))
			.thenReturn(deploymentEventsContent);

		watcher.checkForEvents();

		verify(watcher.latestDeploymentEventsPerSite, never()).put(eq(SITENAME), any());
		verify(watcher.latestDeploymentEventsPerSite, times(1)).put(otherSiteName, deploymentEvents);
	}

	@Test
	public void checkForNoNewEventsTest() throws IOException {
		Instant now = Instant.now();
		Properties lastDeploymentEvents = createDeploymentEvents(now, now, now);

		watcher.latestDeploymentEventsPerSite.put(SITENAME, lastDeploymentEvents);

		Properties currDeploymentEvents = createDeploymentEvents(now, now, now);
		Content currDeploymentEventsContent = getDeploymentEventsAsContent(currDeploymentEvents);

		when(contentStoreService.findContent(context, CACHE_OFF_CACHING_OPTIONS, DEFAULT_DEPLOYMENT_EVENTS_FILE_URL)).thenReturn(currDeploymentEventsContent);

		watcher.checkForEvents();

		verify(siteContextManager, never()).startContextRebuild(anyString(), anyBoolean(), any(Consumer.class));
		verify(siteContext, never()).startCacheClear(any(Runnable.class));
		verify(siteContext, never()).startGraphQLSchemaBuild(any(Runnable.class));
	}

	@Test
	public void checkForAllNewEventsTest() throws IOException {
		Instant now = Instant.now();
		Properties lastDeploymentEvents = createDeploymentEvents(now, now, now);

		watcher.latestDeploymentEventsPerSite.put(SITENAME, lastDeploymentEvents);

		Instant tenSecsLater = now.plusSeconds(10);
		Properties currDeploymentEvents = createDeploymentEvents(tenSecsLater, tenSecsLater, tenSecsLater);
		Content currDeploymentEventsContent = getDeploymentEventsAsContent(currDeploymentEvents);

		when(contentStoreService.findContent(context, CACHE_OFF_CACHING_OPTIONS, DEFAULT_DEPLOYMENT_EVENTS_FILE_URL)).thenReturn(currDeploymentEventsContent);

		watcher.checkForEvents();

		verify(siteContextManager, times(1)).startContextRebuild(anyString(), anyBoolean(), any(Consumer.class));
		verify(siteContext, never()).startCacheClear(any(Runnable.class));
		verify(siteContext, never()).startGraphQLSchemaBuild(any(Runnable.class));
		verify(watcher.latestDeploymentEventsPerSite, times(1)).put(SITENAME, currDeploymentEvents);
	}

	@Test
	public void checkForNewCacheClearAndRebuildGraphQLEventsTest() throws IOException {
		Instant now = Instant.now();
		Properties lastDeploymentEvents = createDeploymentEvents(now, now, now);

		watcher.latestDeploymentEventsPerSite.put(SITENAME, lastDeploymentEvents);

		Instant tenSecsLater = now.plusSeconds(10);
		Properties currDeploymentEvents = createDeploymentEvents(now, tenSecsLater, tenSecsLater);
		Content currDeploymentEventsContent = getDeploymentEventsAsContent(currDeploymentEvents);

		when(contentStoreService.findContent(context, CACHE_OFF_CACHING_OPTIONS, DEFAULT_DEPLOYMENT_EVENTS_FILE_URL)).thenReturn(currDeploymentEventsContent);

		watcher.checkForEvents();

		verify(siteContextManager, never()).startContextRebuild(anyString(), anyBoolean(), any(Consumer.class));
		verify(siteContext, times(1)).startCacheClear(any(Runnable.class));
		verify(siteContext, times(1)).startGraphQLSchemaBuild(any(Runnable.class));
		verify(watcher.latestDeploymentEventsPerSite, times(1)).put(SITENAME, currDeploymentEvents);
	}

	@Test
	public void checkRefreshesManifestOnNewEvents() throws IOException {
		S3ContentStoreAdapter adapter = mock(S3ContentStoreAdapter.class);
		S3Context s3Context = s3Context(adapter);
		when(siteContext.getContext()).thenReturn(s3Context);

		Instant now = Instant.now();
		Properties lastDeploymentEvents = createDeploymentEvents(now, now, now);
		watcher.latestDeploymentEventsPerSite.put(SITENAME, lastDeploymentEvents);

		Instant later = now.plusSeconds(10);
		Properties currDeploymentEvents = createDeploymentEvents(later, later, later);
		Content currDeploymentEventsContent = getDeploymentEventsAsContent(currDeploymentEvents);
		when(contentStoreService.findContent(s3Context, CACHE_OFF_CACHING_OPTIONS, DEFAULT_DEPLOYMENT_EVENTS_FILE_URL))
			.thenReturn(currDeploymentEventsContent);

		watcher.checkForEvents();

		verify(adapter).reloadContentStoreManifest(s3Context);
		verify(siteContextManager, times(1)).startContextRebuild(anyString(), anyBoolean(), any(Consumer.class));
		verify(siteContext, never()).startCacheClear(any(Runnable.class));
		verify(siteContext, never()).startGraphQLSchemaBuild(any(Runnable.class));
		verify(watcher.latestDeploymentEventsPerSite, times(1)).put(SITENAME, currDeploymentEvents);
	}

	@Test
	public void checkRetriesManifestLoadWhenPreviousLoadFailed() throws IOException {
		S3ContentStoreAdapter adapter = mock(S3ContentStoreAdapter.class);
		S3Context s3Context = s3Context(adapter);
		s3Context.markContentStoreManifestLoadFailed();
		when(siteContext.getContext()).thenReturn(s3Context);

		Instant now = Instant.now();
		Properties deploymentEvents = createDeploymentEvents(now, now, now);
		Content deploymentEventsContent = getDeploymentEventsAsContent(deploymentEvents);
		watcher.latestDeploymentEventsPerSite.put(SITENAME, deploymentEvents);
		when(contentStoreService.findContent(s3Context, CACHE_OFF_CACHING_OPTIONS, DEFAULT_DEPLOYMENT_EVENTS_FILE_URL))
			.thenReturn(deploymentEventsContent);

		watcher.checkForEvents();

		verify(adapter).reloadContentStoreManifest(s3Context);
		verify(siteContextManager, never()).startContextRebuild(anyString(), anyBoolean(), any(Consumer.class));
		verify(siteContext, never()).startCacheClear(any(Runnable.class));
		verify(siteContext, never()).startGraphQLSchemaBuild(any(Runnable.class));
	}

	private S3Context s3Context(S3ContentStoreAdapter adapter) {
		S3Utilities utilities = S3Utilities.builder().region(Region.US_EAST_1).build();
		S3Uri uri = utilities.parseUri(URI.create("s3://test-bucket/sites/acme"));
		return new S3Context("id", adapter, "s3://test-bucket/sites/acme", false, true, 1000,
			true, uri, null);
	}

	private Properties createDeploymentEvents(Instant rebuildContextEvent, Instant clearCacheEvent, Instant rebuildGraphQLEvent) {
		Properties deploymentEvents = new Properties();
		deploymentEvents.setProperty(REBUILD_CONTEXT_EVENT_KEY, rebuildContextEvent.toString());
		deploymentEvents.setProperty(CLEAR_CACHE_EVENT_KEY, clearCacheEvent.toString());
		deploymentEvents.setProperty(REBUILD_GRAPHQL_EVENT_KEY, rebuildGraphQLEvent.toString());

		return deploymentEvents;
	}

	private Content getDeploymentEventsAsContent(Properties deploymentEvents) throws IOException {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		deploymentEvents.store(out, null);

		Content content = mock(Content.class);
		when(content.getInputStream()).thenReturn(new ByteArrayInputStream(out.toByteArray()));

		return content;
	}

}
