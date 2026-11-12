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

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.craftercms.commons.security.exception.ActionDeniedException;
import org.craftercms.commons.security.permissions.PermissionEvaluator;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v2.content.ContentLifecycle;
import org.craftercms.studio.api.v2.dal.ItemDAO;
import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.repository.GitContentRepository;
import org.craftercms.studio.api.v2.service.audit.ActivityStreamService;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.api.v2.service.content.ContentTypeService;
import org.craftercms.studio.api.v2.service.dependency.DependencyService;
import org.craftercms.studio.api.v2.service.item.ItemService;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.commons.entitlements.validator.EntitlementValidator;
import org.craftercms.studio.model.rest.content.PasteContentResult;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.util.function.ThrowingSupplier;

import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_COMPONENT;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_PAGE;
import static org.craftercms.studio.api.v2.security.ContentItemAvailableActionsConstants.CONTENT_CUT;
import static org.craftercms.studio.api.v2.security.ContentItemAvailableActionsConstants.CONTENT_EDIT;
import static org.craftercms.studio.api.v2.security.ContentItemAvailableActionsConstants.CONTENT_RENAME;
import static org.craftercms.studio.api.v2.security.ContentItemAvailableActionsConstants.mapPermissionToContentItemAvailableActions;
import static org.craftercms.studio.api.v2.security.ContentItemPossibleActionsConstants.getPossibleActionsForObject;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.PAGE_NAVIGATION_ORDER_INCREMENT;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PATH_LIST_RESOURCE_ID;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PATH_RESOURCE_ID;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_DELETE;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_MOVE;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_WRITE;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * content_move is required on the source and target roots only. These cases are the #9373 and #9372 regressions
 * plus the denial and lifecycle rules around that permission.
 */
@RunWith(MockitoJUnitRunner.class)
public class ContentMovePermissionTest {

	private static final String SITE = "ed";
	private static final String AUTHOR_SCOPE = "/site/website/.*|/site/components(/.*)?|/static-assets(/.*)?";
	private static final Set<String> AUTHOR_ACTIONS = Set.of(
			PERMISSION_CONTENT_WRITE, "content_create", "folder_create", "content_copy", PERMISSION_CONTENT_MOVE);
	private static final String ABOUT = "/site/website/about/index.xml";
	private static final String HELLO = "/site/website/hello/index.xml";

	private enum Role {
		AUTHOR, PUBLISHER, ADMIN, REVIEWER, MOVER
	}

	private record PermissionCall(String action, List<String> paths) {
	}

	@Mock
	private PlatformTransactionManager transactionManager;
	@Mock
	private StudioConfiguration studioConfiguration;
	@Mock
	private SitesService siteService;
	@Mock
	private RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;
	@Mock
	private PublishService publishService;
	@Mock
	private PermissionEvaluator<String, Object> permissionEvaluator;
	@Mock
	private ItemService itemService;
	@Mock
	private ItemDAO itemDao;
	@Mock
	private GeneralLockService generalLockService;
	@Mock
	private DependencyService dependencyService;
	@Mock
	private GitContentRepository contentRepository;
	@Mock
	private ContentLifecycle contentLifecycle;
	@Mock
	private AuditService auditService;
	@Mock
	private ActivityStreamService activityStreamService;
	@Mock
	private EntitlementValidator entitlementValidator;
	@Mock
	private ContentTypeService contentTypeService;

	private ContentServiceInternalImpl service;
	private final List<PermissionCall> calls = new ArrayList<>();
	private Role role = Role.AUTHOR;

	@Before
	public void setUp() {
		when(studioConfiguration.getProperty(eq(PAGE_NAVIGATION_ORDER_INCREMENT), eq(Integer.class), any()))
				.thenReturn(1000);
		service = spy(new ContentServiceInternalImpl(transactionManager, studioConfiguration, siteService,
				retryingDatabaseOperationFacade, publishService, permissionEvaluator, itemService, itemDao,
				generalLockService, dependencyService, contentRepository, contentLifecycle, auditService,
				contentLifecycle, null, activityStreamService, entitlementValidator, null, contentTypeService));
		when(permissionEvaluator.isAllowed(nullable(String.class), any(), anyString())).thenAnswer(invocation -> {
			String action = invocation.getArgument(2);
			List<String> paths = pathsOf(invocation.getArgument(1));
			calls.add(new PermissionCall(action, paths));
			return allows(role, action, paths);
		});
	}

	@Test
	public void moveAndUpdateAsAuthorRenamesAPage() throws Exception {
		allowMoveToFinish();
		service.moveAndUpdate(SITE, ABOUT, HELLO, "<page/>");

		assertEquals(List.of("/site/website/about", "/site/website/hello"), only(PERMISSION_CONTENT_MOVE).paths());
		assertTrue(calls.stream().noneMatch(call -> PERMISSION_CONTENT_WRITE.equals(call.action())));
		assertTrue(calls.stream().noneMatch(call -> PERMISSION_CONTENT_DELETE.equals(call.action())));
		verify(service).doMove(eq(SITE), eq(ABOUT), eq(HELLO), nullable(String.class), any());
	}

	@Test
	public void moveAndUpdateAsPublisherAndAdminStillSucceed() throws Exception {
		allowMoveToFinish();
		role = Role.PUBLISHER;
		service.moveAndUpdate(SITE, ABOUT, HELLO, "<page/>");
		role = Role.ADMIN;
		calls.clear();
		service.moveAndUpdate(SITE, ABOUT, HELLO, "<page/>");

		assertEquals(List.of("/site/website/about", "/site/website/hello"), only(PERMISSION_CONTENT_MOVE).paths());
	}

	@Test
	public void moveAndUpdateAsReviewerIsDenied() throws Exception {
		role = Role.REVIEWER;

		assertThrows(ActionDeniedException.class, () -> service.moveAndUpdate(SITE, ABOUT, HELLO, "<page/>"));
		verify(service, never()).doMove(anyString(), anyString(), anyString(), nullable(String.class),
				nullable(ThrowingSupplier.class));
	}

	@Test
	public void moveIsDeniedWhenOnlyTheSourceAllowsIt() {
		assertThrows(ActionDeniedException.class,
				() -> service.move(SITE, "/site/website/about", "/templates/web/page.ftl"));
	}

	@Test
	public void moveIsDeniedWhenOnlyTheTargetAllowsIt() {
		assertThrows(ActionDeniedException.class,
				() -> service.move(SITE, "/templates/web/page.ftl", "/site/website/about"));
	}

	@Test
	public void folderMovePathListIsTheTwoRoots() throws Exception {
		allowMoveToFinish();
		service.move(SITE, "/site/website/section", "/site/website/archive/section");

		assertEquals(List.of("/site/website/section", "/site/website/archive/section"),
				only(PERMISSION_CONTENT_MOVE).paths());
	}

	@Test
	public void renameAssetChecksTheOldAndNewPaths() throws Exception {
		allowMoveToFinish();
		service.renameContent(SITE, "/static-assets/images/logo.png", "mark.png");

		assertEquals(List.of("/static-assets/images/logo.png", "/static-assets/images/mark.png"),
				only(PERMISSION_CONTENT_MOVE).paths());
	}

	@Test
	public void pasteCutAsAuthorChecksTheSourceAndDropFolder() throws Exception {
		allowMoveToFinish();
		service.moveToParentPath(SITE, ABOUT, "/site/website/news");

		List<String> paths = only(PERMISSION_CONTENT_MOVE).paths();
		assertEquals(List.of("/site/website/about", "/site/website/news"), paths);
		assertTrue(paths.stream().noneMatch(path -> path.contains("/news/about")));
	}

	@Test
	public void pasteCutIsDeniedWhenTheDropFolderLacksMove() {
		assertThrows(ActionDeniedException.class,
				() -> service.moveToParentPath(SITE, ABOUT, "/templates/web"));
	}

	@Test
	public void moveWithoutContentWriteOnTheRootsStillMoves() throws Exception {
		allowMoveToFinish();
		role = Role.MOVER;
		service.move(SITE, "/site/website/section", "/site/website/archive/section");

		assertEquals(PERMISSION_CONTENT_MOVE, only(PERMISSION_CONTENT_MOVE).action());
		assertTrue(calls.stream().noneMatch(call -> PERMISSION_CONTENT_WRITE.equals(call.action())));
	}

	@Test
	public void lifecycleItemOutsideTheMovedSetRequiresContentWrite() throws Exception {
		service.validateLifecycleResults(SITE, "/site/website/section", "/site/website/archive/section", List.of(
				"/site/website/archive/section",
				"/site/website/archive/section/index.xml",
				"/site/website/other/index.xml"));

		assertEquals(List.of("/site/website/other/index.xml"), only(PERMISSION_CONTENT_WRITE).paths());
		assertTrue(calls.stream().noneMatch(call -> PERMISSION_CONTENT_DELETE.equals(call.action())));
	}

	@Test
	public void lifecycleItemOutsideTheMovedSetIsDeniedWithoutContentWrite() {
		role = Role.MOVER;

		assertThrows(ActionDeniedException.class, () -> service.validateLifecycleResults(SITE,
				"/site/website/section", "/site/website/archive/section", List.of(
						"/site/website/archive/section",
						"/site/website/other/index.xml")));
		assertEquals(List.of("/site/website/other/index.xml"), only(PERMISSION_CONTENT_WRITE).paths());
	}

	@Test
	public void moveWithNoOutsideLifecycleItemsDoesNotCheckContentWrite() throws Exception {
		service.validateLifecycleResults(SITE, "/site/website/section", "/site/website/archive/section", List.of(
				"/site/website/archive/section",
				"/site/website/archive/section/child.xml"));

		assertTrue(calls.isEmpty());
	}

	@Test
	public void copyStillRequiresContentWriteOnEveryAffectedPath() throws Exception {
		service.validateLifecycleResults(SITE, null, "/site/website/news/about/index.xml", List.of(
				"/site/website/news/about/index.xml",
				"/site/website/other/index.xml"));

		assertEquals(List.of("/site/website/news/about/index.xml", "/site/website/other/index.xml"),
				only(PERMISSION_CONTENT_WRITE).paths());
	}

	@Test
	public void contentMoveGrantsRenameAndCutAndPagesCanRename() {
		long move = mapPermissionToContentItemAvailableActions(PERMISSION_CONTENT_MOVE);
		long write = mapPermissionToContentItemAvailableActions(PERMISSION_CONTENT_WRITE);

		assertEquals(CONTENT_RENAME + CONTENT_CUT, move);
		assertEquals(0L, write & CONTENT_RENAME);
		assertEquals(0L, write & CONTENT_CUT);
		assertEquals(0L, move & CONTENT_EDIT);
		assertTrue((getPossibleActionsForObject(CONTENT_TYPE_PAGE) & CONTENT_RENAME) > 0);
		assertTrue((getPossibleActionsForObject(CONTENT_TYPE_COMPONENT) & CONTENT_RENAME) > 0);
	}

	private void allowMoveToFinish() throws Exception {
		doReturn(mock(PasteContentResult.class)).when(service).doMove(anyString(), anyString(), anyString(),
				nullable(String.class), nullable(ThrowingSupplier.class));
	}

	private PermissionCall only(String action) {
		List<PermissionCall> matches = calls.stream().filter(call -> action.equals(call.action())).toList();
		assertEquals(1, matches.size());
		return matches.get(0);
	}

	private boolean allows(Role current, String action, List<String> paths) {
		for (String path : paths) {
			if (!allows(current, action, path)) {
				return false;
			}
		}
		return true;
	}

	private boolean allows(Role current, String action, String path) {
		return switch (current) {
			case AUTHOR -> path.matches(AUTHOR_SCOPE) && AUTHOR_ACTIONS.contains(action);
			case PUBLISHER -> path.matches("/site/.*|/static-assets.*")
					&& Set.of(PERMISSION_CONTENT_WRITE, "content_create", "folder_create", "content_copy",
					PERMISSION_CONTENT_MOVE).contains(action);
			case ADMIN -> Set.of(PERMISSION_CONTENT_WRITE, PERMISSION_CONTENT_MOVE, "content_create",
					"folder_create", "content_copy").contains(action);
			case REVIEWER -> false;
			case MOVER -> PERMISSION_CONTENT_MOVE.equals(action) && path.matches(AUTHOR_SCOPE);
		};
	}

	private static List<String> pathsOf(Object resource) {
		if (!(resource instanceof Map<?, ?> map)) {
			return List.of("/");
		}
		Object pathList = map.get(PATH_LIST_RESOURCE_ID);
		if (pathList instanceof Collection<?> paths && !paths.isEmpty()) {
			return paths.stream().map(Object::toString).toList();
		}
		Object path = map.get(PATH_RESOURCE_ID);
		if (path instanceof String value && !value.isEmpty()) {
			return List.of(value);
		}
		return List.of("/");
	}
}
