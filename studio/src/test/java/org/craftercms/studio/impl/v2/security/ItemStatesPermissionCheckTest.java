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
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.service.workflow.WorkflowService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.service.workflow.WorkflowServiceImpl;
import org.craftercms.studio.permissions.PermissionResolverImpl;
import org.junit.Before;
import org.junit.Test;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.util.List;
import java.util.Map;

import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_READ;
import static org.junit.Assert.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Drives item-state reads through the real permission handler, resolver, and path rules.
 */
public class ItemStatesPermissionCheckTest {

	private static final String SITE_ID = "editorial";
	private static final String USERNAME = "admin";
	private static final String CONTENT_PATH = "/site/website/index.xml";

	private WorkflowService workflowService;
	private WorkflowService workflowServiceInternal;
	private UserService userService;
	private RolePermissionMappingsImpl mappings;

	@Before
	public void setUp() throws Exception {
		mappings = new RolePermissionMappingsImpl();
		mappings.addRuleContentItemPermissionsMapping("/.*", List.of(PERMISSION_CONTENT_READ));

		userService = mock(UserService.class);
		when(userService.getUserPermissions(eq(SITE_ID), any(), eq(USERNAME)))
			.thenAnswer(invocation -> mappings.getPermissionsForPath(invocation.getArgument(1)));

		StudioConfiguration studioConfiguration = mock(StudioConfiguration.class);
		PermissionResolverImpl resolver = new PermissionResolverImpl(userService, studioConfiguration);
		PermissionEvaluator<String, Map<String, Object>> evaluator =
			new PermissionEvaluatorImpl<>(new FixedSubjectResolver(USERNAME), resolver);
		HasPermissionAnnotationHandler handler = new HasPermissionAnnotationHandler(
			Map.of(DefaultPermission.class, evaluator), "");

		workflowServiceInternal = mock(WorkflowService.class);
		when(workflowServiceInternal.getItemStatesTotal(eq(SITE_ID), any(), any()))
			.thenReturn(4);
		AspectJProxyFactory proxyFactory = new AspectJProxyFactory(new WorkflowServiceImpl(workflowServiceInternal));
		proxyFactory.setProxyTargetClass(true);
		proxyFactory.addAspect(handler);
		workflowService = proxyFactory.getProxy();
	}

	@Test
	public void nullPathIsCheckedAtTheSiteRootAndQueriedAsOmitted() throws Exception {
		assertEquals(4, workflowService.getItemStatesTotal(SITE_ID, null, null));

		verify(userService).getUserPermissions(SITE_ID, "/", USERNAME);
		verify(workflowServiceInternal).getItemStatesTotal(SITE_ID, null, null);
	}

	@Test
	public void blankPathIsCheckedAtTheSiteRootAndQueriedUnchanged() throws Exception {
		assertEquals(4, workflowService.getItemStatesTotal(SITE_ID, "  ", null));

		verify(userService).getUserPermissions(SITE_ID, "/", USERNAME);
		verify(workflowServiceInternal).getItemStatesTotal(SITE_ID, "  ", null);
	}

	@Test
	public void contentPathIsCheckedAndQueriedAsGiven() throws Exception {
		workflowService.getItemsByStates(SITE_ID, CONTENT_PATH, null, 0, 10);

		verify(userService).getUserPermissions(SITE_ID, CONTENT_PATH, USERNAME);
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
