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

import org.apache.commons.collections.MapUtils;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.configuration2.Configuration;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.XMLConfiguration;
import org.apache.commons.configuration2.builder.FileBasedConfigurationBuilder;
import org.apache.commons.configuration2.builder.fluent.Parameters;
import org.apache.commons.configuration2.builder.fluent.XMLBuilderParameters;
import org.apache.commons.configuration2.convert.DefaultListDelimiterHandler;
import org.apache.commons.configuration2.convert.DisabledListDelimiterHandler;
import org.apache.commons.configuration2.convert.ListDelimiterHandler;
import org.apache.commons.configuration2.interpol.Lookup;
import org.apache.commons.configuration2.io.FileHandler;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.text.lookup.StringLookup;
import org.apache.commons.text.lookup.StringLookupFactory;
import org.springframework.core.io.Resource;
import org.springframework.lang.NonNull;

import java.io.IOException;
import java.io.InputStream;
import java.io.Reader;
import java.net.URL;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.apache.commons.collections4.MapUtils.isNotEmpty;
import static org.craftercms.commons.xml.XmlSecurityUtils.createDocumentBuilder;

/**
 * Utility methods for Apache Commons based configuration.
 *
 * @author avasquez
 */
public class ConfigUtils {

	public static final String DEFAULT_ENCODING = "UTF-8";

	/**
	 * Sentinel for {@link #readXmlConfiguration(InputStream, char, Map, Map, String)} and related methods:
	 * do not split property values on commas (Commons Configuration's default for XML).
	 */
	public static final char NO_LIST_DELIMITER = '\0';

	/**
	 * Reads the XML configuration from the specified input stream without list-delimiter splitting,
	 * using {@link #DEFAULT_ENCODING}.
	 *
	 * @param input the input stream from where to read the configuration
	 * @return the loaded XML configuration
	 * @throws ConfigurationException if an error occurs while reading the configuration
	 */
	public static HierarchicalConfiguration<ImmutableNode> readXmlConfiguration(InputStream input)
			throws ConfigurationException {
		return readXmlConfiguration(input, NO_LIST_DELIMITER, null, null, DEFAULT_ENCODING);
	}

	/**
	 * Reads the XML configuration from the specified input stream, using the {@link #DEFAULT_ENCODING}.
	 *
	 * @param input         the input stream from where to read the configuration
	 * @param listDelimiter the list delimiter, or {@link #NO_LIST_DELIMITER} to disable splitting
	 * @return the loaded XML configuration, as a an Apache Commons {@link HierarchicalConfiguration}
	 * @throws ConfigurationException if an error occurs while reading the configuration
	 */
	public static HierarchicalConfiguration<ImmutableNode> readXmlConfiguration(InputStream input,
											    char listDelimiter,
											    Map<String, Lookup> prefixLookups,
											    Map<String, String> lookupVariables)
		throws ConfigurationException {
		return readXmlConfiguration(input, listDelimiter, prefixLookups, lookupVariables, null);
	}

	/**
	 * Get the default lookups to expand in configuration files.
	 *
	 * @param variables the variables to expand
	 * @return the lookups
	 */
	@NonNull
	private static Collection<Lookup> getLookups(final Map<String, String> variables) {
		StringLookup lookup = StringLookupFactory.INSTANCE.mapStringLookup(variables);
		return List.of(lookup::lookup);
	}

	/**
	 * Reads the XML configuration from the specified input stream, using the given file encoding.
	 *
	 * @param input         the input stream from where to read the configuration
	 * @param listDelimiter the list delimiter, or {@link #NO_LIST_DELIMITER} to disable splitting
	 * @param fileEncoding  the encoding of the file. If not specified {@link #DEFAULT_ENCODING} will be used
	 * @return the loaded XML configuration, as a an Apache Commons {@link HierarchicalConfiguration}
	 * @throws ConfigurationException if an error occurs while reading the configuration
	 */
	public static HierarchicalConfiguration<ImmutableNode> readXmlConfiguration(InputStream input,
											    char listDelimiter,
											    Map<String, Lookup> prefixLookups,
											    final Map<String, String> lookupVariables,
											    String fileEncoding)
		throws ConfigurationException {
		Parameters params = new Parameters();
		FileBasedConfigurationBuilder<XMLConfiguration> builder =
			new FileBasedConfigurationBuilder<>(XMLConfiguration.class);

		try {
			XMLBuilderParameters xmlParams = params.xml();

			if (MapUtils.isNotEmpty(prefixLookups)) {
				xmlParams = xmlParams.setPrefixLookups(prefixLookups);
			}
			if (isNotEmpty(lookupVariables)) {
				xmlParams = xmlParams.setDefaultLookups(getLookups(lookupVariables));
			}

			xmlParams.setListDelimiterHandler(createListDelimiterHandler(listDelimiter));
			xmlParams.setDocumentBuilder(createDocumentBuilder());

			builder.configure(xmlParams);
			XMLConfiguration config = builder.getConfiguration();

			FileHandler fileHandler = new FileHandler(config);
			fileHandler.setEncoding(StringUtils.isNotBlank(fileEncoding) ? fileEncoding : DEFAULT_ENCODING);
			fileHandler.load(input);

			return config;
		} catch (Exception e) {
			throw new ConfigurationException("Unable to read XML configuration", e);
		}
	}

	public static XMLConfiguration readXmlConfiguration(Resource resource, char listDelimiter,
							    Map<String, Lookup> prefixLookups,
							    Map<String, String> lookupVariables)
		throws ConfigurationException {
		URL resourceUrl;
		try {
			resourceUrl = resource.getURL();
		} catch (IOException e) {
			throw new ConfigurationException("Unable to get URL of resource " + resource, e);
		}

		Parameters params = new Parameters();
		FileBasedConfigurationBuilder<XMLConfiguration> builder =
			new FileBasedConfigurationBuilder<>(XMLConfiguration.class);

		try {
			XMLBuilderParameters xmlParams = params
				.xml()
				.setURL(resourceUrl)
				.setListDelimiterHandler(createListDelimiterHandler(listDelimiter));

			if (MapUtils.isNotEmpty(prefixLookups)) {
				xmlParams = xmlParams.setPrefixLookups(prefixLookups);
			}
			if (isNotEmpty(lookupVariables)) {
				xmlParams = xmlParams.setDefaultLookups(getLookups(lookupVariables));
			}

			xmlParams.setDocumentBuilder(createDocumentBuilder());
			builder.configure(xmlParams);

			return builder.getConfiguration();
		} catch (Exception e) {
			throw new ConfigurationException("Unable to read XML configuration from resource " + resource, e);
		}
	}

	private static ListDelimiterHandler createListDelimiterHandler(char listDelimiter) {
		if (listDelimiter == NO_LIST_DELIMITER) {
			return DisabledListDelimiterHandler.INSTANCE;
		}
		return new DefaultListDelimiterHandler(listDelimiter);
	}

	public static HierarchicalConfiguration<?> readYamlConfiguration(Reader reader,
									 Map<String, Lookup> prefixLookups)
		throws ConfigurationException {
		return readYamlConfiguration(reader, prefixLookups, 0);
	}

	/**
	 * Read a YAML configuration from the given reader.
	 *
	 * @param reader                   the reader
	 * @param prefixLookups            the prefix lookups
	 * @param maxAliasesForCollections the maximum number of aliases for collections
	 * @return the configuration
	 * @throws ConfigurationException if an error occurs while parsing the yaml stream
	 */
	public static HierarchicalConfiguration<?> readYamlConfiguration(Reader reader,
									 Map<String, Lookup> prefixLookups,
									 int maxAliasesForCollections)
		throws ConfigurationException {
		YamlConfiguration configuration = new YamlConfiguration();
		configuration.setPrefixLookups(prefixLookups);
		configuration.getLoaderOptions().setMaxAliasesForCollections(maxAliasesForCollections);

		try {
			configuration.read(reader);
			return configuration;
		} catch (Exception e) {
			throw new ConfigurationException("Error loading YAML configuration", e);
		}
	}

	/**
	 * Returns the specified String property from the configuration
	 *
	 * @param config the configuration
	 * @param key    the key of the property
	 * @return the String value of the property, or null if not found
	 * @throws ConfigurationException if an error occurred
	 */
	public static String getStringProperty(Configuration config, String key) throws ConfigurationException {
		return getStringProperty(config, key, null);
	}

	/**
	 * Returns the specified String property from the configuration
	 *
	 * @param config       the configuration
	 * @param key          the key of the property
	 * @param defaultValue the default value if the property is not found
	 * @return the String value of the property, or the default value if not found
	 * @throws ConfigurationException if an error occurred
	 */
	public static String getStringProperty(Configuration config, String key,
					       String defaultValue) throws ConfigurationException {
		try {
			return config.getString(key, defaultValue);
		} catch (Exception e) {
			throw new ConfigurationException("Failed to retrieve property '" + key + "'", e);
		}
	}

	/**
	 * Returns the specified String property from the configuration. If the property is missing a
	 * {@link MissingConfigurationException} is thrown.
	 *
	 * @param config the configuration
	 * @param key    the key of the property
	 * @return the String value of the property
	 * @throws MissingConfigurationException if the property is missing from the configuration
	 * @throws ConfigurationException        if an error occurred
	 */
	public static String getRequiredStringProperty(Configuration config,
						       String key) throws ConfigurationException {
		String property = getStringProperty(config, key);
		if (StringUtils.isEmpty(property)) {
			throw new MissingConfigurationException(key);
		} else {
			return property;
		}
	}

	/**
	 * Returns the specified Boolean property from the configuration
	 *
	 * @param config the configuration
	 * @param key    the key of the property
	 * @return the Boolean value of the property, or null if not found
	 * @throws ConfigurationException if an error occurred
	 */
	public static Boolean getBooleanProperty(Configuration config, String key) throws ConfigurationException {
		return getBooleanProperty(config, key, null);
	}

	/**
	 * Returns the specified Boolean property from the configuration
	 *
	 * @param config       the configuration
	 * @param key          the key of the property
	 * @param defaultValue the default value if the property is not found
	 * @return the Boolean value of the property, or the default value if not found
	 * @throws ConfigurationException if an error occurred
	 */
	public static Boolean getBooleanProperty(Configuration config, String key,
						 Boolean defaultValue) throws ConfigurationException {
		try {
			return config.getBoolean(key, defaultValue);
		} catch (Exception e) {
			throw new ConfigurationException("Failed to retrieve property '" + key + "'", e);
		}
	}

	/**
	 * Returns the specified Boolean property from the configuration. If the property is missing a
	 * {@link MissingConfigurationException} is thrown.
	 *
	 * @param config the configuration
	 * @param key    the key of the property
	 * @return the Boolean value of the property
	 * @throws MissingConfigurationException if the property is missing from the configuration
	 * @throws ConfigurationException        if an error occurred
	 */
	public static Boolean getRequiredBooleanProperty(Configuration config,
							 String key) throws ConfigurationException {
		Boolean property = getBooleanProperty(config, key);
		if (property == null) {
			throw new MissingConfigurationException(key);
		} else {
			return property;
		}
	}

	/**
	 * Returns the specified Integer property from the configuration
	 *
	 * @param config the configuration
	 * @param key    the key of the property
	 * @return the Integer value of the property, or null if not found
	 * @throws ConfigurationException if an error occurred
	 */
	public static Integer getIntegerProperty(Configuration config, String key) throws ConfigurationException {
		return getIntegerProperty(config, key, null);
	}

	/**
	 * Returns the specified Integer property from the configuration
	 *
	 * @param config       the configuration
	 * @param key          the key of the property
	 * @param defaultValue the default value if the property is not found
	 * @return the Integer value of the property, or the default value if not found
	 * @throws ConfigurationException if an error occurred
	 */
	public static Integer getIntegerProperty(Configuration config, String key,
						 Integer defaultValue) throws ConfigurationException {
		try {
			return config.getInteger(key, defaultValue);
		} catch (Exception e) {
			throw new ConfigurationException("Failed to retrieve property '" + key + "'", e);
		}
	}

	/**
	 * Returns the specified Integer property from the configuration. If the property is missing a
	 * {@link MissingConfigurationException} is thrown.
	 *
	 * @param config the configuration
	 * @param key    the key of the property
	 * @return the Integer value of the property
	 * @throws MissingConfigurationException if the property is missing from the configuration
	 * @throws ConfigurationException        if an error occurred
	 */
	public static Integer getRequiredIntegerProperty(Configuration config,
							 String key) throws ConfigurationException {
		Integer property = getIntegerProperty(config, key);
		if (property == null) {
			throw new MissingConfigurationException(key);
		} else {
			return property;
		}
	}

	/**
	 * Returns the specified Long property from the configuration
	 *
	 * @param config the configuration
	 * @param key    the key of the property
	 * @return the Long value of the property, or null if not found
	 * @throws ConfigurationException if an error occurred
	 */
	public static Long getLongProperty(Configuration config, String key) throws ConfigurationException {
		return getLongProperty(config, key, null);
	}

	/**
	 * Returns the specified Long property from the configuration
	 *
	 * @param config       the configuration
	 * @param key          the key of the property
	 * @param defaultValue the default value if the property is not found
	 * @return the Long value of the property, or the default value if not found
	 * @throws ConfigurationException if an error occurred
	 */
	public static Long getLongProperty(Configuration config, String key,
					   Long defaultValue) throws ConfigurationException {
		try {
			return config.getLong(key, defaultValue);
		} catch (Exception e) {
			throw new ConfigurationException("Failed to retrieve property '" + key + "'", e);
		}
	}

	/**
	 * Returns the specified Long property from the configuration. If the property is missing a
	 * {@link MissingConfigurationException} is thrown.
	 *
	 * @param config the configuration
	 * @param key    the key of the property
	 * @return the Long value of the property
	 * @throws MissingConfigurationException if the property is missing from the configuration
	 * @throws ConfigurationException        if an error occurred
	 */
	public static Long getRequiredLongProperty(Configuration config,
						   String key) throws ConfigurationException {
		Long property = getLongProperty(config, key);
		if (property == null) {
			throw new MissingConfigurationException(key);
		} else {
			return property;
		}
	}

	/**
	 * Returns the specified String array property from the configuration. A String array property is normally
	 * specified as a String with values separated by commas in the configuration.
	 *
	 * @param config the configuration
	 * @param key    the key of the property
	 * @return the String array value of the property, or null if not found
	 * @throws ConfigurationException if an error occurred
	 */
	public static String[] getStringArrayProperty(Configuration config,
						      String key) throws ConfigurationException {
		try {
			return config.getStringArray(key);
		} catch (Exception e) {
			throw new ConfigurationException("Failed to retrieve property '" + key + "'", e);
		}
	}

	/**
	 * Returns the specified String array property from the configuration. If the property is missing a
	 * {@link MissingConfigurationException} is thrown. A String array property is normally specified as
	 * a String with values separated by commas in the configuration.
	 *
	 * @param config the configuration
	 * @param key    the key of the property
	 * @return the String value of the property
	 * @throws MissingConfigurationException if the property is missing from the configuration
	 * @throws ConfigurationException        if an error occurred
	 */
	public static String[] getRequiredStringArrayProperty(Configuration config,
							      String key) throws ConfigurationException {
		String[] property = getStringArrayProperty(config, key);
		if (ArrayUtils.isEmpty(property)) {
			throw new MissingConfigurationException(key);
		} else {
			return property;
		}
	}

	/**
	 * Returns the sub-configuration whose root is the specified key.
	 *
	 * @param config the main configuration
	 * @param key    the sub-configuration key
	 * @return the sub-configuration, or null if not found
	 * @throws ConfigurationException if an error occurs
	 */
	public static HierarchicalConfiguration<ImmutableNode> getConfigurationAt(
		HierarchicalConfiguration<ImmutableNode> config, String key) throws ConfigurationException {
		try {
			return config.configurationAt(key);
		} catch (Exception e) {
			throw new ConfigurationException("Failed to retrieve sub-configurations at '" + key + "'", e);
		}
	}

	/**
	 * Returns the sub-configuration whose root is the specified key. If it's missing a
	 * {@link MissingConfigurationException} is thrown.
	 *
	 * @param config the main configuration
	 * @param key    the sub-configuration key
	 * @return the sub-configuration, or null if not found
	 * @throws MissingConfigurationException if the sub-configuration is missing from the configuration
	 * @throws ConfigurationException        if an error occurs
	 */
	public static HierarchicalConfiguration<ImmutableNode> getRequiredConfigurationAt(
		HierarchicalConfiguration<ImmutableNode> config, String key) throws ConfigurationException {
		try {
			return config.configurationAt(key);
		} catch (Exception e) {
			throw new ConfigurationException("Failed to retrieve sub-configurations at '" + key + "'", e);
		}
	}


	/**
	 * Returns the sub-configurations whose root is the specified key.
	 *
	 * @param config the main configuration
	 * @param key    the sub-configurations key
	 * @return the sub-configurations, or null if not found
	 * @throws ConfigurationException if an error occurs
	 */
	public static List<HierarchicalConfiguration<ImmutableNode>> getConfigurationsAt(
		HierarchicalConfiguration<ImmutableNode> config, String key) throws ConfigurationException {
		try {
			return config.configurationsAt(key);
		} catch (Exception e) {
			throw new ConfigurationException("Failed to retrieve sub-configurations at '" + key + "'", e);
		}
	}

	/**
	 * Returns the sub-configurations whose root is the specified key. If they're missing a
	 * {@link MissingConfigurationException} is thrown
	 *
	 * @param config the main configuration
	 * @param key    the sub-configurations key
	 * @return the sub-configurations
	 * @throws MissingConfigurationException if the sub-configurations are missing from the configuration
	 * @throws ConfigurationException        if an error occurs
	 */
	public static List<HierarchicalConfiguration<ImmutableNode>> getRequiredConfigurationsAt(
		HierarchicalConfiguration<ImmutableNode> config, String key) throws ConfigurationException {
		List<HierarchicalConfiguration<ImmutableNode>> configs = getConfigurationsAt(config, key);
		if (CollectionUtils.isEmpty(configs)) {
			throw new MissingConfigurationException(key);
		} else {
			return configs;
		}
	}

	protected ConfigUtils() {
	}

}
