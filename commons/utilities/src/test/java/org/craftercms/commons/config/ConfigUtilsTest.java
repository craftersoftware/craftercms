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
package org.craftercms.commons.config;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static java.util.Collections.emptyMap;
import static org.junit.Assert.assertEquals;

public class ConfigUtilsTest {

	private static final String OPTIONS = "-level 0,100%,1.3 -gaussian-blur 0.05 -quality 20% -strip";
	private static final String XML = "<config><options>" + OPTIONS + "</options></config>";

	@Test
	public void readXmlConfigurationWithoutListDelimiterPreservesCommas() throws Exception {
		HierarchicalConfiguration<ImmutableNode> config = ConfigUtils.readXmlConfiguration(
				new ByteArrayInputStream(XML.getBytes(StandardCharsets.UTF_8)));
		assertEquals(OPTIONS, config.getString("options"));
	}

	@Test
	public void readXmlConfigurationWithCommaDelimiterSplitsValues() throws Exception {
		HierarchicalConfiguration<ImmutableNode> config = ConfigUtils.readXmlConfiguration(
				new ByteArrayInputStream(XML.getBytes(StandardCharsets.UTF_8)), ',', emptyMap(), emptyMap());
		assertEquals("-level 0", config.getString("options"));
	}

}
