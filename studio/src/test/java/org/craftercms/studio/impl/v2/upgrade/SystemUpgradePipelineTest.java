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

package org.craftercms.studio.impl.v2.upgrade;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.io.IOUtils;
import org.craftercms.commons.upgrade.UpgradeOperation;
import org.craftercms.commons.upgrade.UpgradePipeline;
import org.craftercms.commons.upgrade.VersionProvider;
import org.craftercms.commons.upgrade.impl.UpgradeContext;
import org.craftercms.commons.upgrade.impl.configuration.YamlConfigurationProvider;
import org.craftercms.commons.upgrade.impl.pipeline.DefaultUpgradePipelineFactoryImpl;
import org.junit.Test;
import org.springframework.context.ApplicationContext;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The system pipeline is what upgrades the Studio database. A 4.x database whose version is not listed
 * gets an empty pipeline and the 4.x to 5.0 migration never runs.
 */
public class SystemUpgradePipelineTest {

	private static final String VERSION_4_5_1_2 = "4.5.1.2";

	private static final String VERSION_4_5_1_3 = "4.5.1.3";

	private static final Pattern INSTALLED_VERSION =
		Pattern.compile("INSERT INTO _meta \\(version, studio_id\\) VALUES \\('([^']+)'");

	@Test
	public void databaseAt4513GetsTheSameUpgradeAs4512() throws Exception {
		String currentVersion = installedSchemaVersion();
		List<String> from4512 = pipelineSteps(VERSION_4_5_1_2);
		List<String> from4513 = pipelineSteps(VERSION_4_5_1_3);

		assertFalse("a database at 4.5.1.3 must get a pipeline", from4513.isEmpty());
		assertEquals("4.5.1.3 must run the same steps as 4.5.1.2", from4512, from4513);
		assertEquals("version:5.0-t", from4513.get(0));
		assertEquals("the pipeline must end at the current schema version",
			"version:" + currentVersion, from4513.get(from4513.size() - 1));
	}

	/**
	 * Test resources ship a stub {@code pipelines.yaml} on the same classpath path, so this loads the
	 * production file that sits next to the installed schema.
	 */
	private static File productionPipelines() throws Exception {
		File schema = new ClassPathResource("crafter/studio/database/createDDL.sql").getFile();
		File pipelines = schema.toPath().getParent().getParent().resolve("upgrade/pipelines.yaml").toFile();
		assertTrue(pipelines.getAbsolutePath(), pipelines.isFile());
		return pipelines;
	}

	private static String installedSchemaVersion() throws Exception {
		String ddl;
		try (var input = new ClassPathResource("crafter/studio/database/createDDL.sql").getInputStream()) {
			ddl = IOUtils.toString(input, StandardCharsets.UTF_8);
		}
		Matcher matcher = INSTALLED_VERSION.matcher(ddl);
		assertTrue("installed schema version not found in createDDL.sql", matcher.find());
		return matcher.group(1);
	}

	@SuppressWarnings({"rawtypes", "unchecked"})
	private static List<String> pipelineSteps(String dbVersion) throws Exception {
		List<String> steps = new ArrayList<>();
		VersionProvider<String> versionProvider = mock(VersionProvider.class);
		ApplicationContext applicationContext = mock(ApplicationContext.class);
		UpgradeContext<String> context = mock(UpgradeContext.class);

		when(versionProvider.getVersion(context)).thenReturn(dbVersion);
		doAnswer(invocation -> {
			steps.add("version:" + invocation.getArgument(1));
			return null;
		}).when(versionProvider).setVersion(any(), anyString());
		when(applicationContext.getBean(anyString(), any(Class.class))).thenAnswer(invocation -> {
			String type = invocation.getArgument(0);
			return new UpgradeOperation<String>() {
				private String step;

				@Override
				public void init(String currentVersion, String nextVersion, HierarchicalConfiguration<?> config) {
					step = type + " " + currentVersion + "->" + nextVersion + " " + describe(config);
				}

				@Override
				public void execute(UpgradeContext<String> upgradeContext) {
					steps.add(step);
				}
			};
		});

		DefaultUpgradePipelineFactoryImpl<String> factory = new DefaultUpgradePipelineFactoryImpl<>(
			"system", new YamlConfigurationProvider(new FileSystemResource(productionPipelines())), versionProvider);
		factory.setApplicationContext(applicationContext);

		UpgradePipeline<String> pipeline = factory.getPipeline(context);
		assertFalse("pipeline for " + dbVersion, pipeline.isEmpty());
		pipeline.execute(context);
		return steps;
	}

	private static String describe(HierarchicalConfiguration<?> config) {
		StringBuilder description = new StringBuilder();
		Iterator<String> keys = config.getKeys();
		while (keys.hasNext()) {
			String key = keys.next();
			description.append(key).append('=').append(config.getProperty(key)).append(';');
		}
		return description.toString();
	}

}
