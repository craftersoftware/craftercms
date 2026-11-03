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
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.event.publish.RequestPublishEvent;
import org.craftercms.studio.api.v2.service.audit.ActivityStreamService;
import org.craftercms.studio.api.v2.task.TaskManager;
import org.craftercms.studio.api.v2.task.TaskProgress;
import org.craftercms.studio.api.v2.utils.StudioUtils;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.context.ApplicationEventPublisher;

import static java.util.Collections.emptyList;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_PUBLISH_START;
import static org.craftercms.studio.api.v2.dal.Site.State.READY;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getEnableStagingLockKey;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getPublishedRepoLockKey;
import static org.junit.Assert.assertThrows;
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
	TaskManager taskManager;

	@Mock
	ActivityStreamService activityService;

	@Mock
	ApplicationEventPublisher eventPublisher;

	@Spy
	@InjectMocks
	Publisher publisher;

	@Before
	public void setUp() {
		when(disabledSite.getPublishingEnabled()).thenReturn(false);

		when(site2.getPublishingEnabled()).thenReturn(true);
		when(site2.getSiteId()).thenReturn(SITE_ID);
		when(site2.getId()).thenReturn(SITE_NUMERIC_ID);

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

	private void preparePackagePublish(PublishPackage.PackageType packageType, String target) throws SiteNotFoundException {
		when(publishPackage.getId()).thenReturn(PACKAGE_ID);
		when(publishPackage.getPackageType()).thenReturn(packageType);
		when(publishPackage.getTarget()).thenReturn(target);
		when(publishDAO.getPublishItems(SITE_ID, PACKAGE_ID)).thenReturn(emptyList());
		when(servicesConfig.getLiveEnvironment(SITE_ID)).thenReturn(LIVE);
		doNothing().when(publisher).auditPublishOperation(any(), any());
	}
}
