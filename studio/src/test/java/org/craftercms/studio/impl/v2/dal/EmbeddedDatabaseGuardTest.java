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

package org.craftercms.studio.impl.v2.dal;

import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.junit.Before;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.slf4j.Logger;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_ALLOW_EXTERNAL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_INITIALIZER_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_PORT;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SCRIPT_RUNNER_DB_URL;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

public class EmbeddedDatabaseGuardTest {

	private static final String EMBEDDED_URL =
			"jdbc:mariadb://127.0.0.1:33306/crafter?user=crafter&password=crafter&socketTimeout=60000";
	private static final String EMBEDDED_SCRIPT_RUNNER_URL = EMBEDDED_URL + "&allowMultiQueries=true";
	private static final String EMBEDDED_INITIALIZER_URL = "jdbc:mariadb://127.0.0.1:33306?user=root&password=rootpw";
	private static final String EXTERNAL_URL =
			"jdbc:mariadb://db.example.com:3306/crafter?user=crafter&password=s3cr3t&socketTimeout=60000";

	private StudioConfiguration studioConfiguration;
	private Logger logger;
	private EmbeddedDatabaseGuard guard;

	@Before
	public void setUp() {
		studioConfiguration = mock(StudioConfiguration.class);
		logger = mock(Logger.class);
		when(studioConfiguration.getProperty(DB_PORT, Integer.class)).thenReturn(33306);
		when(studioConfiguration.getProperty(DB_URL)).thenReturn(EMBEDDED_URL);
		when(studioConfiguration.getProperty(SCRIPT_RUNNER_DB_URL)).thenReturn(EMBEDDED_SCRIPT_RUNNER_URL);
		when(studioConfiguration.getProperty(DB_INITIALIZER_URL)).thenReturn(EMBEDDED_INITIALIZER_URL);
		allowExternal(false);
		guard = new EmbeddedDatabaseGuard(studioConfiguration, logger);
	}

	private void allowExternal(boolean allow) {
		when(studioConfiguration.getProperty(DB_ALLOW_EXTERNAL, Boolean.class, false)).thenReturn(allow);
	}

	@Test
	public void embeddedPassesSilently() {
		guard.check();
		verifyNoInteractions(logger);
	}

	@Test
	public void embeddedWithOptInPassesSilently() {
		allowExternal(true);
		guard.check();
		verifyNoInteractions(logger);
	}

	@Test
	public void localhostAndIpv6LoopbackPass() {
		when(studioConfiguration.getProperty(DB_URL)).thenReturn("jdbc:mariadb://localhost:33306/crafter");
		when(studioConfiguration.getProperty(SCRIPT_RUNNER_DB_URL)).thenReturn("jdbc:mariadb://[::1]:33306/crafter");
		guard.check();
		verifyNoInteractions(logger);
	}

	@Test
	public void externalWithoutOptInFailsWithHostAndPortOnly() {
		when(studioConfiguration.getProperty(DB_URL)).thenReturn(EXTERNAL_URL);

		IllegalStateException e = assertThrows(IllegalStateException.class, guard::check);

		String message = e.getMessage();
		assertTrue(message, message.contains("at db.example.com:3306 (studio.db.url)"));
		assertTrue(message, message.contains("studio.db.allowExternal: true"));
		assertNoSecrets(message);
		verify(logger).error(message);
		verify(logger, never()).warn(anyString(), any(Object.class));
	}

	@Test
	public void externalWithOptInWarnsOnce() {
		allowExternal(true);
		when(studioConfiguration.getProperty(DB_URL)).thenReturn(EXTERNAL_URL);
		when(studioConfiguration.getProperty(SCRIPT_RUNNER_DB_URL)).thenReturn(EXTERNAL_URL + "&allowMultiQueries=true");
		when(studioConfiguration.getProperty(DB_INITIALIZER_URL)).thenReturn("jdbc:mariadb://db.example.com:3306?user=root&password=s3cr3t");

		guard.check();

		ArgumentCaptor<Object> locations = ArgumentCaptor.forClass(Object.class);
		verify(logger, times(1)).warn(eq(EmbeddedDatabaseGuard.ALLOWED_MESSAGE), locations.capture());
		verify(logger, never()).error(anyString());
		String logged = locations.getValue().toString();
		assertTrue(logged, logged.contains("db.example.com:3306 (studio.db.url)"));
		assertTrue(logged, logged.contains("db.example.com:3306 (studio.db.scriptRunnerUrl)"));
		assertTrue(logged, logged.contains("db.example.com:3306 (studio.db.initializer.url)"));
		assertNoSecrets(logged);
	}

	@Test
	public void scriptRunnerUrlIsChecked() {
		when(studioConfiguration.getProperty(SCRIPT_RUNNER_DB_URL)).thenReturn(EXTERNAL_URL);
		IllegalStateException e = assertThrows(IllegalStateException.class, guard::check);
		assertTrue(e.getMessage(), e.getMessage().contains("db.example.com:3306 (studio.db.scriptRunnerUrl)"));
		assertFalse(e.getMessage(), e.getMessage().contains("(studio.db.url)"));
	}

	@Test
	public void initializerUrlIsChecked() {
		when(studioConfiguration.getProperty(DB_INITIALIZER_URL)).thenReturn("jdbc:mariadb://10.0.0.5:33306?user=root&password=s3cr3t");
		IllegalStateException e = assertThrows(IllegalStateException.class, guard::check);
		assertTrue(e.getMessage(), e.getMessage().contains("10.0.0.5:33306 (studio.db.initializer.url)"));
		assertNoSecrets(e.getMessage());
	}

	@Test
	public void wrongPortIsExternal() {
		when(studioConfiguration.getProperty(DB_URL)).thenReturn("jdbc:mariadb://127.0.0.1:3306/crafter");
		IllegalStateException e = assertThrows(IllegalStateException.class, guard::check);
		assertTrue(e.getMessage(), e.getMessage().contains("127.0.0.1:3306 (studio.db.url)"));
	}

	@Test
	public void unparseableUrlIsExternalAndNotLogged() {
		when(studioConfiguration.getProperty(DB_URL)).thenReturn("jdbc:mariadb://crafter:s3cr3t@db.example.com:3306/crafter");
		IllegalStateException e = assertThrows(IllegalStateException.class, guard::check);
		assertTrue(e.getMessage(), e.getMessage().contains(EmbeddedDatabaseGuard.UNPARSEABLE_ADDRESS + " (studio.db.url)"));
		assertNoSecrets(e.getMessage());
		assertFalse(e.getMessage(), e.getMessage().contains("db.example.com"));
	}

	private static void assertNoSecrets(String text) {
		assertFalse(text, text.contains("s3cr3t"));
		assertFalse(text, text.contains("password"));
		assertFalse(text, text.contains("user="));
		assertFalse(text, text.contains("?"));
		assertFalse(text, text.contains("jdbc:"));
	}
}
