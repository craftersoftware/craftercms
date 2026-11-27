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
package org.craftercms.engine;

import org.junit.Test;
import org.springframework.util.PropertyPlaceholderHelper;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

/**
 * The core cache API ({@code /api/1/cache/clear} and {@code /api/1/cache/clear_all}) reads
 * {@code crafter.core.rest.management.authorizationToken}. Engine must point that property at the Engine
 * management token so an installation override of the Engine token covers the cache API too.
 */
public class CoreCacheManagementTokenConfigurationTest {

	private static final String CORE_TOKEN = "crafter.core.rest.management.authorizationToken";
	private static final String ENGINE_TOKEN = "crafter.engine.management.authorizationToken";
	private static final String SHIPPED_TOKEN = "defaultManagementToken";

	private final PropertyPlaceholderHelper placeholders = new PropertyPlaceholderHelper("${", "}");

	@Test
	public void coreCacheTokenFollowsTheEngineManagementToken() throws IOException {
		Properties properties = loadRenderingProperties();

		assertEquals("${" + ENGINE_TOKEN + "}", properties.getProperty(CORE_TOKEN));
		assertEquals(SHIPPED_TOKEN, placeholders.replacePlaceholders(properties.getProperty(CORE_TOKEN), properties));

		properties.setProperty(ENGINE_TOKEN, "changed-engine-token");

		assertEquals("changed-engine-token",
			placeholders.replacePlaceholders(properties.getProperty(CORE_TOKEN), properties));
	}

	/**
	 * Same file order as {@code main-rendering-context.xml}: core defaults, then Engine config.
	 * A later file overrides the same key.
	 */
	private Properties loadRenderingProperties() throws IOException {
		Properties properties = new Properties();
		load(properties, "crafter/core/core.properties");
		load(properties, "crafter/engine/server-config.properties");
		return properties;
	}

	private void load(Properties properties, String classpathLocation) throws IOException {
		try (InputStream input = getClass().getClassLoader().getResourceAsStream(classpathLocation)) {
			assertNotNull(classpathLocation, input);
			properties.load(input);
		}
	}

}
