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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.craftercms.commons.config.ConfigUtils.getRequiredStringProperty;

/**
 * Operation to add a new processor to the pipeline of the target
 *
 * @author joseross
 * @since 4.0
 */
public class AddProcessorUpgradeOperation extends AbstractProcessorUpgradeOperation {

	/**
	 * The name of the processor to search to insert the new one
	 */
	protected String beforeProcessor;

	/**
	 * The additional properties for the new processor
	 */
	protected Map<String, Object> processorConfiguration;

	/**
	 * When true, skip the upgrade if {@link #beforeProcessor} is not in the pipeline.
	 * Serverless-only processors use this so local and authoring targets are left unchanged.
	 */
	protected boolean requireBeforeProcessor;

	/**
	 * When true, skip the upgrade if a processor named {@link #processorName} is already in the pipeline.
	 * Defaults to false so existing migrations still add a processor when another of the same name is present.
	 */
	protected boolean skipIfPresent;

	/**
	 * Properties copied from an existing processor onto the new one.
	 */
	protected List<PropertyCopy> propertyCopies = new ArrayList<>();

	@Override
	protected void doInit(HierarchicalConfiguration<?> config) throws ConfigurationException {
		beforeProcessor = getRequiredStringProperty(config, "beforeProcessor");
		requireBeforeProcessor = config.getBoolean("requireBeforeProcessor", false);
		skipIfPresent = config.getBoolean("skipIfPresent", false);
		processorConfiguration = new HashMap<>();
		for (HierarchicalConfiguration<?> additionConfig : config.configurationsAt("properties")) {
			var property = getRequiredStringProperty(additionConfig, CONFIG_KEY_PROPERTY);
			if (additionConfig.containsKey(CONFIG_KEY_VALUE)) {
				processorConfiguration.put(property, getRequiredStringProperty(additionConfig, CONFIG_KEY_VALUE));
			} else if (additionConfig.containsKey(CONFIG_KEY_VALUES)) {
				processorConfiguration.put(property, additionConfig.getList(CONFIG_KEY_VALUES));
			}
		}
		propertyCopies = new ArrayList<>();
		for (HierarchicalConfiguration<?> copyConfig : config.configurationsAt("copyProperties")) {
			propertyCopies.add(new PropertyCopy(
				getRequiredStringProperty(copyConfig, "fromProcessor"),
				getRequiredStringProperty(copyConfig, CONFIG_KEY_PROPERTY)));
		}
	}

	@Override
	protected void doExecuteInternal(Target target, Map<String, Object> targetConfig) {
		var pipeline = getPipeline(targetConfig);

		if (skipIfPresent) {
			for (Map<String, Object> processor : pipeline) {
				if (processorName.equals(processor.get(CONFIG_KEY_PROCESSOR_NAME))) {
					logger.info("Processor '{}' already present in target '{}'", processorName, target.getId());
					return;
				}
			}
		}

		int insertAt = -1;
		for (int i = 0; i < pipeline.size(); i++) {
			if (beforeProcessor.equals(pipeline.get(i).get(CONFIG_KEY_PROCESSOR_NAME))) {
				insertAt = i;
				break;
			}
		}
		if (insertAt < 0) {
			if (requireBeforeProcessor) {
				logger.info("Processor '{}' not found in target '{}'. Skipping add of '{}'",
					beforeProcessor, target.getId(), processorName);
				return;
			}
			// Preserve previous behavior: insert before the last processor when the anchor is missing
			insertAt = pipeline.size() - 1;
		}

		var newProcessor = new HashMap<String, Object>();
		newProcessor.put(CONFIG_KEY_PROCESSOR_NAME, processorName);
		for (PropertyCopy copy : propertyCopies) {
			for (Map<String, Object> processor : pipeline) {
				if (copy.fromProcessor.equals(processor.get(CONFIG_KEY_PROCESSOR_NAME)) &&
					processor.containsKey(copy.property)) {
					newProcessor.put(copy.property, processor.get(copy.property));
					break;
				}
			}
		}
		newProcessor.putAll(processorConfiguration);

		pipeline.add(insertAt, newProcessor);
		logger.info("Added processor '{}' before '{}' in target '{}'", processorName, beforeProcessor, target.getId());
	}

	/**
	 * A processor property to copy onto the processor being added.
	 */
	protected static class PropertyCopy {

		protected final String fromProcessor;
		protected final String property;

		protected PropertyCopy(String fromProcessor, String property) {
			this.fromProcessor = fromProcessor;
			this.property = property;
		}
	}
}
