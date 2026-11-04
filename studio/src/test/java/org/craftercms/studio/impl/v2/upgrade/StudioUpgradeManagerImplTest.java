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
package org.craftercms.studio.impl.v2.upgrade;

import org.craftercms.commons.upgrade.exception.UpgradeException;
import org.craftercms.studio.api.v2.utils.spring.context.SiteBootstrapStateProvider;
import org.craftercms.studio.impl.v2.deployment.StagingDeployerTargetEnsurer;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import java.util.List;

import static org.junit.Assert.fail;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

@RunWith(MockitoJUnitRunner.class)
public class StudioUpgradeManagerImplTest {

	private static final String SITE_ID = "site";

	@Mock
	private SiteBootstrapStateProvider siteBootstrapStateProvider;
	@Mock
	private StagingDeployerTargetEnsurer stagingDeployerTargetEnsurer;

	@Test
	public void schedulesStagingTargetAfterSiteIsReady() throws Exception {
		StudioUpgradeManagerImpl manager = manager(5, site -> { });

		manager.upgrade();

		InOrder inOrder = inOrder(siteBootstrapStateProvider, stagingDeployerTargetEnsurer);
		inOrder.verify(siteBootstrapStateProvider).markSiteAsReady(SITE_ID);
		inOrder.verify(stagingDeployerTargetEnsurer).ensureStagingTarget(SITE_ID);
	}

	@Test
	public void schedulesStagingTargetWhenTaskFinishesAfterTimeout() throws Exception {
		StudioUpgradeManagerImpl manager = manager(1, site -> {
			try {
				Thread.sleep(30_000);
			} catch (InterruptedException e) {
				// shutdownNow interrupts a task that is still running after the timeout.
			}
		});

		try {
			manager.upgrade();
			fail("Expected the site upgrade to time out");
		} catch (UpgradeException expected) {
			// The upgrade attempt ends. The task can still finish and mark the site ready.
		}

		verify(stagingDeployerTargetEnsurer, timeout(5_000)).ensureStagingTarget(SITE_ID);
		InOrder inOrder = inOrder(siteBootstrapStateProvider, stagingDeployerTargetEnsurer);
		inOrder.verify(siteBootstrapStateProvider).markSiteAsReady(SITE_ID);
		inOrder.verify(stagingDeployerTargetEnsurer).ensureStagingTarget(SITE_ID);
	}

	@Test
	public void doesNotScheduleStagingTargetWhenUpgradeFails() throws Exception {
		StudioUpgradeManagerImpl manager = manager(5, site -> {
			throw new UpgradeException("upgrade failed");
		});

		try {
			manager.upgrade();
			fail("Expected the site upgrade to fail");
		} catch (UpgradeException expected) {
			// The site stays unready.
		}

		verify(siteBootstrapStateProvider, never()).markSiteAsReady(SITE_ID);
		verify(stagingDeployerTargetEnsurer, never()).ensureStagingTarget(SITE_ID);
	}

	private StudioUpgradeManagerImpl manager(int timeoutSeconds, SiteUpgrade siteUpgrade) {
		return new StudioUpgradeManagerImpl(null, null, null, null, null, null, null, null, null, null,
			siteBootstrapStateProvider, stagingDeployerTargetEnsurer, 1, timeoutSeconds) {
			@Override
			public List<String> getTargets() {
				return List.of(SITE_ID);
			}

			@Override
			public void upgrade(String site) throws UpgradeException {
				siteUpgrade.upgrade(site);
			}
		};
	}

	@FunctionalInterface
	private interface SiteUpgrade {
		void upgrade(String site) throws UpgradeException;
	}
}
