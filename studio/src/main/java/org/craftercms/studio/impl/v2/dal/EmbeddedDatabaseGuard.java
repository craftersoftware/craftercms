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

import org.apache.commons.lang3.StringUtils;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.utils.db.DbUrlUtils;
import org.craftercms.studio.impl.v2.utils.db.DbUrlUtils.HostAndPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

import static java.lang.String.format;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_ALLOW_EXTERNAL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_INITIALIZER_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_PORT;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.DB_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.SCRIPT_RUNNER_DB_URL;

/**
 * Prevents Studio from starting against an external database unless {@code studio.db.allowExternal} is true.
 * <p>
 * Checks {@code studio.db.url}, {@code studio.db.scriptRunnerUrl} and {@code studio.db.initializer.url}. A URL is
 * external when its host isn't a loopback address ({@code 127.0.0.1}, {@code localhost} or {@code ::1}), its port
 * isn't {@code studio.db.port}, or it can't be parsed. Only host and port are logged, never credentials or
 * query strings.
 * </p>
 * <p>
 * The embedded database and the connection pools depend on this bean, so the check runs before any connection
 * is opened. External databases are deprecated; this check and the setting will be removed in a future release.
 * </p>
 *
 * @since 5.0.0
 */
public class EmbeddedDatabaseGuard {

	private static final Logger defaultLogger = LoggerFactory.getLogger(EmbeddedDatabaseGuard.class);

	static final String[] CHECKED_URL_PROPERTIES = {DB_URL, SCRIPT_RUNNER_DB_URL, DB_INITIALIZER_URL};
	static final String UNPARSEABLE_ADDRESS = "<unrecognized address>";
	static final String NOT_ALLOWED_MESSAGE = "Crafter Studio is configured to use an external database at %s. " +
			"External databases are deprecated and unsupported. Migrate to the embedded database, or set '" +
			DB_ALLOW_EXTERNAL + ": true' in studio-config-override.yaml to start anyway. " +
			"This setting will be removed in a future release.";
	static final String ALLOWED_MESSAGE = "Crafter Studio is using an external database at {} because '" +
			DB_ALLOW_EXTERNAL + "' is true. External databases are deprecated and unsupported. Migrate to the " +
			"embedded database. This setting will be removed in a future release.";

	private final StudioConfiguration studioConfiguration;
	private final Logger logger;

	public EmbeddedDatabaseGuard(final StudioConfiguration studioConfiguration) {
		this(studioConfiguration, defaultLogger);
	}

	EmbeddedDatabaseGuard(final StudioConfiguration studioConfiguration, final Logger logger) {
		this.studioConfiguration = studioConfiguration;
		this.logger = logger;
	}

	/**
	 * Checks the database URLs.
	 *
	 * @throws IllegalStateException if an external database is configured and not allowed
	 */
	public void check() {
		int port = studioConfiguration.getProperty(DB_PORT, Integer.class);
		List<String> externals = new ArrayList<>();
		for (String property : CHECKED_URL_PROPERTIES) {
			String url = studioConfiguration.getProperty(property);
			if (StringUtils.isBlank(url) || DbUrlUtils.isEmbedded(url, port)) {
				continue;
			}
			HostAndPort hostAndPort = DbUrlUtils.parseHostAndPort(url);
			String address = hostAndPort != null ? hostAndPort.toString() : UNPARSEABLE_ADDRESS;
			externals.add(format("%s (%s)", address, property));
		}
		if (externals.isEmpty()) {
			return;
		}

		String locations = String.join(", ", externals);
		if (!studioConfiguration.getProperty(DB_ALLOW_EXTERNAL, Boolean.class, false)) {
			String message = format(NOT_ALLOWED_MESSAGE, locations);
			logger.error(message);
			throw new IllegalStateException(message);
		}
		logger.warn(ALLOWED_MESSAGE, locations);
	}
}
