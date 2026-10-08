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

import javax.xml.parsers.ParserConfigurationException;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.XMLConfiguration;
import org.apache.commons.configuration2.builder.FileBasedConfigurationBuilder;
import org.apache.commons.configuration2.builder.fluent.Parameters;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.configuration2.io.FileHandler;
import org.apache.commons.configuration2.tree.ImmutableNode;

import static org.craftercms.commons.config.ConfigUtils.createDocumentBuilder;

public class ConfigUtils {

    public static HierarchicalConfiguration<ImmutableNode> readXmlConfiguration(InputStream input)
            throws ConfigurationException {
        Parameters params = new Parameters();
        FileBasedConfigurationBuilder<XMLConfiguration> builder =
                new FileBasedConfigurationBuilder<>(XMLConfiguration.class);
		XMLConfiguration config;
		try {
			config = builder.configure(params.xml().setDocumentBuilder(createDocumentBuilder())).getConfiguration();
		} catch (ParserConfigurationException e) {
			throw new ConfigurationException("Unable to create a secure XML parser", e);
		}
        FileHandler fileHandler = new FileHandler(config);

        fileHandler.setEncoding("UTF-8");
        fileHandler.load(input);

        return config;
    }

    private ConfigUtils() {
    }

}
