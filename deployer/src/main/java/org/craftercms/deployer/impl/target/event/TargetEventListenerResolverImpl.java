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

package org.craftercms.deployer.impl.target.event;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.deployer.api.exceptions.DeployerException;
import org.craftercms.deployer.api.target.event.TargetEventListener;
import org.craftercms.deployer.api.target.event.TargetEventListenerResolver;
import org.craftercms.deployer.impl.DeploymentConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.NoSuchBeanDefinitionException;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.List;
import java.util.Map;

import static org.apache.commons.collections.CollectionUtils.isNotEmpty;
import static org.craftercms.commons.config.ConfigUtils.getRequiredStringProperty;
import static org.craftercms.deployer.impl.DeploymentConstants.TARGET_EVENT_LISTENER_EVENT_NAME;
import static org.craftercms.deployer.impl.DeploymentConstants.TARGET_EVENT_LISTENER_LISTENERS;

/**
 * Default implementation of {@link TargetEventListenerResolver}
 */
@Component
public class TargetEventListenerResolverImpl implements TargetEventListenerResolver {
	private static final Logger logger = LoggerFactory.getLogger(TargetEventListenerResolverImpl.class);

	@Override
	public Map<String, List<TargetEventListener>> getListeners(HierarchicalConfiguration<ImmutableNode> configuration,
															   ApplicationContext applicationContext,
															   String eventListenerPropertyName) throws ConfigurationException, DeployerException {
		MultiValueMap<String, TargetEventListener> result = new LinkedMultiValueMap<>();

		List<HierarchicalConfiguration<ImmutableNode>> eventConfigs = configuration.configurationsAt(eventListenerPropertyName);
		if (!isNotEmpty(eventConfigs)) {
			logger.info("No event configured for property '{}'.", eventListenerPropertyName);
			return result;
		}
		// Iterate through each listener configuration
		for (HierarchicalConfiguration<ImmutableNode> eventConfig : eventConfigs) {
			String eventName = getRequiredStringProperty(eventConfig, TARGET_EVENT_LISTENER_EVENT_NAME);
			List<HierarchicalConfiguration<ImmutableNode>> listeners = eventConfig.configurationsAt(TARGET_EVENT_LISTENER_LISTENERS);
			for (HierarchicalConfiguration<ImmutableNode> listenerConfig : listeners) {
				String listenerName = getRequiredStringProperty(listenerConfig, DeploymentConstants.TARGET_EVENT_LISTENER_NAME);
				logger.debug("Initializing target event listener '{}'", listenerName);
				try {
					TargetEventListener listener = applicationContext.getBean(listenerName, TargetEventListener.class);
					listener.init(listenerConfig, applicationContext);
					result.add(eventName, listener);
				} catch (NoSuchBeanDefinitionException e) {
					throw new DeployerException("Target event listener '" + listenerName + "' not found in application context", e);
				} catch (Exception e) {
					throw new DeployerException("Failed to initialize target event listener '" + listenerName + "'", e);
				}
			}
		}
		return result;
	}
}
