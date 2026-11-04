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

import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.deployment.Deployer;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.spring.context.SiteBootstrapStateProvider;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.Assert.assertEquals;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class StagingDeployerTargetEnsurerTest {

	private static final String READY_SITE = "ready";
	private static final String BOOTSTRAPPING_SITE = "bootstrapping";
	private static final String STAGING_OFF_SITE = "off";

	@Mock
	private SitesService sitesService;
	@Mock
	private ServicesConfig servicesConfig;
	@Mock
	private SiteBootstrapStateProvider siteBootstrapStateProvider;
	@Mock
	private Deployer deployer;

	private StagingDeployerTargetEnsurer ensurer;

	@Before
	public void setUp() {
		Executor direct = Runnable::run;
		ensurer = new StagingDeployerTargetEnsurer(sitesService, servicesConfig, siteBootstrapStateProvider, deployer, direct);
	}

	@Test
	public void createsATargetOnlyForReadySitesWithStagingEnabled() throws Exception {
		when(sitesService.getAllSites()).thenReturn(List.of(
			site(READY_SITE, true), site(BOOTSTRAPPING_SITE, true), site(STAGING_OFF_SITE, false)));
		when(siteBootstrapStateProvider.isSiteReady(READY_SITE)).thenReturn(true);
		when(siteBootstrapStateProvider.isSiteReady(BOOTSTRAPPING_SITE)).thenReturn(false);
		when(servicesConfig.isStagingEnvironmentEnabled(READY_SITE)).thenReturn(true);

		ensurer.ensureForReadySites();
		ensurer.ensureStagingTarget(READY_SITE);

		verify(deployer, times(1)).createStagingTarget(READY_SITE);
		verify(deployer, never()).createStagingTarget(BOOTSTRAPPING_SITE);
		verify(deployer, never()).createStagingTarget(STAGING_OFF_SITE);
	}

	@Test
	public void deployerFailureDoesNotStopLaterSitesAndIsRetried() throws Exception {
		when(sitesService.getAllSites()).thenReturn(List.of(site("first", true), site("second", true)));
		when(siteBootstrapStateProvider.isSiteReady("first")).thenReturn(true);
		when(siteBootstrapStateProvider.isSiteReady("second")).thenReturn(true);
		when(servicesConfig.isStagingEnvironmentEnabled("first")).thenReturn(true);
		when(servicesConfig.isStagingEnvironmentEnabled("second")).thenReturn(true);
		doThrow(new RestClientException("deployer down")).doNothing().when(deployer).createStagingTarget("first");

		ensurer.ensureForReadySites();
		ensurer.ensureStagingTarget("first");

		verify(deployer, times(2)).createStagingTarget("first");
		verify(deployer).createStagingTarget("second");
	}

	@Test
	public void skipsDuplicatePendingWork() throws Exception {
		List<Runnable> pendingTasks = new ArrayList<>();
		ensurer = new StagingDeployerTargetEnsurer(sitesService, servicesConfig, siteBootstrapStateProvider, deployer,
			pendingTasks::add);
		when(servicesConfig.isStagingEnvironmentEnabled(READY_SITE)).thenReturn(true);

		ensurer.ensureStagingTarget(READY_SITE);
		ensurer.ensureStagingTarget(READY_SITE);

		assertEquals(1, pendingTasks.size());
		pendingTasks.get(0).run();

		verify(deployer).createStagingTarget(READY_SITE);
	}

	@Test
	public void rejectedSubmissionIsRetried() {
		AtomicInteger submissionAttempts = new AtomicInteger();
		Executor rejecting = command -> {
			submissionAttempts.incrementAndGet();
			throw new RejectedExecutionException("executor stopped");
		};
		ensurer = new StagingDeployerTargetEnsurer(sitesService, servicesConfig, siteBootstrapStateProvider, deployer, rejecting);

		ensurer.ensureStagingTarget(READY_SITE);
		ensurer.ensureStagingTarget(READY_SITE);

		assertEquals(2, submissionAttempts.get());
	}

	@Test
	public void stagingDisabledAtExecutionIsNotRemembered() throws Exception {
		when(servicesConfig.isStagingEnvironmentEnabled(READY_SITE)).thenReturn(false, true);

		ensurer.ensureStagingTarget(READY_SITE);
		ensurer.ensureStagingTarget(READY_SITE);

		verify(deployer, times(1)).createStagingTarget(READY_SITE);
	}

	@Test
	public void missingSiteIsSkipped() throws Exception {
		when(servicesConfig.isStagingEnvironmentEnabled(READY_SITE)).thenThrow(new SiteNotFoundException());

		ensurer.ensureStagingTarget(READY_SITE);

		verifyNoInteractions(deployer);
	}

	@Test
	public void listingSitesFailureDoesNotThrow() {
		when(sitesService.getAllSites()).thenThrow(new IllegalStateException("db down"));

		ensurer.ensureForReadySites();

		verifyNoInteractions(deployer);
	}

	private static Site site(String siteId, boolean stagingEnabled) {
		Site site = new Site();
		site.setSiteId(siteId);
		site.setStagingEnabled(stagingEnabled);
		return site;
	}
}
