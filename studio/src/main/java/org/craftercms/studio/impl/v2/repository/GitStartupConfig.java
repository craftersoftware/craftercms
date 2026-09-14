/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.studio.impl.v2.repository;

import org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.eclipse.jgit.errors.ConfigInvalidException;
import org.eclipse.jgit.lib.StoredConfig;
import org.eclipse.jgit.util.SystemReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;

import java.beans.ConstructorProperties;
import java.io.IOException;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.*;
import static org.eclipse.jgit.lib.ConfigConstants.*;
import static org.opensearch.core.common.Strings.isEmpty;
import static org.springframework.core.Ordered.HIGHEST_PRECEDENCE;

/**
 * Updates git global configuration properties on startup
 */
public class GitStartupConfig {

	private final static Logger logger = LoggerFactory.getLogger(GitStartupConfig.class);

	private final StudioConfiguration studioConfiguration;

	@ConstructorProperties({"studioConfiguration"})
	public GitStartupConfig(StudioConfiguration studioConfiguration) {
		this.studioConfiguration = studioConfiguration;
	}

	@LogExecutionTime
	@Order(HIGHEST_PRECEDENCE)
	@EventListener(value = ContextRefreshedEvent.class, condition = "event.applicationContext.parent == null")
	public void onStartup() {
		boolean enabled = studioConfiguration.getProperty(REPO_GIT_GLOBAL_CONFIG_ENABLED, Boolean.class, true);
		if (!enabled) {
			logger.info("Global Git config updates disabled by configuration");
			return;
		}

		StoredConfig globalConfig = null;
		try {
			globalConfig = SystemReader.getInstance().getUserConfig();
			boolean hasChanges = setProperty(globalConfig, CONFIG_GC_SECTION, CONFIG_KEY_PRUNEPACKEXPIRE, REPO_GC_PRUNE_PACK_EXPIRE);
			hasChanges |= setProperty(globalConfig, CONFIG_GC_SECTION, CONFIG_KEY_AUTOPACKLIMIT, REPO_GC_AUTO_PACK_LIMIT);
			if (hasChanges) {
				globalConfig.save();
			}
			logger.info("Git global configuration updated successfully.");
		} catch (ConfigInvalidException e) {
			logger.error("Error reading git user configuration", e);
		} catch (IOException e) {
			logger.error("Error saving git user configuration", e);
		}
	}

	/**
	 * Read a property from studio configuration and set its value in the git global configuration.
	 *
	 * @param config               the git configuration to update
	 * @param section              the section in the git configuration
	 * @param property             the property to set
	 * @param studioConfigProperty the property in the studio configuration to read the value from
	 * @throws IOException if there is an error saving the git configuration
	 */
	protected boolean setProperty(StoredConfig config, String section, String property, String studioConfigProperty) throws IOException {
		String value = studioConfiguration.getProperty(studioConfigProperty);
		if (isEmpty(value)) {
			logger.debug("Git '{}' is not set, skipping configuration.", studioConfigProperty);
			return false;
		}
		logger.debug("Setting '{}.{}'  to '{}'", section, property, value);
		config.setString(section, null, property, value);
		logger.info("Git '{}.{}' set to '{}'", section, property, value);
		return true;
	}

}
