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

package org.craftercms.studio.impl.v2.security;

import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.PermissionEvaluator;
import org.craftercms.commons.security.permissions.SubjectResolver;
import org.craftercms.commons.security.permissions.annotations.HasPermissionAnnotationHandler;
import org.craftercms.commons.security.permissions.impl.PermissionEvaluatorImpl;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.service.workflow.WorkflowService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.controller.rest.v2.WorkflowController;
import org.craftercms.studio.impl.v2.service.workflow.WorkflowServiceImpl;
import org.craftercms.studio.model.rest.ApiResponse;
import org.craftercms.studio.model.rest.PaginatedResultList;
import org.craftercms.studio.permissions.PermissionResolverImpl;
import org.junit.Before;
import org.junit.Test;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.util.List;
import java.util.Map;

import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_READ;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Item-state reads go through the controller before the real permission check.
 */
public class ItemStatesPermissionCheckTest {

	private static final String SITE_ID = "editorial";
	private static final String USERNAME = "admin";
	private static final String CONTENT_PATH = "/site/website/index.xml";

	private WorkflowController controller;
	private WorkflowService workflowServiceInternal;
	private UserService userService;

	@Before
	public void setUp() throws Exception {
		RolePermissionMappingsImpl mappings = new RolePermissionMappingsImpl();
		mappings.addRuleContentItemPermissionsMapping("/.*", List.of(PERMISSION_CONTENT_READ));

		userService = mock(UserService.class);
		when(userService.getUserPermissions(SITE_ID, CONTENT_PATH, USERNAME))
			.thenAnswer(invocation -> mappings.getPermissionsForPath(invocation.getArgument(1)));

		StudioConfiguration studioConfiguration = mock(StudioConfiguration.class);
		PermissionResolverImpl resolver = new PermissionResolverImpl(userService, studioConfiguration);
		PermissionEvaluator<String, Map<String, Object>> evaluator =
			new PermissionEvaluatorImpl<>(new FixedSubjectResolver(USERNAME), resolver);
		HasPermissionAnnotationHandler handler = new HasPermissionAnnotationHandler(
			Map.of(DefaultPermission.class, evaluator), "");

		workflowServiceInternal = mock(WorkflowService.class);
		AspectJProxyFactory proxyFactory = new AspectJProxyFactory(new WorkflowServiceImpl(workflowServiceInternal));
		proxyFactory.setProxyTargetClass(true);
		proxyFactory.addAspect(handler);
		controller = new WorkflowController(proxyFactory.getProxy(), mock(PublishService.class));
	}

	@Test
	public void missingPathIsRejectedBeforePermissionCheck() {
		assertThrows(InvalidParametersException.class, () -> controller.getItemStates(SITE_ID, null, null, 0, 10));

		verifyNoInteractions(userService, workflowServiceInternal);
	}

	@Test
	public void blankPathIsRejectedBeforePermissionCheck() {
		assertThrows(InvalidParametersException.class, () -> controller.getItemStates(SITE_ID, "  ", null, 0, 10));

		verifyNoInteractions(userService, workflowServiceInternal);
	}

	@Test
	public void invalidRegexIsRejectedBeforePermissionCheck() {
		assertThrows(InvalidParametersException.class, () -> controller.getItemStates(SITE_ID, "[", null, 0, 10));

		verifyNoInteractions(userService, workflowServiceInternal);
	}

	@Test
	public void validPathIsPermissionCheckedAndQueried() throws Exception {
		when(workflowServiceInternal.getItemStatesTotal(SITE_ID, CONTENT_PATH, null)).thenReturn(4);
		when(workflowServiceInternal.getItemsByStates(SITE_ID, CONTENT_PATH, null, 0, 10)).thenReturn(List.of());

		PaginatedResultList<?> result = controller.getItemStates(SITE_ID, CONTENT_PATH, null, 0, 10);

		assertSame(ApiResponse.OK, result.getResponse());
		assertEquals(4L, result.getTotal());
		verify(userService, times(2)).getUserPermissions(SITE_ID, CONTENT_PATH, USERNAME);
		verify(workflowServiceInternal).getItemStatesTotal(SITE_ID, CONTENT_PATH, null);
		verify(workflowServiceInternal).getItemsByStates(SITE_ID, CONTENT_PATH, null, 0, 10);
	}

	private static final class FixedSubjectResolver implements SubjectResolver<String> {

		private final String subject;

		private FixedSubjectResolver(String subject) {
			this.subject = subject;
		}

		@Override
		public String getCurrentSubject() {
			return subject;
		}
	}
}
