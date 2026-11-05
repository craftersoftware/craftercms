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

package org.craftercms.studio.impl.v2.service.security.internal;

import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.SecurityDAO;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.junit.Test;
import org.springframework.security.core.Authentication;

import java.time.Duration;
import java.time.Instant;
import java.util.function.Supplier;

import static org.craftercms.studio.impl.v2.service.security.internal.AccessTokenServiceInternalImpl.ACTIVITY_CACHE_CONFIG_KEY;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class AccessTokenServiceInternalImplTest {

	private static final long USER_ID = 7;
	private static final int MAX_EXTENSIONS = 10;

	private final SecurityDAO securityDao = mock(SecurityDAO.class);
	private final RetryingDatabaseOperationFacade retryingFacade = mock(RetryingDatabaseOperationFacade.class);
	private final Authentication auth = mock(Authentication.class);

	private AccessTokenServiceInternalImpl createService(int sessionTimeout, int inactivityTimeout) {
		var studioConfiguration = mock(StudioConfiguration.class);
		when(studioConfiguration.getProperty(ACTIVITY_CACHE_CONFIG_KEY)).thenReturn("maximumSize=10");
		var user = new User();
		user.setId(USER_ID);
		when(auth.getPrincipal()).thenReturn(user);
		doAnswer(invocation -> {
			((Runnable) invocation.getArgument(0)).run();
			return null;
		}).when(retryingFacade).retry(any(Runnable.class));
		when(retryingFacade.retry(any(Supplier.class))).thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(0)).get());
		var service = new AccessTokenServiceInternalImpl(null, null, 5, "sign", "encrypt", sessionTimeout,
			inactivityTimeout, MAX_EXTENSIONS, securityDao, null, null, studioConfiguration, null, retryingFacade, null,
			null, null);
		service.afterPropertiesSet();
		return service;
	}

	@Test
	public void sessionLimitIsCountedInWholeMinutes() {
		var service = createService(480, 30);
		when(securityDao.getRefreshTokenRemainingSeconds(USER_ID, 481)).thenReturn(120L);

		Instant expiration = service.getSessionLimitExpiration(USER_ID);

		assertNotNull(expiration);
		assertTrue(Duration.between(Instant.now(), expiration).getSeconds() <= 120);
	}

	@Test
	public void inactivityLimitStartsWithTheActivity() {
		var service = createService(480, 30);
		assertNull(service.getInactivityExpiration(USER_ID));

		service.updateUserActivity(auth);
		Instant expiration = service.getInactivityExpiration(USER_ID);

		assertNotNull(expiration);
		assertTrue(Duration.between(Instant.now(), expiration).toMinutes() <= 31);
		assertTrue(Duration.between(Instant.now(), expiration).toMinutes() >= 30);
	}

	@Test
	public void limitsOfTwentyHoursOrMoreAreNotReported() {
		var service = createService(20 * 60, 20 * 60);
		service.updateUserActivity(auth);

		assertNull(service.getSessionLimitExpiration(USER_ID));
		assertNull(service.getInactivityExpiration(USER_ID));
		verify(securityDao, never()).getRefreshTokenRemainingSeconds(anyLong(), anyInt());
	}

	@Test
	public void extendingRestartsTheSessionLimitWhileBelowTheCap() {
		var service = createService(480, 30);
		when(securityDao.extendSession(USER_ID, MAX_EXTENSIONS)).thenReturn(1);

		service.extendSession(auth);

		verify(securityDao).extendSession(USER_ID, MAX_EXTENSIONS);
		assertEquals(1, service.userActivity.size());
	}

	@Test
	public void extendingIsRefusedOnceTheCapIsReached() {
		var service = createService(480, 30);
		// The query only updates the token when the extensions used are below the maximum
		when(securityDao.extendSession(eq(USER_ID), eq(MAX_EXTENSIONS))).thenReturn(0);

		service.extendSession(auth);

		verify(securityDao).extendSession(USER_ID, MAX_EXTENSIONS);
		verify(securityDao, never()).resetSessionExtensions(anyLong());
	}

	@Test
	public void sessionCanBeExtendedBelowTheCap() {
		var service = createService(480, 30);
		var sessionLimit = Instant.now().plusSeconds(60);
		when(securityDao.getSessionExtensions(USER_ID)).thenReturn(MAX_EXTENSIONS - 1);

		assertTrue(service.canExtendSession(USER_ID, sessionLimit, null));
	}

	@Test
	public void sessionCanNotBeExtendedAtTheCapWhenTheSessionLimitIsNext() {
		var service = createService(480, 30);
		var sessionLimit = Instant.now().plusSeconds(60);
		when(securityDao.getSessionExtensions(USER_ID)).thenReturn(MAX_EXTENSIONS);

		assertFalse(service.canExtendSession(USER_ID, sessionLimit, null));
		assertFalse(service.canExtendSession(USER_ID, sessionLimit, sessionLimit.plusSeconds(30)));
	}

	@Test
	public void sessionCanNotBeExtendedAtTheCapWhenBothLimitsAreAboutToExpire() {
		var service = createService(480, 30);
		var now = Instant.now();
		when(securityDao.getSessionExtensions(USER_ID)).thenReturn(MAX_EXTENSIONS);

		assertFalse(service.canExtendSession(USER_ID, now.plusSeconds(60), now.plusSeconds(59)));
	}

	@Test
	public void sessionCanBeExtendedAtTheCapWhenInactivityIsNext() {
		var service = createService(480, 30);
		var sessionLimit = Instant.now().plusSeconds(600);
		when(securityDao.getSessionExtensions(USER_ID)).thenReturn(MAX_EXTENSIONS);

		assertTrue(service.canExtendSession(USER_ID, sessionLimit, sessionLimit.minusSeconds(300)));
	}

	@Test
	public void sessionCanBeExtendedWhenThereIsNoSessionLimit() {
		var service = createService(20 * 60, 30);

		assertTrue(service.canExtendSession(USER_ID, null, Instant.now().plusSeconds(60)));
		verify(securityDao, never()).getSessionExtensions(anyLong());
	}

	@Test
	public void loginStartsCountingExtensionsFromZero() {
		var service = createService(480, 30);

		service.resetSessionExtensions(auth);

		verify(securityDao).resetSessionExtensions(USER_ID);
	}

}
