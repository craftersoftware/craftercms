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
import org.craftercms.studio.api.v2.annotation.publish.PackageId;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.exception.publish.PublishPackageNotFoundException;
import org.craftercms.studio.api.v2.exception.security.PackageSubmitterCheckException;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;

import java.lang.reflect.Method;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class PackageSubmitterAnnotationHandlerTest {

	private static final String SITE_ID = "editorial";
	private static final long PACKAGE_ID = 999999L;
	private static final long SUBMITTER_ID = 7L;
	private static final long OTHER_USER_ID = 8L;

	@Mock
	private PublishDAO publishDao;
	@Mock
	private ProceedingJoinPoint pjp;
	@Mock
	private MethodSignature signature;

	private PackageSubmitterAnnotationHandler handler;

	@Before
	public void setUp() throws NoSuchMethodException {
		handler = new PackageSubmitterAnnotationHandler(publishDao);
		Method method = PackageSubmitterTarget.class.getMethod("update", String.class, long.class);
		when(pjp.getSignature()).thenReturn(signature);
		when(signature.getMethod()).thenReturn(method);
		when(pjp.getArgs()).thenReturn(new Object[]{SITE_ID, PACKAGE_ID});
	}

	@Test
	public void orderRunsAfterPackageExistenceCheck() {
		Order order = PackageSubmitterAnnotationHandler.class.getAnnotation(Order.class);
		assertEquals(Order.class, order.annotationType());
		assertEquals(20, order.value());
	}

	@Test
	public void missingPackageIsNotFound() throws Throwable {
		PublishPackageNotFoundException exception = assertThrows(PublishPackageNotFoundException.class,
			() -> handler.checkPublishPackageSubmitter(pjp));

		assertEquals(SITE_ID, exception.getSiteId());
		assertEquals(PACKAGE_ID, exception.getPackageId().longValue());
		verify(publishDao).getByStringSiteId(SITE_ID, PACKAGE_ID);
		verify(pjp, never()).proceed();
	}

	@Test
	public void nonSubmitterIsRejected() throws Throwable {
		PublishPackage publishPackage = new PublishPackage();
		publishPackage.setSubmitterId(SUBMITTER_ID);
		when(publishDao.getByStringSiteId(SITE_ID, PACKAGE_ID)).thenReturn(publishPackage);

		User user = new User();
		user.setId(OTHER_USER_ID);
		Authentication authentication = mock(Authentication.class);
		when(authentication.getPrincipal()).thenReturn(user);

		try (MockedStatic<SecurityUtils> security = mockStatic(SecurityUtils.class)) {
			security.when(SecurityUtils::getAuthentication).thenReturn(authentication);

			assertThrows(PackageSubmitterCheckException.class, () -> handler.checkPublishPackageSubmitter(pjp));
		}
		verify(pjp, never()).proceed();
	}

	public static class PackageSubmitterTarget {
		public void update(@SiteId String siteId, @PackageId long packageId) {
		}
	}
}
