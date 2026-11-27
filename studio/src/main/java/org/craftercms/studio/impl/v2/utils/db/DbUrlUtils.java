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

package org.craftercms.studio.impl.v2.utils.db;

import org.apache.commons.lang3.StringUtils;

import static org.apache.commons.lang3.Strings.CI;
import static org.apache.commons.lang3.Strings.CS;

/**
 * Utility methods to inspect the JDBC URLs used by Studio.
 *
 * @since 5.0.0
 */
public final class DbUrlUtils {

	private static final String[] SUPPORTED_PREFIXES = {"jdbc:mariadb://", "jdbc:mysql://"};
	private static final String[] LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"};

	private DbUrlUtils() {
	}

	/**
	 * Indicates if the given JDBC URL points to the embedded database: a single loopback host
	 * ({@code 127.0.0.1}, {@code localhost} or {@code ::1}) and the given port.
	 * A URL that can't be parsed, has no port or has multiple hosts is considered external.
	 *
	 * @param url  the JDBC URL
	 * @param port the embedded database port
	 * @return true if the URL points to the embedded database, false otherwise
	 */
	public static boolean isEmbedded(final String url, final int port) {
		HostAndPort hostAndPort = parseHostAndPort(url);
		return hostAndPort != null && hostAndPort.port() == port && CI.equalsAny(hostAndPort.host(), LOOPBACK_HOSTS);
	}

	/**
	 * Extracts the host and port of a single-host MariaDB/MySQL JDBC URL.
	 *
	 * @param url the JDBC URL
	 * @return the host and port, or null if the URL can't be parsed, has no port or has multiple hosts
	 */
	public static HostAndPort parseHostAndPort(final String url) {
		if (StringUtils.isBlank(url)) {
			return null;
		}
		String prefix = null;
		for (String supportedPrefix : SUPPORTED_PREFIXES) {
			if (CI.startsWith(url, supportedPrefix)) {
				prefix = supportedPrefix;
				break;
			}
		}
		if (prefix == null) {
			return null;
		}
		String authority = url.substring(prefix.length());
		int end = StringUtils.indexOfAny(authority, '/', '?', ';');
		if (end >= 0) {
			authority = authority.substring(0, end);
		}
		// Credentials, multiple hosts or address=(...) syntax are not supported
		if (StringUtils.isEmpty(authority) || StringUtils.containsAny(authority, '@', ',', '(', ')', ' ')) {
			return null;
		}

		String host;
		String portStr;
		if (CS.startsWith(authority, "[")) {
			int closing = authority.indexOf(']');
			if (closing < 0 || !CS.startsWith(authority.substring(closing + 1), ":")) {
				return null;
			}
			host = authority.substring(1, closing);
			portStr = authority.substring(closing + 2);
		} else {
			int colon = authority.indexOf(':');
			if (colon < 0 || colon != authority.lastIndexOf(':')) {
				return null;
			}
			host = authority.substring(0, colon);
			portStr = authority.substring(colon + 1);
		}
		if (StringUtils.isEmpty(host) || portStr.isEmpty() || !StringUtils.isNumeric(portStr) || portStr.length() > 5) {
			return null;
		}
		int port = Integer.parseInt(portStr);
		if (port < 1 || port > 65535) {
			return null;
		}
		return new HostAndPort(host, port);
	}

	/**
	 * Host and port of a JDBC URL
	 *
	 * @param host the host
	 * @param port the port
	 */
	public record HostAndPort(String host, int port) {

		@Override
		public String toString() {
			return host.indexOf(':') >= 0 ? "[" + host + "]:" + port : host + ":" + port;
		}
	}
}
