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

package org.craftercms.studio.impl.v1.util;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class ConfigUtilsTest {

	private static final String XXE_MARKER = "XXE_MARKER_SHOULD_NOT_LEAK";

	@Test
	public void testReadXmlConfiguration() throws ConfigurationException {
		String xml = "<configuration><header>ok</header></configuration>";
		HierarchicalConfiguration<ImmutableNode> config = ConfigUtils.readXmlConfiguration(
				new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
		assertEquals("ok", config.getString("header"));
	}

	@Test
	public void testReadXmlConfigurationRejectsExternalEntity() throws IOException {
		Path secret = Files.createTempFile("xxe-secret", ".txt");
		Files.writeString(secret, XXE_MARKER);
		String payload = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
				"<!DOCTYPE configuration [<!ENTITY xxe SYSTEM \"" + secret.toUri() + "\">]>" +
				"<configuration><secret>&xxe;</secret></configuration>";
		try {
			ConfigurationException ex = assertThrows(ConfigurationException.class, () ->
					ConfigUtils.readXmlConfiguration(new ByteArrayInputStream(payload.getBytes(StandardCharsets.UTF_8))));
			String text = exceptionText(ex);
			assertFalse(text.contains(XXE_MARKER));
			assertTrue(text.toLowerCase().contains("doctype"));
		} finally {
			Files.deleteIfExists(secret);
		}
	}

	private static String exceptionText(Throwable error) {
		StringBuilder text = new StringBuilder();
		Throwable current = error;
		while (current != null) {
			if (current.getMessage() != null) {
				text.append(current.getMessage());
			}
			current = current.getCause();
		}
		return text.toString();
	}

}
