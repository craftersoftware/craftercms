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
package org.craftercms.studio.impl.v2.upgrade.operations.db;

import org.craftercms.commons.upgrade.exception.UpgradeException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.publish.ItemTargetDAO;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobAwareContentRepository;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.upgrade.StudioUpgradeContext;
import org.dom4j.DocumentException;
import org.dom4j.DocumentHelper;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;

import static org.craftercms.studio.api.v1.constant.StudioConstants.MODULE_STUDIO;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_ENVIRONMENT_ACTIVE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_SITE_GENERAL_CONFIG_FILE_NAME;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class StagingEnabledBackfillUpgradeOperationTest {

	private static final String CONFIG_FILE = "site-config.xml";
	private static final String LIVE = "live";
	private static final String STAGING = "staging";
	private static final String ENABLED_CONFIG = """
		<site-config>
			<published-repository>
				<enable-staging-environment>true</enable-staging-environment>
			</published-repository>
		</site-config>
		""";

	@Mock
	private StudioConfiguration studioConfiguration;
	@Mock
	private SitesService sitesService;
	@Mock
	private ConfigurationService configurationService;
	@Mock
	private ServicesConfig servicesConfig;
	@Mock
	private StudioBlobAwareContentRepository contentRepository;
	@Mock
	private ItemTargetDAO itemTargetDao;
	@Mock
	private StudioUpgradeContext context;
	@Mock
	private Connection connection;
	@Mock
	private PreparedStatement statement;
	@Mock
	private PreparedStatement pendingStatement;

	private StagingEnabledBackfillUpgradeOperation operation;

	@Before
	public void setUp() {
		when(studioConfiguration.getProperty(CONFIGURATION_ENVIRONMENT_ACTIVE)).thenReturn("default");
		when(studioConfiguration.getProperty(CONFIGURATION_SITE_GENERAL_CONFIG_FILE_NAME)).thenReturn(CONFIG_FILE);
		operation = new StagingEnabledBackfillUpgradeOperation(studioConfiguration, sitesService, configurationService,
			servicesConfig, contentRepository, itemTargetDao);
	}

	@Test
	public void skipsASiteWhoseFlagIsAlreadySet() throws Exception {
		Site finished = site("finished", 1, true);
		when(sitesService.getAllSites()).thenReturn(List.of(finished));

		operation.doExecute(context);

		verifyNoInteractions(configurationService, servicesConfig, contentRepository, itemTargetDao, context);
	}

	@Test
	public void retrySkipsBlobCopyWhenTheBranchAlreadyExists() throws Exception {
		Site finished = site("finished", 1, true);
		Site pending = site("pending", 2, false);
		when(sitesService.getAllSites()).thenReturn(List.of(finished, pending));
		stubEnabledConfig("pending");
		when(servicesConfig.getLiveEnvironment("pending")).thenReturn(LIVE);
		when(servicesConfig.getStagingEnvironment("pending")).thenReturn(STAGING);
		when(contentRepository.publishedRepositoryExists("pending")).thenReturn(true);
		when(contentRepository.isTargetPublished("pending", LIVE)).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive("pending", LIVE, STAGING)).thenReturn(false);
		when(context.getConnection()).thenReturn(connection);
		when(connection.prepareStatement(StagingEnabledBackfillUpgradeOperation.UPDATE_STAGING_ENABLED)).thenReturn(statement);
		when(statement.executeUpdate()).thenReturn(1);

		operation.doExecute(context);

		verify(contentRepository, never()).copyBlobs(any(), any(), any());
		verify(contentRepository, never()).copyBlobs(any(), any(), any(), any());
		verify(itemTargetDao, never()).initStaging(anyLong(), any(), any());
		verify(contentRepository, never()).publishedRepositoryExists("finished");
		verify(statement).setInt(1, 1);
		verify(statement).setString(2, "pending");
		verify(connection).commit();
		verify(connection, never()).prepareStatement(StagingEnabledBackfillUpgradeOperation.MARK_STAGING_BLOBS_PENDING);
	}

	@Test
	public void retryKeepsBlobCopyPendingWhenTheFlagIsAlreadyFalse() throws Exception {
		Site pending = site("pending", 2, false, false);
		when(sitesService.getAllSites()).thenReturn(List.of(pending));
		stubEnabledConfig("pending");
		when(servicesConfig.getLiveEnvironment("pending")).thenReturn(LIVE);
		when(servicesConfig.getStagingEnvironment("pending")).thenReturn(STAGING);
		when(contentRepository.publishedRepositoryExists("pending")).thenReturn(true);
		when(contentRepository.isTargetPublished("pending", LIVE)).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive("pending", LIVE, STAGING)).thenReturn(false);
		when(itemTargetDao.targetExists(2L, STAGING)).thenReturn(true);
		when(context.getConnection()).thenReturn(connection);
		when(connection.prepareStatement(StagingEnabledBackfillUpgradeOperation.UPDATE_STAGING_ENABLED)).thenReturn(statement);
		when(statement.executeUpdate()).thenReturn(1);

		operation.doExecute(context);

		verify(contentRepository, never()).copyBlobs(any(), any(), any(), any());
		verify(itemTargetDao, never()).initStaging(anyLong(), any(), any());
		verify(connection, never()).prepareStatement(StagingEnabledBackfillUpgradeOperation.MARK_STAGING_BLOBS_PENDING);
		verify(statement).setInt(1, 0);
		verify(statement).setString(2, "pending");
		verify(connection).commit();
	}

	@Test
	public void createdBranchLeavesBlobCopyForTheNextPublish() throws Exception {
		Site pending = site("pending", 2, false);
		when(sitesService.getAllSites()).thenReturn(List.of(pending));
		stubEnabledConfig("pending");
		when(servicesConfig.getLiveEnvironment("pending")).thenReturn(LIVE);
		when(servicesConfig.getStagingEnvironment("pending")).thenReturn(STAGING);
		when(contentRepository.publishedRepositoryExists("pending")).thenReturn(true);
		when(contentRepository.isTargetPublished("pending", LIVE)).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive("pending", LIVE, STAGING)).thenReturn(true);
		when(itemTargetDao.targetExists(2L, STAGING)).thenReturn(false);
		when(context.getConnection()).thenReturn(connection);
		when(connection.prepareStatement(StagingEnabledBackfillUpgradeOperation.MARK_STAGING_BLOBS_PENDING)).thenReturn(pendingStatement);
		when(connection.prepareStatement(StagingEnabledBackfillUpgradeOperation.UPDATE_STAGING_ENABLED)).thenReturn(statement);
		when(pendingStatement.executeUpdate()).thenReturn(1);
		when(statement.executeUpdate()).thenReturn(1);

		operation.doExecute(context);

		InOrder inOrder = inOrder(pendingStatement, connection, itemTargetDao, statement);
		inOrder.verify(pendingStatement).setString(1, "pending");
		inOrder.verify(pendingStatement).executeUpdate();
		inOrder.verify(connection).commit();
		inOrder.verify(itemTargetDao).initStaging(2L, STAGING, LIVE);
		inOrder.verify(statement).setInt(1, 0);
		inOrder.verify(statement).setString(2, "pending");
		inOrder.verify(connection).commit();
		verify(contentRepository, never()).copyBlobs(any(), any(), any());
		verify(contentRepository, never()).copyBlobs(any(), any(), any(), any());
	}

	@Test
	public void failureStopsTheUpgradeBeforeLaterSites() throws Exception {
		Site broken = site("broken", 3, false);
		Site later = site("later", 4, false);
		SQLException updateFailure = new SQLException("update failed");
		when(sitesService.getAllSites()).thenReturn(List.of(broken, later));
		stubEnabledConfig("broken");
		when(servicesConfig.getLiveEnvironment("broken")).thenReturn(LIVE);
		when(servicesConfig.getStagingEnvironment("broken")).thenReturn(STAGING);
		when(contentRepository.publishedRepositoryExists("broken")).thenReturn(true);
		when(contentRepository.isTargetPublished("broken", LIVE)).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive("broken", LIVE, STAGING)).thenReturn(true);
		when(itemTargetDao.targetExists(3L, STAGING)).thenReturn(false);
		when(context.getConnection()).thenReturn(connection);
		when(connection.prepareStatement(StagingEnabledBackfillUpgradeOperation.MARK_STAGING_BLOBS_PENDING)).thenReturn(pendingStatement);
		when(connection.prepareStatement(StagingEnabledBackfillUpgradeOperation.UPDATE_STAGING_ENABLED)).thenReturn(statement);
		when(pendingStatement.executeUpdate()).thenReturn(1);
		when(statement.executeUpdate()).thenThrow(updateFailure);

		try {
			operation.doExecute(context);
			fail("expected the upgrade to fail");
		} catch (UpgradeException e) {
			assertEquals("Failed to backfill staging for site 'broken'", e.getMessage());
			assertSame(updateFailure, e.getCause());
		}

		verify(pendingStatement).setString(1, "broken");
		verify(connection).commit();
		verify(itemTargetDao).initStaging(3L, STAGING, LIVE);
		verify(contentRepository).deletePublishedBranch("broken", STAGING);
		verify(contentRepository, never()).copyBlobs(any(), any(), any(), any());
		verify(configurationService, never()).getConfigurationAsDocument(eq("later"), any(), any(), any());
	}

	private void stubEnabledConfig(String siteId) throws DocumentException, ServiceLayerException {
		when(configurationService.getConfigurationAsDocument(siteId, MODULE_STUDIO, CONFIG_FILE, "default"))
			.thenReturn(DocumentHelper.parseText(ENABLED_CONFIG));
	}

	private static Site site(String siteId, long id, boolean stagingEnabled) {
		return site(siteId, id, stagingEnabled, true);
	}

	private static Site site(String siteId, long id, boolean stagingEnabled, boolean blobsCopied) {
		Site site = new Site();
		site.setId(id);
		site.setSiteId(siteId);
		site.setStagingEnabled(stagingEnabled);
		site.setStagingBlobsCopied(blobsCopied);
		return site;
	}
}
