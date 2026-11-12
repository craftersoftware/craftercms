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
package org.craftercms.studio.impl.v2.service.clipboard.internal;

import org.craftercms.commons.security.permissions.PermissionEvaluator;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.exception.content.ContentInPublishQueueException;
import org.craftercms.studio.api.v2.exception.content.ContentMoveInvalidLocation;
import org.craftercms.studio.api.v2.repository.GitContentRepository;
import org.craftercms.studio.api.v2.service.item.ItemService;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.model.rest.content.PasteContentResult;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import java.util.List;
import java.util.Map;

import static org.craftercms.studio.model.clipboard.Operation.COPY;
import static org.craftercms.studio.model.clipboard.Operation.CUT;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PATH_RESOURCE_ID;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_WRITE;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.SITE_ID_RESOURCE_ID;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.*;

@RunWith(MockitoJUnitRunner.class)
public class ClipboardServiceInternalImplTest {

	private static final String SITE_ID = "mySite";

	@Mock
	private ItemService itemService;

	@Mock
	private GitContentRepository contentRepository;

	@Mock
	private org.craftercms.studio.api.v2.service.content.ContentService contentService;

	@Mock
	private GeneralLockService generalLockService;

	@Mock
	private PublishService publishService;

	@Mock
	private SitesService sitesService;

	@Mock
	private PermissionEvaluator<String, Object> permissionEvaluator;

	@InjectMocks
	private ClipboardServiceInternalImpl service;

	@Before
	public void setUp() throws SiteNotFoundException {
		for (String pagePath : getPagePaths()) {
			when(contentService.contentExists(SITE_ID, pagePath)).thenReturn(true);
		}
		for (String folderPath : getFolderPaths()) {
			when(contentService.contentExists(SITE_ID, folderPath)).thenReturn(true);
			when(contentRepository.isFolder(SITE_ID, folderPath)).thenReturn(true);
		}
		for (String nonFolderPath : getNonFolderPaths()) {
			when(contentService.contentExists(SITE_ID, nonFolderPath)).thenReturn(true);
		}

		for (String existingPath : getExistingPaths()) {
			when(contentService.contentExists(SITE_ID, existingPath)).thenReturn(true);
		}

		when(sitesService.getSite(SITE_ID)).thenReturn(mock(Site.class));
	}

	private String[] getPagePaths() {
		return new String[]{
				"/site/website/health/index.xml"
		};
	}

	private String[] getExistingPaths() {
		return new String[]{
				"/site/website/style/index.xml",
				"/site/website/news",
				"/static-assets/images/screenshot.png",
				"/site/components/header/default.xml",
				"/templates/web/layout/main.ftl",
				"/scripts/rest/search/documents.get.groovy",
				"/sources/folder/script.groovy",
				"/site/taxonomy/categories.xml",
				"/custom/folder/item.xls",
				"/site/components/headers/the-header.xml",
				"/site/website/health/article-1/index.xml",
				"/site/website/articles/article-1/index.xml"
		};
	}

	private String[] getFolderPaths() {
		return new String[]{
				"/site/website/articles",
				"/site/components/headers",
				"/static-assets/screenshots",
				"/templates/web/blog",
				"/scripts/rest/documents/search",
				"/scripts/rest/search",
				"/sources/classes/folder",
				"/site/taxonomy/categories",
				"/custom/old",
				"/reports/folder"
		};
	}

	private String[] getNonFolderPaths() {
		return new String[]{
				"/templates/web/layout.ftl",
				"/static-assets/screenshot.png"};
	}

	@Test
	public void allowPastingFolderIntoPageTest() {
		assertDoesNotThrow(
				() ->
						service.validatePasteItemsAction(
								SITE_ID, COPY, "/site/website/news", "/site/website/health/index.xml"));
	}

	@Test
	public void allowPastingPageIntoFolderTest() {
		assertDoesNotThrow(
				() ->
						service.validatePasteItemsAction(
								SITE_ID, COPY, "/site/website/style/index.xml", "/site/website/articles"));
	}

	@Test
	public void allowPastingFolderIntoFolderTest() {
		assertDoesNotThrow(
				() ->
						service.validatePasteItemsAction(
								SITE_ID, COPY, "/site/website/news", "/site/website/articles"));
	}

	@Test
	public void allowPastingPageIntoPageTest() {
		assertDoesNotThrow(
				() ->
						service.validatePasteItemsAction(
								SITE_ID, COPY, "/site/website/style/index.xml", "/site/website/health/index.xml"));
	}

	@Test
	public void allowPastingAssetIntoFolderTest() {
		assertDoesNotThrow(
				() ->
						service.validatePasteItemsAction(
								SITE_ID, COPY, "/static-assets/images/screenshot.png", "/static-assets/screenshots"));
	}

	@Test
	public void allowPastingComponentIntoFolderTest() {
		assertDoesNotThrow(
				() ->
						service.validatePasteItemsAction(
								SITE_ID, COPY, "/site/components/header/default.xml", "/site/components/headers"));
	}

	@Test
	public void allowPastingTemplateIntoFolderTest() {
		assertDoesNotThrow(
				() ->
						service.validatePasteItemsAction(
								SITE_ID, COPY, "/templates/web/layout/main.ftl", "/templates/web/blog"));
	}

	@Test
	public void allowPastingScriptIntoFolderTest() {
		assertDoesNotThrow(
				() ->
						service.validatePasteItemsAction(
								SITE_ID, COPY,
								"/scripts/rest/search/documents.get.groovy",
								"/scripts/rest/documents/search"));
	}

	@Test
	public void allowPastingSourcesFileIntoFolderTest() {
		assertDoesNotThrow(
				() ->
						service.validatePasteItemsAction(
								SITE_ID, COPY, "/sources/folder/script.groovy", "/sources/classes/folder"));
	}

	@Test
	public void allowPastingTaxonomyIntoFolderTest() {
		assertDoesNotThrow(
				() ->
						service.validatePasteItemsAction(
								SITE_ID, COPY, "/site/taxonomy/categories.xml", "/site/taxonomy/categories"));
	}

	@Test
	public void allowTest() {
		assertDoesNotThrow(
				() ->
						service.validatePasteItemsAction(
								SITE_ID, COPY, "/custom/folder/item.xls", "/reports/folder"));
	}

	@Test
	public void allowPastingCustomPathItemIntoFolderTest() {
		assertDoesNotThrow(
				() -> service.validatePasteItemsAction(SITE_ID, COPY, "/custom/folder/item.xls", "/custom/old"));
	}

	@Test(expected = InvalidParametersException.class)
	public void preventPastingPageIntoStaticAssetsTest()
			throws ServiceLayerException {
		service.validatePasteItemsAction(
				SITE_ID, COPY, "/site/website/style/index.xml", "/static-assets/screenshots");
	}

	@Test(expected = InvalidParametersException.class)
	public void preventPastingComponentIntoStaticAssetsTest()
			throws ServiceLayerException {
		service.validatePasteItemsAction(
				SITE_ID, COPY, "/site/components/header/default.xml", "/static-assets/screenshots");
	}

	@Test(expected = InvalidParametersException.class)
	public void preventPastingAssetIntoAssetTest()
			throws ServiceLayerException {
		service.validatePasteItemsAction(
				SITE_ID, COPY, "/static-assets/images/screenshot.png", "/static-assets/screenshot.png");
	}

	@Test(expected = InvalidParametersException.class)
	public void preventPastingTemplateIntoStaticAssetsTest()
			throws ServiceLayerException {
		service.validatePasteItemsAction(
				SITE_ID, COPY, "/templates/web/layout/main.ftl", "/static-assets/screenshots");
	}

	@Test(expected = InvalidParametersException.class)
	public void preventPastingTemplateIntoTemplateTest()
			throws ServiceLayerException {
		service.validatePasteItemsAction(
				SITE_ID, COPY, "/templates/web/layout/main.ftl", "/templates/web/layout.ftl");
	}

	@Test(expected = InvalidParametersException.class)
	public void preventPastingScriptIntoTaxonomiesTest()
			throws ServiceLayerException {
		service.validatePasteItemsAction(
				SITE_ID, COPY, "/scripts/rest/search/documents.get.groovy", "/site/taxonomy/categories");
	}

	@Test(expected = InvalidParametersException.class)
	public void preventPastingCustomPathItemIntoStaticAssetsTest()
			throws ServiceLayerException {
		service.validatePasteItemsAction(
				SITE_ID, COPY, "/custom/folder/item.xls", "/static-assets/screenshots");
	}

	@Test(expected = InvalidParametersException.class)
	public void preventPastingTemplateIntoCustomPathTest()
			throws ServiceLayerException {
		service.validatePasteItemsAction(SITE_ID, COPY, "/templates/web/layout/main.ftl", "/custom/old");
	}

	@Test(expected = ContentNotFoundException.class)
	public void preventPastingNonExistingContentTest()
			throws ServiceLayerException {
		service.validatePasteItemsAction(SITE_ID, COPY, "/templates/web/layout/unexistent.ftl", "/templates/web/blog");
	}

	@Test(expected = ContentMoveInvalidLocation.class)
	public void preventCutPasteScriptIntoSameFolder()
			throws ServiceLayerException {
		service.validatePasteItemsAction(SITE_ID, CUT, "/scripts/rest/search/documents.get.groovy", "/scripts/rest/search");
	}

	@Test(expected = ContentMoveInvalidLocation.class)
	public void preventCutPasteComponentIntoSameFolder()
			throws ServiceLayerException {
		service.validatePasteItemsAction(SITE_ID, CUT, "/site/components/headers/the-header.xml", "/site/components/headers");
	}

	@Test(expected = ContentMoveInvalidLocation.class)
	public void preventCutPastePageIntoPageSameFolder()
			throws ServiceLayerException {
		service.validatePasteItemsAction(SITE_ID, CUT, "/site/website/health/article-1/index.xml", "/site/website/health/index.xml");
	}

	@Test(expected = ContentMoveInvalidLocation.class)
	public void preventCutPastePageIntoSameFolder()
			throws ServiceLayerException {
		service.validatePasteItemsAction(SITE_ID, CUT, "/site/website/articles/article-1/index.xml", "/site/website/articles");
	}

	@Test
	public void duplicatePageTest() throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		String path = "/site/website/style/index.xml";
		when(contentService.duplicate(any(), any())).thenReturn(mock(PasteContentResult.class));
		service.duplicateItem(SITE_ID, path);
		// The duplicate is delegated to the content service
		verify(contentService).duplicate(eq(SITE_ID), eq(path));
	}

	@Test
	public void duplicateAssetTest() throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		String path = "/static-assets/images/screenshot.png";
		when(contentService.duplicate(any(), any())).thenReturn(mock(PasteContentResult.class));
		service.duplicateItem(SITE_ID, path);
		// The duplicate is delegated to the content service
		verify(contentService).duplicate(eq(SITE_ID), eq(path));
	}

	@Test
	public void copyPasteTest() throws UserNotFoundException, AuthenticationException, ServiceLayerException {
		String path = "/site/website/style/index.xml";
		when(permissionEvaluator.isAllowed(nullable(String.class), any(), eq(PERMISSION_CONTENT_WRITE))).thenReturn(true);
		when(contentService.copy(any(), any(), any(), any())).thenReturn(mock(PasteContentResult.class));
		assertDoesNotThrow(() -> service.pasteItems(SITE_ID, COPY, "/site/website/articles", path, true));
		verify(permissionEvaluator).isAllowed(nullable(String.class), argThat(resource -> {
			if (!(resource instanceof Map<?, ?> map)) {
				return false;
			}
			return SITE_ID.equals(map.get(SITE_ID_RESOURCE_ID))
					&& "/site/website/articles".equals(map.get(PATH_RESOURCE_ID));
		}), eq(PERMISSION_CONTENT_WRITE));
	}

	@Test
	public void cutPasteDoesNotCheckContentWriteOnTheDropFolder()
			throws UserNotFoundException, AuthenticationException, ServiceLayerException {
		String path = "/site/website/style/index.xml";
		when(publishService.getActivePackagesForItems(SITE_ID, List.of(path), true)).thenReturn(List.of());
		when(contentService.moveToParentPath(SITE_ID, path, "/site/website/articles"))
				.thenReturn(mock(PasteContentResult.class));

		service.pasteItems(SITE_ID, CUT, "/site/website/articles", path, false);

		verify(contentService).moveToParentPath(SITE_ID, path, "/site/website/articles");
		verify(permissionEvaluator, never()).isAllowed(nullable(String.class), any(), any());
	}

	@Test
	public void cutPasteTest() throws UserNotFoundException, AuthenticationException, ServiceLayerException {
		String path = "/site/website/style/index.xml";

		when(publishService.getActivePackagesForItems(SITE_ID, List.of(path), true)).thenReturn(List.of(mock(PublishPackage.class)));

		assertThrows(ContentInPublishQueueException.class,
				() -> service.pasteItems(SITE_ID, CUT, "/site/website/articles", path, true),
				"It should fail because the item is part of an active publish package");
	}
}
