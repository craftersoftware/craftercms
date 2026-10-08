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
package org.craftercms.studio.impl.v1.asset.processing;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.configuration2.Configuration;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.config.ConfigUtils;
import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.studio.api.v1.asset.processing.AssetProcessingConfigReader;
import org.craftercms.studio.api.v1.asset.processing.ProcessorConfiguration;
import org.craftercms.studio.api.v1.asset.processing.ProcessorPipelineConfiguration;
import org.craftercms.studio.api.v1.exception.AssetProcessingConfigurationException;

/**
 * Default implementation for {@link AssetProcessingConfigReader}.
 *
 * @author avasquez
 */
public class AssetProcessingConfigReaderImpl implements AssetProcessingConfigReader {

    public static final String PIPELINES_CONFIG_KEY = "pipelines.pipeline";
    public static final String INPUT_PATH_PATTERN_CONFIG_KEY = "inputPathPattern";
    public static final String KEEP_ORIGINAL_CONFIG_KEY = "keepOriginal";
    public static final String PROCESSORS_CONFIG_KEY = "processors.processor";
    public static final String PROCESSOR_TYPE_CONFIG_KEY = "type";
    public static final String PROCESSOR_PARAMS_CONFIG_KEY = "params";
    public static final String PROCESSOR_OUTPUT_PATH_FORMAT_CONFIG_KEY = "outputPathFormat";

    @Override
    public List<ProcessorPipelineConfiguration> readConfig(InputStream in) throws AssetProcessingConfigurationException {
        HierarchicalConfiguration config;
        try {
            config = ConfigUtils.readXmlConfiguration(in, ',', null, null, "UTF-8");
        } catch (ConfigurationException e) {
            throw new AssetProcessingConfigurationException("Unable to read XML configuration file", e);
        }

        return readConfig(config);
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<ProcessorPipelineConfiguration> readConfig(HierarchicalConfiguration config) throws AssetProcessingConfigurationException {
        List<HierarchicalConfiguration> pipelinesConfig = config.configurationsAt(PIPELINES_CONFIG_KEY);
        if (CollectionUtils.isNotEmpty(pipelinesConfig)) {
            List<ProcessorPipelineConfiguration> mappedPipelinesConfig = new ArrayList<>(pipelinesConfig.size());

            for (HierarchicalConfiguration pipelineConfig : pipelinesConfig) {
                mappedPipelinesConfig.add(readPipelineConfig(pipelineConfig));
            }

            return mappedPipelinesConfig;
        } else {
            return Collections.emptyList();
        }
    }

    @SuppressWarnings("unchecked")
    private ProcessorPipelineConfiguration readPipelineConfig(HierarchicalConfiguration pipelineConfig)
        throws AssetProcessingConfigurationException {
        ProcessorPipelineConfiguration mappedPipelineConfig = new ProcessorPipelineConfiguration();
        mappedPipelineConfig.setInputPathPattern(getRequiredStringProperty(pipelineConfig, INPUT_PATH_PATTERN_CONFIG_KEY));
        mappedPipelineConfig.setKeepOriginal(pipelineConfig.getBoolean(KEEP_ORIGINAL_CONFIG_KEY, false));

        List<HierarchicalConfiguration> processorsConfig = getRequiredConfigurationsAt(pipelineConfig, PROCESSORS_CONFIG_KEY);
        List<ProcessorConfiguration> mappedProcessorsConfig = new ArrayList<>(processorsConfig.size());

        for (HierarchicalConfiguration processorConfig : processorsConfig) {
            mappedProcessorsConfig.add(readProcessorConfig(processorConfig));
        }

        mappedPipelineConfig.setProcessorsConfig(mappedProcessorsConfig);

        return mappedPipelineConfig;
    }

    private ProcessorConfiguration readProcessorConfig(HierarchicalConfiguration processorConfig)
        throws AssetProcessingConfigurationException {
        ProcessorConfiguration mappedProcessorConfig = new ProcessorConfiguration();
        mappedProcessorConfig.setType(getRequiredStringProperty(processorConfig, PROCESSOR_TYPE_CONFIG_KEY));
        mappedProcessorConfig.setParams(getProcessorParams(processorConfig));
        mappedProcessorConfig.setOutputPathFormat(processorConfig.getString(PROCESSOR_OUTPUT_PATH_FORMAT_CONFIG_KEY));

        return mappedProcessorConfig;
    }

    private Map<String, String > getProcessorParams(HierarchicalConfiguration processorConfig) {
        Map<String, String> params = new HashMap<>();
        Iterator<String> keysIter = processorConfig.getKeys();
        String paramsPrefix = PROCESSOR_PARAMS_CONFIG_KEY + ".";

        while (keysIter.hasNext()) {
            String key = keysIter.next();

            if (key.startsWith(paramsPrefix)) {
                String paramName = StringUtils.substringAfter(key, paramsPrefix);
                String paramValue = processorConfig.getString(key);

                params.put(paramName, paramValue);
            }
        }

        return params;
    }

    @SuppressWarnings("unchecked")
    private List<HierarchicalConfiguration> getRequiredConfigurationsAt(HierarchicalConfiguration config,
                                                                        String key) throws AssetProcessingConfigurationException {
        List<HierarchicalConfiguration> configs = config.configurationsAt(key);
        if (CollectionUtils.isEmpty(configs)) {
            throw new AssetProcessingConfigurationException("Missing required property '" + key + "'");
        } else {
            return configs;
        }
    }

    private String getRequiredStringProperty(Configuration config, String key) throws AssetProcessingConfigurationException {
        String property = config.getString(key);
        if (StringUtils.isEmpty(property)) {
            throw new AssetProcessingConfigurationException("Missing required property '" + key + "'");
        } else {
            return property;
        }
    }

}
