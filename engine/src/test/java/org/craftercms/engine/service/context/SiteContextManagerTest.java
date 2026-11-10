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

package org.craftercms.engine.service.context;

import java.util.List;
import java.util.concurrent.Executor;

import org.craftercms.commons.concurrency.locks.LockByKey;
import org.craftercms.engine.event.SiteContextRemovedEvent;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationEvent;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class SiteContextManagerTest {

	private static final String SITE_NAME = "editorial";
	private static final String FALLBACK_SITE_NAME = "default";

	@Mock
	private SiteContextFactory contextFactory;
	@Mock
	private SiteContextFactory fallbackContextFactory;
	@Mock
	private SiteListResolver siteListResolver;
	@Mock
	private Executor jobThreadPoolExecutor;
	@Mock
	private LockByKey<String> sitesLock;
	@Mock
	private ApplicationContext applicationContext;
	@Mock
	private SiteContext siteContext;
	@Mock
	private SiteContext fallbackContext;

	private SiteContextManager manager;

	@Before
	public void setUp() {
		manager = new SiteContextManager(contextFactory, fallbackContextFactory, siteListResolver,
			false, jobThreadPoolExecutor, FALLBACK_SITE_NAME, 1, 0L, 1,
			false, new String[0], new String[0], 1, 1, sitesLock);
		manager.setApplicationContext(applicationContext);
		manager.contextRegistry.put(SITE_NAME, siteContext);
		manager.contextRegistry.put(FALLBACK_SITE_NAME, fallbackContext);
	}

	@Test
	public void syncContextsSkipsWhenSiteListIsNull() {
		when(siteListResolver.getSiteList()).thenReturn(null);

		manager.syncContexts();

		assertSame(siteContext, manager.contextRegistry.get(SITE_NAME));
		assertSame(fallbackContext, manager.contextRegistry.get(FALLBACK_SITE_NAME));
		assertEquals(2, manager.contextRegistry.size());
		verify(contextFactory, never()).createContext(anyString());
		verify(fallbackContextFactory, never()).createContext(anyString());
		verify(siteContext, never()).destroy();
		verify(fallbackContext, never()).destroy();
		verify(sitesLock, never()).lock(anyString());
		verify(applicationContext, never()).publishEvent(any(ApplicationEvent.class));
	}

	@Test
	public void syncContextsStillRemovesMissingSitesWhenSiteListIsEmpty() {
		when(siteListResolver.getSiteList()).thenReturn(List.of());
		when(fallbackContext.isFallback()).thenReturn(true);

		manager.syncContexts();

		assertEquals(1, manager.contextRegistry.size());
		assertSame(fallbackContext, manager.contextRegistry.get(FALLBACK_SITE_NAME));
		assertNull(manager.contextRegistry.get(SITE_NAME));
		verify(siteContext).destroy();
		verify(fallbackContext, never()).destroy();
		verify(contextFactory, never()).createContext(anyString());
		verify(applicationContext).publishEvent(argThat(SiteContextRemovedEvent.class::isInstance));
	}

}
