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

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.deployer.api.exceptions.DeployerException;
import org.springframework.context.ApplicationContext;

import java.util.List;
import java.util.Map;

/**
 * Interface for resolving target event listeners from a target configuration.
 */
public interface TargetEventListenerResolver {

	/**
	 * Returns a map of event listener names to lists of {@link TargetEventListener} instances
	 * The map keys are the configured event types, and the values are lists of listeners associated with each event type.
	 *
	 * @param configuration             the hierarchical configuration for the target
	 * @param applicationContext        the Spring application context
	 * @param eventListenerPropertyName the property name in the configuration that contains the event listeners
	 * @return a map of event listener names to lists of {@link TargetEventListener} instances
	 * @throws ConfigurationException if there is an error while reading  the configuration
	 * @throws DeployerException      if there is an error while resolving the listeners
	 */
	Map<String, List<TargetEventListener>> getListeners(HierarchicalConfiguration<ImmutableNode> configuration,
														ApplicationContext applicationContext, String eventListenerPropertyName) throws ConfigurationException, DeployerException;
}
