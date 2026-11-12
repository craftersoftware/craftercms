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
package org.craftercms.studio;

import org.apache.commons.collections4.IterableUtils;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.io.output.ByteArrayOutputStream;
import org.craftercms.commons.upgrade.impl.configuration.YamlConfigurationProvider;
import org.craftercms.studio.impl.v2.utils.XsltUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.xmlunit.builder.DiffBuilder;
import org.xmlunit.diff.Diff;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.TransformerException;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static java.nio.charset.StandardCharsets.UTF_8;
import static java.util.Collections.emptyMap;
import static org.apache.commons.io.IOUtils.toInputStream;

/**
 * @author joseross
 */
@RunWith(Parameterized.class)
public class XsltTest {

	private enum Scenario {
		XSLT,
		SHIPPED_SITE_CONFIG_TOOLS,
		UI_PIPELINE,
		CONTENT_TYPE_FROM_4500,
		IDENTIFIED_TRANSLATIONS,
		CUSTOM_CATALOG,
		NO_TOP_LEVEL_WIDGET,
		SHIPPED_UI
	}

	private final Scenario scenario;
	private final Resource template;
	private final Resource content;
	private final Resource expected;
	private final Map<String, Object> params;

	public XsltTest(String name, Scenario scenario, Resource template, Resource content, Resource expected,
					Map<String, Object> params) {
		this.scenario = scenario;
		this.template = template;
		this.content = content;
		this.expected = expected;
		this.params = params;
	}

	@Parameterized.Parameters(name = "{0}")
	public static Collection<Object[]> parameters() {
		List<Object[]> rows = new ArrayList<>();
		addXsltCases(rows, "xsltData", getTestData());
		addXsltCases(rows, "permissions500Test", permissions500TestData());
		addXsltCases(rows, "globalPermissions500Test", globalPermissions500TestData());
		addXsltCases(rows, "globalRoles500Test", globalRoles500TestData());
		addXsltCases(rows, "depResolver5001Test", depResolver5001TestData());
		addXsltCases(rows, "siteConfig5000Test", siteConfig5000TestData());
		addXsltCases(rows, "globalPermissions50010Test", globalPermissions50010TestData());
		addXsltCases(rows, "ui5000Test", ui5000TestData());
		addXsltCases(rows, "ui5001Test", ui5001TestData());
		addXsltCases(rows, "ui5002Test", ui5002TestData());
		addXsltCases(rows, "ui5003Test", ui5003TestData());
		addXsltCases(rows, "globalPermissions50023Test", globalPermissions50023TestData());
		addXsltCases(rows, "globalPermissions50025Test", globalPermissions50025TestData());
		addXsltCases(rows, "contentMovePermissionTest", contentMovePermissionTestData());
		addXsltCases(rows, "siteConfigTools407Test", siteConfigTools407TestData());
		addScenario(rows, "shippedSiteConfigToolsRemoveLegacyContentTypesTool", Scenario.SHIPPED_SITE_CONFIG_TOOLS);
		addScenario(rows, "uiPipelineContinuesFrom4500ThroughContentTypeManagement", Scenario.UI_PIPELINE);
		addScenario(rows, "contentTypeManagementUpgradeFrom4500PreservesCustomConfiguration", Scenario.CONTENT_TYPE_FROM_4500);
		addScenario(rows, "stockTextLocalizationPreservesIdentifiedTranslations", Scenario.IDENTIFIED_TRANSLATIONS);
		addScenario(rows, "existingContentTypeManagementCatalogIsNotReplaced", Scenario.CUSTOM_CATALOG);
		addScenario(rows, "contentTypeManagementAddedWhenSiteUiHasNoTopLevelWidget", Scenario.NO_TOP_LEVEL_WIDGET);
		addScenario(rows, "shippedUiContainsContentTypeManagementCatalog", Scenario.SHIPPED_UI);
		return rows;
	}

	private static void addXsltCases(List<Object[]> rows, String name, Object[][] data) {
		for (int i = 0; i < data.length; i++) {
			rows.add(new Object[]{name + "[" + i + "]", Scenario.XSLT, data[i][0], data[i][1], data[i][2], data[i][3]});
		}
	}

	private static void addScenario(List<Object[]> rows, String name, Scenario scenario) {
		rows.add(new Object[]{name, scenario, null, null, null, null});
	}

	@Test
	public void execute() throws Exception {
		switch (scenario) {
			case XSLT -> testXsltTemplate(template, content, expected, params);
			case SHIPPED_SITE_CONFIG_TOOLS -> shippedSiteConfigToolsRemoveLegacyContentTypesTool();
			case UI_PIPELINE -> uiPipelineContinuesFrom4500ThroughContentTypeManagement();
			case CONTENT_TYPE_FROM_4500 -> contentTypeManagementUpgradeFrom4500PreservesCustomConfiguration();
			case IDENTIFIED_TRANSLATIONS -> stockTextLocalizationPreservesIdentifiedTranslations();
			case CUSTOM_CATALOG -> existingContentTypeManagementCatalogIsNotReplaced();
			case NO_TOP_LEVEL_WIDGET -> contentTypeManagementAddedWhenSiteUiHasNoTopLevelWidget();
			case SHIPPED_UI -> shippedUiContainsContentTypeManagementCatalog();
			default -> throw new AssertionError(scenario);
		}
	}



	private static final Logger logger = LoggerFactory.getLogger(XsltTest.class);

	private static final String UI_I18N_TEMPLATE =
		"crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.0.xslt";

	private static final String[] CONTENT_TYPE_MANAGEMENT_TEMPLATES = {
		"crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.1.xslt",
		"crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.2.xslt",
		"crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.3.xslt"
	};

	private static final String UI_4500_FIXTURE =
		"crafter/studio/upgrade/xslt/ui/v5.0/content-type-management/from-4.5.0.0.xml";
	private static final String UI_CUSTOM_CATALOG_FIXTURE =
		"crafter/studio/upgrade/xslt/ui/v5.0/content-type-management/custom-catalog.xml";
	private static final String UI_NO_WIDGET_FIXTURE =
		"crafter/studio/upgrade/xslt/ui/v5.0/content-type-management/no-top-level-widget.xml";
	private static final String UI_I18N_PRESERVE_FIXTURE =
		"crafter/studio/upgrade/xslt/ui/v5.0/i18n-preserve/input.xml";

	/**
	 * Each array must follow this structure:
	 * 0: resource for the XSLT template
	 * 1: resource for the input XML
	 * 2: resource for the expected XML
	 * 3: a map of strings to add as parameters for the XSLT template
	 */
	public static Object[][] getTestData() {
		return new Object[][]{
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config/site-config-v9.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/v9/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/v9/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config/site-config-v10.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/v10/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/v10/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/4.0.0.2/site/rte-refactor.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/rte-refactor/form-definition.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/rte-refactor/form-definition-expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/config-list/config-list-v14.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/rte-refactor/config-list.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/rte-refactor/config-list-expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config-tools/site-config-tools-v13.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/rte-refactor/site-config-tools.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/rte-refactor/site-config-tools-expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/resolver-config/resolver-config-v3.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/resolver-config-v3/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/resolver-config-v3/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/copy.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/cdata/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/cdata/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/4.0.0.3/site/additional-fields.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/additional-fields/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/additional-fields/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/4.0.0.36/system/" +
					"global-permission-mappings-config.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/search-plugins/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/search-plugins/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/permission-mappings-config/" +
					"permission-mappings-config-v4.0.3.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.3/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.3/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/permission-mappings-config/" +
					"permission-mappings-config-v4.0.4.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.4/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.4/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/ui/ui-v4.0.2.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/ui/v4.0.2/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/ui/v4.0.2/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/ui/ui-v4.0.5.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/ui/v4.0.5/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/ui/v4.0.5/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/4.0.1.5/system/global-permission-mappings-config.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/4.0.1.5/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/4.0.1.5/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/permission-mappings-config/" +
					"permission-mappings-config-v4.0.7.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.7/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.7/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/resolver-config/resolver-config-v4.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/resolver-config-v4/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/resolver-config-v4/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config/site-config-v4.0.1.1.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/4.0.1.1/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/4.0.1.1/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/4.0.0.6/site/site-policy-config.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-policy/4.0.0.6/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-policy/4.0.0.6/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/4.0.1.8/system/global-permission-mappings-config.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/4.0.1.8/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/4.0.1.8/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/permission-mappings-config/" +
					"permission-mappings-config-v4.0.7.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.8/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.8/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config-tools/site-config-tools-v4.0.4.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.4/with-child-content/site-config-tools.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.4/with-child-content/site-config-tools-expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config-tools/site-config-tools-v4.0.4.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.4/with-dropTargets/site-config-tools.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.4/with-dropTargets/site-config-tools-expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/4.0.0.7/site/update-content-type-datasources.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/update-content-type-datasources/with-child-content/form-definition.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/update-content-type-datasources/with-child-content/form-definition-expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/4.0.0.7/site/update-content-type-datasources.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/update-content-type-datasources/with-dropTargets/form-definition.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/update-content-type-datasources/with-dropTargets/form-definition-expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config-tools/site-config-tools-v4.0.4.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.4/with-both/site-config-tools.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.4/with-both/site-config-tools-expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config-tools/site-config-tools-v4.0.4.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.4/with-components/site-config-tools.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.4/with-components/site-config-tools-expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config/site-config-v4.0.1.2.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/4.0.1.2/oob/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/4.0.1.2/oob/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config/site-config-v4.0.1.2.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/4.0.1.2/missingFolders/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/4.0.1.2/missingFolders/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config/site-config-v4.0.1.2.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/4.0.1.2/alreadyConfigured/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/4.0.1.2/alreadyConfigured/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/permission-mappings-config/" +
					"permission-mappings-config-v4.0.9.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.9/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.9/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/4.0.1.11/system/global-menu-config.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-menu/4.0.1.11/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-menu/4.0.1.11/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/permission-mappings-config/" +
					"permission-mappings-config-v4.0.10.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.10/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.10/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/permission-mappings-config/" +
					"permission-mappings-config-v4.0.11.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.11/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/permission-mappings-config-v4.0.11/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.1.x/4.1.7/system/global-permission-mappings-config.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/4.1.7/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/4.1.7/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("/crafter/studio/utils/readonly-blob-stores.xslt"),
				new ClassPathResource("crafter/studio/blob-stores/readonly/input.xml"),
				new ClassPathResource("crafter/studio/blob-stores/readonly/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.2.x/config/site-config/site-config-v4.2.0.0.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/4.2.0.0/add/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/4.2.0.0/add/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.2.x/config/site-config/site-config-v4.2.0.0.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/4.2.0.0/existed/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/4.2.0.0/existed/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("/crafter/studio/upgrade/4.2.x/config/ui/ui-v4.2.0.0.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/ui/v4.2/4.2.0.0/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/ui/v4.2/4.2.0.0/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("/crafter/studio/upgrade/4.2.x/config/ui/ui-v4.2.0.1.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/ui/v4.2/4.2.0.1/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/ui/v4.2/4.2.0.1/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config-tools/site-config-tools-v4.0.6.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.6/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.6/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.1.x/site-policy-config/site-policy-config-v4.1.2.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-policy/4.1.2/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-policy/4.1.2/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("/crafter/studio/upgrade/4.2.x/config/ui/ui-v4.2.0.2.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/ui/v4.2/4.2.0.2/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/ui/v4.2/4.2.0.2/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.2.x/permission-mappings/permission-mappings-config-v4.2.0.0.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/4.2/4.2.0.0/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/4.2/4.2.0.0/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.3.x/permission-mappings/permission-mappings-config-v4.3.0.0.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/4.3/4.3.0.0/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/4.3/4.3.0.0/expected.xml"),
				emptyMap()
			},
			new Object[] {
				new ClassPathResource("crafter/studio/upgrade/5.0.x/system/global-permission-mappings-config-v5.0.0.0.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0.0.0/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0.0.0/expected.xml"),
				emptyMap()
			},
			new Object[] {
				new ClassPathResource("crafter/studio/upgrade/5.0.x/config/config-list/config-list-v5.0.0.0.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/config-list/5.0.0.0/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/config-list/5.0.0.0/expected.xml"),
				emptyMap()
			},
			new Object[] {
				new ClassPathResource("crafter/studio/upgrade/5.0.x/config/resolver-config/resolver-config-v5.0.0.0.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/resolver-config/5.0/5.0.0.0/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/resolver-config/5.0/5.0.0.0/expected.xml"),
				emptyMap()
			}
		};
	}

	public static Object[][] permissions500TestData() {
		return new Object[][]{
				{
						new ClassPathResource("crafter/studio/upgrade/5.0.x/permission-mappings/permission-mappings-config-v5.0.0.0.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/5.0/5.0.0/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/5.0/5.0.0/expected.xml"),
						emptyMap()
				}
		};
	}

	public static Object[][] globalPermissions500TestData() {
		return new Object[][]{
			{
				new ClassPathResource("crafter/studio/upgrade/5.0.x/system/global-permission-mappings-config-v5.0.0.1.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.1/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.1/expected.xml"),
				emptyMap()
			},
			new Object[] {
				new ClassPathResource("crafter/studio/upgrade/5.0.x/system/global-permission-mappings-config-v5.0.0.4.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.4/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.4/expected.xml"),
				emptyMap()
			}
		};
	}

	public static Object[][] globalRoles500TestData() {
		return new Object[][]{
			new Object[] {
				new ClassPathResource("crafter/studio/upgrade/5.0.x/system/global-role-mappings-config-v5.0.0.4.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-role-mappings/5.0/5.0.0.4/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-role-mappings/5.0/5.0.0.4/expected.xml"),
				emptyMap()
			}
		};
	}

	public void permissions500Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	public void globalPermissions500Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	public void globalRoles500Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	public void testXsltData(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	public static Object[][] depResolver5001TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/config/resolver-config/resolver-config-v5.0.0.1.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/resolver-config/5.0/5.0.0.1/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/resolver-config/5.0/5.0.0.1/expected.xml"),
						emptyMap()
				}
		};
	}

	public void depResolver5001Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	public static Object[][] siteConfig5000TestData() {
		return new Object[][]{
			new Object[] {
				new ClassPathResource("crafter/studio/upgrade/5.0.x/config/site-config/site-config-v5.0.0.0.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/5.0.0.0/add/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/5.0.0.0/add/expected.xml"),
				emptyMap()
			},
			new Object[] {
				new ClassPathResource("crafter/studio/upgrade/5.0.x/config/site-config/site-config-v5.0.0.0.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/5.0.0.0/existed/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config/5.0.0.0/existed/expected.xml"),
				emptyMap()
			}
		};
	}

	public void siteConfig5000Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	public static Object[][] globalPermissions50010TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/system/global-permission-mappings-config-v5.0.0.10.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.10/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.10/expected.xml"),
						emptyMap()
				}
		};
	}

	public void globalPermissions50010Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	public static Object[][] ui5000TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.0.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.0/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.0/expected.xml"),
						emptyMap()
				}
		};
	}

	public void ui5000Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	public static Object[][] ui5001TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.1.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.1/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.1/expected.xml"),
						emptyMap()
				}
		};
	}

	public void ui5001Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	public void ui5002Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	public static Object[][] ui5002TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.2.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.2/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.2/expected.xml"),
						emptyMap()
				}
		};
	}

	public void ui5003Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	public static Object[][] ui5003TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.3.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.3/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.3/expected.xml"),
						emptyMap()
				}
		};
	}

	public static Object[][] globalPermissions50023TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/system/global-permission-mappings-config-v5.0.0.23.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.23/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.23/expected.xml"),
						emptyMap()
				}
		};
	}

	public void globalPermissions50023Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	public static Object[][] globalPermissions50025TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/system/global-permission-mappings-config-v5.0.0.25.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.25/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.25/expected.xml"),
						emptyMap()
				}
		};
	}

	public void globalPermissions50025Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	/**
	 * content_move is added beside content_write, including on a custom role. A rule that already has
	 * content_move, and a rule with no content_write, are left alone. The harness runs the template twice.
	 */
	public static Object[][] contentMovePermissionTestData() {
		return new Object[][]{
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/5.0.x/permission-mappings/permission-mappings-config-v5.0.0.2.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/5.0/5.0.0.2/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/5.0/5.0.0.2/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/5.0.x/permission-mappings/permission-mappings-config-v5.0.0.2.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.28/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.28/expected.xml"),
				emptyMap()
			}
		};
	}

	/**
	 * Removes the legacy content-types tool (and the controls/datasources it contains) from existing
	 * site-config-tools.xml files. The four blueprints were byte-identical before that tool was removed,
	 * so the editorial fixture covers all of them. The sample fixture keeps the other sample tools.
	 * Custom tool entries outside content-types are preserved, including when that tool is already absent.
	 */
	public static Object[][] siteConfigTools407TestData() {
		return new Object[][]{
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config-tools/site-config-tools-v4.0.7.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.7/blueprint/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.7/blueprint/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config-tools/site-config-tools-v4.0.7.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.7/sample/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.7/sample/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config-tools/site-config-tools-v4.0.7.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.7/custom-tools/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.7/custom-tools/expected.xml"),
				emptyMap()
			},
			new Object[]{
				new ClassPathResource("crafter/studio/upgrade/4.0.x/config/site-config-tools/site-config-tools-v4.0.7.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.7/custom-only/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/site-config-tools/v4.0.7/custom-only/expected.xml"),
				emptyMap()
			}
		};
	}

	public void siteConfigTools407Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	/**
	 * Shipped blueprints and the sample are already at the post-migration version, so new sites do not
	 * run the 4.0.6 to 4.0.7 step. The XSLT version element is updated by the upgrade manager, not the template.
	 */
	public void shippedSiteConfigToolsRemoveLegacyContentTypesTool() throws Exception {
		String[] blueprints = {
			"repo-bootstrap/global/blueprints/1000_website_editorial/config/studio/administration/site-config-tools.xml",
			"repo-bootstrap/global/blueprints/2000_headless_store/config/studio/administration/site-config-tools.xml",
			"repo-bootstrap/global/blueprints/4000_empty/config/studio/administration/site-config-tools.xml",
			"repo-bootstrap/global/blueprints/5000_headless_blog/config/studio/administration/site-config-tools.xml"
		};
		for (String path : blueprints) {
			Set<String> toolNames = toolNames(path);
			assertEquals(version(path), "4.0.7", path);
			assertTrue(toolNames.isEmpty(), path + " still declares tools: " + toolNames);
		}

		String sample = "repo-bootstrap/global/configuration/samples/sample-site-config-tools.xml";
		Set<String> sampleTools = toolNames(sample);
		assertEquals(version(sample), "4.0.7", sample);
		assertFalse(sampleTools.contains("content-types"), sample);
		assertTrue(sampleTools.contains("encrypt-tool"), sample);
		assertTrue(sampleTools.contains("plugin-management"), sample);
	}

	/**
	 * Supported 4.x ui.xml versions join at 5.0-t with no operations. The i18n transform runs once
	 * on the way to 5.0.0.0, then the ContentTypeManagement, TinyMCE, and pages-datasource steps.
	 * A site already at 5.0.0.0 does not run the i18n transform again.
	 */
	public void uiPipelineContinuesFrom4500ThroughContentTypeManagement() throws Exception {
		HierarchicalConfiguration config = productionUpgradeConfig();
		List<String> from4x = Arrays.asList(templatesFrom4500());

		assertEquals(templatesFrom(config, "4.5.0.0"), from4x,
			"4.5.0.0 must reach i18n once, then ContentTypeManagement, TinyMCE, and pages datasource");
		assertEquals(templatesFrom(config, "4.2.0.3"), from4x,
			"4.2.0.3 must use the same 5.0-t entry as 4.5.0.0");
		assertEquals(templatesFrom(config, "4.2.0.2"), from4x,
			"earlier 4.x ui.xml versions must reach the single 5.0-t i18n step");
		assertEquals(finalVersion(config, "4.5.0.0"), "5.0.0.3");
		assertEquals(finalVersion(config, "4.2.0.3"), "5.0.0.3");
		assertEquals(finalVersion(config, "4.2.0.2"), "5.0.0.3");
		assertEquals(templatesFrom(config, "5.0.0.0"), Arrays.asList(CONTENT_TYPE_MANAGEMENT_TEMPLATES),
			"5.0.0.0 must not run the i18n transform again");
		assertEquals(finalVersion(config, "5.0.0.0"), "5.0.0.3");

		assertTrue(templatesFrom(config, "5.0.0.3").isEmpty(),
			"sites already at 5.0.0.3 must not run another ui.xml step");
	}

	/**
	 * Representative 4.5 ui.xml: top-level widgets, a nested content-types tool reference, and custom
	 * configuration. The catalog is inserted once. A leftover stock label is translated. An existing
	 * translation descriptor and a custom label stay. Custom widgets, tools and the version element stay.
	 */
	public void contentTypeManagementUpgradeFrom4500PreservesCustomConfiguration() throws Exception {
		String[] templates = templatesFrom4500();
		String upgraded = applyTemplates(readResource(UI_4500_FIXTURE), templates);
		Document document = parseXmlString(upgraded);
		Element siteUi = document.getDocumentElement();

		assertEquals(text(siteUi, "version"), "4.5.0.0");
		assertEquals(labelById(siteUi, "pathNavigatorTree.pages").getAttribute("defaultMessage"), "Pages");
		assertEquals(labelById(siteUi, "pathNavigatorTree.pages").getTextContent().trim(), "");
		assertEquals(labelById(siteUi, "pathNavigatorTree.components").getAttribute("defaultMessage"), "Components");
		assertEquals(labelText(siteUi, "Site Pages"), "Site Pages");
		assertFalse(labelTexts(siteUi).contains("Pages"));
		assertEquals(catalogIds(topLevelContentTypeManagement(document), "control"),
			shippedContentTypeCatalog("control"));
		assertEquals(catalogIds(topLevelContentTypeManagement(document), "dataSource"),
			shippedContentTypeCatalog("dataSource"));
		assertEquals(childElements(toolWidget(document, "craftercms.components.ContentTypeManagement")).size(), 0);
		assertEquals(text(widget(siteUi, "craftercms.components.CustomSiteWidget"), "keep"), "custom-value");
		assertEquals(text(descendantWidget(siteUi, "acme.components.CustomTool"), "option"), "keep-me");

		List<Element> children = childElements(siteUi);
		assertTrue(indexOf(children, "widget", "craftercms.components.CustomSiteWidget")
			< indexOf(children, "widget", "craftercms.components.ContentTypeManagement"));
		assertTrue(indexOf(children, "widget", "craftercms.components.ContentTypeManagement")
			< indexOf(children, "references", null));

		String tinymce = text(widget(siteUi, "craftercms.components.TinyMCE"), "tinymceOptions");
		assertFalse(tinymce.contains("autoresize_on_init"));
		assertTrue(tinymce.contains("autoresize_bottom_margin"));
		assertTrue(tinymce.contains("blocks | bold"));

		assertIdempotent(upgraded, templates);
	}

	/**
	 * Plain stock text is localized. An element that already has an id keeps that id, its defaultMessage,
	 * and its text. The same rule applies to Preview Audiences name, label, and helpText.
	 */
	public void stockTextLocalizationPreservesIdentifiedTranslations() throws Exception {
		String upgraded = applyTemplates(readResource(UI_I18N_PRESERVE_FIXTURE), UI_I18N_TEMPLATE);
		Document document = parseXmlString(upgraded);
		Element siteUi = document.getDocumentElement();

		assertTranslation(siteUi, "label", "pathNavigatorTree.pages", "Pages", "");
		assertTranslation(siteUi, "label", "acme.pages", "Project pages", "Pages");
		assertTranslation(siteUi, "label", "pathNavigatorTree.components", "Custom components", "Components");
		assertTranslation(siteUi, "label", "pathNavigatorTree.items", "Items", "");
		Element sitePages = unlabeled(siteUi, "label", "Site Pages");
		assertEquals(sitePages.getAttribute("id"), "");
		assertEquals(sitePages.getAttribute("defaultMessage"), "");

		assertTranslation(siteUi, "name", "previewAudiencesPanel.segmentLabel", "Segment", "");
		assertTranslation(siteUi, "name", "acme.segment", "Audience", "Segment");
		assertTranslation(siteUi, "name", "previewAudiencesPanel.nameLabel", "Display name", "Name");
		assertTranslation(siteUi, "label", "previewAudiencesPanel.guyValueLabel", "Guy", "");
		assertTranslation(siteUi, "label", "acme.guy", "Person", "Guy");
		assertTranslation(siteUi, "helpText", "previewAudiencesPanel.segmentHelpText",
			"Setting the segment will change content targeting to the audience selected", "");
		assertTranslation(siteUi, "helpText", "acme.help", "Custom targeting note",
			"Setting the segment will change content targeting to the audience selected.");
		Element nickname = unlabeled(siteUi, "name", "Nickname");
		assertEquals(nickname.getAttribute("id"), "");

		assertIdempotent(upgraded, UI_I18N_TEMPLATE);
	}

	/**
	 * A site that already has its own top-level ContentTypeManagement widget keeps that catalog.
	 * The standard controls are not merged in, and the pages datasource is added beside the custom ones.
	 */
	public void existingContentTypeManagementCatalogIsNotReplaced() throws Exception {
		String upgraded = applyTemplates(readResource(UI_CUSTOM_CATALOG_FIXTURE), CONTENT_TYPE_MANAGEMENT_TEMPLATES);
		Document document = parseXmlString(upgraded);
		Element catalog = topLevelContentTypeManagement(document);

		assertEquals(catalogIds(catalog, "control"), List.of("input", "acme-custom"));
		assertEquals(iconId(catalog, "control", "input"), "acme.icons.CustomInput");
		assertEquals(iconId(catalog, "control", "acme-custom"), "acme.icons.Custom");
		assertEquals(catalogIds(catalog, "dataSource"), List.of("pages", "components"));
		assertEquals(iconId(catalog, "dataSource", "components"), "acme.icons.Components");
		assertEquals(text(widget(document.getDocumentElement(), "craftercms.components.CustomSiteWidget"), "keep"),
			"still-here");
		assertFalse(text(widget(document.getDocumentElement(), "craftercms.components.TinyMCE"), "tinymceOptions")
			.contains("autoresize_on_init"));

		assertIdempotent(upgraded, CONTENT_TYPE_MANAGEMENT_TEMPLATES);
	}

	/**
	 * siteUi with no top-level widget still receives the catalog. Existing elements stay in order,
	 * and a nested tool reference is left as a reference.
	 */
	public void contentTypeManagementAddedWhenSiteUiHasNoTopLevelWidget() throws Exception {
		String upgraded = applyTemplates(readResource(UI_NO_WIDGET_FIXTURE), CONTENT_TYPE_MANAGEMENT_TEMPLATES);
		Document document = parseXmlString(upgraded);
		Element siteUi = document.getDocumentElement();

		assertEquals(text(siteUi, "studioCustom"), "keep-custom");
		assertEquals(text(siteUi, "version"), "4.5.0.0");
		assertEquals(catalogIds(topLevelContentTypeManagement(document), "control"),
			shippedContentTypeCatalog("control"));
		assertEquals(catalogIds(topLevelContentTypeManagement(document), "dataSource"),
			shippedContentTypeCatalog("dataSource"));
		assertEquals(childElements(toolWidget(document, "craftercms.components.ContentTypeManagement")).size(), 0);

		List<Element> children = childElements(siteUi);
		assertTrue(indexOf(children, "studioCustom", null) < indexOf(children, "references", null));
		assertTrue(indexOf(children, "references", null)
			< indexOf(children, "widget", "craftercms.components.ContentTypeManagement"));

		assertIdempotent(upgraded, CONTENT_TYPE_MANAGEMENT_TEMPLATES);
	}

	/**
	 * New sites already ship the catalog at ui.xml 5.0.0.3. The sample has the same catalog and is not
	 * a versioned site file.
	 */
	public void shippedUiContainsContentTypeManagementCatalog() throws Exception {
		List<String> controls = shippedContentTypeCatalog("control");
		List<String> dataSources = shippedContentTypeCatalog("dataSource");
		assertEquals(new HashSet<>(controls).size(), controls.size(), "duplicate shipped controls");
		assertEquals(new HashSet<>(dataSources).size(), dataSources.size(), "duplicate shipped data sources");
		assertTrue(controls.contains("input"));
		assertTrue(controls.contains("rte"));
		assertTrue(dataSources.contains("pages"));
		assertTrue(dataSources.contains("components"));

		String[] blueprints = {
			"repo-bootstrap/global/blueprints/1000_website_editorial/config/studio/ui.xml",
			"repo-bootstrap/global/blueprints/2000_headless_store/config/studio/ui.xml",
			"repo-bootstrap/global/blueprints/4000_empty/config/studio/ui.xml",
			"repo-bootstrap/global/blueprints/5000_headless_blog/config/studio/ui.xml"
		};
		for (String path : blueprints) {
			Document document = parseXml(path);
			assertEquals(version(path), "5.0.0.3", path);
			assertEquals(catalogIds(topLevelContentTypeManagement(document), "control"), controls, path);
			assertEquals(catalogIds(topLevelContentTypeManagement(document), "dataSource"), dataSources, path);
			assertEquals(childElements(toolWidget(document, "craftercms.components.ContentTypeManagement")).size(), 0,
				path);
		}

		Document sample = parseXml("repo-bootstrap/global/configuration/samples/sample-ui.xml");
		assertEquals(catalogIds(topLevelContentTypeManagement(sample), "control"), controls);
		assertEquals(catalogIds(topLevelContentTypeManagement(sample), "dataSource"), dataSources);
		assertEquals(childElements(toolWidget(sample, "craftercms.components.ContentTypeManagement")).size(), 0);
	}

	private HierarchicalConfiguration productionUpgradeConfig() throws Exception {
		File xslt = new ClassPathResource(CONTENT_TYPE_MANAGEMENT_TEMPLATES[0]).getFile();
		File pipelines = xslt.toPath().getParent().getParent().getParent().getParent()
			.resolve("pipelines.yaml").toFile();
		assertTrue(pipelines.isFile(), pipelines.getAbsolutePath());
		return new YamlConfigurationProvider(new FileSystemResource(pipelines)).getConfiguration();
	}

	@SuppressWarnings("rawtypes")
	private List<String> templatesFrom(HierarchicalConfiguration config, String startVersion) {
		List<String> templates = new ArrayList<>();
		String next = startVersion;
		for (Object item : config.configurationsAt("configurations.ui.pipeline")) {
			HierarchicalConfiguration step = (HierarchicalConfiguration) item;
			if (!next.equals(step.getString("currentVersion"))) {
				continue;
			}
			for (Object operationItem : step.configurationsAt("operations")) {
				HierarchicalConfiguration operation = (HierarchicalConfiguration) operationItem;
				String template = operation.getString("template");
				if (template != null) {
					templates.add(template);
				}
			}
			next = step.getString("nextVersion");
		}
		return templates;
	}

	@SuppressWarnings("rawtypes")
	private String finalVersion(HierarchicalConfiguration config, String startVersion) {
		String next = startVersion;
		for (Object item : config.configurationsAt("configurations.ui.pipeline")) {
			HierarchicalConfiguration step = (HierarchicalConfiguration) item;
			if (next.equals(step.getString("currentVersion"))) {
				next = step.getString("nextVersion");
			}
		}
		return next;
	}

	private String applyTemplates(String xml, String... templates) throws IOException, TransformerException {
		String current = xml;
		for (String template : templates) {
			try (InputStream templateIs = new ClassPathResource(template).getInputStream();
			     InputStream contentIs = toInputStream(current, UTF_8)) {
				ByteArrayOutputStream output = new ByteArrayOutputStream();
				XsltUtils.executeTemplate(templateIs, emptyMap(), null, contentIs, output);
				current = new String(output.toByteArray(), UTF_8);
			}
		}
		return current;
	}

	private String[] templatesFrom4500() {
		String[] templates = new String[1 + CONTENT_TYPE_MANAGEMENT_TEMPLATES.length];
		templates[0] = UI_I18N_TEMPLATE;
		System.arraycopy(CONTENT_TYPE_MANAGEMENT_TEMPLATES, 0, templates, 1, CONTENT_TYPE_MANAGEMENT_TEMPLATES.length);
		return templates;
	}

	private void assertIdempotent(String xml, String... templates) throws IOException, TransformerException {
		String second = applyTemplates(xml, templates);
		Diff diff = DiffBuilder.compare(xml).withTest(second)
			.ignoreWhitespace()
			.ignoreComments()
			.checkForSimilar()
			.build();
		assertEquals(IterableUtils.size(diff.getDifferences()), 0,
			"running the ui.xml 5.0.0.1 through 5.0.0.3 templates again should not change the document");
	}

	private String readResource(String path) throws IOException {
		try (InputStream input = new ClassPathResource(path).getInputStream()) {
			return new String(input.readAllBytes(), StandardCharsets.UTF_8);
		}
	}

	private Document parseXmlString(String xml) throws Exception {
		DocumentBuilderFactory factory = xmlFactory();
		return factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
	}

	private List<String> shippedContentTypeCatalog(String elementName) throws Exception {
		Document editorial = parseXml(
			"repo-bootstrap/global/blueprints/1000_website_editorial/config/studio/ui.xml");
		return catalogIds(topLevelContentTypeManagement(editorial), elementName);
	}

	private List<String> catalogIds(Element catalog, String elementName) {
		Element container = childElement(childElement(catalog, "configuration"),
			"control".equals(elementName) ? "controls" : "dataSources");
		List<String> ids = new ArrayList<>();
		for (Element element : childElements(container, elementName)) {
			ids.add(element.getAttribute("id"));
		}
		return ids;
	}

	private String iconId(Element catalog, String elementName, String id) {
		Element container = childElement(childElement(catalog, "configuration"),
			"control".equals(elementName) ? "controls" : "dataSources");
		for (Element element : childElements(container, elementName)) {
			if (id.equals(element.getAttribute("id"))) {
				return childElement(element, "icon").getAttribute("id");
			}
		}
		throw new AssertionError("Missing " + elementName + " " + id);
	}

	private Element topLevelContentTypeManagement(Document document) {
		List<Element> matches = new ArrayList<>();
		for (Element widget : childElements(document.getDocumentElement(), "widget")) {
			if ("craftercms.components.ContentTypeManagement".equals(widget.getAttribute("id"))) {
				matches.add(widget);
			}
		}
		assertEquals(matches.size(), 1, "top-level ContentTypeManagement widgets");
		return matches.get(0);
	}

	private Element toolWidget(Document document, String id) {
		Element references = childElement(document.getDocumentElement(), "references");
		for (Element reference : childElements(references, "reference")) {
			if (!"craftercms.siteTools".equals(reference.getAttribute("id"))) {
				continue;
			}
			for (Element tool : childElements(childElement(reference, "tools"), "tool")) {
				for (Element widget : childElements(tool, "widget")) {
					if (id.equals(widget.getAttribute("id"))) {
						return widget;
					}
				}
			}
		}
		throw new AssertionError("Missing tool widget " + id);
	}

	private Element descendantWidget(Element parent, String id) {
		NodeList widgets = parent.getElementsByTagName("widget");
		Element found = null;
		for (int i = 0; i < widgets.getLength(); i++) {
			Element widget = (Element) widgets.item(i);
			if (!id.equals(widget.getAttribute("id"))) {
				continue;
			}
			if (found != null) {
				throw new AssertionError("Multiple widgets " + id);
			}
			found = widget;
		}
		if (found == null) {
			throw new AssertionError("Missing widget " + id);
		}
		return found;
	}

	private void assertTranslation(Element parent, String tag, String id, String defaultMessage, String text) {
		List<Element> matches = elementsById(parent, tag, id);
		assertEquals(matches.size(), 1, tag + " " + id);
		assertEquals(matches.get(0).getAttribute("defaultMessage"), defaultMessage, id);
		assertEquals(matches.get(0).getTextContent().trim(), text, id);
	}

	private Element unlabeled(Element parent, String tag, String text) {
		NodeList nodes = parent.getElementsByTagName(tag);
		Element found = null;
		for (int i = 0; i < nodes.getLength(); i++) {
			Element element = (Element) nodes.item(i);
			if (!text.equals(element.getTextContent().trim()) || element.hasAttribute("id")) {
				continue;
			}
			if (found != null) {
				throw new AssertionError("Multiple unlabeled " + tag + " elements with text " + text);
			}
			found = element;
		}
		if (found == null) {
			throw new AssertionError("Missing unlabeled " + tag + " " + text);
		}
		return found;
	}

	private List<Element> elementsById(Element parent, String tag, String id) {
		List<Element> matches = new ArrayList<>();
		NodeList nodes = parent.getElementsByTagName(tag);
		for (int i = 0; i < nodes.getLength(); i++) {
			Element element = (Element) nodes.item(i);
			if (id.equals(element.getAttribute("id"))) {
				matches.add(element);
			}
		}
		return matches;
	}

	private Element labelById(Element parent, String id) {
		NodeList labels = parent.getElementsByTagName("label");
		for (int i = 0; i < labels.getLength(); i++) {
			Element label = (Element) labels.item(i);
			if (id.equals(label.getAttribute("id"))) {
				return label;
			}
		}
		throw new AssertionError("Missing label " + id);
	}

	private String labelText(Element parent, String text) {
		List<String> texts = labelTexts(parent);
		assertTrue(texts.contains(text), text);
		return text;
	}

	private List<String> labelTexts(Element parent) {
		List<String> texts = new ArrayList<>();
		NodeList labels = parent.getElementsByTagName("label");
		for (int i = 0; i < labels.getLength(); i++) {
			String text = labels.item(i).getTextContent().trim();
			if (!text.isEmpty()) {
				texts.add(text);
			}
		}
		return texts;
	}

	private Element widget(Element parent, String id) {
		for (Element widget : childElements(parent, "widget")) {
			if (id.equals(widget.getAttribute("id"))) {
				return widget;
			}
		}
		throw new AssertionError("Missing widget " + id);
	}

	private int indexOf(List<Element> elements, String name, String id) {
		for (int i = 0; i < elements.size(); i++) {
			Element element = elements.get(i);
			if (name.equals(element.getNodeName()) && (id == null || id.equals(element.getAttribute("id")))) {
				return i;
			}
		}
		throw new AssertionError("Missing " + name + " " + id);
	}

	private String text(Element parent, String childName) {
		NodeList nodes = parent.getElementsByTagName(childName);
		assertEquals(nodes.getLength(), 1, parent.getNodeName() + "/" + childName);
		return nodes.item(0).getTextContent();
	}

	private Element childElement(Element parent, String name) {
		List<Element> children = name == null ? childElements(parent) : childElements(parent, name);
		assertEquals(children.size(), 1, parent.getNodeName() + "/" + name);
		return children.get(0);
	}

	private List<Element> childElements(Element parent) {
		return childElements(parent, null);
	}

	private List<Element> childElements(Element parent, String name) {
		List<Element> result = new ArrayList<>();
		NodeList children = parent.getChildNodes();
		for (int i = 0; i < children.getLength(); i++) {
			Node child = children.item(i);
			if (child instanceof Element && (name == null || name.equals(child.getNodeName()))) {
				result.add((Element) child);
			}
		}
		return result;
	}

	private DocumentBuilderFactory xmlFactory() throws Exception {
		DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
		factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
		factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
		return factory;
	}

	private String version(String path) throws Exception {
		Document document = parseXml(path);
		return document.getElementsByTagName("version").item(0).getTextContent().trim();
	}

	private Set<String> toolNames(String path) throws Exception {
		Document document = parseXml(path);
		NodeList tools = document.getElementsByTagName("tool");
		Set<String> names = new HashSet<>();
		for (int i = 0; i < tools.getLength(); i++) {
			NodeList children = tools.item(i).getChildNodes();
			for (int j = 0; j < children.getLength(); j++) {
				Node child = children.item(j);
				if (child instanceof Element && "name".equals(child.getNodeName())) {
					names.add(child.getTextContent().trim());
				}
			}
		}
		return names;
	}

	private Document parseXml(String path) throws Exception {
		DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
		factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
		factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
		try (InputStream input = new ClassPathResource(path).getInputStream()) {
			return factory.newDocumentBuilder().parse(input);
		}
	}

	private void testXsltTemplate(Resource template, Resource content, Resource expected, Map<String, Object> params)
		throws IOException, TransformerException {
		try (InputStream templateIs = template.getInputStream();
		     InputStream contentIs = content.getInputStream();
		     InputStream expectedIs = expected.getInputStream()) {
			ByteArrayOutputStream output = new ByteArrayOutputStream();
			XsltUtils.executeTemplate(templateIs, params, null, contentIs, output);
			String result = new String(output.toByteArray());

			// Compare the result
			Diff diff = DiffBuilder
				.compare(expectedIs)
				.withTest(result)
				.ignoreWhitespace()
				.ignoreComments()
				.checkForSimilar()
				.build();

			if (diff.hasDifferences()) {
				logger.debug(result);
			}

			// there should not be any differences
			assertEquals(IterableUtils.size(diff.getDifferences()), 0,
				"The result XML should be equal to the expected XML");

			// test that the XSLT is idempotent
			output = new ByteArrayOutputStream();
			try (InputStream template2 = template.getInputStream()) {
				XsltUtils.executeTemplate(template2, params, null, toInputStream(result, UTF_8), output);

				// Compare the result
				diff = DiffBuilder
					.compare(result)
					.withTest(output.toByteArray())
					.ignoreWhitespace()
					.ignoreComments()
					.checkForSimilar()
					.build();

				if (diff.hasDifferences()) {
					logger.debug(new String(output.toByteArray()));
				}
				// there should not be any differences
				assertEquals(IterableUtils.size(diff.getDifferences()), 0,
					"The result XML should not change the second time");

			}
		}
	}


	private static void assertEquals(Object actual, Object expected) {
		org.junit.Assert.assertEquals(expected, actual);
	}

	private static void assertEquals(Object actual, Object expected, String message) {
		org.junit.Assert.assertEquals(message, expected, actual);
	}

	private static void assertTrue(boolean condition) {
		org.junit.Assert.assertTrue(condition);
	}

	private static void assertTrue(boolean condition, String message) {
		org.junit.Assert.assertTrue(message, condition);
	}

	private static void assertFalse(boolean condition) {
		org.junit.Assert.assertFalse(condition);
	}

	private static void assertFalse(boolean condition, String message) {
		org.junit.Assert.assertFalse(message, condition);
	}

}
