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

package org.craftercms.deployer.api.target.event;

import org.apache.commons.configuration2.Configuration;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.deployer.api.exceptions.DeployerException;
import org.springframework.context.ApplicationContext;

/**
 * Interface for listeners that handle {@link TargetEvent}.
 */
public interface TargetEventListener {

	/**
	 * Initializes the listener with the given configuration and application context.
	 *
	 * @param config             the configuration to use for initialization
	 * @param applicationContext the application context to use for initialization
	 * @throws ConfigurationException if there is an error reading the configuration
	 * @throws DeployerException      if there is an error during initialization
	 */
	void init(Configuration config, ApplicationContext applicationContext) throws ConfigurationException, DeployerException;

	/**
	 * Handles a target event.
	 *
	 * @param event the target event to handle
	 */
	void handle(TargetEvent<?> event) throws DeployerException;

}
