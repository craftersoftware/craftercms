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
package org.craftercms.deployer.impl.upgrade.operations;

import org.craftercms.commons.config.ConfigurationException;
import org.craftercms.commons.config.YamlConfiguration;
import org.craftercms.deployer.api.Target;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.mockito.Mockito.when;

/**
 * Tests for adding the content store manifest processor to serverless targets.
 */
@RunWith(MockitoJUnitRunner.class)
public class AddProcessorUpgradeOperationTest {

	private static final String CONFIG = """
		processor: s3ContentStoreManifestProcessor
		beforeProcessor: s3DeploymentEventsProcessor
		requireBeforeProcessor: true
		skipIfPresent: true
		copyProperties:
		    -   fromProcessor: s3DeploymentEventsProcessor
		        property: url
		    -   fromProcessor: s3DeploymentEventsProcessor
		        property: endpoint
		    -   fromProcessor: s3SyncProcessor
		        property: ignoreBlobs
		""";

	@Mock
	private Target target;

	private AddProcessorUpgradeOperation operation;

	@Before
	public void setUp() throws Exception {
		when(target.getEnv()).thenReturn("default");
		when(target.getId()).thenReturn("acme-default");
		operation = new AddProcessorUpgradeOperation();
		operation.init(null, null, readConfig(CONFIG));
	}

	@Test
	public void testAddsManifestProcessorBeforeDeploymentEvents() throws Exception {
		Map<String, Object> targetConfig = targetConfig(false);

		operation.doExecute(target, targetConfig);

		List<Map<String, Object>> pipeline = pipeline(targetConfig);
		assertEquals("s3SyncProcessor", pipeline.get(0).get("processorName"));
		assertEquals("s3ContentStoreManifestProcessor", pipeline.get(1).get("processorName"));
		assertEquals("s3://bucket/site", pipeline.get(1).get("url"));
		assertEquals(false, pipeline.get(1).get("ignoreBlobs"));
		assertFalse(pipeline.get(1).containsKey("endpoint"));
		assertEquals("s3DeploymentEventsProcessor", pipeline.get(2).get("processorName"));
	}

	@Test
	public void testSkipsTargetsWithoutDeploymentEventsProcessor() throws Exception {
		List<Map<String, Object>> pipeline = new ArrayList<>();
		pipeline.add(processor("gitDiffProcessor"));
		Map<String, Object> targetConfig = wrap(pipeline);

		operation.doExecute(target, targetConfig);

		assertEquals(1, pipeline(targetConfig).size());
		assertEquals("gitDiffProcessor", pipeline(targetConfig).get(0).get("processorName"));
	}

	@Test
	public void testSkipsWhenManifestProcessorIsAlreadyPresent() throws Exception {
		Map<String, Object> targetConfig = targetConfig(true);

		operation.doExecute(target, targetConfig);

		assertEquals(3, pipeline(targetConfig).size());
	}

	private Map<String, Object> targetConfig(boolean includeManifest) {
		List<Map<String, Object>> pipeline = new ArrayList<>();
		Map<String, Object> sync = processor("s3SyncProcessor");
		sync.put("ignoreBlobs", false);
		pipeline.add(sync);
		if (includeManifest) {
			pipeline.add(processor("s3ContentStoreManifestProcessor"));
		}
		Map<String, Object> events = processor("s3DeploymentEventsProcessor");
		events.put("url", "s3://bucket/site");
		pipeline.add(events);
		return wrap(pipeline);
	}

	private Map<String, Object> processor(String name) {
		Map<String, Object> processor = new HashMap<>();
		processor.put("processorName", name);
		return processor;
	}

	private Map<String, Object> wrap(List<Map<String, Object>> pipeline) {
		Map<String, Object> deployment = new HashMap<>();
		deployment.put("pipeline", pipeline);
		Map<String, Object> targetNode = new HashMap<>();
		targetNode.put("deployment", deployment);
		Map<String, Object> root = new HashMap<>();
		root.put("target", targetNode);
		return root;
	}

	@SuppressWarnings("unchecked")
	private List<Map<String, Object>> pipeline(Map<String, Object> targetConfig) {
		Map<String, Object> targetNode = (Map<String, Object>) targetConfig.get("target");
		Map<String, Object> deployment = (Map<String, Object>) targetNode.get("deployment");
		return (List<Map<String, Object>>) deployment.get("pipeline");
	}

	private YamlConfiguration readConfig(String yaml) throws ConfigurationException, org.apache.commons.configuration2.ex.ConfigurationException, java.io.IOException {
		YamlConfiguration config = new YamlConfiguration();
		try (ByteArrayInputStream in = new ByteArrayInputStream(yaml.getBytes(StandardCharsets.UTF_8))) {
			config.read(in);
		}
		return config;
	}

}
