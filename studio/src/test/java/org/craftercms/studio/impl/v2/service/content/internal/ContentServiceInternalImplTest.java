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

package org.craftercms.studio.impl.v2.service.content.internal;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import static java.util.Collections.emptyList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.apache.commons.io.IOUtils.toInputStream;
import static org.apache.commons.lang3.exception.ExceptionUtils.throwableOfType;
import org.craftercms.commons.entitlements.exception.EntitlementException;
import org.craftercms.commons.entitlements.model.EntitlementType;
import org.craftercms.commons.entitlements.validator.EntitlementValidator;
import org.craftercms.commons.security.exception.ActionDeniedException;
import org.craftercms.commons.security.permissions.PermissionEvaluator;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_FOLDER;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v2.content.ContentLifecycle;
import org.craftercms.studio.api.v2.content.LifecycleContent;
import org.craftercms.studio.api.v2.content.LifecycleContent.ContentLifecycleItem;
import static org.craftercms.studio.api.v2.content.LifecycleContent.LifecycleOperation.DUPLICATE;
import static org.craftercms.studio.api.v2.content.LifecycleContent.LifecycleOperation.NEW;
import static org.craftercms.studio.api.v2.content.LifecycleContent.LifecycleOperation.UPDATE;
import org.craftercms.studio.api.v2.dal.Item;
import org.craftercms.studio.api.v2.dal.ItemDAO;
import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.item.ContentItem;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.exception.content.ContentExistException;
import org.craftercms.studio.api.v2.exception.content.ContentInPublishQueueException;
import org.craftercms.studio.api.v2.repository.GitContentRepository;
import org.craftercms.studio.api.v2.repository.RepositoryItem;
import org.craftercms.studio.api.v2.security.SemanticsAvailableActionsResolver;
import org.craftercms.studio.api.v2.service.audit.ActivityStreamService;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.api.v2.service.content.ContentTypeService;
import org.craftercms.studio.api.v2.service.dependency.DependencyService;
import org.craftercms.studio.api.v2.service.item.ItemService;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.PAGE_NAVIGATION_ORDER_INCREMENT;
import org.craftercms.studio.api.v2.utils.StudioUtils;
import static org.craftercms.studio.api.v2.utils.StudioUtils.createTempFile;
import static org.craftercms.studio.api.v2.utils.StudioUtils.isDescriptor;
import static org.craftercms.studio.api.v2.utils.StudioUtils.isPageDescriptor;
import static org.craftercms.studio.api.v2.utils.StudioUtils.movePath;
import static org.craftercms.studio.api.v2.utils.StudioUtils.underDescriptorRoot;
import static org.craftercms.studio.api.v2.utils.StudioUtils.underPagesRoot;
import org.craftercms.studio.impl.v1.util.ContentUtils;
import static org.craftercms.studio.impl.v1.util.ContentUtils.convertStreamToXml;
import static org.craftercms.studio.impl.v1.util.ContentUtils.getParentUrl;
import org.craftercms.studio.impl.v2.service.content.internal.ContentServiceInternalImpl.PastedPath;
import org.craftercms.studio.impl.v2.utils.db.DBUtils;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.craftercms.studio.model.AuthenticatedUser;
import org.craftercms.studio.model.rest.content.PasteContentResult;
import org.craftercms.studio.model.rest.content.WriteContentResult;
import org.craftercms.studio.model.rest.content.order.ItemOrder;
import org.craftercms.studio.model.rest.content.order.ReorderItemRequest;
import org.dom4j.Document;
import org.dom4j.DocumentException;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.io.Resource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.util.function.ThrowingSupplier;

import static junit.framework.TestCase.assertFalse;
import static junit.framework.TestCase.assertTrue;

@RunWith(MockitoJUnitRunner.class)
public class ContentServiceInternalImplTest {
	private static final String SITE_ID = "sample-site";
	private static final String PATH = "/sample/path";
	private static final String NON_EXIST_CONTENT_PATH = "/sample/non-exists-content-path";

	private static final long SITE_NUMERIC_ID = 1001;
	private static final int PUBLISH_PACKAGE_ID = 101;
	private static final int ORDER_INCREMENT = 10;

	@Mock
	protected GitContentRepository contentRepository;

	@Mock
	protected PermissionEvaluator<String, Object> permissionEvaluator;

	@Mock
	protected PublishService publishService;

	@Mock
	protected AuditService auditService;

	@Mock
	protected ActivityStreamService activityStreamService;

	@Mock
	protected ApplicationEventPublisher applicationEventPublisher;

	@Mock
	protected PlatformTransactionManager transactionManager;

	@Mock
	protected ItemService itemService;

	@Mock
	protected ItemDAO itemDAO;

	@Mock
	protected GeneralLockService generalLockService;

	@Mock
	protected ContentLifecycle contentLifecycle;

	@Mock
	protected RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;

	@Mock
	protected DependencyService dependencyService;

	@Mock
	protected SitesService siteService;

	@Mock
	protected EntitlementValidator entitlementValidator;

	@Mock
	protected StudioConfiguration studioConfiguration;

	@Mock
	protected SemanticsAvailableActionsResolver semanticsAvailableActionsResolver;

	@Mock
	protected ContentTypeService contentTypeService;

	protected ContentServiceInternalImpl serviceInternal;

	private InputStream contentStream;

	@Before
	public void setUp() throws ServiceLayerException {
		when(contentRepository.contentExists(SITE_ID, PATH)).thenReturn(true);
		when(contentRepository.contentExists(SITE_ID, NON_EXIST_CONTENT_PATH)).thenReturn(false);

		doNothing().when(retryingDatabaseOperationFacade).retry(any(Runnable.class));

		Site site = mock(Site.class);
		when(site.getSiteId()).thenReturn(SITE_ID);
		when(site.getId()).thenReturn(SITE_NUMERIC_ID);
		when(siteService.getSite(SITE_ID)).thenReturn(site);

		contentStream = new ByteArrayInputStream("test content".getBytes());

		doReturn(ORDER_INCREMENT).when(studioConfiguration).getProperty(eq(PAGE_NAVIGATION_ORDER_INCREMENT), eq(Integer.class), any());

		doNothing().when(contentLifecycle).execute(any(), any(), any());

		serviceInternal = spy(new ContentServiceInternalImpl(transactionManager,
				studioConfiguration,
				siteService,
				retryingDatabaseOperationFacade,
				publishService,
				permissionEvaluator,
				itemService,
				itemDAO,
				generalLockService,
				dependencyService,
				contentRepository,
				contentLifecycle,
				auditService,
				contentLifecycle,
				null,
				activityStreamService,
				entitlementValidator,
				null,
				contentTypeService
		));
		serviceInternal.setSemanticsAvailableActionsResolver(semanticsAvailableActionsResolver);
		serviceInternal.setApplicationEventPublisher(applicationEventPublisher);
	}

	@Test
	public void testContentExits() {
		boolean result = serviceInternal.contentExists(SITE_ID, PATH);
		verify(contentRepository, times(1)).contentExists(SITE_ID, PATH);
		assertTrue(result);
	}

	@Test
	public void testPathNonExist() {
		boolean result = serviceInternal.contentExists(SITE_ID, NON_EXIST_CONTENT_PATH);
		verify(contentRepository, times(1)).contentExists(SITE_ID, NON_EXIST_CONTENT_PATH);
		assertFalse(result);
	}

	private void assertCreationPathComparatorMatches(List<String> paths, List<String> expected) {
		paths.sort(serviceInternal.creationPathComparator());

		assertEquals(expected.size(), paths.size());
		for (int i = 0; i < expected.size(); i++) {
			assertEquals(expected.get(i), paths.get(i));
		}
	}

	@Test
	public void testPathCreationOrder() {
		// Parent folders should go before children
		// XXX/index.xml should go before other XXX/yyyy items
		List<String> paths = new ArrayList<>(List.of("/a/b/c", "/a/b", "/a/b/index.xml", "/a", "/a/index.xml"));
		List<String> expected = List.of("/a", "/a/index.xml", "/a/b", "/a/b/index.xml", "/a/b/c");

		assertCreationPathComparatorMatches(paths, expected);
	}

	@Test
	public void testPathCreationOrder2() {
		// Parent folders should go before children
		// XXX/index.xml should go before other XXX/yyyy items
		List<String> paths = new ArrayList<>(List.of(
				"/site/website/en/articles/new-cms/features/index.xml",
				"/site/website/en/articles/new-cms/features/",
				"/site/website/en/index.xml",
				"/site/website/en/news/archive/new-release/index.xml",
				"/site/website/en/news/archive/new-release",
				"/site/website/en/news/archive/",
				"/site/website/en/news",
				"/site/website/en",
				"/site/website/en/articles/new-cms/index.xml",
				"/site/website/en/articles",
				"/site/website/en/articles/new-cms"));

		List<String> expected = List.of(
				"/site/website/en",
				"/site/website/en/index.xml",
				"/site/website/en/news",
				"/site/website/en/articles",
				"/site/website/en/news/archive/",
				"/site/website/en/articles/new-cms",
				"/site/website/en/articles/new-cms/index.xml",
				"/site/website/en/news/archive/new-release",
				"/site/website/en/news/archive/new-release/index.xml",
				"/site/website/en/articles/new-cms/features/",
				"/site/website/en/articles/new-cms/features/index.xml");

		assertCreationPathComparatorMatches(paths, expected);
	}


	@Test
	public void testWriteSuccess() throws Exception {
		// Mock lifecycle content
		LifecycleContent lifecycleContent = mock(LifecycleContent.class);
		ContentLifecycleItem item = mock(ContentLifecycleItem.class);
		when(item.repoPath()).thenReturn(PATH);
		when(lifecycleContent.getItems()).thenReturn(Map.of(PATH, item));
		when(lifecycleContent.getRepoPath()).thenReturn(PATH);
		when(lifecycleContent.getOperation()).thenReturn(UPDATE);
		when(permissionEvaluator.isAllowed(any(), any(), any())).thenReturn(true);

		// Mock repository behavior
		when(contentRepository.writeContent(eq(SITE_ID), anyCollection(), anySet(), nullable(String.class))).thenReturn("commit-id");

		// Mock lifecycle execution
		doReturn(lifecycleContent).when(serviceInternal).runLifecycle(eq(SITE_ID), any(), eq(PATH), any(), any(), any());

		runInMockStatics(() -> {
			WriteContentResult result = serviceInternal.write(SITE_ID, PATH, contentStream, null);

			// Verify behavior
			assertNotNull(result);
			assertEquals(1, result.getItems().size());
		});
		verify(contentRepository, times(1)).writeContent(eq(SITE_ID), anyCollection(), anySet(), nullable(String.class));
	}

	@Test(expected = ServiceLayerException.class)
	public void testWriteEmptyLifecycleResults() throws Exception {
		// Mock lifecycle content with empty results
		LifecycleContent lifecycleContent = mock(LifecycleContent.class);
		when(lifecycleContent.getItems()).thenReturn(Collections.emptyMap());
		doReturn(lifecycleContent).when(serviceInternal).runLifecycle(eq(SITE_ID), any(), eq(PATH), any(), any(), any());

		// Call the method
		serviceInternal.write(SITE_ID, PATH, contentStream, null);
	}

	@Test(expected = ContentInPublishQueueException.class)
	public void testWriteItemInPublishQueue() throws Exception {
		// Mock lifecycle content
		LifecycleContent lifecycleContent = mock(LifecycleContent.class);
		ContentLifecycleItem item = mock(ContentLifecycleItem.class);
		when(lifecycleContent.getItems()).thenReturn(Map.of(PATH, item));
		when(permissionEvaluator.isAllowed(any(), any(), any())).thenReturn(true);

		PublishPackage publishPackage = new PublishPackage();
		publishPackage.setId(PUBLISH_PACKAGE_ID);
		when(publishService.getActivePackagesForItems(any(), anyList(), anyBoolean()))
				.thenReturn(List.of(publishPackage));

		// Mock lifecycle execution
		doReturn(lifecycleContent).when(serviceInternal).runLifecycle(eq(SITE_ID), any(), eq(PATH), any(), any(), any());

		// Call the method
		serviceInternal.write(SITE_ID, PATH, contentStream, null);
	}

	@Test(expected = ActionDeniedException.class)
	public void testWritePermissionDenied() throws Exception {
		// Mock lifecycle content
		LifecycleContent lifecycleContent = mock(LifecycleContent.class);
		ContentLifecycleItem item = mock(ContentLifecycleItem.class);
		when(lifecycleContent.getItems()).thenReturn(Map.of(PATH, item));
		when(permissionEvaluator.isAllowed(any(), any(), any())).thenReturn(false);

		// Mock lifecycle execution
		doReturn(lifecycleContent).when(serviceInternal).runLifecycle(eq(SITE_ID), any(), eq(PATH), any(), any(), any());

		// Call the method
		serviceInternal.write(SITE_ID, PATH, contentStream, null);
	}

	@Test
	public void testGetMissingFolders() {
		Map<String, LifecycleContent.LifecycleOperation> operationsByPath = Map.of(
				"/a/b/c/d", NEW
		);

		// Mock content existence
		when(contentRepository.contentExists(SITE_ID, "/a")).thenReturn(true);
		when(contentRepository.contentExists(SITE_ID, "/a/b")).thenReturn(false);
		when(contentRepository.contentExists(SITE_ID, "/a/b/c")).thenReturn(false);

		// Call the method
		Set<String> missingFolders = serviceInternal.getMissingFolders(SITE_ID, operationsByPath);

		// Verify the result
		assertEquals(Set.of("/a/b", "/a/b/c"), missingFolders);
	}

	@Test
	public void testMovePageSuccess() throws Exception {
		// Mock content existence
		String sourcePath = "/site/website/test1/index.xml";
		String targetPath = "/site/website/test2/index.xml";
		String sourceFolder = "/site/website/test1";
		String targetFolder = "/site/website/test2";
		String commitId = "COMMIT 123";
		List<String> children = List.of(
				"/site/website/test1/index.xml",
				"/site/website/test1/child1/index.xml",
				"/site/website/test1/child2/index.xml");

		when(contentRepository.contentExists(SITE_ID, sourcePath)).thenReturn(true);
		when(contentRepository.contentExists(SITE_ID, sourceFolder)).thenReturn(true);
		when(contentRepository.contentExists(SITE_ID, targetPath)).thenReturn(false);
		when(contentRepository.contentExists(SITE_ID, "/site/website")).thenReturn(true);
		when(contentRepository.isFolder(SITE_ID, "/site/website/test1")).thenReturn(true);

		when(itemDAO.getChildrenPaths(SITE_NUMERIC_ID, sourceFolder)).thenReturn(children);
		when(itemDAO.getContentItemByPathPreferContent(SITE_NUMERIC_ID,sourceFolder)).thenReturn(mock(ContentItem.class));

		Item sourceItem = mock(Item.class);
		when(sourceItem.getSystemType()).thenReturn(CONTENT_TYPE_FOLDER);
		when(itemService.getItem(SITE_ID, sourceFolder, true)).thenReturn(sourceItem);
		when(itemService.getItem(SITE_ID, "/site/website", true)).thenReturn(mock(Item.class));

		when(itemService.getItem(SITE_ID, "/site/website/test2", true)).thenReturn(mock(Item.class));

		when(permissionEvaluator.isAllowed(any(), any(), any())).thenReturn(true);

		when(contentRepository.moveContent(any(), any(), any(), any(), any())).thenReturn(commitId);

		doAnswer(a -> {
			String path = a.getArgument(2);
			ContentLifecycleItem item = mock(ContentLifecycleItem.class);
			when(item.repoPath()).thenReturn(path);
			LifecycleContent lifecycleContent = mock(LifecycleContent.class);
			when(lifecycleContent.getItems()).thenReturn(Map.of(path, item));
			return lifecycleContent;
		}).when(serviceInternal).runLifecycle(
				anyString(), anyString(), anyString(), any(), any(), any()
		);

		WriteContentResult moveResult;
		try (MockedStatic<DBUtils> dbUtilsMock = mockStatic(DBUtils.class);
			 MockedStatic<ContentUtils> contentUtilsMock = mockStatic(ContentUtils.class);
			 MockedStatic<SecurityUtils> secUtilsMock = mockStatic(SecurityUtils.class);
			 MockedStatic<StudioUtils> studioUtilsMock = mockStatic(StudioUtils.class)) {
			dbUtilsMock.when(() -> DBUtils.runInTransaction(
					any(PlatformTransactionManager.class),
					anyString(),
					any(),
					any(ThrowingSupplier.class)
			)).thenAnswer(invocation -> {
				// Simulate transaction behavior
				ThrowingSupplier<String> supplier = invocation.getArgument(3);
				return supplier.getWithException();
			});
			studioUtilsMock.when(() -> createTempFile(anyString(), any(Document.class))).thenReturn(mock(Path.class));
			studioUtilsMock.when(() -> isPageDescriptor(anyString())).thenReturn(true);
			studioUtilsMock.when(() -> movePath(anyString(), anyString(), anyString())).thenCallRealMethod();
			studioUtilsMock.when(() -> underPagesRoot(anyString())).thenCallRealMethod();
			contentUtilsMock.when(() -> convertStreamToXml(any())).thenReturn(mock(Document.class));
			contentUtilsMock.when(() -> getParentUrl(any())).thenCallRealMethod();
			secUtilsMock.when(SecurityUtils::getCurrentUser).thenReturn(mock(AuthenticatedUser.class));
			moveResult = serviceInternal.move(SITE_ID, sourcePath, targetPath);
		}

		assertEquals("Commit ID should match", commitId, moveResult.getCommitId());
		assertEquals("Number of items should match", 3, moveResult.getItems().size());

		verify(contentRepository, times(1)).moveContent(eq(SITE_ID), eq(sourceFolder), eq(targetFolder), anyCollection(), anySet());

		verify(serviceInternal, times(3)).runLifecycle(
				eq(SITE_ID), any(), anyString(), any(), any(), any()
		);
	}

	@Test(expected = ContentNotFoundException.class)
	public void testMoveSourcePathNotFound() throws Exception {
		// Mock content existence
		when(contentRepository.contentExists(SITE_ID, PATH)).thenReturn(false);

		// Call the method
		serviceInternal.move(SITE_ID, PATH, "/new/path");
	}

	@Test(expected = ContentExistException.class)
	public void testMoveTargetPathExists() throws Exception {
		// Mock content existence
		when(contentRepository.contentExists(SITE_ID, PATH)).thenReturn(true);
		when(contentRepository.contentExists(SITE_ID, "/new/path")).thenReturn(true);

		// Call the method
		serviceInternal.move(SITE_ID, PATH, "/new/path");
	}

	@Test(expected = InvalidParametersException.class)
	public void testMoveNonMatchingExtensions() throws Exception {
		// Mock content existence
		when(contentRepository.contentExists(SITE_ID, "/existing/file.jpg")).thenReturn(true);

		// Call the method
		serviceInternal.move(SITE_ID, "/existing/file.jpg", "/new/path.txt");
	}

	@Test
	public void testFolderCutPasteOnCollision() throws ServiceLayerException, DocumentException {
		Collection<RepositoryItem> repoItems = getRepoItems("/site/website/articles", List.of("folder"), true);
		List<String> existentPaths = List.of("/site/website/articles/folder");
		when(contentRepository.getContentChildren(SITE_ID, "/site/website/articles")).thenReturn(repoItems);
		for (String path : existentPaths) {
			when(serviceInternal.contentExists(SITE_ID, path)).thenReturn(true);
		}
		PastedPath targetPath = serviceInternal.constructNewPathForCutCopy(SITE_ID,
				"/site/website/folder",
				"/site/website/articles");

		assertEquals("File path is not the expected", "/site/website/articles/folder-copy-1", targetPath.path);
	}

	@Test
	public void testFolderCutPasteOnCollisionMultiple() throws ServiceLayerException, DocumentException {
		Collection<RepositoryItem> repoItems = getRepoItems(
				"/site/website/articles",
				List.of("folder", "folder-copy-1", "folder-copy-2"),
				true);
		List<String> existentPaths = List.of("/site/website/articles/folder",
				"/site/website/articles/folder-copy-3",
				"/site/website/articles/folder-copy-2");
		when(contentRepository.getContentChildren(SITE_ID, "/site/website/articles")).thenReturn(repoItems);
		for (String path : existentPaths) {
			when(serviceInternal.contentExists(SITE_ID, path)).thenReturn(true);
		}
		PastedPath targetPath = serviceInternal.constructNewPathForCutCopy(SITE_ID,
				"/site/website/folder",
				"/site/website/articles");

		assertEquals("File path is not the expected", "/site/website/articles/folder-copy-3", targetPath.path);
	}

	@Test
	public void testPageCutPasteIntoFolderOnCollision() throws ServiceLayerException, DocumentException {
		Collection<RepositoryItem> repoItems = getRepoItems(
				"/site/website/articles",
				List.of("style"),
				true);
		List<String> existentPaths = List.of("/site/website/articles/style/index.xml",
				"/site/website/articles/style");
		when(contentRepository.getContentChildren(SITE_ID, "/site/website/articles")).thenReturn(repoItems);
		for (String path : existentPaths) {
			when(serviceInternal.contentExists(SITE_ID, path)).thenReturn(true);
		}

		PastedPath targetPath = serviceInternal.constructNewPathForCutCopy(SITE_ID,
				"/site/website/style/index.xml",
				"/site/website/articles");

		assertEquals("File path is not the expected", "/site/website/articles/style-copy-1/index.xml", targetPath.path);
	}

	@Test
	public void testPageCutPasteIntoFolderOnCollisionMultiple() throws ServiceLayerException, DocumentException {
		Collection<RepositoryItem> repoItems = getRepoItems(
				"/site/website/articles",
				List.of("style", "style-copy-1", "style-copy-2"),
				true);
		List<String> existentPaths = List.of("/site/website/articles/style/index.xml",
				"/site/website/articles/style");
		when(contentRepository.getContentChildren(SITE_ID, "/site/website/articles")).thenReturn(repoItems);
		for (String path : existentPaths) {
			when(serviceInternal.contentExists(SITE_ID, path)).thenReturn(true);
		}

		PastedPath targetPath = serviceInternal.constructNewPathForCutCopy(SITE_ID,
				"/site/website/style/index.xml",
				"/site/website/articles");

		assertEquals("File path is not the expected", "/site/website/articles/style-copy-3/index.xml", targetPath.path);
	}

	@Test
	public void testFolderCutPasteIntoPageOnCollision() throws ServiceLayerException, DocumentException {
		Collection<RepositoryItem> repoItems = getRepoItems(
				"/site/website/style",
				List.of("style", "articles-copy-1", "articles-copy-2"),
				true);
		List<String> existentPaths = List.of(
				"/site/website/style/articles-copy-1",
				"/site/website/style/articles-copy-2",
				"/site/website/style");
		when(contentRepository.getContentChildren(SITE_ID, "/site/website/style")).thenReturn(repoItems);
		for (String path : existentPaths) {
			when(serviceInternal.contentExists(SITE_ID, path)).thenReturn(true);
		}

		PastedPath targetPath = serviceInternal.constructNewPathForCutCopy(SITE_ID,
				"/site/website/articles-copy-1",
				"/site/website/style/index.xml");

		assertEquals("File path is not the expected", "/site/website/style/articles-copy-3", targetPath.path);
	}

	@Test
	public void testPageCutPasteIntoPageOnCollision() throws ServiceLayerException, DocumentException {
		Collection<RepositoryItem> repoItems = getRepoItems(
				"/site/website/health",
				List.of("style", "style-copy-1", "style-copy-2"),
				false);
		List<String> existentPaths = List.of(
				"/site/website/health/style-copy-1",
				"/site/website/health/style-copy-2");
		when(contentRepository.getContentChildren(SITE_ID, "/site/website/health")).thenReturn(repoItems);
		for (String path : existentPaths) {
			when(serviceInternal.contentExists(SITE_ID, path)).thenReturn(true);
		}

		PastedPath targetPath = serviceInternal.constructNewPathForCutCopy(SITE_ID,
				"/site/website/style-copy-1",
				"/site/website/health/index.xml");

		assertEquals("File path is not the expected", "/site/website/health/style-copy-3", targetPath.path);
	}

	@Test
	public void testPageCutPasteIntoCopiedParent() throws ServiceLayerException, DocumentException {
		// This test is to prevent the "copy file modifier" number from being matched on a parent folder
		// instead of the actual target
		Collection<RepositoryItem> repoItems = getRepoItems(
				"/site/website/health-copy-1",
				List.of("style", "style-copy-1", "style-copy-2"),
				false);
		List<String> existentPaths = List.of(
				"/site/website/health",
				"/site/website/health-copy-1/style",
				"/site/website/health-copy-1/style-copy-1",
				"/site/website/health-copy-1/style-copy-2");
		when(contentRepository.getContentChildren(SITE_ID, "/site/website/health-copy-1")).thenReturn(repoItems);
		for (String path : existentPaths) {
			when(serviceInternal.contentExists(SITE_ID, path)).thenReturn(true);
		}

		PastedPath targetPath = serviceInternal.constructNewPathForCutCopy(SITE_ID,
				"/site/website/health-copy-1/style",
				"/site/website/health-copy-1/index.xml");

		assertEquals("File path is not the expected", "/site/website/health-copy-1/style-copy-3", targetPath.path);
	}

	@Test
	public void testMoveToParentPath() throws ServiceLayerException, DocumentException, UserNotFoundException, AuthenticationException {
		when(contentRepository.contentExists(SITE_ID, "/site/website/new-location")).thenReturn(true);
		when(contentRepository.contentExists(SITE_ID, "/site/website/new-location/style")).thenReturn(true);
		when(contentRepository.isFolder(SITE_ID, "/site/website/new-location")).thenReturn(true);
		when(contentRepository.isFolder(SITE_ID, "/site/website/articles/style")).thenReturn(true);
		when(contentRepository.contentExists(SITE_ID, "/site/website/articles/style")).thenReturn(true);
		when(contentRepository.contentExists(SITE_ID, "/site/website/articles/style/index.xml")).thenReturn(true);
		when(permissionEvaluator.isAllowed(any(), any(), any())).thenReturn(true);
		when(contentRepository.moveContent(any(), any(), any(), anyCollection(), anySet())).thenReturn("COMMIT 123");

		Document document = convertStreamToXml(toInputStream(
				"<page><internal-name>the label</internal-name></page>", "UTF-8"));
		doReturn(document).when(serviceInternal).getItemDescriptor(SITE_ID, "/site/website/articles/style/index.xml", false);

		Item sourceItem = mock(Item.class);
		when(sourceItem.getSystemType()).thenReturn("page");
		doReturn(sourceItem).when(itemService).getItem(SITE_ID, "/site/website/articles/style", true);

		Item parentItem = mock(Item.class);
		when(parentItem.getId()).thenReturn(123L);
		when(itemService.getItem(SITE_ID, "/site/website/new-location", true)).thenReturn(parentItem);

		doReturn(mock(ContentItem.class)).when(itemDAO).getContentItemByPathPreferContent(SITE_NUMERIC_ID, "/site/website/articles/style");

		doAnswer(invocation -> {
			Runnable runnable = invocation.getArgument(0);
			runnable.run();
			return null;
		}).when(retryingDatabaseOperationFacade).retry(any(Runnable.class));

		try (MockedStatic<DBUtils> dbUtilsMock = mockStatic(DBUtils.class);
			 MockedStatic<SecurityUtils> secUtilsMock = mockStatic(SecurityUtils.class)) {
			dbUtilsMock.when(() -> DBUtils.runInTransaction(
					any(PlatformTransactionManager.class),
					anyString(),
					any(),
					any(ThrowingSupplier.class)
			)).thenAnswer(invocation -> {
				// Simulate transaction behavior
				ThrowingSupplier<String> supplier = invocation.getArgument(3);
				return supplier.getWithException();
			});
			secUtilsMock.when(SecurityUtils::getCurrentUser).thenReturn(mock(AuthenticatedUser.class));
			PasteContentResult pasteResult = serviceInternal.moveToParentPath(
					SITE_ID,
					"/site/website/articles/style/index.xml",
					"/site/website/new-location");

			assertEquals("Target path is not as expected",
					"/site/website/new-location/style-copy-1", pasteResult.getTargetPath());

			verify(contentRepository, times(1)).moveContent(
					eq(SITE_ID),
					eq("/site/website/articles/style"),
					eq("/site/website/new-location/style-copy-1"),
					anyCollection(),
					anySet()
			);

			verify(itemDAO, times(1)).updateMovedFolders(
					eq(SITE_NUMERIC_ID),
					eq("/site/website/articles/style"),
					eq("/site/website/new-location/style-copy-1")
			);
		}
	}

	@Test(expected = ContentNotFoundException.class)
	public void testDuplicateDoesNotExist() throws Exception {
		doReturn(false).when(contentRepository).contentExists(SITE_ID, "/site/website/articles/test1");

		runInMockStatics(() -> serviceInternal.duplicate(SITE_ID, "/site/website/articles/test1"));
	}

	@Test
	public void testDuplicate() throws Exception {
		doReturn(true).when(contentRepository).contentExists(SITE_ID, "/site/website/articles/test1");
		doReturn(true).when(contentRepository).contentExists(SITE_ID, "/site/website/articles");
		when(permissionEvaluator.isAllowed(any(), any(), any())).thenReturn(true);
		when(contentRepository.copy(eq(SITE_ID), anyString(), anyString(), any(), any())).thenReturn("commit-id");
		doReturn(true).when(contentRepository).isFolder(SITE_ID, "/site/website/articles");
		doReturn(true).when(contentRepository).isFolder(SITE_ID, "/site/website/articles/test1");

		Item parentItem = mock(Item.class);
		when(parentItem.getId()).thenReturn(123L);
		when(itemService.getItem(SITE_ID, "/site/website/articles", true)).thenReturn(parentItem);
		when(itemDAO.getContentItemByPathPreferContent(SITE_NUMERIC_ID, "/site/website/articles/test1")).thenReturn(mock(ContentItem.class));

		runInMockStatics(() -> serviceInternal.duplicate(SITE_ID, "/site/website/articles/test1"));

		verify(itemService).copyItem(
				SITE_ID,
				"/site/website/articles/test1",
				"/site/website/articles/test1-copy-1",
				123L,
				"test1-copy-1",
				0
		);
		verify(serviceInternal).insertContentAudit(
				eq(SITE_ID),
				eq("/site/website/articles/test1"),
				eq("/site/website/articles/test1-copy-1"),
				eq(DUPLICATE),
				any()
		);
	}

	@Test
	public void testDeletePublished() throws Exception {
		Set<String> deletePaths = Set.of("/site/website/test1", "/site/website/test2", "/site/website/test3");
		doReturn(true).when(contentRepository).contentExists(SITE_ID, "/site/website/test1");
		doReturn(true).when(contentRepository).contentExists(SITE_ID, "/site/website/test2");
		doReturn(true).when(contentRepository).contentExists(SITE_ID, "/site/website/test3");

		doReturn("COMMIT123").when(contentRepository).deleteContent(any(), any(), any(), any());

		doReturn(true).when(contentRepository).publishedRepositoryExists(SITE_ID);

		runInMockStatics(() ->
				serviceInternal.deleteContent(SITE_ID, deletePaths, "PUBLISH TITLE", "PUBLISH COMMENT"));

		verify(publishService).publishDelete(eq(SITE_ID), any(), any(), any(), any());

		verify(contentRepository, times(1)).deleteContent(
				eq(SITE_ID),
				eq(deletePaths),
				argThat(Collection::isEmpty),
				argThat(Collection::isEmpty)
		);

		verify(serviceInternal).insertDeleteContentAudit(eq(SITE_ID), any());
	}

	@Test
	public void testDelete() throws Exception {
		Set<String> deletePaths = Set.of("/site/website/test1", "/site/website/test2", "/site/website/test3");
		doReturn(true).when(contentRepository).contentExists(SITE_ID, "/site/website/test1");
		doReturn(true).when(contentRepository).contentExists(SITE_ID, "/site/website/test2");
		doReturn(true).when(contentRepository).contentExists(SITE_ID, "/site/website/test3");

		doReturn("COMMIT123").when(contentRepository).deleteContent(any(), any(), any(), any());

		runInMockStatics(() ->
				serviceInternal.deleteContent(SITE_ID, deletePaths, "PUBLISH TITLE", "PUBLISH COMMENT"));

		verify(publishService, never()).publishDelete(eq(SITE_ID), any(), any(), any(), any());

		verify(contentRepository, times(1)).deleteContent(
				eq(SITE_ID),
				eq(deletePaths),
				argThat(Collection::isEmpty),
				argThat(Collection::isEmpty)
		);
		verify(serviceInternal).insertDeleteContentAudit(eq(SITE_ID), any());
	}

	@Test
	public void testRevert() throws Exception {
		String content = "<content><title>Test Content</title></content>";

		Resource resource = mock(Resource.class);
		when(resource.getInputStream()).thenReturn(new ByteArrayInputStream(content.getBytes()));
		when(contentRepository.getContentByCommitId(SITE_ID, "/site/website/test1", "COMMIT123")).thenReturn(Optional.of(resource));
		when(permissionEvaluator.isAllowed(any(), any(), any())).thenReturn(true);

		when(contentRepository.writeContent(eq(SITE_ID), anyCollection(), anySet(), nullable(String.class))).thenReturn("new-commit-id");
		when(itemService.getItem(SITE_ID, "/site/website", false)).thenReturn(mock(Item.class));
		doReturn(true).when(contentRepository).contentExists(SITE_ID, "/site/website");

		runInMockStatics(() -> serviceInternal.revert(
				SITE_ID,
				"/site/website/test1",
				"COMMIT123"));

		verify(serviceInternal).writeInternal(
				eq(SITE_ID),
				eq("/site/website/test1"),
				any(LifecycleContent.class),
				nullable(String.class)
		);
	}

	@Test(expected = ContentNotFoundException.class)
	public void testRevertInvalidCommit() throws Exception {
		when(contentRepository.getContentByCommitId(SITE_ID, "/site/website/test1", "COMMIT123")).thenReturn(Optional.empty());

		runInMockStatics(() -> serviceInternal.revert(
				SITE_ID,
				"/site/website/test1",
				"COMMIT123"));
	}

	@Test
	public void testEntitlementsUpdate() throws Exception {
		when(permissionEvaluator.isAllowed(any(), any(), any())).thenReturn(true);
		when(contentRepository.writeContent(eq(SITE_ID), anyCollection(), anySet(), nullable(String.class))).thenReturn("commit-id");
		runInMockStatics(() -> serviceInternal.write(
				SITE_ID,
				PATH,
				contentStream,
				null
		));

		verify(entitlementValidator, times(1)).validateEntitlement(
				EntitlementType.ITEM,
				0
		);
	}

	@Test
	public void testEntitlementsCreate() throws Exception {
		Item parentItem = mock(Item.class);
		when(parentItem.getId()).thenReturn(123L);
		when(itemService.getItem(SITE_ID, "/sample", false)).thenReturn(parentItem);
		when(contentRepository.contentExists(SITE_ID, "/sample")).thenReturn(true);
		when(permissionEvaluator.isAllowed(any(), any(), any())).thenReturn(true);
		when(contentRepository.writeContent(eq(SITE_ID), anyCollection(), anySet(), nullable(String.class))).thenReturn("commit-id");
		runInMockStatics(() -> serviceInternal.write(
				SITE_ID,
				NON_EXIST_CONTENT_PATH,
				contentStream,
				null
		));

		verify(entitlementValidator, times(1)).validateEntitlement(
				EntitlementType.ITEM,
				1 // 1 for the new item
		);
	}

	@Test
	public void testEntitlementsCreateMultiple() throws Exception {
		Item parentItem = mock(Item.class);
		when(parentItem.getId()).thenReturn(123L);
		when(itemService.getItem(SITE_ID, "/sample", false)).thenReturn(parentItem);
		when(contentRepository.contentExists(SITE_ID, "/sample")).thenReturn(true);
		when(permissionEvaluator.isAllowed(any(), any(), any())).thenReturn(true);
		when(contentRepository.writeContent(eq(SITE_ID), anyCollection(), anySet(), nullable(String.class))).thenReturn("commit-id");

		doAnswer(a -> {
			LifecycleContent lifecycleContent = (LifecycleContent) a.getArguments()[1];
			lifecycleContent.write("/sample/path1", mock(Path.class));
			lifecycleContent.write("/sample/path2", mock(Path.class));
			return null;
		}).when(contentLifecycle).execute(
				anyString(),
				any(LifecycleContent.class),
				any()
		);

		runInMockStatics(() -> serviceInternal.write(
				SITE_ID,
				NON_EXIST_CONTENT_PATH,
				contentStream,
				null
		));

		verify(entitlementValidator, times(1)).validateEntitlement(
				EntitlementType.ITEM,
				3 // 1 (initial create) + 2 (writes)
		);
	}

	@Test
	public void testEntitlementsDeleteAndWrites() throws Exception {
		String deletePath = "/site/website/page1/index.xml";
		Item deleteItem = mock(Item.class);
		Item parentItem = mock(Item.class);
		when(parentItem.getId()).thenReturn(123L);
		when(itemService.getItem(SITE_ID, "/sample", false)).thenReturn(parentItem);

		when(itemService.getItem(SITE_ID, deletePath, false)).thenReturn(deleteItem);
		when(contentRepository.contentExists(SITE_ID, deletePath)).thenReturn(true);
		when(contentRepository.contentExists(SITE_ID, "/sample")).thenReturn(true);

		doAnswer(a -> {
			LifecycleContent lifecycleContent = (LifecycleContent) a.getArguments()[1];
			lifecycleContent.write("/sample/path1", mock(Path.class));
			lifecycleContent.write("/sample/path2", mock(Path.class));
			return null;
		}).when(contentLifecycle).execute(
				anyString(),
				any(LifecycleContent.class),
				any()
		);

		runInMockStatics(() -> serviceInternal.deleteContent(
				SITE_ID,
				Set.of(deletePath),
				"Publish title",
				"Publish comment"
		));

		verify(entitlementValidator, times(1)).validateEntitlement(
				EntitlementType.ITEM,
				1 // -1 (delete) + 2 (writes)
		);
	}

	@Test
	public void testEntitlementsDelete() throws Exception {
		runInMockStatics(() -> serviceInternal.deleteContent(
				SITE_ID,
				Set.of(PATH),
				"Publish title",
				"Publish comment"
		));

		verify(entitlementValidator, times(1)).validateEntitlement(
				EntitlementType.ITEM,
				-1 // -1 for delete operation
		);
	}

	@Test
	public void testFailedEntitlementValidationCreate() throws Exception {
		when(permissionEvaluator.isAllowed(any(), any(), any())).thenReturn(true);

		doThrow(EntitlementException.class).when(entitlementValidator).validateEntitlement(EntitlementType.ITEM, 1);

		runInMockStatics(() -> {
			ServiceLayerException exception = assertThrows(ServiceLayerException.class, () -> serviceInternal.write(
					SITE_ID,
					NON_EXIST_CONTENT_PATH,
					contentStream,
					null
			));
			EntitlementException entitlementException = throwableOfType(exception, EntitlementException.class);
			assertNotNull("Exception thrown should be EntitlementException", entitlementException);
		});

		verify(contentRepository, never()).writeContent(eq(SITE_ID), anyCollection(), anySet(), anyString());
	}

	@Test
	public void testReorderAddAfter() throws ServiceLayerException {
		String path = "/site/website/page1/index.xml";
		ReorderItemRequest.AddAfter request = new ReorderItemRequest.AddAfter();
		request.setReferencePath(path);

		doReturn(4.0).when(serviceInternal).getItemOrder(SITE_ID, path);

		double newOrder = serviceInternal.reorderItem(SITE_ID, request);
		assertEquals("New order should be previous + increment", 14, newOrder, 0.001);
	}

	@Test
	public void testReorderAddBefore() throws ServiceLayerException {
		String path = "/site/website/page1/index.xml";
		ReorderItemRequest.AddBefore request = new ReorderItemRequest.AddBefore();
		request.setReferencePath(path);

		doReturn(4.0).when(serviceInternal).getItemOrder(SITE_ID, path);

		double newOrder = serviceInternal.reorderItem(SITE_ID, request);
		assertEquals("New order should be next - increment", -6, newOrder, 0.001);
	}

	@Test
	public void testReorderInsert() throws ServiceLayerException {
		String path = "/site/website/page1/index.xml";
		String path2 = "/site/website/page2/index.xml";
		ReorderItemRequest.Insert request = new ReorderItemRequest.Insert();
		request.setPreviousPath(path);
		request.setNextPath(path2);

		doReturn(4.0).when(serviceInternal).getItemOrder(SITE_ID, path);
		doReturn(10.0).when(serviceInternal).getItemOrder(SITE_ID, path2);

		double neOrder = serviceInternal.reorderItem(SITE_ID, request);
		assertEquals("New order should be between previous and next values", 7, neOrder, 0.001);
	}

	@Test
	public void testGetItemsOrder_returnsSortedListWhenChildrenHaveValidNavOrder() throws Exception {
		String parentPath = "/site/website/section";

		// Create mock children with different nav orders
		List<ContentItem> mockChildren = Arrays.asList(
				createMockContentItem("/site/website/section/page1/index.xml"),
				createMockContentItem("/site/website/section/page2/index.xml"),
				createMockContentItem("/site/website/section/page3/index.xml")
		);

		when(itemDAO.getChildrenByPath(eq(SITE_NUMERIC_ID), eq(parentPath),
				isNull(), isNull(),
				anyList(),
				isNull(), isNull(),
				isNull(), isNull(),
				anyInt(), anyInt()))
				.thenReturn(mockChildren);

		doReturn(1000.0).when(serviceInternal).getItemOrder(SITE_ID, "/site/website/section/page2/index.xml");
		doReturn(2000.0).when(serviceInternal).getItemOrder(SITE_ID, "/site/website/section/page3/index.xml");
		doReturn(3000.0).when(serviceInternal).getItemOrder(SITE_ID, "/site/website/section/page1/index.xml");

		List<ItemOrder> result = serviceInternal.getItemsOrder(SITE_ID, parentPath);

		assertEquals("Should return 3 items", 3, result.size());
		assertEquals("First item should have lowest order", 1000.0, result.get(0).getOrder(), 0.001);
		assertEquals("Second item should have middle order", 2000.0, result.get(1).getOrder(), 0.001);
		assertEquals("Third item should have highest order", 3000.0, result.get(2).getOrder(), 0.001);
	}

	@Test
	public void testGetItemsOrder_excludesChildrenWherePlaceInNavIsFalse() throws Exception {
		String parentPath = "/site/website/section";

		List<ContentItem> mockChildren = Arrays.asList(
				createMockContentItem("/site/website/section/page1/index.xml"),
				createMockContentItem("/site/website/section/page2/index.xml"),
				createMockContentItem("/site/website/section/page3/index.xml")
		);

		when(itemDAO.getChildrenByPath(eq(SITE_NUMERIC_ID), eq(parentPath),
				isNull(), isNull(),
				anyList(),
				isNull(), isNull(),
				isNull(), isNull(),
				anyInt(), anyInt()))
				.thenReturn(mockChildren);

		// page1 has placeInNav = true, order = 1000
		doReturn(1000.0).when(serviceInternal).getItemOrder(SITE_ID, "/site/website/section/page1/index.xml");
		// page2 has placeInNav = false, should be excluded
		doReturn(null).when(serviceInternal).getItemOrder(SITE_ID, "/site/website/section/page2/index.xml");
		// page3 has placeInNav = true, order = 3000
		doReturn(3000.0).when(serviceInternal).getItemOrder(SITE_ID, "/site/website/section/page3/index.xml");

		List<ItemOrder> result = serviceInternal.getItemsOrder(SITE_ID, parentPath);

		assertEquals("Should return only 2 items (excluding page2)", 2, result.size());
		assertEquals("First item should be page1", "/site/website/section/page1/index.xml", result.get(0).getPath());
		assertEquals("Second item should be page3", "/site/website/section/page3/index.xml", result.get(1).getPath());
	}

	@Test
	public void testGetItemsOrder_excludesChildrenWithNoOrderValue() throws Exception {
		String parentPath = "/site/website/section";

		List<ContentItem> mockChildren = Arrays.asList(
				createMockContentItem("/site/website/section/page1/index.xml"),
				createMockContentItem("/site/website/section/page2/index.xml"),
				createMockContentItem("/site/website/section/page3/index.xml")
		);

		when(itemDAO.getChildrenByPath(eq(SITE_NUMERIC_ID), eq(parentPath),
				isNull(), isNull(),
				anyList(),
				isNull(), isNull(),
				isNull(), isNull(),
				anyInt(), anyInt()))
				.thenReturn(mockChildren);

		doReturn(1000.0).when(serviceInternal).getItemOrder(SITE_ID, "/site/website/section/page1/index.xml");
		doReturn(null).when(serviceInternal).getItemOrder(SITE_ID, "/site/website/section/page2/index.xml");
		doReturn(2000.0).when(serviceInternal).getItemOrder(SITE_ID, "/site/website/section/page3/index.xml");

		List<ItemOrder> result = serviceInternal.getItemsOrder(SITE_ID, parentPath);

		assertEquals("Should return only items with valid order", 2, result.size());
		assertFalse("Result should not contain page2",
				result.stream().anyMatch(item -> item.getPath().equals("/site/website/section/page2")));
	}

	@Test
	public void testGetItemsOrder_returnsEmptyListWhenParentHasNoChildren() throws Exception {
		String parentPath = "/site/website/empty-section";

		when(itemDAO.getChildrenByPath(eq(SITE_NUMERIC_ID), eq(parentPath),
				isNull(), isNull(),
				anyList(),
				isNull(), isNull(),
				isNull(), isNull(),
				anyInt(), anyInt()))
				.thenReturn(emptyList());

		List<ItemOrder> result = serviceInternal.getItemsOrder(SITE_ID, parentPath);

		assertNotNull("Result should not be null", result);
		assertTrue("Result should be empty", result.isEmpty());
	}

	private ContentItem createMockContentItem(String path) {
		ContentItem item = mock(ContentItem.class);
		when(item.getPath()).thenReturn(path);
		return item;
	}


	/**
	 * Runs the provided runnable in a mocked static context for DBUtils and SecurityUtils.
	 *
	 * @param runnable the runnable to execute
	 * @throws Exception if an error occurs during execution
	 */
	private void runInMockStatics(DBUtils.ThrowingRunnable runnable) throws Exception {
		try (MockedStatic<DBUtils> dbUtilsMock = mockStatic(DBUtils.class);
			 MockedStatic<SecurityUtils> secUtilsMock = mockStatic(SecurityUtils.class);
			 MockedStatic<StudioUtils> studioUtilsMock = mockStatic(StudioUtils.class)) {
			dbUtilsMock.when(() -> DBUtils.runInTransaction(
					any(PlatformTransactionManager.class),
					anyString(),
					any(),
					any(ThrowingSupplier.class)
			)).thenAnswer(invocation -> {
				// Simulate transaction behavior
				ThrowingSupplier<String> supplier = invocation.getArgument(3);
				return supplier.getWithException();
			});
			secUtilsMock.when(SecurityUtils::getCurrentUser).thenReturn(mock(AuthenticatedUser.class));

			studioUtilsMock.when(() -> createTempFile(anyString(), any(Document.class))).thenReturn(mock(Path.class));
			studioUtilsMock.when(() -> isDescriptor(anyString())).thenCallRealMethod();
			studioUtilsMock.when(() -> underDescriptorRoot(anyString())).thenCallRealMethod();
			runnable.run();
		}
	}

	private Collection<RepositoryItem> getRepoItems(String path, List<String> names, boolean folders) {
		return names.stream()
				.map(name -> new RepositoryItem(path, name, folders))
				.toList();
	}
}
