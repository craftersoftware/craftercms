/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import java.io.InputStream;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.configuration2.tree.ImmutableNode;

public class ConfigUtils {

    public static HierarchicalConfiguration<ImmutableNode> readXmlConfiguration(InputStream input)
            throws ConfigurationException {
		try {
			return org.craftercms.commons.config.ConfigUtils.readXmlConfiguration(input, ',', null, null, "UTF-8");
		} catch (org.craftercms.commons.config.ConfigurationException e) {
			throw new ConfigurationException("Unable to read XML configuration", e);
		}
    }

    private ConfigUtils() {
    }

}
