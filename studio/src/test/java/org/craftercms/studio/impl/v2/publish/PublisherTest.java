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

package org.craftercms.studio.impl.v2.publish;

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.SiteDAO;
import org.craftercms.studio.api.v2.dal.publish.ItemTargetDAO;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.api.v2.dal.publish.PublishItem;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.deployment.Deployer;
import org.craftercms.studio.api.v2.event.publish.PublishErrorEvent;
import org.craftercms.studio.api.v2.event.publish.RequestPublishEvent;
import org.craftercms.studio.api.v2.event.site.SiteDeletingEvent;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobAwareContentRepository;
import org.craftercms.studio.api.v2.service.audit.ActivityStreamService;
import org.craftercms.studio.api.v2.task.TaskManager;
import org.craftercms.studio.api.v2.task.TaskProgress;
import org.craftercms.studio.api.v2.utils.StudioUtils;
import org.apache.ibatis.executor.BatchResult;
import org.craftercms.studio.api.v2.repository.PublishItemTO;
import org.craftercms.studio.api.v2.repository.publish.GitPublishChangeSet;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.MockitoJUnitRunner;
import org.craftercms.studio.model.rest.ApiResponse;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.web.client.RestClientException;

import java.io.IOException;
import java.sql.Statement;
import java.util.Collection;
import java.util.List;

import static java.util.Collections.emptyList;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_PUBLISH_START;
import static org.craftercms.studio.api.v2.dal.Site.State.READY;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.COMPLETED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.LIVE_FAILED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.LIVE_SUCCESS;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.PROCESSING;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.STAGING_FAILED;
import static org.craftercms.studio.api.v2.dal.publish.PublishPackage.PackageState.STAGING_SUCCESS;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getEnableStagingLockKey;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getPublishedRepoLockKey;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.*;

@RunWith(MockitoJUnitRunner.class)
public class PublisherTest {
	static final String DISABLED_PUBLISH_SITE_ID = "disabledSite1";
	static final String SITE_ID = "site2";
	static final String LIVE = "live";
	static final String STAGING = "staging";
	static final long PACKAGE_ID = 123;
	static final long SITE_NUMERIC_ID = 456;

	@Mock
	SiteDAO siteDAO;

	@Mock
	PublishDAO publishDAO;

	@Mock
	Site disabledSite;

	@Mock
	Site site2;

	@Mock
	PublishPackage publishPackage;

	@Mock
	GeneralLockService generalLockService;

	@Mock
	ServicesConfig servicesConfig;

	@Mock
	ItemTargetDAO itemTargetDAO;

	@Mock
	StudioBlobAwareContentRepository contentRepository;

	@Mock
	Deployer deployer;

	@Mock
	TaskManager taskManager;

	@Mock
	ActivityStreamService activityService;

	@Mock
	ApplicationEventPublisher eventPublisher;

	@Mock
	PlatformTransactionManager transactionManager;

	@Mock
	TransactionStatus transactionStatus;

	@Mock
	SqlSessionTemplate batchSqlSessionTemplate;

	@Spy
	@InjectMocks
	Publisher publisher;

	@Before
	public void setUp() {
		when(disabledSite.getPublishingEnabled()).thenReturn(false);

		when(site2.getPublishingEnabled()).thenReturn(true);
		when(site2.getSiteId()).thenReturn(SITE_ID);
		when(site2.getId()).thenReturn(SITE_NUMERIC_ID);
		when(site2.isStagingBlobsCopied()).thenReturn(true);

		when(siteDAO.getSite(SITE_ID)).thenReturn(site2);
		when(site2.getState()).thenReturn(READY);

		when(siteDAO.getSite(DISABLED_PUBLISH_SITE_ID)).thenReturn(disabledSite);

		when(publishPackage.getSite()).thenReturn(site2);

		when(taskManager.registerTask(any())).then(invocation -> {
			TaskProgress<?, ?> taskProgress = mock(TaskProgress.class);
			when(taskProgress.startStage(any())).thenReturn(mock(TaskProgress.Stage.class));
			return taskProgress;
		});

		publisher.setApplicationEventPublisher(eventPublisher);
		lenient().when(transactionManager.getTransaction(any())).thenReturn(transactionStatus);

		when(publishPackage.getPackageType()).thenReturn(PublishPackage.PackageType.ITEM_LIST);
	}

	@Test
	public void publishDisabledTest() throws ServiceLayerException {
		publisher.handleRequestPublishEvent(new RequestPublishEvent(DISABLED_PUBLISH_SITE_ID, PACKAGE_ID));
		verify(publisher, never()).lockAndPublish(anyLong(), anyLong());
	}

	@Test
	public void lockUnavailableTest() throws ServiceLayerException {
		when(generalLockService.tryLock(StudioUtils.getPublishingLockKey(SITE_ID))).thenReturn(false);
		publisher.handleRequestPublishEvent(new RequestPublishEvent(SITE_ID, PACKAGE_ID));

		verify(generalLockService).tryLock(StudioUtils.getPublishingLockKey(SITE_ID));
		verify(publisher, never()).lockAndPublish(anyLong(), anyLong());
	}

	@Test
	public void notReadySiteTest() throws ServiceLayerException {
		when(site2.getState()).thenReturn(Site.State.INITIALIZING);
		publisher.handleRequestPublishEvent(new RequestPublishEvent(SITE_ID, PACKAGE_ID));

		verify(site2).getState();
		verify(publisher, never()).lockAndPublish(anyLong(), anyLong());
	}

	@Test
	public void lockedPackageTest() throws ServiceLayerException {
		when(generalLockService.tryLock(StudioUtils.getPublishingLockKey(SITE_ID))).thenReturn(true);
		when(site2.getState()).thenReturn(READY);
		when(generalLockService.tryLock(StudioUtils.getPublishPackageLockKey(PACKAGE_ID))).thenReturn(false);

		publisher.handleRequestPublishEvent(new RequestPublishEvent(SITE_ID, PACKAGE_ID));

		verify(publisher).lockAndPublish(anyLong(), anyLong());
		verify(publisher, never()).doPublish(any());
		verify(generalLockService).tryLock(StudioUtils.getPublishPackageLockKey(PACKAGE_ID));
	}

	@Test
	public void doPublishCallTest() throws ServiceLayerException {
		when(generalLockService.tryLock(StudioUtils.getPublishingLockKey(SITE_ID))).thenReturn(true);
		when(site2.getState()).thenReturn(READY);
		when(generalLockService.tryLock(StudioUtils.getPublishPackageLockKey(PACKAGE_ID))).thenReturn(true);
		doNothing().when(publisher).doPublish(any());

		publisher.handleRequestPublishEvent(new RequestPublishEvent(SITE_ID, PACKAGE_ID));

		verify(publisher).doPublish(any());
		verify(generalLockService).tryLock(StudioUtils.getPublishPackageLockKey(PACKAGE_ID));
	}

	@Test
	public void auditPublishTest() throws ServiceLayerException {
		when(publishPackage.getId()).thenReturn(PACKAGE_ID);
		when(publishDAO.getById(SITE_NUMERIC_ID, PACKAGE_ID)).thenReturn(publishPackage);

		when(generalLockService.tryLock(StudioUtils.getPublishingLockKey(SITE_ID))).thenReturn(true);
		when(site2.getState()).thenReturn(READY);
		when(generalLockService.tryLock(StudioUtils.getPublishPackageLockKey(PACKAGE_ID))).thenReturn(true);

		doNothing().when(publisher).auditPublishOperation(any(), any());
		doNothing().when(publisher).doPublishItemList(any(), any(), any(), anyBoolean());

		publisher.handleRequestPublishEvent(new RequestPublishEvent(SITE_ID, PACKAGE_ID));

		verify(publisher).auditPublishOperation(any(), eq(OPERATION_PUBLISH_START));
	}

	@Test
	public void livePublishRechecksStagingAfterPublishedRepoLock() throws ServiceLayerException {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(false);
		doAnswer(invocation -> {
			when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
			return null;
		}).when(generalLockService).lock(getPublishedRepoLockKey(SITE_ID));
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);

		InOrder inOrder = inOrder(generalLockService, publisher);
		inOrder.verify(generalLockService).lock(getEnableStagingLockKey(SITE_ID));
		inOrder.verify(generalLockService).lock(getPublishedRepoLockKey(SITE_ID));
		inOrder.verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(false), eq(STAGING));
		inOrder.verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(true), eq(LIVE));
		inOrder.verify(generalLockService).unlock(getPublishedRepoLockKey(SITE_ID));
		inOrder.verify(generalLockService).unlock(getEnableStagingLockKey(SITE_ID));
	}

	@Test
	public void livePublishSkipsStagingWhenStillDisabled() throws ServiceLayerException {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(false);
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);

		verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(true), eq(LIVE));
		verify(publisher, never()).runTargetPublisher(any(), any(), any(), eq(false), eq(STAGING));
		verify(generalLockService).unlock(getPublishedRepoLockKey(SITE_ID));
		verify(generalLockService).unlock(getEnableStagingLockKey(SITE_ID));
	}

	@Test
	public void initialPublishRechecksStagingAfterPublishedRepoLock() throws ServiceLayerException {
		preparePackagePublish(PublishPackage.PackageType.INITIAL_PUBLISH, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(false);
		doAnswer(invocation -> {
			when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
			return null;
		}).when(generalLockService).lock(getPublishedRepoLockKey(SITE_ID));
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);

		InOrder inOrder = inOrder(generalLockService, publisher);
		inOrder.verify(generalLockService).lock(getEnableStagingLockKey(SITE_ID));
		inOrder.verify(generalLockService).lock(getPublishedRepoLockKey(SITE_ID));
		inOrder.verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(false), eq(STAGING));
		inOrder.verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(true), eq(LIVE));
		inOrder.verify(generalLockService).unlock(getPublishedRepoLockKey(SITE_ID));
		inOrder.verify(generalLockService).unlock(getEnableStagingLockKey(SITE_ID));
		verify(itemTargetDAO).insertForInitialPublish(eq(SITE_NUMERIC_ID), anyLong(), anyLong(), eq(STAGING), any(), any());
		verify(itemTargetDAO).insertForInitialPublish(eq(SITE_NUMERIC_ID), anyLong(), anyLong(), eq(LIVE), any(), any());
	}

	@Test
	public void initialPublishSkipsStagingWhenStillDisabled() throws ServiceLayerException {
		preparePackagePublish(PublishPackage.PackageType.INITIAL_PUBLISH, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(false);
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);

		verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(true), eq(LIVE));
		verify(publisher, never()).runTargetPublisher(any(), any(), any(), eq(false), eq(STAGING));
		verify(generalLockService).unlock(getPublishedRepoLockKey(SITE_ID));
		verify(generalLockService).unlock(getEnableStagingLockKey(SITE_ID));
		verify(itemTargetDAO, never()).insertForInitialPublish(anyLong(), anyLong(), anyLong(), eq(STAGING), any(), any());
		verify(itemTargetDAO).insertForInitialPublish(eq(SITE_NUMERIC_ID), anyLong(), anyLong(), eq(LIVE), any(), any());
	}

	@Test
	public void livePublishWithStagingEnabledDoesNotTakeEnableLock() throws ServiceLayerException {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);

		InOrder inOrder = inOrder(generalLockService, publisher);
		inOrder.verify(generalLockService).lock(getPublishedRepoLockKey(SITE_ID));
		inOrder.verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(false), eq(STAGING));
		inOrder.verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(true), eq(LIVE));
		inOrder.verify(generalLockService).unlock(getPublishedRepoLockKey(SITE_ID));
		verify(generalLockService, never()).lock(getEnableStagingLockKey(SITE_ID));
		verify(deployer, never()).createStagingTarget(SITE_ID);
	}

	@Test
	public void stagingPublishCreatesDeployerTargetAfterBranchExists() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, STAGING)).thenReturn(true);
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);

		InOrder inOrder = inOrder(generalLockService, deployer);
		inOrder.verify(generalLockService).unlock(getPublishedRepoLockKey(SITE_ID));
		inOrder.verify(deployer).createStagingTarget(SITE_ID);
	}

	@Test
	public void stagingPublishSkipsDeployerTargetAfterItIsEnsured() throws Exception {
		prepareStagingDeployerTarget();
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);
		publisher.doPublish(publishPackage);

		verify(deployer, times(1)).createStagingTarget(SITE_ID);
	}

	@Test
	public void siteDeletionClearsEnsuredStagingDeployerTarget() throws Exception {
		prepareStagingDeployerTarget();
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);
		publisher.onSiteDeleting(new SiteDeletingEvent(SITE_ID, "site-uuid"));
		publisher.doPublish(publishPackage);

		verify(deployer, times(2)).createStagingTarget(SITE_ID);
	}

	@Test
	public void stagingPublishRetriesDeployerTargetUntilItSucceeds() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.INITIAL_PUBLISH, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, STAGING)).thenReturn(true);
		doThrow(new RestClientException("deployer down")).doReturn(true).when(deployer).createStagingTarget(SITE_ID);
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);
		publisher.doPublish(publishPackage);

		verify(deployer, times(2)).createStagingTarget(SITE_ID);
		verify(publishDAO, atLeastOnce()).updatePackage(publishPackage);
	}

	@Test
	public void stagingPublishSkipsDeployerTargetUntilBranchExists() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.INITIAL_PUBLISH, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(false);
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);

		verify(deployer, never()).createStagingTarget(any());
		verify(contentRepository, never()).isTargetPublished(any(), any());
	}

	@Test
	public void stagingPublishCopiesLiveBlobsBeforeTheStagingDelta() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		when(site2.isStagingBlobsCopied()).thenReturn(false);
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, STAGING)).thenReturn(true);
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);

		InOrder inOrder = inOrder(generalLockService, contentRepository, siteDAO, publisher);
		inOrder.verify(generalLockService).lock(getPublishedRepoLockKey(SITE_ID));
		inOrder.verify(contentRepository).copyBlobs(SITE_ID, LIVE, STAGING, STAGING);
		inOrder.verify(siteDAO).setStagingBlobsCopied(SITE_ID, true);
		inOrder.verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(false), eq(STAGING));
		inOrder.verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(true), eq(LIVE));
	}

	@Test
	public void blobCopyFailurePublishesNothingAndFailsBothTargets() throws Exception {
		prepareFailedBaselineCopy(LIVE);
		doThrow(new ServiceLayerException("blob copy failed")).when(contentRepository)
			.copyBlobs(SITE_ID, LIVE, STAGING, STAGING);
		long[] packageState = trackPackageState();
		long[] itemState = trackItemState();

		publisher.doPublish(publishPackage);

		assertFailedUnpublishedPackage(packageState, itemState, true);
		verify(siteDAO, never()).setStagingBlobsCopied(SITE_ID, true);
	}

	@Test
	public void blobCopySucceedsOnTheNextPackageAndPublishesBothTargets() throws Exception {
		prepareFailedBaselineCopy(LIVE);
		doThrow(new ServiceLayerException("blob copy failed")).doNothing().when(contentRepository)
			.copyBlobs(SITE_ID, LIVE, STAGING, STAGING);
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);
		verify(publisher, never()).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);

		verify(contentRepository, times(2)).copyBlobs(SITE_ID, LIVE, STAGING, STAGING);
		InOrder inOrder = inOrder(siteDAO, publisher);
		inOrder.verify(siteDAO).setStagingBlobsCopied(SITE_ID, true);
		inOrder.verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(false), eq(STAGING));
		inOrder.verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(true), eq(LIVE));
	}

	@Test
	public void partialBlobCopyFailurePublishesNothingAndLeavesTheFlagFalse() throws Exception {
		prepareFailedBaselineCopy(LIVE);
		doThrow(new ServiceLayerException("partial copy failed")).when(contentRepository)
			.copyBlobs(SITE_ID, LIVE, STAGING, STAGING);
		long[] packageState = trackPackageState();
		long[] itemState = trackItemState();

		publisher.doPublish(publishPackage);

		assertFailedUnpublishedPackage(packageState, itemState, true);
		verify(siteDAO, never()).setStagingBlobsCopied(anyString(), anyBoolean());
	}

	@Test
	public void liveDeletePublishesNothingWhileTheBlobCopyIsFailing() throws Exception {
		prepareFailedBaselineCopy(LIVE);
		when(publishDAO.getPublishItems(SITE_ID, PACKAGE_ID)).thenReturn(List.of(publishItem(PublishItem.Action.DELETE, "/static-assets/blob.png")));
		doThrow(new ServiceLayerException("blob copy failed")).when(contentRepository)
			.copyBlobs(SITE_ID, LIVE, STAGING, STAGING);

		publisher.doPublish(publishPackage);

		verify(publisher, never()).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());
		verify(contentRepository, never()).publish(any(), any(), any());
		verify(siteDAO, never()).setStagingBlobsCopied(SITE_ID, true);
	}

	@Test
	public void blobCopyFailureDoesNotPublishAStagingTargetPackage() throws Exception {
		prepareFailedBaselineCopy(STAGING);
		doThrow(new ServiceLayerException("blob copy failed")).when(contentRepository)
			.copyBlobs(SITE_ID, LIVE, STAGING, STAGING);
		long[] packageState = trackPackageState();
		long[] itemState = trackItemState();

		publisher.doPublish(publishPackage);

		assertFailedUnpublishedPackage(packageState, itemState, false);
	}

	@Test
	public void failedTargetDoesNotSaveItsPublishedCommitId() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		trackPackageState();
		String[] liveCommitId = trackLiveCommitId();
		List<String> savedLiveCommitIds = new java.util.ArrayList<>();
		doAnswer(invocation -> {
			savedLiveCommitIds.add(liveCommitId[0]);
			return null;
		}).when(publishDAO).updatePackage(publishPackage);

		publisher.runTargetPublisher(publishPackage, emptyList(),
			(packageTO, target, items) -> {
				packageTO.setPublishedCommitId("live-commit");
				throw new IOException("git failed");
			}, true, LIVE);

		assertEquals(java.util.Collections.singletonList(null), savedLiveCommitIds);
	}

	@Test
	public void rolledBackPackageIsSavedAsFailedWithoutThePublishedCommitIdOfAFinishedTarget() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		long[] packageState = trackPackageState();
		String[] stagingCommitId = trackStagingCommitId();
		List<String> savedStagingCommitIds = new java.util.ArrayList<>();
		List<Long> savedStates = new java.util.ArrayList<>();
		doAnswer(invocation -> {
			savedStagingCommitIds.add(stagingCommitId[0]);
			savedStates.add(packageState[0]);
			return null;
		}).when(publishDAO).updatePackage(publishPackage);
		doAnswer(invocation -> {
			// The staging target finished and set its commit id, but its changes are rolled back with the package
			new PublishPackageTO(publishPackage, false).setPublishedCommitId("staging-commit");
			packageState[0] |= STAGING_SUCCESS.value;
			return null;
		}).doThrow(new SiteNotFoundException(SITE_ID)).when(publisher)
			.runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		assertThrows(SiteNotFoundException.class, () -> publisher.doPublish(publishPackage));

		verify(transactionStatus).setRollbackOnly();
		// The last save is the failed package, saved in a new transaction
		assertEquals(COMPLETED.value | STAGING_FAILED.value | LIVE_FAILED.value, (long) savedStates.get(savedStates.size() - 1));
		assertNull(savedStagingCommitIds.get(savedStagingCommitIds.size() - 1));
	}

	@Test
	public void initialPublishFailedItemsAreInsertedInABatchBeforeTheyAreRead() throws Exception {
		PublishDAO batchPublishDao = prepareInitialPublishWithFailedItem();
		when(batchSqlSessionTemplate.flushStatements()).thenReturn(emptyList());

		publisher.doPublish(publishPackage);

		InOrder inOrder = inOrder(batchPublishDao, batchSqlSessionTemplate, itemTargetDAO, publishDAO, transactionManager);
		inOrder.verify(batchPublishDao).insertInitialPublishItems(eq(PACKAGE_ID), argThat(items -> items.size() == 1));
		inOrder.verify(batchSqlSessionTemplate).flushStatements();
		inOrder.verify(itemTargetDAO).insertForInitialPublish(eq(SITE_NUMERIC_ID), anyLong(), anyLong(), eq(LIVE), any(), any());
		inOrder.verify(publishDAO).updatePackage(publishPackage);
		inOrder.verify(transactionManager).commit(transactionStatus);
		verify(publishDAO, never()).insertInitialPublishItems(anyLong(), any());
		verify(transactionStatus, never()).setRollbackOnly();
	}

	@Test
	public void initialPublishBatchFlushFailureRollsBackAndCompletesThePackageAsFailed() throws Exception {
		prepareInitialPublishWithFailedItem();
		when(batchSqlSessionTemplate.flushStatements()).thenThrow(new DataIntegrityViolationException("insert failed"));
		long[] packageState = trackPackageState();

		assertThrows(DataIntegrityViolationException.class, () -> publisher.doPublish(publishPackage));

		assertBatchInsertRolledBack(packageState);
	}

	@Test
	public void initialPublishBatchWithAFailedInsertRollsBackAndCompletesThePackageAsFailed() throws Exception {
		prepareInitialPublishWithFailedItem();
		BatchResult result = new BatchResult(null, "INSERT INTO publish_item");
		result.setUpdateCounts(new int[] {1, Statement.EXECUTE_FAILED});
		when(batchSqlSessionTemplate.flushStatements()).thenReturn(List.of(result));
		long[] packageState = trackPackageState();

		assertThrows(DataIntegrityViolationException.class, () -> publisher.doPublish(publishPackage));

		assertBatchInsertRolledBack(packageState);
	}

	private void assertBatchInsertRolledBack(long[] packageState) {
		verify(transactionStatus).setRollbackOnly();
		verify(itemTargetDAO, never()).insertForInitialPublish(anyLong(), anyLong(), anyLong(), anyString(), any(), any());
		assertEquals(COMPLETED.value | LIVE_FAILED.value, packageState[0]);
		// Without a transaction synchronization, the error event of the failed item is published too
		verify(eventPublisher, atLeastOnce()).publishEvent((Object) isA(PublishErrorEvent.class));
	}

	private PublishDAO prepareInitialPublishWithFailedItem() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.INITIAL_PUBLISH, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(false);
		PublishItemTO failedItem = mock(PublishItemTO.class);
		when(failedItem.getPath()).thenReturn("/site/website/index.xml");
		GitPublishChangeSet<PublishItemTO> changeSet = new GitPublishChangeSet<>("initial-commit", emptyList(), List.of(failedItem));
		doReturn(changeSet).when(contentRepository).initialPublish(publishPackage, LIVE);
		PublishDAO batchPublishDao = mock(PublishDAO.class);
		when(batchSqlSessionTemplate.getMapper(PublishDAO.class)).thenReturn(batchPublishDao);
		return batchPublishDao;
	}

	private String[] trackLiveCommitId() {
		String[] commitId = {null};
		lenient().when(publishPackage.getPublishedLiveCommitId()).thenAnswer(invocation -> commitId[0]);
		doAnswer(invocation -> {
			commitId[0] = invocation.getArgument(0);
			return null;
		}).when(publishPackage).setPublishedLiveCommitId(any());
		return commitId;
	}

	private String[] trackStagingCommitId() {
		String[] commitId = {null};
		lenient().when(publishPackage.getPublishedStagingCommitId()).thenAnswer(invocation -> commitId[0]);
		doAnswer(invocation -> {
			commitId[0] = invocation.getArgument(0);
			return null;
		}).when(publishPackage).setPublishedStagingCommitId(any());
		return commitId;
	}

	private void prepareFailedBaselineCopy(String target) throws Exception {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, target);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		when(site2.isStagingBlobsCopied()).thenReturn(false);
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, STAGING)).thenReturn(true);
	}

	private void assertFailedUnpublishedPackage(long[] packageState, long[] itemState, boolean liveTarget) throws Exception {
		long failedBits = liveTarget ? STAGING_FAILED.value | LIVE_FAILED.value : STAGING_FAILED.value;
		assertEquals(COMPLETED.value | failedBits, packageState[0]);
		assertTrue(STAGING_FAILED.matches(packageState[0]));
		assertEquals(liveTarget, LIVE_FAILED.matches(packageState[0]));
		assertFalse(PROCESSING.matches(packageState[0]));
		assertFalse(LIVE_SUCCESS.matches(packageState[0]));
		long itemFailedBits = liveTarget
			? PublishItem.PublishState.STAGING_FAILED.value | PublishItem.PublishState.LIVE_FAILED.value
			: PublishItem.PublishState.STAGING_FAILED.value;
		assertEquals(itemFailedBits, itemState[0]);
		assertEquals(0, itemState[0] & PublishItem.PublishState.PROCESSING.value);
		assertEquals(0, itemState[0] & PublishItem.PublishState.LIVE_SUCCESS.value);
		verify(publishPackage).setPublishedOn(any());
		verify(publishPackage).setStagingError(ApiResponse.INTERNAL_SYSTEM_FAILURE.getCode());
		if (liveTarget) {
			verify(publishPackage).setLiveError(ApiResponse.INTERNAL_SYSTEM_FAILURE.getCode());
		} else {
			verify(publishPackage, never()).setLiveError(anyInt());
		}
		verify(publisher, never()).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());
		verify(contentRepository, never()).publish(any(), any(), any());
	}

	private long[] trackItemState() {
		long[] itemState = {0};
		doAnswer(invocation -> {
			long onBits = invocation.getArgument(1);
			long offBits = invocation.getArgument(2);
			itemState[0] = (itemState[0] | onBits) & ~offBits;
			return null;
		}).when(publishDAO).updatePublishItemsState(eq(PACKAGE_ID), anyLong(), anyLong());
		return itemState;
	}

	private long[] trackPackageState() {
		long[] packageState = {0};
		when(publishPackage.getPackageState()).thenAnswer(invocation -> packageState[0]);
		doAnswer(invocation -> {
			long onBits = invocation.getArgument(0);
			long offBits = invocation.getArgument(1);
			packageState[0] = (packageState[0] | onBits) & ~offBits;
			return null;
		}).when(publishPackage).updatePackageState(anyLong(), anyLong());
		return packageState;
	}

	private static PublishItem publishItem(PublishItem.Action action, String path) {
		PublishItem item = new PublishItem();
		item.setAction(action);
		item.setPath(path);
		item.setPackageId(PACKAGE_ID);
		return item;
	}

	@Test
	public void blobCopyFailureRecordingRollsBackAndCompletesALivePackageAsFailed() throws Exception {
		assertBlobCopyFailureIsCompletedWhenRecordingFails(LIVE, true);
	}

	@Test
	public void blobCopyFailureRecordingRollsBackAndCompletesAStagingPackageAsFailed() throws Exception {
		assertBlobCopyFailureIsCompletedWhenRecordingFails(STAGING, false);
	}

	private void assertBlobCopyFailureIsCompletedWhenRecordingFails(String target, boolean liveTarget) throws Exception {
		prepareFailedBaselineCopy(target);
		doThrow(new ServiceLayerException("blob copy failed")).when(contentRepository)
			.copyBlobs(SITE_ID, LIVE, STAGING, STAGING);
		doNothing().doThrow(new RuntimeException("dao down")).doNothing()
			.when(publishDAO).updatePackage(publishPackage);
		long[] packageState = trackPackageState();
		long[] itemState = trackItemState();

		assertThrows(RuntimeException.class, () -> publisher.doPublish(publishPackage));

		// The package transaction was rolled back, and the package was completed as failed in a new one
		verify(transactionStatus).setRollbackOnly();
		assertFailedUnpublishedPackage(packageState, itemState, liveTarget);
		verify(eventPublisher).publishEvent((Object) isA(PublishErrorEvent.class));
	}

	@Test
	public void packageThatCannotBeSavedAsFailedDoesNotHideTheOriginalFailure() throws Exception {
		prepareFailedBaselineCopy(LIVE);
		doThrow(new ServiceLayerException("blob copy failed")).when(contentRepository)
			.copyBlobs(SITE_ID, LIVE, STAGING, STAGING);
		doNothing().doThrow(new RuntimeException("dao down")).doThrow(new RuntimeException("dao still down"))
			.when(publishDAO).updatePackage(publishPackage);

		RuntimeException thrown = assertThrows(RuntimeException.class, () -> publisher.doPublish(publishPackage));

		assertEquals("dao down", thrown.getMessage());
		assertEquals(1, thrown.getSuppressed().length);
		assertEquals("dao still down", thrown.getSuppressed()[0].getMessage());
	}

	@Test
	public void unexpectedFailureRollsBackAndCompletesTheLivePackageAsFailed() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		doThrow(new SiteNotFoundException(SITE_ID)).when(publisher)
			.runTargetPublisher(any(), any(), any(), eq(false), eq(STAGING));
		long[] packageState = trackPackageState();
		long[] itemState = trackItemState();

		assertThrows(SiteNotFoundException.class, () -> publisher.doPublish(publishPackage));

		verify(transactionStatus).setRollbackOnly();
		assertEquals(COMPLETED.value | STAGING_FAILED.value | LIVE_FAILED.value, packageState[0]);
		assertEquals(PublishItem.PublishState.STAGING_FAILED.value | PublishItem.PublishState.LIVE_FAILED.value, itemState[0]);
		verify(publishPackage).setPublishedOn(any());
		verify(generalLockService).unlock(getPublishedRepoLockKey(SITE_ID));
		verify(eventPublisher).publishEvent((Object) isA(PublishErrorEvent.class));
	}

	@Test
	public void unexpectedFailureReplacesTheOutcomeOfATargetThatHadFinished() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		long[] packageState = trackPackageState();
		doAnswer(invocation -> {
			// The staging target finished, but its changes are rolled back with the rest of the transaction
			packageState[0] |= STAGING_SUCCESS.value;
			return null;
		}).doThrow(new SiteNotFoundException(SITE_ID)).when(publisher)
			.runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		assertThrows(SiteNotFoundException.class, () -> publisher.doPublish(publishPackage));

		assertEquals(COMPLETED.value | STAGING_FAILED.value | LIVE_FAILED.value, packageState[0]);
		assertFalse(STAGING_SUCCESS.matches(packageState[0]));
	}

	@Test
	public void failedTargetRollsBackToItsSavepointAndIsRecorded() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		long[] packageState = trackPackageState();
		// The target set its outcome before it failed
		packageState[0] = LIVE_SUCCESS.value;

		publisher.runTargetPublisher(publishPackage, emptyList(),
			(packageTO, target, items) -> {
				throw new IOException("git failed");
			}, true, LIVE);

		ArgumentCaptor<TransactionDefinition> definition = ArgumentCaptor.forClass(TransactionDefinition.class);
		verify(transactionManager).getTransaction(definition.capture());
		assertEquals(TransactionDefinition.PROPAGATION_NESTED, definition.getValue().getPropagationBehavior());
		verify(transactionStatus).setRollbackOnly();
		assertEquals(LIVE_FAILED.value, packageState[0]);
		verify(publishPackage).setLiveError(ApiResponse.INTERNAL_SYSTEM_FAILURE.getCode());
		verify(publishDAO).updatePublishItemsState(PACKAGE_ID, PublishItem.PublishState.LIVE_FAILED.value, 0);
		verify(publishDAO).updateItemStatesForCompletePackage(eq(PACKAGE_ID), anyLong(), anyLong(), anyLong(), anyLong(), eq(LIVE));
	}

	@Test
	public void packageTransactionCommitsBeforeThePublishedRepoLockIsReleased() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);

		InOrder inOrder = inOrder(generalLockService, transactionManager);
		inOrder.verify(generalLockService).lock(getPublishedRepoLockKey(SITE_ID));
		inOrder.verify(transactionManager).commit(transactionStatus);
		inOrder.verify(generalLockService).unlock(getPublishedRepoLockKey(SITE_ID));
		verify(transactionStatus, never()).setRollbackOnly();
	}

	@Test
	public void packageTransactionCommitsBeforeTheEnableStagingLockIsReleased() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(false);
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);

		InOrder inOrder = inOrder(generalLockService, transactionManager);
		inOrder.verify(generalLockService).lock(getEnableStagingLockKey(SITE_ID));
		inOrder.verify(transactionManager).commit(transactionStatus);
		inOrder.verify(generalLockService).unlock(getEnableStagingLockKey(SITE_ID));
	}

	@Test
	public void initialPublishFailureWhenStagingAlreadyEnabledReleasesPublishedRepoLock() throws ServiceLayerException {
		preparePackagePublish(PublishPackage.PackageType.INITIAL_PUBLISH, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		doThrow(new SiteNotFoundException(SITE_ID)).when(publisher)
			.runTargetPublisher(any(), any(), any(), eq(false), eq(STAGING));

		assertThrows(SiteNotFoundException.class, () -> publisher.doPublish(publishPackage));

		verify(generalLockService, never()).lock(getEnableStagingLockKey(SITE_ID));
		verify(generalLockService).unlock(getPublishedRepoLockKey(SITE_ID));
		verify(publisher, never()).runTargetPublisher(any(), any(), any(), eq(true), eq(LIVE));
	}

	@Test
	public void stagingTargetPublishTakesPublishedRepoLock() throws ServiceLayerException {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		doNothing().when(publisher).runTargetPublisher(any(), any(), any(), anyBoolean(), anyString());

		publisher.doPublish(publishPackage);

		verify(publisher).runTargetPublisher(eq(publishPackage), eq(emptyList()), any(), eq(false), eq(STAGING));
		verify(publisher, never()).runTargetPublisher(any(), any(), any(), eq(true), eq(LIVE));
		verify(generalLockService).lock(getPublishedRepoLockKey(SITE_ID));
		verify(generalLockService).unlock(getPublishedRepoLockKey(SITE_ID));
		verify(generalLockService, never()).lock(getEnableStagingLockKey(SITE_ID));
	}

	@Test
	public void livePublishFailureWhenStagingAlreadyEnabledReleasesPublishedRepoLock() throws ServiceLayerException {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		doThrow(new SiteNotFoundException(SITE_ID)).when(publisher)
			.runTargetPublisher(any(), any(), any(), eq(false), eq(STAGING));

		assertThrows(SiteNotFoundException.class, () -> publisher.doPublish(publishPackage));

		verify(publisher, never()).runTargetPublisher(any(), any(), any(), eq(true), eq(LIVE));
		verify(generalLockService, never()).lock(getEnableStagingLockKey(SITE_ID));
		verify(generalLockService).unlock(getPublishedRepoLockKey(SITE_ID));
	}

	private void prepareStagingDeployerTarget() throws Exception {
		preparePackagePublish(PublishPackage.PackageType.ITEM_LIST, LIVE);
		when(servicesConfig.getStagingEnvironment(SITE_ID)).thenReturn(STAGING);
		when(servicesConfig.isStagingEnvironmentEnabled(SITE_ID)).thenReturn(true);
		when(contentRepository.publishedRepositoryExists(SITE_ID)).thenReturn(true);
		when(contentRepository.isTargetPublished(SITE_ID, STAGING)).thenReturn(true);
	}

	private void preparePackagePublish(PublishPackage.PackageType packageType, String target) throws SiteNotFoundException {
		when(publishPackage.getId()).thenReturn(PACKAGE_ID);
		when(publishPackage.getPackageType()).thenReturn(packageType);
		when(publishPackage.getTarget()).thenReturn(target);
		when(publishDAO.getPublishItems(SITE_ID, PACKAGE_ID)).thenReturn(emptyList());
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn(LIVE);
		doNothing().when(publisher).auditPublishOperation(any(), any());
	}
}
