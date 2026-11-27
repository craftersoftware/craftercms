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

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

public class DbUrlUtilsTest {

	private static final int PORT = 33306;

	private static final String[] EMBEDDED_URLS = {
			"jdbc:mariadb://127.0.0.1:33306/crafter?user=crafter&password=crafter&socketTimeout=60000",
			"jdbc:mariadb://localhost:33306/crafter",
			"jdbc:mariadb://LOCALHOST:33306",
			"jdbc:mariadb://[::1]:33306/crafter",
			"jdbc:mysql://127.0.0.1:33306?user=root&password=secret",
			"jdbc:mariadb://127.0.0.1:33306"
	};

	private static final String[] EXTERNAL_URLS = {
			// remote host
			"jdbc:mariadb://db.example.com:33306/crafter?user=crafter&password=crafter",
			"jdbc:mariadb://10.0.0.5:33306/crafter",
			// wrong port
			"jdbc:mariadb://127.0.0.1:3306/crafter",
			// no port
			"jdbc:mariadb://127.0.0.1/crafter",
			"jdbc:mariadb://localhost",
			// multi-host
			"jdbc:mariadb://127.0.0.1:33306,db.example.com:33306/crafter",
			"jdbc:mariadb:replication://127.0.0.1:33306/crafter",
			"jdbc:mariadb://address=(host=127.0.0.1)(port=33306)/crafter",
			// credentials in the authority
			"jdbc:mariadb://user:secret@127.0.0.1:33306/crafter",
			// garbage
			"garbage",
			"jdbc:derby:crafter;create=true",
			"jdbc:mariadb://",
			"jdbc:mariadb://127.0.0.1:abc/crafter",
			"jdbc:mariadb://127.0.0.1:99999/crafter",
			"jdbc:mariadb://[::1/crafter",
			"jdbc:mariadb://::1:33306/crafter"
	};

	@Test
	public void loopbackUrlsAreEmbedded() {
		for (String url : EMBEDDED_URLS) {
			assertTrue(url, DbUrlUtils.isEmbedded(url, PORT));
		}
	}

	@Test
	public void otherUrlsAreExternal() {
		for (String url : EXTERNAL_URLS) {
			assertFalse(url, DbUrlUtils.isEmbedded(url, PORT));
		}
	}

	@Test
	public void blankUrlsAreNotEmbedded() {
		for (String url : new String[] {null, "", "  "}) {
			assertFalse(DbUrlUtils.isEmbedded(url, PORT));
			assertNull(DbUrlUtils.parseHostAndPort(url));
		}
	}

	@Test
	public void parseHostAndPortReturnsOnlyHostAndPort() {
		assertEquals("db.example.com:3306",
				DbUrlUtils.parseHostAndPort("jdbc:mariadb://db.example.com:3306/crafter?user=u&password=p").toString());
		assertEquals("[::1]:33306", DbUrlUtils.parseHostAndPort("jdbc:mariadb://[::1]:33306").toString());
		assertNull(DbUrlUtils.parseHostAndPort("jdbc:mariadb://user:secret@db.example.com:3306/crafter"));
	}
}
