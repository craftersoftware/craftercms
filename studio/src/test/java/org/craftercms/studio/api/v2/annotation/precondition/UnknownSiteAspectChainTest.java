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

package org.craftercms.studio.api.v2.annotation.precondition;

import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.PermissionEvaluator;
import org.craftercms.commons.security.permissions.annotations.HasPermissionAnnotationHandler;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.security.HasAllPermissionsAnnotationHandler;
import org.craftercms.studio.api.v2.security.publish.PeerReviewCapableAnnotationHandler;
import org.craftercms.studio.api.v2.service.dependency.DependencyService;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.impl.v2.service.dependency.DependencyServiceImpl;
import org.craftercms.studio.impl.v2.service.publish.PublishServiceImpl;
import org.craftercms.studio.permissions.CompositePermission;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;

import java.lang.reflect.UndeclaredThrowableException;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;

/**
 * Real Spring proxy: site existence runs before permission and peer review.
 */
public class UnknownSiteAspectChainTest {

	private static final String UNKNOWN_SITE = "no-such-site";

	private AnnotationConfigApplicationContext context;
	private PublishService publishService;
	private DependencyService dependencyService;
	private PublishService publishServiceInternal;
	private DependencyService dependencyServiceInternal;
	private ServicesConfig servicesConfig;
	private PermissionEvaluator<String, Object> permissionEvaluator;

	@Before
	public void setUp() throws Exception {
		publishServiceInternal = mock(PublishService.class);
		dependencyServiceInternal = mock(DependencyService.class);
		servicesConfig = mock(ServicesConfig.class);
		permissionEvaluator = mock(PermissionEvaluator.class);
		when(permissionEvaluator.isAllowed(any(), any())).thenThrow(new AssertionError("permission check ran"));
		when(permissionEvaluator.isAllowed(any(), any(), any())).thenThrow(new AssertionError("permission check ran"));

		SitesService sitesService = mock(SitesService.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
		when(sitesService.exists(UNKNOWN_SITE)).thenReturn(false);

		context = new AnnotationConfigApplicationContext();
		context.register(ChainConfiguration.class);
		context.registerBean(SitesService.class, () -> sitesService);
		context.registerBean("publishServiceInternal", PublishService.class, () -> publishServiceInternal);
		context.registerBean("dependencyServiceInternal", DependencyService.class, () -> dependencyServiceInternal);
		context.registerBean(ServicesConfig.class, () -> servicesConfig);
		context.registerBean(PermissionEvaluator.class, () -> permissionEvaluator);
		context.refresh();

		publishService = context.getBean(PublishServiceImpl.class);
		dependencyService = context.getBean(DependencyServiceImpl.class);
	}

	@After
	public void closeContext() {
		if (context != null) {
			context.close();
		}
	}

	@Test
	public void unknownSiteIsRejectedBeforePublishPermissionChecks() throws Exception {
		SiteNotFoundException exception = assertThrows(SiteNotFoundException.class, () ->
			publishService.publish(UNKNOWN_SITE, "live", List.of(), List.of(), null, "title", "comment", false));

		assertTrue(exception.getMessage().contains(UNKNOWN_SITE));
		verify(publishServiceInternal, never()).publish(any(), any(), any(), any(), any(), any(), any(), anyBoolean());
		verify(servicesConfig, never()).isRequirePeerReview(anyString());
		verify(permissionEvaluator, never()).isAllowed(any(), any(), any());
	}

	@Test
	public void unknownSiteIsRejectedBeforeRequestPublish() throws Exception {
		SiteNotFoundException exception = assertThrows(SiteNotFoundException.class, () ->
			publishService.requestPublish(UNKNOWN_SITE, "live", List.of(), List.of(), null, "title", "comment", false));

		assertTrue(exception.getMessage().contains(UNKNOWN_SITE));
		verify(publishServiceInternal, never()).requestPublish(any(), any(), any(), any(), any(), any(), any(), anyBoolean());
		verify(permissionEvaluator, never()).isAllowed(any(), any());
	}

	@Test
	public void unknownSiteIsRejectedBeforePublishDependencies() throws Exception {
		// getSoftDependencies does not declare SiteNotFoundException, so the proxy wraps it.
		// ExceptionHandlers unwraps that wrapper and still responds 404.
		UndeclaredThrowableException wrapped = assertThrows(UndeclaredThrowableException.class, () ->
			dependencyService.getSoftDependencies(UNKNOWN_SITE, Set.of("/site/website/index.xml")));
		assertTrue(wrapped.getUndeclaredThrowable() instanceof SiteNotFoundException);
		assertTrue(wrapped.getUndeclaredThrowable().getMessage().contains(UNKNOWN_SITE));
		verify(dependencyServiceInternal, never()).getSoftDependencies(anyString(), any());
		verify(permissionEvaluator, never()).isAllowed(any(), any());
	}

	@Configuration
	@EnableAspectJAutoProxy(proxyTargetClass = true)
	static class ChainConfiguration {

		@Bean
		PublishServiceImpl publishService(PublishService publishServiceInternal) {
			PublishServiceImpl service = new PublishServiceImpl();
			service.setPublishServiceInternal(publishServiceInternal);
			return service;
		}

		@Bean
		DependencyServiceImpl dependencyService(DependencyService dependencyServiceInternal) {
			return new DependencyServiceImpl(dependencyServiceInternal);
		}

		@Bean
		RequireSiteExistsAnnotationHandler requireSiteExistsAnnotationHandler(SitesService sitesService) {
			return new RequireSiteExistsAnnotationHandler(sitesService);
		}

		@Bean
		PeerReviewCapableAnnotationHandler peerReviewCapableAnnotationHandler(ServicesConfig servicesConfig) {
			return new PeerReviewCapableAnnotationHandler(servicesConfig, null);
		}

		@Bean
		HasPermissionAnnotationHandler hasPermissionAnnotationHandler(PermissionEvaluator<String, Object> permissionEvaluator) {
			return new HasPermissionAnnotationHandler(Map.of(
			DefaultPermission.class, permissionEvaluator,
			CompositePermission.class, permissionEvaluator), "");
		}

		@Bean
		HasAllPermissionsAnnotationHandler hasAllPermissionsAnnotationHandler(PermissionEvaluator<String, Object> permissionEvaluator) {
			return new HasAllPermissionsAnnotationHandler(Map.of(CompositePermission.class, permissionEvaluator));
		}
	}
}
