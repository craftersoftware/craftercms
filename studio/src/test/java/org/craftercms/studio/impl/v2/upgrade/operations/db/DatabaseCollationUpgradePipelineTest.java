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

package org.craftercms.studio.impl.v2.upgrade.operations.db;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.io.IOUtils;
import org.craftercms.commons.upgrade.UpgradeOperation;
import org.craftercms.commons.upgrade.UpgradePipeline;
import org.craftercms.commons.upgrade.VersionProvider;
import org.craftercms.commons.upgrade.exception.UpgradeException;
import org.craftercms.commons.upgrade.impl.UpgradeContext;
import org.craftercms.commons.upgrade.impl.configuration.YamlConfigurationProvider;
import org.craftercms.commons.upgrade.impl.operations.UpdateVersionUpgradeOperation;
import org.craftercms.commons.upgrade.impl.pipeline.DefaultUpgradePipelineImpl;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.upgrade.pipeline.PrototypeUpgradePipelineFactoryImpl;
import org.junit.Test;
import org.springframework.beans.factory.xml.XmlBeanDefinitionReader;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.net.URL;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.craftercms.commons.upgrade.UpgradePipelineFactory.CONFIG_KEY_CURRENT_VERSION;
import static org.craftercms.commons.upgrade.UpgradePipelineFactory.CONFIG_KEY_NEXT_VERSION;
import static org.craftercms.commons.upgrade.UpgradePipelineFactory.CONFIG_KEY_OPERATIONS;
import static org.craftercms.commons.upgrade.UpgradePipelineFactory.CONFIG_KEY_TYPE;
import static org.craftercms.commons.upgrade.UpgradePipelineFactory.CONFIG_KEY_VERSIONS;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;

/**
 * The system pipeline is loaded with {@link PrototypeUpgradePipelineFactoryImpl} and the bean
 * definitions in {@code studio-upgrade-context.xml}. The test classpath also contains a stub
 * {@code pipelines.yaml}, so the production file is chosen by its collation step.
 *
 * <p>This test assumes {@code 4.5.1.3} is the last 4.x system upgrade step. Anyone adding a later
 * step must update it.</p>
 */
public class DatabaseCollationUpgradePipelineTest {

    private static final String PREVIOUS_VERSION = "4.5.1.2";
    private static final String NEXT_VERSION = "4.5.1.3";
    private static final String PIPELINE_NAME = "system";
    private static final String PIPELINE_PREFIX = "pipelines.";
    private static final String OPERATION_TYPE = "databaseCollationUpgrader";
    private static final String CREATE_DDL_VERSION =
        "INSERT INTO _meta (version, studio_id) VALUES ('" + NEXT_VERSION + "', UUID())";

    @Test
    public void collationStepIsTheLastSystemUpgrade() throws Exception {
        Resource pipelines = productionPipelines();
        YamlConfigurationProvider provider = new YamlConfigurationProvider(pipelines);
        assertLastVersion(provider.getConfiguration());

        String createDdl = IOUtils.toString(
            new ClassPathResource("crafter/studio/database/createDDL.sql").getInputStream(), UTF_8);
        assertTrue(createDdl.contains(CREATE_DDL_VERSION));

        try (GenericApplicationContext context = upgradeContext()) {
            assertEquals(DatabaseCollationUpgradeOperation.class.getName(),
                context.getBeanFactory().getBeanDefinition(OPERATION_TYPE).getBeanClassName());

            PrototypeUpgradePipelineFactoryImpl factory = new PrototypeUpgradePipelineFactoryImpl(
                PIPELINE_NAME, provider, new FixedVersionProvider(PREVIOUS_VERSION), "defaultPipeline");
            factory.setPipelinePrefix(PIPELINE_PREFIX);
            factory.setApplicationContext(context);

            UpgradePipeline<String> pipeline = factory.getPipeline(new UpgradeContext<>(PIPELINE_NAME) { });
            assertTrue(pipeline instanceof DefaultUpgradePipelineImpl);

            @SuppressWarnings("unchecked")
            List<UpgradeOperation<String>> operations = (List<UpgradeOperation<String>>)
                ReflectionTestUtils.getField(pipeline, "operations");
            assertEquals(2, operations.size());
            assertTrue(operations.get(0) instanceof DatabaseCollationUpgradeOperation);
            assertEquals(PREVIOUS_VERSION, ReflectionTestUtils.getField(operations.get(0), "currentVersion"));
            assertEquals(NEXT_VERSION, ReflectionTestUtils.getField(operations.get(0), "nextVersion"));
            assertTrue(operations.get(1) instanceof UpdateVersionUpgradeOperation);
            assertEquals(NEXT_VERSION, ReflectionTestUtils.getField(operations.get(1), "nextVersion"));
        }
    }

    private static void assertLastVersion(HierarchicalConfiguration config) {
        List<HierarchicalConfiguration> versions = config.configurationsAt(PIPELINE_PREFIX + PIPELINE_NAME + CONFIG_KEY_VERSIONS);
        assertTrue(versions.size() > 1);

        Set<String> currentVersions = new HashSet<>();
        Set<String> nextVersions = new HashSet<>();
        HierarchicalConfiguration collationStep = null;
        for (HierarchicalConfiguration version : versions) {
            String currentVersion = version.getString(CONFIG_KEY_CURRENT_VERSION);
            String nextVersion = version.getString(CONFIG_KEY_NEXT_VERSION);
            currentVersions.add(currentVersion);
            nextVersions.add(nextVersion);
            if (PREVIOUS_VERSION.equals(currentVersion)) {
                collationStep = version;
            }
        }

        assertEquals(PREVIOUS_VERSION, collationStep.getString(CONFIG_KEY_CURRENT_VERSION));
        assertEquals(NEXT_VERSION, collationStep.getString(CONFIG_KEY_NEXT_VERSION));
        List<HierarchicalConfiguration> operations = collationStep.configurationsAt(CONFIG_KEY_OPERATIONS);
        assertEquals(1, operations.size());
        assertEquals(OPERATION_TYPE, operations.get(0).getString(CONFIG_KEY_TYPE));

        assertEquals(NEXT_VERSION, versions.get(versions.size() - 1).getString(CONFIG_KEY_NEXT_VERSION));
        nextVersions.removeAll(currentVersions);
        assertEquals(Collections.singleton(NEXT_VERSION), nextVersions);
    }

    private static GenericApplicationContext upgradeContext() {
        GenericApplicationContext context = new GenericApplicationContext();
        context.getBeanFactory().registerSingleton("studioConfiguration", mock(StudioConfiguration.class));
        XmlBeanDefinitionReader reader = new XmlBeanDefinitionReader(context);
        reader.loadBeanDefinitions(new ClassPathResource("crafter/studio/studio-upgrade-context.xml"));
        for (String name : context.getBeanDefinitionNames()) {
            context.getBeanDefinition(name).setLazyInit(true);
        }
        context.refresh();
        return context;
    }

    private static Resource productionPipelines() throws IOException {
        Enumeration<URL> resources = Thread.currentThread().getContextClassLoader()
            .getResources("crafter/studio/upgrade/pipelines.yaml");
        URL production = null;
        while (resources.hasMoreElements()) {
            URL candidate = resources.nextElement();
            String text = IOUtils.toString(candidate, UTF_8);
            if (text.contains(OPERATION_TYPE)) {
                assertEquals("more than one pipelines.yaml defines " + OPERATION_TYPE, null, production);
                production = candidate;
            }
        }
        assertTrue("production pipelines.yaml was not on the test classpath", production != null);
        return new UrlResource(production);
    }

    private static final class FixedVersionProvider implements VersionProvider<String> {

        private final String version;

        private FixedVersionProvider(String version) {
            this.version = version;
        }

        @Override
        public String getVersion(UpgradeContext<String> context) {
            return version;
        }

        @Override
        public void setVersion(UpgradeContext<String> context, String version) throws UpgradeException {
            throw new UpgradeException("version updates are not part of this test");
        }
    }
}
