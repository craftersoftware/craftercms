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

package org.craftercms.studio.impl.v2.service.site.internal;


import org.craftercms.commons.entitlements.validator.EntitlementValidator;
import org.craftercms.commons.git.utils.AuthenticationType;
import org.craftercms.commons.plugin.model.BlueprintDescriptor;
import org.craftercms.commons.plugin.model.Plugin;
import org.craftercms.commons.plugin.model.PluginDescriptor;
import org.craftercms.commons.rest.RestServiceException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteAlreadyExistsException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryCredentialsException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryException;
import org.craftercms.studio.api.v1.exception.repository.RemoteRepositoryNotFoundException;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.SiteDAO;
import org.craftercms.studio.api.v2.dal.publish.ItemTargetDAO;
import org.craftercms.studio.api.v2.exception.StagingAlreadyEnabledException;
import org.craftercms.studio.api.v2.deployment.Deployer;
import org.craftercms.studio.api.v2.exception.CompositeException;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobAwareContentRepository;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.upgrade.StudioUpgradeManager;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.api.v2.utils.spring.context.SiteBootstrapStateProvider;
import org.craftercms.studio.impl.v2.dal.RetryingDatabaseOperationFacadeImpl;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.craftercms.studio.model.rest.sites.CreateSiteRequest;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Spy;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.RestClientException;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_GLOBAL_SYSTEM_SITE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_SITE_STAGING_ID_SUFFIX;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getEnableStagingLockKey;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getPublishedRepoLockKey;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SERVERLESS_DELIVERY_ENABLED;
import static org.craftercms.studio.model.rest.sites.CreateSiteRequest.RemoteAuthentication.NONE;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@RunWith(MockitoJUnitRunner.class)
public class SitesServiceInternalImplTest {

	private static final String ROOT_SITE_ID = "studio_root";
	private static final String SITE_ID = "site1";
	private static final String USED_SITE_NAME = "already-taken";
	private static final String SOURCE_SITE_ID = "original";
	private static final String NEW_SITE_ID = "the-copy";
	private static final String SOURCE_SANDBOX_BRANCH = "develop";
	private static final String DUPLICATE_SANDBOX_BRANCH = "feature1";

	@Mock
	Deployer deployer;
	@Spy
	RetryingDatabaseOperationFacadeImpl retryingDatabaseOperationFacade;
	@Mock
	StudioBlobAwareContentRepository contentRepository;
	@Mock
	ConfigurationService configurationService;
	@Mock
	StudioConfiguration studioConfiguration;
	@Mock
	ApplicationContext applicationContext;
	@Mock
	EntitlementValidator entitlementValidator;
	@Mock
	UserService userService;
	@Mock
	ContentService contentService;
	@Mock
	StudioUpgradeManager upgradeManager;
	@Mock
	SiteBootstrapStateProvider siteBootstrapStateProvider;
	@Spy
	@InjectMocks
	SitesServiceInternalImpl sitesServiceInternal;

	@Mock
	protected SiteDAO siteDAO;
	@Mock
	protected AuditService auditService;
	@Mock
	protected ServicesConfig servicesConfig;
	@Mock
	protected ItemTargetDAO itemTargetDao;
	@Mock
	protected GeneralLockService generalLockService;

	private Site site;

	@Before
	public void setUp() throws IOException, ServiceLayerException {
		sitesServiceInternal.setApplicationContext(applicationContext);
		sitesServiceInternal.setServicesConfig(servicesConfig);
		sitesServiceInternal.setBlobAwareRepository(contentRepository);
		sitesServiceInternal.setServicesConfig(servicesConfig);
		sitesServiceInternal.setItemTargetDao(itemTargetDao);
		sitesServiceInternal.setGeneralLockService(generalLockService);
		sitesServiceInternal.setConfigurationService(configurationService);
		sitesServiceInternal.setUpgradeManager(upgradeManager);
		sitesServiceInternal.setContentService(contentService);
		site = new Site();
		site.setSiteId(SITE_ID);
		site.setName("Site 1");
		site.setSiteUuid(UUID.randomUUID().toString());
		site.setState(Site.State.READY);
		site.setStagingBlobsCopied(true);
		when(siteDAO.getSite(SITE_ID)).thenReturn(site);

		Site rootSite = new Site();
		rootSite.setId(1);
		when(siteDAO.getSite(ROOT_SITE_ID)).thenReturn(rootSite);

		when(studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE)).thenReturn(ROOT_SITE_ID);
		lenient().when(studioConfiguration.getProperty(CONFIGURATION_SITE_STAGING_ID_SUFFIX)).thenReturn("-staging");

		when(contentRepository.deleteSite(SITE_ID)).thenReturn(true);

		when(siteDAO.isNameUsed(NEW_SITE_ID, USED_SITE_NAME)).thenReturn(true);

		doNothing().when(sitesServiceInternal).addSiteUuidFile(anyString(), anyString());
		doCallRealMethod().when(retryingDatabaseOperationFacade).retry(any(Runnable.class));

		doNothing().when(sitesServiceInternal).auditSiteDuplicate(anyString(), anyString(), anyString());
		sitesServiceInternal.setApplicationContext(applicationContext);

		Site newSite = new Site();
		newSite.setSiteId(NEW_SITE_ID);
		when(siteDAO.getSite(NEW_SITE_ID)).thenReturn(newSite);

		Site sourceSite = new Site();
		sourceSite.setPublishingEnabled(true);
		sourceSite.setSandboxBranch(SOURCE_SANDBOX_BRANCH);
		when(siteDAO.getSite(SOURCE_SITE_ID)).thenReturn(sourceSite);
	}

	@Test
	public void siteDeleteTest() throws ServiceLayerException {
		doNothing().when(sitesServiceInternal).destroySitePreviewContext(SITE_ID);
		sitesServiceInternal.deleteSite(SITE_ID);

		verify(siteDAO, times(1)).startSiteDelete(SITE_ID);
		verify(siteDAO, times(1)).enablePublishing(SITE_ID, false);
		verify(deployer, times(1)).deleteTargets(SITE_ID);
		verify(sitesServiceInternal, times(1)).destroySitePreviewContext(SITE_ID);
		verify(contentRepository, times(1)).deleteSite(SITE_ID);
		verify(configurationService, times(1)).invalidateConfiguration(SITE_ID);
		verify(siteDAO, times(1)).deleteSiteRelatedItems(SITE_ID);
		verify(siteDAO, times(1)).completeSiteDelete(SITE_ID);
		verify(auditService, times(3)).insertAuditLog(any());
	}

	@Test
	public void deployerDownSiteDeleteTest() throws ServiceLayerException {
		doNothing().when(sitesServiceInternal).destroySitePreviewContext(SITE_ID);
		doThrow(new RestClientException("Deployer is down")).when(deployer).deleteTargets(SITE_ID);

		assertThrows(ServiceLayerException.class, () -> sitesServiceInternal.deleteSite(SITE_ID));

		verify(siteDAO, times(1)).startSiteDelete(SITE_ID);
		verify(siteDAO, times(1)).enablePublishing(SITE_ID, false);
		verify(deployer, times(1)).deleteTargets(SITE_ID);
		verify(sitesServiceInternal, times(1)).destroySitePreviewContext(SITE_ID);
		verify(contentRepository, times(1)).deleteSite(SITE_ID);
		verify(configurationService, times(1)).invalidateConfiguration(SITE_ID);
		verify(siteDAO, times(1)).deleteSiteRelatedItems(SITE_ID);
		verify(siteDAO, never()).completeSiteDelete(SITE_ID);
		verify(auditService, times(2)).insertAuditLog(any());
	}

	@Test
	public void multipleExceptionsSiteDeleteTest() throws ServiceLayerException {
		doNothing().when(sitesServiceInternal).destroySitePreviewContext(SITE_ID);
		doThrow(new RestClientException("Deployer is down")).when(deployer).deleteTargets(SITE_ID);
		doThrow(new RuntimeException("Unexpected file system error")).when(contentRepository).deleteSite(SITE_ID);

		CompositeException exception = assertThrows(CompositeException.class, () -> sitesServiceInternal.deleteSite(SITE_ID));
		assertEquals(2, exception.getExceptions().size());

		verify(siteDAO, times(1)).startSiteDelete(SITE_ID);
		verify(siteDAO, times(1)).enablePublishing(SITE_ID, false);
		verify(deployer, times(1)).deleteTargets(SITE_ID);
		verify(sitesServiceInternal, times(1)).destroySitePreviewContext(SITE_ID);
		verify(contentRepository, times(1)).deleteSite(SITE_ID);
		verify(configurationService, times(1)).invalidateConfiguration(SITE_ID);
		verify(siteDAO, times(1)).deleteSiteRelatedItems(SITE_ID);
		verify(siteDAO, never()).completeSiteDelete(SITE_ID);
		verify(auditService, times(2)).insertAuditLog(any());
	}

	@Test
	public void nonCriticalErrorsSiteDeleteTest() throws ServiceLayerException {
		doThrow(new ServiceLayerException("Failed to destroy site preview context")).when(sitesServiceInternal).destroySitePreviewContext(SITE_ID);

		doThrow(new RuntimeException("Unexpected db error")).when(siteDAO).enablePublishing(SITE_ID, false);

		sitesServiceInternal.deleteSite(SITE_ID);

		verify(siteDAO, times(1)).startSiteDelete(SITE_ID);
		verify(siteDAO, times(1)).enablePublishing(SITE_ID, false);
		verify(deployer, times(1)).deleteTargets(SITE_ID);
		verify(sitesServiceInternal, times(1)).destroySitePreviewContext(SITE_ID);
		verify(contentRepository, times(1)).deleteSite(SITE_ID);
		verify(configurationService, times(1)).invalidateConfiguration(SITE_ID);
		verify(siteDAO, times(1)).deleteSiteRelatedItems(SITE_ID);
		verify(siteDAO, times(1)).completeSiteDelete(SITE_ID);
		verify(auditService, times(2)).insertAuditLog(any());
	}

	@Test
	public void duplicateAlreadyTakenNameTest() {
		assertThrows(SiteAlreadyExistsException.class, () ->
				sitesServiceInternal.duplicate(SOURCE_SITE_ID, NEW_SITE_ID, USED_SITE_NAME, "The new site", "main_branch", false, false));
	}

	@Test
	public void readOnlyOnBlobStoresTest() throws ServiceLayerException {
		when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_ENABLED, Boolean.class, false)).thenReturn(false);
		sitesServiceInternal.duplicate(SOURCE_SITE_ID, NEW_SITE_ID, "site_name", "The new site", "main_branch", true, false);

		verify(configurationService).makeBlobStoresReadOnly(NEW_SITE_ID);
	}

	@Test
	public void readOnlyOffBlobStoresTest() throws ServiceLayerException {
		sitesServiceInternal.duplicate(SOURCE_SITE_ID, NEW_SITE_ID, "site_name", "The new site", "main_branch", false, false);

		verify(configurationService, never()).makeBlobStoresReadOnly(NEW_SITE_ID);
	}

	@Test
	public void duplicateSiteTest() throws ServiceLayerException, IOException {
		sitesServiceInternal.duplicate(SOURCE_SITE_ID, NEW_SITE_ID, "site_name", "The new site", DUPLICATE_SANDBOX_BRANCH, false, false);

		verify(contentRepository).duplicateSite(SOURCE_SITE_ID, NEW_SITE_ID, SOURCE_SANDBOX_BRANCH, DUPLICATE_SANDBOX_BRANCH);
		verify(sitesServiceInternal).addSiteUuidFile(eq(NEW_SITE_ID), any());
		verify(siteDAO).duplicate(eq(SOURCE_SITE_ID), eq(NEW_SITE_ID), eq("site_name"), eq("The new site"), eq(DUPLICATE_SANDBOX_BRANCH), any());

		verify(deployer).duplicateTargets(SOURCE_SITE_ID, NEW_SITE_ID);
		verify(sitesServiceInternal).enablePublishing(NEW_SITE_ID, true);

		verify(sitesServiceInternal).enablePublishing(SOURCE_SITE_ID, false);
		verify(sitesServiceInternal).enablePublishing(SOURCE_SITE_ID, true);
	}

	@Test
	public void duplicateSiteErrorTest() throws ServiceLayerException {
		doThrow(new RestClientException("test")).when(deployer).duplicateTargets(SOURCE_SITE_ID, NEW_SITE_ID);

		assertThrows(ServiceLayerException.class, () ->
				sitesServiceInternal.duplicate(SOURCE_SITE_ID, NEW_SITE_ID, "site_name", "The new site", "main_branch", false, false));
		verify(sitesServiceInternal).deleteSite(NEW_SITE_ID);
	}

	@Test
	public void createSiteTest() throws InvalidRemoteRepositoryCredentialsException, RemoteRepositoryNotFoundException, ServiceLayerException, InvalidRemoteRepositoryException {
		try (MockedStatic<SecurityUtils> securityUtils = mockStatic(SecurityUtils.class)) {
			securityUtils.when(SecurityUtils::getCurrentUsername).thenReturn("user123");
			when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_ENABLED, Boolean.class, false)).thenReturn(false);


			PluginDescriptor pluginDescriptor = new PluginDescriptor();
			pluginDescriptor.setBlueprint(new BlueprintDescriptor.Blueprint());
			Plugin plugin = new Plugin();
			pluginDescriptor.setPlugin(plugin);
			doReturn(pluginDescriptor).when(sitesServiceInternal).getBlueprintDescriptor("test-blueprint");

			CreateSiteRequest.BlueprintSource request = new CreateSiteRequest.BlueprintSource();
			request.setSiteId("new-site");
			request.setName("New Site");
			request.setDescription("A new site created from a blueprint");
			request.setBlueprintId("test-blueprint");

			sitesServiceInternal.createSite(request);

			verify(contentRepository).createSiteFromBlueprint(eq(""), eq("new-site"), nullable(String.class), argThat(m -> m == null || m.isEmpty()), eq("user123"));
		}
	}

	@Test
	public void createSiteFromRemoteTest() throws InvalidRemoteRepositoryCredentialsException, RemoteRepositoryNotFoundException, ServiceLayerException, InvalidRemoteRepositoryException {
		try (MockedStatic<SecurityUtils> securityUtils = mockStatic(SecurityUtils.class)) {
			securityUtils.when(SecurityUtils::getCurrentUsername).thenReturn("user123");
			when(studioConfiguration.getProperty(SERVERLESS_DELIVERY_ENABLED, Boolean.class, false)).thenReturn(false);

			CreateSiteRequest.RemoteSource request = new CreateSiteRequest.RemoteSource();
			request.setSiteId("new-site");
			request.setName("New Site");
			request.setDescription("A new site created from a remote repository");
			request.setRemoteUrl("http://example.com/repo.git");
			request.setRemoteName("origin");
			request.setRemoteBranch("main");
			request.setAuthentication(NONE);

			sitesServiceInternal.createSite(request);

			verify(contentRepository).createSiteCloneRemote(eq("new-site"), nullable(String.class), eq("origin"), eq("http://example.com/repo.git"),
					nullable(String.class), eq(true), eq(AuthenticationType.none), nullable(String.class), nullable(String.class),
					nullable(String.class), nullable(String.class), argThat(m -> m == null || m.isEmpty()), eq(false), eq("user123"));
		}
	}

	@Test
	public void enableStagingAlreadyEnabledTest() {
		Site site = new Site();
		site.setSiteId(SITE_ID);
		site.setStagingEnabled(true);
		when(siteDAO.getSite(SITE_ID)).thenReturn(site);

		assertThrows(StagingAlreadyEnabledException.class, () -> sitesServiceInternal.enableStaging(SITE_ID));

		verify(deployer, never()).createStagingTarget(SITE_ID);
		verify(siteDAO, never()).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingUnpublishedSiteTest() throws Exception {
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(false);
		when(siteDAO.setStagingEnabled(SITE_ID)).thenReturn(1);

		sitesServiceInternal.enableStaging(SITE_ID);

		verify(deployer).createStagingTarget(SITE_ID);
		verify(siteDAO).setStagingEnabled(SITE_ID);
		verify(contentRepository, never()).createStagingBranchFromLive(anyString(), anyString(), anyString());
		verify(contentRepository, never()).copyBlobs(anyString(), anyString(), anyString());
		verify(contentRepository, never()).copyBlobs(anyString(), anyString(), anyString(), anyString());
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingPublishedSiteTest() throws Exception {
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, "live")).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive(SITE_ID, "live", "staging")).thenReturn(true);
		when(itemTargetDao.targetExists(0L, "staging")).thenReturn(false);
		when(siteDAO.setStagingEnabled(SITE_ID)).thenReturn(1);

		sitesServiceInternal.enableStaging(SITE_ID);

		InOrder inOrder = inOrder(siteDAO, itemTargetDao, contentRepository);
		inOrder.verify(siteDAO).setStagingBlobsCopied(SITE_ID, false);
		inOrder.verify(itemTargetDao).initStaging(0L, "staging", "live");
		inOrder.verify(contentRepository).copyBlobs(SITE_ID, "live", "staging", "staging");
		inOrder.verify(siteDAO).setStagingBlobsCopied(SITE_ID, true);
		verify(contentRepository, never()).copyBlobs(anyString(), anyString(), anyString());
		verify(deployer).createStagingTarget(SITE_ID);
		verify(siteDAO).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingExistingBranchSkipsBlobCopy() throws Exception {
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, "live")).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive(SITE_ID, "live", "staging")).thenReturn(false);
		when(itemTargetDao.targetExists(0L, "staging")).thenReturn(true);
		when(siteDAO.setStagingEnabled(SITE_ID)).thenReturn(1);

		sitesServiceInternal.enableStaging(SITE_ID);

		verify(contentRepository, never()).copyBlobs(anyString(), anyString(), anyString());
		verify(contentRepository, never()).copyBlobs(anyString(), anyString(), anyString(), anyString());
		verify(siteDAO, never()).setStagingBlobsCopied(SITE_ID, false);
		verify(contentRepository, never()).deletePublishedBranch(anyString(), anyString());
		verify(itemTargetDao, never()).initStaging(anyLong(), anyString(), anyString());
		verify(deployer).createStagingTarget(SITE_ID);
		verify(siteDAO).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingRetryCopiesBlobsWhenTheFlagIsPending() throws Exception {
		site.setStagingBlobsCopied(false);
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, "live")).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive(SITE_ID, "live", "staging")).thenReturn(false, true);
		when(contentRepository.deletePublishedBranch(SITE_ID, "staging")).thenReturn(true);
		when(itemTargetDao.targetExists(0L, "staging")).thenReturn(false);
		when(siteDAO.setStagingEnabled(SITE_ID)).thenReturn(1);

		sitesServiceInternal.enableStaging(SITE_ID);

		verify(itemTargetDao).deleteForTarget(0L, "staging");
		verify(contentRepository).deletePublishedBranch(SITE_ID, "staging");
		verify(contentRepository, times(2)).createStagingBranchFromLive(SITE_ID, "live", "staging");
		verify(itemTargetDao).initStaging(0L, "staging", "live");
		verify(contentRepository).copyBlobs(SITE_ID, "live", "staging", "staging");
		verify(siteDAO).setStagingBlobsCopied(SITE_ID, false);
		verify(siteDAO).setStagingBlobsCopied(SITE_ID, true);
		verify(siteDAO).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingBlobCopyFailureDeletesCreatedBranch() throws Exception {
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, "live")).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive(SITE_ID, "live", "staging")).thenReturn(true);
		when(itemTargetDao.targetExists(0L, "staging")).thenReturn(false);
		doThrow(new ServiceLayerException("blob copy failed")).when(contentRepository).copyBlobs(SITE_ID, "live", "staging", "staging");

		assertThrows(ServiceLayerException.class, () -> sitesServiceInternal.enableStaging(SITE_ID));

		verify(siteDAO).setStagingBlobsCopied(SITE_ID, false);
		verify(siteDAO, never()).setStagingBlobsCopied(SITE_ID, true);
		verify(contentRepository).deletePublishedBranch(SITE_ID, "staging");
		verify(itemTargetDao).deleteForTarget(0L, "staging");
		verify(deployer, never()).createStagingTarget(SITE_ID);
		verify(deployer, never()).deleteStagingTarget(SITE_ID);
		verify(siteDAO, never()).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingRetryAfterFailedCleanupRebuildsFromOneLiveCommit() throws Exception {
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, "live")).thenReturn(true);
		when(itemTargetDao.targetExists(0L, "staging")).thenReturn(false);
		when(siteDAO.setStagingEnabled(SITE_ID)).thenReturn(1);
		when(deployer.createStagingTarget(SITE_ID)).thenReturn(true);

		AtomicReference<String> liveCommit = new AtomicReference<>("commit-a");
		AtomicReference<String> stagingCommit = new AtomicReference<>();
		when(contentRepository.createStagingBranchFromLive(SITE_ID, "live", "staging")).thenAnswer(invocation -> {
			if (stagingCommit.get() != null) {
				return false;
			}
			stagingCommit.set(liveCommit.get());
			return true;
		});
		AtomicInteger deletes = new AtomicInteger();
		when(contentRepository.deletePublishedBranch(SITE_ID, "staging")).thenAnswer(invocation -> {
			if (deletes.incrementAndGet() == 1) {
				throw new IOException("branch cleanup failed");
			}
			stagingCommit.set(null);
			return true;
		});
		doAnswer(invocation -> {
			if (!liveCommit.get().equals(stagingCommit.get())) {
				throw new AssertionError("Item targets were initialized from live " + liveCommit.get()
					+ " while the staging branch is " + stagingCommit.get());
			}
			return null;
		}).when(itemTargetDao).initStaging(0L, "staging", "live");
		AtomicInteger blobCopies = new AtomicInteger();
		doAnswer(invocation -> {
			if (!liveCommit.get().equals(stagingCommit.get())) {
				throw new AssertionError("Blob copy used live " + liveCommit.get() + " and staging " + stagingCommit.get());
			}
			if (blobCopies.incrementAndGet() == 1) {
				throw new ServiceLayerException("blob copy failed");
			}
			return null;
		}).when(contentRepository).copyBlobs(SITE_ID, "live", "staging", "staging");

		assertThrows(ServiceLayerException.class, () -> sitesServiceInternal.enableStaging(SITE_ID));
		assertEquals("commit-a", stagingCommit.get());

		liveCommit.set("commit-b");
		site.setStagingBlobsCopied(false);
		sitesServiceInternal.enableStaging(SITE_ID);

		assertEquals("commit-b", stagingCommit.get());
		verify(contentRepository, times(3)).createStagingBranchFromLive(SITE_ID, "live", "staging");
		verify(contentRepository, times(2)).deletePublishedBranch(SITE_ID, "staging");
		verify(itemTargetDao, times(2)).initStaging(0L, "staging", "live");
		verify(contentRepository, times(2)).copyBlobs(SITE_ID, "live", "staging", "staging");
		verify(contentRepository, never()).copyBlobs(anyString(), anyString(), anyString());
		verify(siteDAO).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingFreshBranchDeletesLeftoverItemTargets() throws Exception {
		site.setStagingBlobsCopied(false);
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, "live")).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive(SITE_ID, "live", "staging")).thenReturn(true);
		when(siteDAO.setStagingEnabled(SITE_ID)).thenReturn(1);
		AtomicBoolean targetsExist = new AtomicBoolean(true);
		when(itemTargetDao.targetExists(0L, "staging")).thenAnswer(invocation -> targetsExist.get());
		doAnswer(invocation -> {
			targetsExist.set(false);
			return null;
		}).when(itemTargetDao).deleteForTarget(0L, "staging");

		sitesServiceInternal.enableStaging(SITE_ID);

		assertFalse(targetsExist.get());
		InOrder inOrder = inOrder(itemTargetDao, contentRepository);
		inOrder.verify(itemTargetDao).deleteForTarget(0L, "staging");
		inOrder.verify(contentRepository).createStagingBranchFromLive(SITE_ID, "live", "staging");
		inOrder.verify(itemTargetDao).initStaging(0L, "staging", "live");
		inOrder.verify(contentRepository).copyBlobs(SITE_ID, "live", "staging", "staging");
		verify(contentRepository, never()).deletePublishedBranch(anyString(), anyString());
		verify(siteDAO).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingRetryDeletesLeftoverTargetsAndRebuildsAfterLivePublish() throws Exception {
		site.setStagingBlobsCopied(false);
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, "live")).thenReturn(true);
		when(siteDAO.setStagingEnabled(SITE_ID)).thenReturn(1);
		AtomicReference<String> liveCommit = new AtomicReference<>("commit-b");
		AtomicReference<String> stagingCommit = new AtomicReference<>("commit-a");
		AtomicBoolean targetsExist = new AtomicBoolean(true);
		when(contentRepository.createStagingBranchFromLive(SITE_ID, "live", "staging")).thenAnswer(invocation -> {
			if (stagingCommit.get() != null) {
				return false;
			}
			stagingCommit.set(liveCommit.get());
			return true;
		});
		when(contentRepository.deletePublishedBranch(SITE_ID, "staging")).thenAnswer(invocation -> {
			stagingCommit.set(null);
			return true;
		});
		when(itemTargetDao.targetExists(0L, "staging")).thenAnswer(invocation -> targetsExist.get());
		doAnswer(invocation -> {
			targetsExist.set(false);
			return null;
		}).when(itemTargetDao).deleteForTarget(0L, "staging");
		doAnswer(invocation -> {
			if (!liveCommit.get().equals(stagingCommit.get())) {
				throw new AssertionError("Item targets were rebuilt from live " + liveCommit.get()
					+ " while the staging branch is " + stagingCommit.get());
			}
			return null;
		}).when(itemTargetDao).initStaging(0L, "staging", "live");
		doAnswer(invocation -> {
			if (!liveCommit.get().equals(stagingCommit.get())) {
				throw new AssertionError("Blob copy used live " + liveCommit.get() + " and staging " + stagingCommit.get());
			}
			return null;
		}).when(contentRepository).copyBlobs(SITE_ID, "live", "staging", "staging");

		sitesServiceInternal.enableStaging(SITE_ID);

		assertEquals("commit-b", stagingCommit.get());
		assertFalse(targetsExist.get());
		InOrder inOrder = inOrder(itemTargetDao, contentRepository);
		inOrder.verify(itemTargetDao).deleteForTarget(0L, "staging");
		inOrder.verify(contentRepository).deletePublishedBranch(SITE_ID, "staging");
		inOrder.verify(contentRepository).createStagingBranchFromLive(SITE_ID, "live", "staging");
		inOrder.verify(itemTargetDao).initStaging(0L, "staging", "live");
		inOrder.verify(contentRepository).copyBlobs(SITE_ID, "live", "staging", "staging");
		verify(siteDAO).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingSkipsRebuildWhenBlobsAreAlreadyCopied() throws Exception {
		site.setStagingBlobsCopied(true);
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, "live")).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive(SITE_ID, "live", "staging")).thenReturn(false);
		when(itemTargetDao.targetExists(0L, "staging")).thenReturn(true);
		when(siteDAO.setStagingEnabled(SITE_ID)).thenReturn(1);

		sitesServiceInternal.enableStaging(SITE_ID);

		verify(contentRepository, times(1)).createStagingBranchFromLive(SITE_ID, "live", "staging");
		verify(contentRepository, never()).deletePublishedBranch(anyString(), anyString());
		verify(contentRepository, never()).copyBlobs(anyString(), anyString(), anyString(), anyString());
		verify(itemTargetDao, never()).initStaging(anyLong(), anyString(), anyString());
		verify(siteDAO).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingRebuildFailsWhenTheOldBranchCannotBeDeleted() throws Exception {
		site.setStagingBlobsCopied(false);
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, "live")).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive(SITE_ID, "live", "staging")).thenReturn(false);
		when(contentRepository.deletePublishedBranch(SITE_ID, "staging")).thenReturn(false);

		ServiceLayerException error = assertThrows(ServiceLayerException.class, () -> sitesServiceInternal.enableStaging(SITE_ID));

		assertTrue(error.getMessage().contains("Failed to delete staging branch 'staging' for site 'site1' before rebuilding it from 'live'"));
		verify(contentRepository, times(1)).createStagingBranchFromLive(SITE_ID, "live", "staging");
		verify(itemTargetDao, never()).initStaging(anyLong(), anyString(), anyString());
		verify(contentRepository, never()).copyBlobs(anyString(), anyString(), anyString(), anyString());
		verify(siteDAO, never()).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingRebuildFailsWhenTheBranchCannotBeCreated() throws Exception {
		site.setStagingBlobsCopied(false);
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, "live")).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive(SITE_ID, "live", "staging")).thenReturn(false);
		when(contentRepository.deletePublishedBranch(SITE_ID, "staging")).thenReturn(true);

		ServiceLayerException error = assertThrows(ServiceLayerException.class, () -> sitesServiceInternal.enableStaging(SITE_ID));

		assertTrue(error.getMessage().contains("Failed to rebuild staging branch 'staging' for site 'site1' from 'live'"));
		verify(contentRepository, times(2)).createStagingBranchFromLive(SITE_ID, "live", "staging");
		verify(contentRepository).deletePublishedBranch(SITE_ID, "staging");
		verify(itemTargetDao, never()).initStaging(anyLong(), anyString(), anyString());
		verify(contentRepository, never()).copyBlobs(anyString(), anyString(), anyString(), anyString());
		verify(siteDAO, never()).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingFailureRollsBackTest() throws Exception {
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, "live")).thenReturn(true);
		when(contentRepository.createStagingBranchFromLive(SITE_ID, "live", "staging")).thenReturn(true);
		when(itemTargetDao.targetExists(0L, "staging")).thenReturn(false);
		doThrow(new RestClientException("deployer down")).when(deployer).createStagingTarget(SITE_ID);

		assertThrows(ServiceLayerException.class, () -> sitesServiceInternal.enableStaging(SITE_ID));

		verify(siteDAO, never()).setStagingEnabled(SITE_ID);
		verify(itemTargetDao).deleteForTarget(0L, "staging");
		verify(contentRepository).deletePublishedBranch(SITE_ID, "staging");
		verify(deployer, never()).deleteStagingTarget(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingExistingTargetIsNotRemovedWhenInitializationFails() throws Exception {
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(false);
		when(deployer.createStagingTarget(SITE_ID)).thenReturn(false);
		doThrow(new RuntimeException("db down")).when(siteDAO).setStagingBlobsCopied(SITE_ID, true);

		assertThrows(ServiceLayerException.class, () -> sitesServiceInternal.enableStaging(SITE_ID));

		verify(deployer).createStagingTarget(SITE_ID);
		verify(deployer, never()).deleteStagingTarget(anyString());
		verify(siteDAO, never()).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	@Test
	public void enableStagingRemovesDeployerTargetCreatedByThisCall() throws Exception {
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(false);
		when(deployer.createStagingTarget(SITE_ID)).thenReturn(true);
		doThrow(new RuntimeException("db down")).when(siteDAO).setStagingBlobsCopied(SITE_ID, true);

		assertThrows(ServiceLayerException.class, () -> sitesServiceInternal.enableStaging(SITE_ID));

		verify(deployer).deleteStagingTarget(SITE_ID);
		verify(siteDAO, never()).setStagingEnabled(SITE_ID);
		verifyEnableStagingLockReleased();
	}

	private void verifyEnableStagingLockReleased() {
		String enableLockKey = getEnableStagingLockKey(SITE_ID);
		InOrder inOrder = inOrder(generalLockService);
		inOrder.verify(generalLockService).lock(enableLockKey);
		inOrder.verify(generalLockService).unlock(enableLockKey);
		verify(generalLockService, never()).lock(getPublishedRepoLockKey(SITE_ID));
	}

	@Test
	public void duplicateEnableStagingFromLiveTest() throws Exception {
		when(servicesConfig.getLiveEnvironment(NEW_SITE_ID)).thenReturn("live");
		when(servicesConfig.getStagingEnvironment(NEW_SITE_ID)).thenReturn("staging");
		when(contentRepository.publishedRepositoryExists(NEW_SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(NEW_SITE_ID, "live")).thenReturn(true);
		when(itemTargetDao.targetExists(0L, "staging")).thenReturn(false);

		sitesServiceInternal.duplicate(SOURCE_SITE_ID, NEW_SITE_ID, "site_name", "The new site", DUPLICATE_SANDBOX_BRANCH, false, true);

		verify(siteDAO).setStagingEnabled(NEW_SITE_ID);
		verify(siteDAO).setStagingBlobsCopied(NEW_SITE_ID, true);
		verify(contentRepository).createStagingBranchFromLive(NEW_SITE_ID, "live", "staging");
		verify(itemTargetDao).initStaging(0L, "staging", "live");
		verify(deployer).createStagingTarget(NEW_SITE_ID);
		verify(deployer, never()).duplicateStagingTarget(anyString(), anyString());
		verify(contentRepository).copyBlobs(NEW_SITE_ID, "live", "staging");
	}

	@Test
	public void duplicateDisableStagingFromSourceTest() throws Exception {
		Site sourceSite = new Site();
		sourceSite.setPublishingEnabled(true);
		sourceSite.setSandboxBranch(SOURCE_SANDBOX_BRANCH);
		sourceSite.setStagingEnabled(true);
		when(siteDAO.getSite(SOURCE_SITE_ID)).thenReturn(sourceSite);
		when(servicesConfig.getStagingEnvironment(NEW_SITE_ID)).thenReturn("staging");

		sitesServiceInternal.duplicate(SOURCE_SITE_ID, NEW_SITE_ID, "site_name", "The new site", DUPLICATE_SANDBOX_BRANCH, false, false);

		verify(contentRepository).deletePublishedBranch(NEW_SITE_ID, "staging");
		verify(itemTargetDao).deleteForTarget(0L, "staging");
		verify(siteDAO, never()).setStagingEnabled(NEW_SITE_ID);
		verify(siteDAO, never()).setStagingBlobsCopied(anyString(), anyBoolean());
		verify(deployer, never()).createStagingTarget(anyString());
		verify(deployer, never()).duplicateStagingTarget(anyString(), anyString());
	}

	@Test
	public void duplicateKeepSourceStagingTest() throws Exception {
		Site sourceSite = new Site();
		sourceSite.setPublishingEnabled(true);
		sourceSite.setSandboxBranch(SOURCE_SANDBOX_BRANCH);
		sourceSite.setStagingEnabled(true);
		sourceSite.setStagingBlobsCopied(true);
		when(siteDAO.getSite(SOURCE_SITE_ID)).thenReturn(sourceSite);
		when(servicesConfig.getStagingEnvironment(NEW_SITE_ID)).thenReturn("staging");

		sitesServiceInternal.duplicate(SOURCE_SITE_ID, NEW_SITE_ID, "site_name", "The new site", DUPLICATE_SANDBOX_BRANCH, false, true);

		verify(siteDAO).setStagingEnabled(NEW_SITE_ID);
		verify(siteDAO).setStagingBlobsCopied(NEW_SITE_ID, true);
		verify(contentRepository, never()).createStagingBranchFromLive(anyString(), anyString(), anyString());
		verify(contentRepository, never()).deletePublishedBranch(anyString(), anyString());
		verify(deployer).duplicateStagingTarget(SOURCE_SITE_ID, NEW_SITE_ID);
		verify(deployer, never()).createStagingTarget(anyString());
	}

	@Test
	public void duplicateMissingSourceStagingTargetCreatesOne() throws Exception {
		Site sourceSite = new Site();
		sourceSite.setPublishingEnabled(true);
		sourceSite.setSandboxBranch(SOURCE_SANDBOX_BRANCH);
		sourceSite.setStagingEnabled(true);
		when(siteDAO.getSite(SOURCE_SITE_ID)).thenReturn(sourceSite);
		when(servicesConfig.getStagingEnvironment(NEW_SITE_ID)).thenReturn("staging");
		doThrow(new RestServiceException(HttpStatus.NOT_FOUND, "Target not found"))
			.when(deployer).duplicateStagingTarget(SOURCE_SITE_ID, NEW_SITE_ID);

		sitesServiceInternal.duplicate(SOURCE_SITE_ID, NEW_SITE_ID, "site_name", "The new site", DUPLICATE_SANDBOX_BRANCH, false, true);

		verify(deployer).duplicateStagingTarget(SOURCE_SITE_ID, NEW_SITE_ID);
		verify(deployer).createStagingTarget(NEW_SITE_ID);
		verify(siteDAO).setStagingBlobsCopied(NEW_SITE_ID, false);
	}

	@Test
	public void bootstrappingStateTest() {
		when(siteBootstrapStateProvider.isSiteReady(SITE_ID)).thenReturn(false);

		Site site = sitesServiceInternal.getSite(SITE_ID);
		assertEquals(Site.State.BOOTSTRAPPING, site.getState());

		verify(sitesServiceInternal).checkBootstrappingState(any());
	}

	@Test
	public void deliverableSitesWithoutStaging() throws SiteNotFoundException {
		when(siteDAO.getDeliverableSiteIds()).thenReturn(List.of("editorial", "zeta"));
		when(servicesConfig.isStagingEnvironmentEnabled("editorial")).thenReturn(false);
		when(servicesConfig.isStagingEnvironmentEnabled("zeta")).thenReturn(false);

		assertEquals(List.of("editorial", "zeta"), sitesServiceInternal.getDeliverableSiteIds());
	}

	@Test
	public void deliverableSitesWithStaging() throws SiteNotFoundException {
		when(siteDAO.getDeliverableSiteIds()).thenReturn(List.of("editorial", "zeta"));
		when(servicesConfig.isStagingEnvironmentEnabled("editorial")).thenReturn(true);
		when(servicesConfig.isStagingEnvironmentEnabled("zeta")).thenReturn(false);

		assertEquals(List.of("editorial", "editorial-staging", "zeta"), sitesServiceInternal.getDeliverableSiteIds());
	}

	@Test
	public void deliverableSitesStagingReadFailure() throws SiteNotFoundException {
		when(siteDAO.getDeliverableSiteIds()).thenReturn(List.of("editorial"));
		when(servicesConfig.isStagingEnvironmentEnabled("editorial")).thenThrow(new SiteNotFoundException("editorial"));

		assertEquals(List.of("editorial"), sitesServiceInternal.getDeliverableSiteIds());
	}

	@Test
	public void deliverableSitesStagingConfigFailureKeepsSite() throws SiteNotFoundException {
		when(siteDAO.getDeliverableSiteIds()).thenReturn(List.of("editorial", "zeta"));
		when(servicesConfig.isStagingEnvironmentEnabled("editorial"))
			.thenThrow(new NullPointerException("site config"));
		when(servicesConfig.isStagingEnvironmentEnabled("zeta")).thenReturn(true);

		assertEquals(List.of("editorial", "zeta", "zeta-staging"), sitesServiceInternal.getDeliverableSiteIds());
	}

	@Test
	public void readyStateTest() {
		when(siteBootstrapStateProvider.isSiteReady(SITE_ID)).thenReturn(true);

		Site site = sitesServiceInternal.getSite(SITE_ID);
		assertEquals(Site.State.READY, site.getState());

		verify(sitesServiceInternal).checkBootstrappingState(any());
	}
}
