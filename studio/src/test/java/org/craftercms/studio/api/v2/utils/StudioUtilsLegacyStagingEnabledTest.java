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
package org.craftercms.studio.api.v2.utils;

import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.dom4j.DocumentException;
import org.dom4j.DocumentHelper;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import static org.craftercms.studio.api.v1.constant.StudioConstants.MODULE_STUDIO;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_ENVIRONMENT_ACTIVE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_SITE_GENERAL_CONFIG_FILE_NAME;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class StudioUtilsLegacyStagingEnabledTest {

	private static final String SITE_ID = "my-site";
	private static final String CONFIG_FILE = "site-config.xml";

	@Mock
	private StudioConfiguration studioConfiguration;
	@Mock
	private ConfigurationService configurationService;

	@Before
	public void setUp() {
		when(studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE)).thenReturn("default");
		when(studioConfiguration.getProperty(CONFIGURATION_SITE_GENERAL_CONFIG_FILE_NAME)).thenReturn(CONFIG_FILE);
	}

	@Test
	public void acceptsAnyCase() throws Exception {
		stubConfig("""
			<site-config>
				<published-repository>
					<enable-staging-environment>TRUE</enable-staging-environment>
				</published-repository>
			</site-config>
			""");

		assertTrue(StudioUtils.isLegacyStagingEnabled(SITE_ID, studioConfiguration, configurationService));
	}

	@Test
	public void acceptsAnElementWithAttributes() throws Exception {
		stubConfig("""
			<site-config>
				<published-repository>
					<enable-staging-environment type="boolean">true</enable-staging-environment>
				</published-repository>
			</site-config>
			""");

		assertTrue(StudioUtils.isLegacyStagingEnabled(SITE_ID, studioConfiguration, configurationService));
	}

	@Test
	public void ignoresTheElementTextInsideAComment() throws Exception {
		stubConfig("""
			<site-config>
				<!-- <enable-staging-environment>true</enable-staging-environment> -->
				<published-repository>
					<enable-staging-environment>false</enable-staging-environment>
				</published-repository>
			</site-config>
			""");

		assertFalse(StudioUtils.isLegacyStagingEnabled(SITE_ID, studioConfiguration, configurationService));
	}

	@Test
	public void ignoresTheElementOutsidePublishedRepository() throws Exception {
		stubConfig("""
			<site-config>
				<enable-staging-environment>true</enable-staging-environment>
			</site-config>
			""");

		assertFalse(StudioUtils.isLegacyStagingEnabled(SITE_ID, studioConfiguration, configurationService));
	}

	@Test
	public void readsTheActiveEnvironmentDocument() throws Exception {
		when(studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE)).thenReturn("authoring");
		stubConfig("""
			<site-config>
				<published-repository>
					<enable-staging-environment>true</enable-staging-environment>
				</published-repository>
			</site-config>
			""");

		assertTrue(StudioUtils.isLegacyStagingEnabled(SITE_ID, studioConfiguration, configurationService));
		verify(configurationService).getConfigurationAsDocument(SITE_ID, MODULE_STUDIO, CONFIG_FILE, "authoring");
	}

	@Test
	public void missingFileIsDisabled() throws Exception {
		when(configurationService.getConfigurationAsDocument(SITE_ID, MODULE_STUDIO, CONFIG_FILE, "default"))
			.thenThrow(new ContentNotFoundException(CONFIG_FILE, SITE_ID, "missing"));

		assertFalse(StudioUtils.isLegacyStagingEnabled(SITE_ID, studioConfiguration, configurationService));
	}

	@Test
	public void missingElementIsDisabled() throws Exception {
		stubConfig("""
			<site-config>
				<published-repository/>
			</site-config>
			""");

		assertFalse(StudioUtils.isLegacyStagingEnabled(SITE_ID, studioConfiguration, configurationService));
	}

	private void stubConfig(String xml) throws DocumentException, ServiceLayerException {
		String environment = studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE);
		when(configurationService.getConfigurationAsDocument(SITE_ID, MODULE_STUDIO, CONFIG_FILE, environment))
			.thenReturn(DocumentHelper.parseText(xml));
	}
}
