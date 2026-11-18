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

import com.github.jknack.handlebars.Handlebars;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.craftercms.commons.config.YamlConfiguration;
import org.craftercms.deployer.api.Target;
import org.craftercms.deployer.utils.handlebars.ListHelper;
import org.junit.Before;
import org.junit.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.util.ReflectionTestUtils;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The 2.5 to 2.6 upgrade removes the preview context-rebuild processor.
 * New targets are still created from {@code remote-target-template.yaml} at version 2.4, which now sends the
 * management token in a header. The removal matches includeFiles, excludeFiles, method and jumpTo, so both that
 * header form and the legacy query-token URL are removed.
 */
public class PreviewContextRebuildProcessorUpgradeTest {

	private static final String REBUILD_URL =
		"${target.engineUrl}/api/1/site/context/rebuild.json?crafterSite=${target.siteName}";
	private static final String LEGACY_REBUILD_URL = REBUILD_URL + "&token=${target.engineManagementToken}";
	private static final String CACHE_CLEAR_URL =
		"${target.engineUrl}/api/1/site/cache/clear.json?crafterSite=${target.siteName}";
	private static final String GRAPHQL_REBUILD_URL =
		"${target.engineUrl}/api/1/site/context/graphql/rebuild.json?crafterSite=${target.siteName}";

	private RemoveProcessorUpgradeOperation operation;

	@Before
	public void setUp() throws Exception {
		operation = new RemoveProcessorUpgradeOperation();
		operation.init("2.5", "2.6", removalStep());

		@SuppressWarnings("unchecked")
		Map<String, String> match =
			(Map<String, String>) ReflectionTestUtils.getField(operation, "processorConfiguration");
		assertEquals(Set.of("includeFiles", "excludeFiles", "method", "jumpTo"), match.keySet());
		assertEquals("preview", ReflectionTestUtils.getField(operation, "envPattern"));
		for (String value : match.values()) {
			assertFalse(value.contains("token="));
			assertFalse(value.contains("engineManagementToken"));
		}
	}

	@Test
	public void previewTargetFromCurrentTemplateDropsContextRebuildProcessor() throws Exception {
		Map<String, Object> targetConfig = previewTargetFromTemplate();
		assertEquals("2.4", targetConfig.get("version"));
		assertEquals("preview", target(targetConfig).get("env"));

		Map<String, Object> rebuild = processorWithUrl(targetConfig, REBUILD_URL);
		assertNotNull(rebuild);
		assertEquals("httpMethodCallProcessor", rebuild.get("processorName"));
		assertEquals("fileOutputProcessor", rebuild.get("jumpTo"));
		assertHeaderToken(rebuild);
		assertEquals(3, countProcessors(targetConfig, "httpMethodCallProcessor"));

		operation.doExecute(targetWithEnv("preview"), targetConfig);

		assertNull(processorWithUrl(targetConfig, REBUILD_URL));
		assertEquals(2, countProcessors(targetConfig, "httpMethodCallProcessor"));
		assertNotNull(processorWithUrl(targetConfig, CACHE_CLEAR_URL));
		assertNotNull(processorWithUrl(targetConfig, GRAPHQL_REBUILD_URL));
		assertEquals(1, countProcessors(targetConfig, "fileOutputProcessor"));
		assertEquals(1, countProcessors(targetConfig, "searchIndexingProcessor"));
	}

	@Test
	public void legacyTokenQueryUrlIsStillRemoved() throws Exception {
		Map<String, Object> targetConfig = previewTargetFromTemplate();
		Map<String, Object> rebuild = processorWithUrl(targetConfig, REBUILD_URL);
		rebuild.put("url", LEGACY_REBUILD_URL);
		rebuild.remove("headers");
		String cacheClearWithToken = CACHE_CLEAR_URL + "&token=${target.engineManagementToken}";
		processorWithUrl(targetConfig, CACHE_CLEAR_URL).put("url", cacheClearWithToken);

		operation.doExecute(targetWithEnv("preview"), targetConfig);

		assertNull(processorWithUrl(targetConfig, LEGACY_REBUILD_URL));
		assertNull(processorWithUrl(targetConfig, REBUILD_URL));
		assertNotNull(processorWithUrl(targetConfig, cacheClearWithToken));
		assertNotNull(processorWithUrl(targetConfig, GRAPHQL_REBUILD_URL));
		assertEquals(2, countProcessors(targetConfig, "httpMethodCallProcessor"));
	}

	@Test
	public void nonPreviewTargetKeepsContextRebuildProcessor() throws Exception {
		Map<String, Object> targetConfig = previewTargetFromTemplate();

		operation.doExecute(targetWithEnv("live"), targetConfig);

		assertNotNull(processorWithUrl(targetConfig, REBUILD_URL));
		assertEquals(3, countProcessors(targetConfig, "httpMethodCallProcessor"));
	}

	private HierarchicalConfiguration<?> removalStep() throws Exception {
		YamlConfiguration config = new YamlConfiguration();
		try (InputStream in = new ClassPathResource("upgrade/pipelines.yaml").getInputStream()) {
			config.read(in);
		}
		for (HierarchicalConfiguration<?> version : config.configurationsAt("pipelines.target.versions")) {
			if ("2.5".equals(version.getString("currentVersion")) && "2.6".equals(version.getString("nextVersion"))) {
				for (HierarchicalConfiguration<?> operationConfig : version.configurationsAt("operations")) {
					if ("removeProcessorUpgrader".equals(operationConfig.getString("type"))) {
						return operationConfig;
					}
				}
			}
		}
		throw new IllegalStateException("2.5 to 2.6 removeProcessorUpgrader was not found in pipelines.yaml");
	}

	private Map<String, Object> previewTargetFromTemplate() throws Exception {
		String templateSource;
		try (InputStream in = new ClassPathResource("templates/targets/remote-target-template.yaml").getInputStream()) {
			templateSource = new String(in.readAllBytes(), StandardCharsets.UTF_8);
		}
		Handlebars handlebars = new Handlebars();
		handlebars.prettyPrint(true);
		handlebars.registerHelper(ListHelper.NAME, ListHelper.INSTANCE);
		Map<String, Object> model = new HashMap<>();
		model.put("env", "preview");
		model.put("site_name", "editorial");
		model.put("repo_url", "https://example.com/editorial.git");
		String rendered = handlebars.compileInline(templateSource).apply(model);
		return new Yaml().load(rendered);
	}

	private Target targetWithEnv(String env) {
		Target target = mock(Target.class);
		when(target.getEnv()).thenReturn(env);
		return target;
	}

	@SuppressWarnings("unchecked")
	private Map<String, Object> target(Map<String, Object> targetConfig) {
		return (Map<String, Object>) targetConfig.get("target");
	}

	@SuppressWarnings("unchecked")
	private List<Map<String, Object>> pipeline(Map<String, Object> targetConfig) {
		Map<String, Object> deployment = (Map<String, Object>) target(targetConfig).get("deployment");
		return (List<Map<String, Object>>) deployment.get("pipeline");
	}

	private Map<String, Object> processorWithUrl(Map<String, Object> targetConfig, String url) {
		for (Map<String, Object> processor : pipeline(targetConfig)) {
			if (url.equals(processor.get("url"))) {
				return processor;
			}
		}
		return null;
	}

	private long countProcessors(Map<String, Object> targetConfig, String processorName) {
		return pipeline(targetConfig).stream()
			.filter(processor -> processorName.equals(processor.get("processorName")))
			.count();
	}

	@SuppressWarnings("unchecked")
	private void assertHeaderToken(Map<String, Object> processor) {
		List<Map<String, Object>> headers = (List<Map<String, Object>>) processor.get("headers");
		assertNotNull(headers);
		assertEquals(1, headers.size());
		assertEquals("X-Crafter-Management-Token", headers.get(0).get("name"));
		assertEquals("${target.engineManagementToken}", headers.get(0).get("value"));
	}

}
