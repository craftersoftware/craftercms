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

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.craftercms.commons.http.NamedCookieManager;
import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.SecurityDAO;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.junit.Test;
import org.springframework.security.core.Authentication;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
		var service = new AccessTokenServiceInternalImpl(null, null, 5, "sign-password-long-enough-for-hmac-sha-512-key-size-at-least-64-bytes-long!!", "encrypt", sessionTimeout,
			inactivityTimeout, MAX_EXTENSIONS, securityDao, null, null, studioConfiguration, null, retryingFacade, null,
			null, null);
		service.afterPropertiesSet();
		return service;
	}

	@Test
	public void sessionLimitIsCountedInWholeMinutes() {
		var service = createService(480, 30);
		var expectedExpiration = Instant.now().plusSeconds(120).truncatedTo(ChronoUnit.SECONDS);
		when(securityDao.getRefreshTokenExpiration(USER_ID, 481)).thenReturn(expectedExpiration.getEpochSecond());

		Instant expiration = service.getSessionLimitExpiration(USER_ID);

		assertEquals(expectedExpiration, expiration);
	}

	@Test
	public void sessionExpirationIsTheSameOnEveryCall() throws Exception {
		var service = createService(480, 30);
		when(securityDao.getRefreshTokenExpiration(USER_ID, 481)).thenReturn(Instant.now().getEpochSecond() + 120);
		service.setAudience("test-instance");
		service.setRefreshTokenCookieManager(mock(NamedCookieManager.class));
		service.setPreviewCookieManager(mock(NamedCookieManager.class));
		var request = mock(HttpServletRequest.class);
		var response = mock(HttpServletResponse.class);

		var first = service.createTokens(auth, request, response, false);
		Thread.sleep(20);
		var second = service.createTokens(auth, request, response, false);

		assertNotNull(first.getSessionExpiresAt());
		assertEquals(first.getSessionExpiresAt(), second.getSessionExpiresAt());
		assertSecondsMatch(first.getExpiresAt(), first.getExpiresIn());
		assertSecondsMatch(first.getSessionExpiresAt(), first.getSessionExpiresIn());
	}

	@Test
	public void noSessionExpiryOmitsTheSessionSeconds() throws Exception {
		var service = createService(20 * 60, 20 * 60);
		service.setAudience("test-instance");
		service.setRefreshTokenCookieManager(mock(NamedCookieManager.class));
		service.setPreviewCookieManager(mock(NamedCookieManager.class));

		var token = service.createTokens(auth, mock(HttpServletRequest.class), mock(HttpServletResponse.class), false);

		assertNull(token.getSessionExpiresAt());
		assertNull(token.getSessionExpiresIn());
		assertSecondsMatch(token.getExpiresAt(), token.getExpiresIn());
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
		verify(securityDao, never()).getRefreshTokenExpiration(anyLong(), anyInt());
	}

	@Test
	public void extendingRestartsTheSessionLimitWhileBelowTheCap() {
		var service = createService(480, 30);
		// No recorded activity, so the absolute session limit is the one reached next
		when(securityDao.getRefreshTokenExpiration(USER_ID, 481)).thenReturn(Instant.now().plusSeconds(120).getEpochSecond());
		when(securityDao.extendSession(USER_ID, MAX_EXTENSIONS)).thenReturn(1);

		service.extendSession(auth);

		verify(securityDao).extendSession(USER_ID, MAX_EXTENSIONS);
		assertEquals(1, service.userActivity.size());
	}

	@Test
	public void extendingIsRefusedOnceTheCapIsReached() {
		var service = createService(480, 30);
		when(securityDao.getRefreshTokenExpiration(USER_ID, 481)).thenReturn(Instant.now().plusSeconds(120).getEpochSecond());
		// The query only updates the token when the extensions used are below the maximum
		when(securityDao.extendSession(eq(USER_ID), eq(MAX_EXTENSIONS))).thenReturn(0);

		service.extendSession(auth);

		verify(securityDao).extendSession(USER_ID, MAX_EXTENSIONS);
		verify(securityDao, never()).resetSessionExtensions(anyLong());
		// Activity is still refreshed, but it does not move the session limit that is about to expire
		assertEquals(1, service.userActivity.size());
	}

	@Test
	public void inactivityExtendRefreshesActivityWithoutConsumingAnExtension() {
		var service = createService(480, 30);
		service.updateUserActivity(auth);
		Instant inactivityLimit = service.getInactivityExpiration(USER_ID);
		// Further out than the inactivity limit plus the tolerance, so inactivity is the one reached next
		when(securityDao.getRefreshTokenExpiration(USER_ID, 481))
			.thenReturn(inactivityLimit.plusSeconds(180).getEpochSecond());

		service.extendSession(auth);

		verify(securityDao, never()).extendSession(anyLong(), anyInt());
		assertEquals(1, service.userActivity.size());
	}

	@Test
	public void limitsWithinTheToleranceCountAsTheSessionLimit() {
		var service = createService(480, 30);
		service.updateUserActivity(auth);
		Instant inactivityLimit = service.getInactivityExpiration(USER_ID);
		when(securityDao.getRefreshTokenExpiration(USER_ID, 481))
			.thenReturn(inactivityLimit.plusSeconds(60).getEpochSecond());
		when(securityDao.extendSession(USER_ID, MAX_EXTENSIONS)).thenReturn(1);

		service.extendSession(auth);

		verify(securityDao).extendSession(USER_ID, MAX_EXTENSIONS);
	}

	@Test
	public void inactivityJustPastTheToleranceDoesNotConsumeAnExtension() {
		var service = createService(480, 30);
		service.updateUserActivity(auth);
		Instant inactivityLimit = service.getInactivityExpiration(USER_ID);
		when(securityDao.getRefreshTokenExpiration(USER_ID, 481))
			.thenReturn(inactivityLimit.plusSeconds(61).getEpochSecond());

		service.extendSession(auth);

		verify(securityDao, never()).extendSession(anyLong(), anyInt());
		assertEquals(1, service.userActivity.size());
	}

	@Test
	public void extendWithoutASessionLimitOnlyRefreshesActivity() {
		var service = createService(20 * 60, 30);

		service.extendSession(auth);

		verify(securityDao, never()).extendSession(anyLong(), anyInt());
		verify(securityDao, never()).getRefreshTokenExpiration(anyLong(), anyInt());
		assertEquals(1, service.userActivity.size());
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
	public void resetsCountSessionsOnLogin() {
		var service = createService(480, 30);

		service.resetSessionExtensions(auth);

		verify(securityDao).resetSessionExtensions(USER_ID);
	}

	/**
	 * {@code reported} was counted just before the token was returned, so it is the remaining whole seconds, or a
	 * second or two more if time passed since then.
	 */
	private static void assertSecondsMatch(Instant until, Long reported) {
		assertNotNull(until);
		assertNotNull(reported);
		long remaining = Math.max(0, Duration.between(Instant.now(), until).getSeconds());
		assertTrue(reported >= remaining && reported - remaining <= 5,
			"reported " + reported + " seconds, about " + remaining + " remain until " + until);
	}

}
