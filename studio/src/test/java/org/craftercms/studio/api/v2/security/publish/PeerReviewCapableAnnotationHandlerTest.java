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

package org.craftercms.studio.api.v2.security.publish;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.reflect.MethodSignature;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.annotation.publish.PackageId;
import org.craftercms.studio.api.v2.annotation.publish.PackageIds;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.exception.publish.PublishPackageNotFoundException;
import org.craftercms.studio.api.v2.exception.security.PeerReviewCheckException;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.security.core.Authentication;

import java.lang.reflect.Method;
import java.util.Collection;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class PeerReviewCapableAnnotationHandlerTest {

	private static final String SITE_ID = "editorial";
	private static final long PACKAGE_ID = 999999L;

	@Mock
	private ServicesConfig servicesConfig;
	@Mock
	private PublishDAO publishDao;
	@Mock
	private ProceedingJoinPoint pjp;
	@Mock
	private MethodSignature signature;

	private PeerReviewCapableAnnotationHandler handler;

	@Before
	public void setUp() throws SiteNotFoundException {
		handler = new PeerReviewCapableAnnotationHandler(servicesConfig, publishDao);
		when(servicesConfig.isRequirePeerReview(SITE_ID)).thenReturn(true);
		when(pjp.getSignature()).thenReturn(signature);
	}

	@Test
	public void missingPackageOnApproveIsNotFound() throws Throwable {
		stubMethod(PeerReviewTarget.class.getMethod("approve", String.class, Collection.class),
			new Object[]{SITE_ID, List.of(PACKAGE_ID)});

		PublishPackageNotFoundException exception = assertThrows(PublishPackageNotFoundException.class,
			() -> withUser(() -> handler.checkPeerReview(pjp)));

		assertEquals(SITE_ID, exception.getSiteId());
		assertEquals(PACKAGE_ID, exception.getPackageId().longValue());
		verify(publishDao).getByStringSiteId(SITE_ID, PACKAGE_ID);
		verify(pjp, never()).proceed();
	}

	@Test
	public void directPublishWithoutPackageIdIsRejected() throws Throwable {
		stubMethod(PeerReviewTarget.class.getMethod("publish", String.class), new Object[]{SITE_ID});

		assertThrows(PeerReviewCheckException.class, () -> withUser(() -> handler.checkPeerReview(pjp)));

		verify(publishDao, never()).getByStringSiteId(anyString(), anyLong());
		verify(pjp, never()).proceed();
	}

	@Test
	public void reviewerOfASinglePackageProceeds() throws Throwable {
		stubMethod(PeerReviewTarget.class.getMethod("review", String.class, long.class),
			new Object[]{SITE_ID, PACKAGE_ID});
		PublishPackage publishPackage = new PublishPackage();
		publishPackage.setSubmitterId(99L);
		when(publishDao.getByStringSiteId(SITE_ID, PACKAGE_ID)).thenReturn(publishPackage);
		when(pjp.proceed()).thenReturn("published");

		withUser(() -> {
			assertEquals("published", handler.checkPeerReview(pjp));
		});
	}

	@Test
	public void missingSinglePackageIsNotFound() throws Throwable {
		stubMethod(PeerReviewTarget.class.getMethod("review", String.class, long.class),
			new Object[]{SITE_ID, PACKAGE_ID});

		PublishPackageNotFoundException exception = assertThrows(PublishPackageNotFoundException.class,
			() -> withUser(() -> handler.checkPeerReview(pjp)));

		assertEquals(SITE_ID, exception.getSiteId());
		assertEquals(PACKAGE_ID, exception.getPackageId().longValue());
		verify(publishDao).getByStringSiteId(SITE_ID, PACKAGE_ID);
		verify(pjp, never()).proceed();
	}

	private void stubMethod(Method method, Object[] args) {
		when(signature.getMethod()).thenReturn(method);
		when(pjp.getArgs()).thenReturn(args);
	}

	private void withUser(ThrowingRunnable action) throws Throwable {
		User user = new User();
		user.setId(4L);
		Authentication authentication = mock(Authentication.class);
		when(authentication.getPrincipal()).thenReturn(user);
		try (MockedStatic<SecurityUtils> security = mockStatic(SecurityUtils.class)) {
			security.when(SecurityUtils::getAuthentication).thenReturn(authentication);
			action.run();
		}
	}

	@FunctionalInterface
	private interface ThrowingRunnable {
		void run() throws Throwable;
	}

	public static class PeerReviewTarget {
		public void approve(@SiteId String siteId, @PackageIds Collection<Long> packageIds) {
		}

		public void review(@SiteId String siteId, @PackageId long packageId) {
		}

		public void publish(@SiteId String siteId) {
		}
	}
}
