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

import static org.craftercms.studio.impl.v2.service.security.internal.AccessTokenServiceInternalImpl.ACTIVITY_CACHE_CONFIG_KEY;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
		var service = new AccessTokenServiceInternalImpl(null, null, 5, "sign", "encrypt", sessionTimeout,
			inactivityTimeout, securityDao, null, null, studioConfiguration, null, retryingFacade, null, null, null);
		service.afterPropertiesSet();
		return service;
	}

	@Test
	public void expiresAtTheEarliestTimeLimit() {
		var service = createService(480, 30);
		when(securityDao.getRefreshTokenRemainingSeconds(USER_ID, 481)).thenReturn(3600L);
		service.updateUserActivity(auth);

		Instant expiration = service.getSessionExpiration(auth);

		// Inactivity (31 minutes) comes before the session limit (1 hour)
		assertNotNull(expiration);
		assertTrue(Duration.between(Instant.now(), expiration).toMinutes() <= 31);
		assertTrue(Duration.between(Instant.now(), expiration).toMinutes() >= 30);
	}

	@Test
	public void sessionLimitCanComeBeforeInactivity() {
		var service = createService(480, 30);
		when(securityDao.getRefreshTokenRemainingSeconds(USER_ID, 481)).thenReturn(120L);
		service.updateUserActivity(auth);

		Instant expiration = service.getSessionExpiration(auth);

		assertNotNull(expiration);
		assertTrue(Duration.between(Instant.now(), expiration).getSeconds() <= 120);
	}

	@Test
	public void inactivityIsIgnoredUntilThereIsActivity() {
		var service = createService(480, 30);
		when(securityDao.getRefreshTokenRemainingSeconds(USER_ID, 481)).thenReturn(600L);

		Instant expiration = service.getSessionExpiration(auth);

		assertNotNull(expiration);
		assertTrue(Duration.between(Instant.now(), expiration).getSeconds() <= 600);
	}

	@Test
	public void limitsOfTwentyHoursOrMoreAreNotReported() {
		var service = createService(20 * 60, 20 * 60);
		service.updateUserActivity(auth);

		assertNull(service.getSessionExpiration(auth));
		verify(securityDao, never()).getRefreshTokenRemainingSeconds(anyLong(), anyInt());
	}

	@Test
	public void onlyTheLimitBelowTwentyHoursIsReported() {
		var service = createService(20 * 60, 30);
		service.updateUserActivity(auth);

		Instant expiration = service.getSessionExpiration(auth);

		assertNotNull(expiration);
		assertTrue(Duration.between(Instant.now(), expiration).toMinutes() <= 31);
		verify(securityDao, never()).getRefreshTokenRemainingSeconds(anyLong(), anyInt());
	}

	@Test
	public void extendingRestartsBothTimeLimits() {
		var service = createService(480, 30);

		service.extendSession(auth);

		verify(securityDao).resetRefreshTokenCreatedOn(USER_ID);
		assertEquals(1, service.userActivity.size());
	}

}
