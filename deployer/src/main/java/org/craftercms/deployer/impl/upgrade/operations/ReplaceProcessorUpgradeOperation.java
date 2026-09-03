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
package org.craftercms.deployer.impl.upgrade.operations;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.deployer.api.Target;

import java.util.*;

import static org.craftercms.commons.config.ConfigUtils.getRequiredStringProperty;
import static org.craftercms.deployer.impl.DeploymentConstants.PROCESSOR_NAME_CONFIG_KEY;

/**
 * Implementation of {@link AbstractTargetUpgradeOperation} that replaces processors in the pipeline
 *
 * @author joseross
 * @since 3.1.8
 */
public class ReplaceProcessorUpgradeOperation extends AbstractProcessorUpgradeOperation {

	public static final String CONFIG_KEY_CONDITIONS = "conditions";

	public static final String CONFIG_KEY_NEW_PROCESSOR = "newProcessor";

	public static final String CONFIG_KEY_DELETE_PROPERTIES = "deleteProperties";
	protected Map<String, String> conditions;

	protected String newProcessorName;

	protected List<String> deleteProperties;
	protected Map<String, String> properties;

	@Override
	@SuppressWarnings("rawtypes,unchecked")
	protected void doInit(HierarchicalConfiguration config) throws ConfigurationException {
		conditions = new HashMap<>();
		List<HierarchicalConfiguration> conditionConfig = config.configurationsAt(CONFIG_KEY_CONDITIONS);
		if (!conditionConfig.isEmpty()) {
			Iterator<String> it = conditionConfig.get(0).getKeys();
			while (it.hasNext()) {
				String key = it.next();
				conditions.put(key, conditionConfig.get(0).getString(key));
			}
		}

		newProcessorName = getRequiredStringProperty(config, CONFIG_KEY_NEW_PROCESSOR);

		deleteProperties = config.getList(String.class, CONFIG_KEY_DELETE_PROPERTIES, Collections.emptyList());

		properties = new HashMap<>();
		if (config.containsKey(CONFIG_KEY_PROPERTIES)) {
			HierarchicalConfiguration propertyConfig = config.configurationAt(CONFIG_KEY_PROPERTIES);
			if (propertyConfig != null) {
				Iterator<String> it = propertyConfig.getKeys();
				while (it.hasNext()) {
					String key = it.next();
					properties.put(key, propertyConfig.getString(key));
				}
			}
		}
	}

	protected boolean matchesAllConditions(Map<String, Object> processorObj) {
		if (processorObj.get(PROCESSOR_NAME_CONFIG_KEY).equals(processorName)) {
			for (String property : conditions.keySet()) {
				if (!(processorObj.containsKey(property) &&
					processorObj.get(property).toString().matches(conditions.get(property)))) {
					return false;
				}
			}
			return true;
		} else {
			return false;
		}
	}

	@Override
	protected void doExecuteInternal(Target target, Map<String, Object> targetConfig) {
		List<Map<String, Object>> pipelineObj = getPipeline(targetConfig);
		for (Map<String, Object> processorObj : pipelineObj) {
			if (matchesAllConditions(processorObj)) {
				processorObj.put(PROCESSOR_NAME_CONFIG_KEY, newProcessorName);
				properties.forEach(processorObj::put);
				deleteProperties.forEach(processorObj::remove);
			}
		}
	}

}
