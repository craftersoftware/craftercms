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
package org.craftercms.studio.impl.v1.service.configuration;

import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.SiteDAO;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class ServicesConfigImplTest {

	private static final String SITE_ID = "editorial";

	@Mock
	private SiteDAO siteDao;

	private ServicesConfigImpl servicesConfig;

	@Before
	public void setUp() {
		servicesConfig = new ServicesConfigImpl();
		servicesConfig.setSiteDao(siteDao);
	}

	@Test
	public void isStagingEnvironmentEnabledReadsTheDatabaseFlag() throws SiteNotFoundException {
		Site site = new Site();
		site.setSiteId(SITE_ID);
		site.setStagingEnabled(true);
		when(siteDao.getSite(SITE_ID)).thenReturn(site);

		assertTrue(servicesConfig.isStagingEnvironmentEnabled(SITE_ID));

		site.setStagingEnabled(false);
		assertFalse(servicesConfig.isStagingEnvironmentEnabled(SITE_ID));
	}

	@Test(expected = SiteNotFoundException.class)
	public void isStagingEnvironmentEnabledMissingSite() throws SiteNotFoundException {
		when(siteDao.getSite(SITE_ID)).thenReturn(null);

		servicesConfig.isStagingEnvironmentEnabled(SITE_ID);
	}
}
