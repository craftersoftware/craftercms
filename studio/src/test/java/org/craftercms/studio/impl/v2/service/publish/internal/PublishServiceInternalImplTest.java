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

package org.craftercms.studio.impl.v2.service.publish.internal;

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.exception.publish.InvalidTargetException;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.MockitoJUnitRunner;

import java.io.IOException;

import static java.util.Collections.emptyList;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@RunWith(MockitoJUnitRunner.class)
public class PublishServiceInternalImplTest {

	@Mock
	private ServicesConfig servicesConfig;
	@Mock
	private SitesService sitesService;
	@Mock
	private GeneralLockService generalLockService;
	@InjectMocks
	@Spy
	private PublishServiceInternalImpl service;

	@Test(expected = InvalidTargetException.class)
	public void testStagingFailsIfNotEnabled() throws AuthenticationException, ServiceLayerException {
		String siteId = "site1";
		when(servicesConfig.getLiveEnvironment(siteId)).thenReturn("live");

		service.routePackageSubmission(siteId, "staging", emptyList(), emptyList(),
				null, "Publish test", "Testing with invalid target", false, false);
	}

	@Test
	public void testStagingPassIfEnabled() throws AuthenticationException, ServiceLayerException {
		String siteId = "site1";
		doReturn(4L).when(service).buildInitialPublishPackage(any(Site.class), anyString(), eq(false), anyString(), anyString());
		Site site = mock(Site.class);
		when(site.getSiteId()).thenReturn(siteId);
		when(sitesService.getSite(siteId)).thenReturn(site);
		when(servicesConfig.getLiveEnvironment(siteId)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(siteId)).thenReturn("staging");
		when(servicesConfig.isStagingEnvironmentEnabled(siteId)).thenReturn(true);

		service.routePackageSubmission(siteId, "staging", emptyList(), emptyList(),
				null, "Publish test", "Testing with invalid target", false, false);
		verify(service).validateTarget(siteId, "staging");
	}

	@Test(expected = InvalidTargetException.class)
	public void testInvalidTargetFails() throws AuthenticationException, ServiceLayerException {
		String siteId = "site1";
		when(servicesConfig.getLiveEnvironment(siteId)).thenReturn("live");

		service.routePackageSubmission(siteId, "alive", emptyList(), emptyList(),
				null, "Publish test", "Testing with invalid target", false, false);
	}

	@Test
	public void testMatchingTargetPass() throws AuthenticationException, ServiceLayerException {
		String siteId = "site1";
		doReturn(4L).when(service).buildInitialPublishPackage(any(Site.class), anyString(), eq(false), anyString(), anyString());
		Site site = mock(Site.class);
		when(site.getSiteId()).thenReturn(siteId);
		when(sitesService.getSite(siteId)).thenReturn(site);

		when(servicesConfig.getLiveEnvironment(siteId)).thenReturn("thelivetarget");

		service.routePackageSubmission(siteId, "thelivetarget", emptyList(), emptyList(),
				null, "Publish test", "Testing with invalid target", false, false);

		verify(service).validateTarget(siteId, "thelivetarget");
	}

	@Test(expected = InvalidTargetException.class)
	public void testCalculateInvalidTargetFails() throws ServiceLayerException, IOException {
		String siteId = "site1";
		when(servicesConfig.getLiveEnvironment(siteId)).thenReturn("live");

		service.calculatePublishPackage(siteId, "bogus", emptyList(), emptyList());
	}

	@Test(expected = InvalidTargetException.class)
	public void testCalculateStagingFailsIfNotEnabled() throws ServiceLayerException, IOException {
		String siteId = "site1";
		when(servicesConfig.getLiveEnvironment(siteId)).thenReturn("live");
		when(servicesConfig.isStagingEnvironmentEnabled(siteId)).thenReturn(false);

		service.calculatePublishPackage(siteId, "staging", emptyList(), emptyList());
	}

	@Test(expected = InvalidTargetException.class)
	public void testRecalculateInvalidTargetFails() throws ServiceLayerException {
		String siteId = "site1";
		when(servicesConfig.getLiveEnvironment(siteId)).thenReturn("live");

		service.recalculatePublishPackage(siteId, 42L, "bogus");
	}

	@Test(expected = InvalidTargetException.class)
	public void testRecalculateStagingFailsIfNotEnabled() throws ServiceLayerException {
		String siteId = "site1";
		when(servicesConfig.getLiveEnvironment(siteId)).thenReturn("live");
		when(servicesConfig.isStagingEnvironmentEnabled(siteId)).thenReturn(false);

		service.recalculatePublishPackage(siteId, 42L, "staging");
	}
}
