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
import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;
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
import java.util.List;
import java.util.Map;
import java.util.Set;

import static java.nio.charset.StandardCharsets.UTF_8;
import static java.util.Collections.emptyMap;
import static org.apache.commons.io.IOUtils.toInputStream;
import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertTrue;

/**
 * @author joseross
 */
public class XsltTest {

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

	/**
	 * Each array must follow this structure:
	 * 0: resource for the XSLT template
	 * 1: resource for the input XML
	 * 2: resource for the expected XML
	 * 3: a map of strings to add as parameters for the XSLT template
	 */
	@DataProvider(name = "xsltData")
	public Object[][] getTestData() {
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

	@DataProvider(name = "permissions500TestData")
	public Object[][] permissions500TestData() {
		return new Object[][]{
				{
						new ClassPathResource("crafter/studio/upgrade/5.0.x/permission-mappings/permission-mappings-config-v5.0.0.0.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/5.0/5.0.0/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/permission-mappings-config/5.0/5.0.0/expected.xml"),
						emptyMap()
				}
		};
	}

	@DataProvider(name = "globalPermissions500TestData")
	public Object[][] globalPermissions500TestData() {
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

	@DataProvider(name = "globalRoles500TestData")
	public Object[][] globalRoles500TestData() {
		return new Object[][]{
			new Object[] {
				new ClassPathResource("crafter/studio/upgrade/5.0.x/system/global-role-mappings-config-v5.0.0.4.xslt"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-role-mappings/5.0/5.0.0.4/input.xml"),
				new ClassPathResource("crafter/studio/upgrade/xslt/global-role-mappings/5.0/5.0.0.4/expected.xml"),
				emptyMap()
			}
		};
	}

	@Test(dataProvider = "permissions500TestData")
	public void permissions500Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

    @Test(dataProvider = "globalPermissions500TestData")
    public void globalPermissions500Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
        testXsltTemplate(template, content, expected, params);
    }

	@Test(dataProvider = "globalRoles500TestData")
	public void globalRoles500Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	@Test(dataProvider = "xsltData")
	public void testXsltData(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	@DataProvider(name = "depResolver5001TestData")
	public Object[][] depResolver5001TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/config/resolver-config/resolver-config-v5.0.0.1.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/resolver-config/5.0/5.0.0.1/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/resolver-config/5.0/5.0.0.1/expected.xml"),
						emptyMap()
				}
		};
	}

	@Test(dataProvider = "depResolver5001TestData")
	public void depResolver5001Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	@DataProvider(name = "siteConfig5000TestData")
	public Object[][] siteConfig5000TestData() {
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

	@Test(dataProvider = "siteConfig5000TestData")
	public void siteConfig5000Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	@DataProvider(name = "globalPermissions50010TestData")
	public Object[][] globalPermissions50010TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/system/global-permission-mappings-config-v5.0.0.10.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.10/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.10/expected.xml"),
						emptyMap()
				}
		};
	}

	@Test(dataProvider = "globalPermissions50010TestData")
	public void globalPermissions50010Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	@DataProvider(name = "ui5000TestData")
	public Object[][] ui5000TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.0.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.0/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.0/expected.xml"),
						emptyMap()
				}
		};
	}

	@Test(dataProvider = "ui5000TestData")
	public void ui5000Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	@DataProvider(name = "ui5001TestData")
	public Object[][] ui5001TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.1.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.1/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.1/expected.xml"),
						emptyMap()
				}
		};
	}

	@Test(dataProvider = "ui5001TestData")
	public void ui5001Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	@Test(dataProvider = "ui5002TestData")
	public void ui5002Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	@DataProvider(name = "ui5002TestData")
	public Object[][] ui5002TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.2.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.2/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.2/expected.xml"),
						emptyMap()
				}
		};
	}

	@Test(dataProvider = "ui5003TestData")
	public void ui5003Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	@DataProvider(name = "ui5003TestData")
	public Object[][] ui5003TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.3.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.3/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/ui/v5.0/5.0.0.3/expected.xml"),
						emptyMap()
				}
		};
	}

	@DataProvider(name = "globalPermissions50023TestData")
	public Object[][] globalPermissions50023TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/system/global-permission-mappings-config-v5.0.0.23.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.23/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.23/expected.xml"),
						emptyMap()
				}
		};
	}

	@Test(dataProvider = "globalPermissions50023TestData")
	public void globalPermissions50023Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	@DataProvider(name = "globalPermissions50025TestData")
	public Object[][] globalPermissions50025TestData() {
		return new Object[][]{
				new Object[] {
						new ClassPathResource("crafter/studio/upgrade/5.0.x/system/global-permission-mappings-config-v5.0.0.25.xslt"),
						new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.25/input.xml"),
						new ClassPathResource("crafter/studio/upgrade/xslt/global-permission-mappings/5.0/5.0.0.25/expected.xml"),
						emptyMap()
				}
		};
	}

	@Test(dataProvider = "globalPermissions50025TestData")
	public void globalPermissions50025Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	/**
	 * Removes the legacy content-types tool (and the controls/datasources it contains) from existing
	 * site-config-tools.xml files. The four blueprints were byte-identical before that tool was removed,
	 * so the editorial fixture covers all of them. The sample fixture keeps the other sample tools.
	 * Custom tool entries outside content-types are preserved, including when that tool is already absent.
	 */
	@DataProvider(name = "siteConfigTools407TestData")
	public Object[][] siteConfigTools407TestData() {
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

	@Test(dataProvider = "siteConfigTools407TestData")
	public void siteConfigTools407Test(Resource template, Resource content, Resource expected, Map<String, Object> params) throws IOException, TransformerException {
		testXsltTemplate(template, content, expected, params);
	}

	/**
	 * Shipped blueprints and the sample are already at the post-migration version, so new sites do not
	 * run the 4.0.6 to 4.0.7 step. The XSLT version element is updated by the upgrade manager, not the template.
	 */
	@Test
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
	 * 4.5–4.7 ui.xml is version 4.5.0.0. The pipeline reapplies the PathNavigator i18n transform,
	 * then continues through 5.0.0.1, 5.0.0.2 and 5.0.0.3 for the ContentTypeManagement catalog.
	 * A nested tool reference is not that catalog.
	 */
	@Test
	public void uiPipelineContinuesFrom4500ThroughContentTypeManagement() throws Exception {
		HierarchicalConfiguration config = productionUpgradeConfig();

		assertEquals(templatesFrom(config, "4.5.0.0"), Arrays.asList(templatesFrom4500()),
			"4.5.0.0 must reach the i18n, ContentTypeManagement, TinyMCE and pages-datasource steps");
		assertEquals(finalVersion(config, "4.5.0.0"), "5.0.0.3");

		List<String> from4203 = templatesFrom(config, "4.2.0.3");
		assertEquals(from4203.get(0), "crafter/studio/upgrade/5.0.x/config/ui/ui-v5.0.0.0.xslt");
		assertEquals(from4203.subList(1, from4203.size()), Arrays.asList(CONTENT_TYPE_MANAGEMENT_TEMPLATES));
		assertEquals(finalVersion(config, "4.2.0.3"), "5.0.0.3");

		assertTrue(templatesFrom(config, "5.0.0.3").isEmpty(),
			"sites already at 5.0.0.3 must not run another ui.xml step");
	}

	/**
	 * Representative 4.5 ui.xml: top-level widgets, a nested content-types tool reference, and custom
	 * configuration. The catalog is inserted once. A leftover stock label is translated. An existing
	 * translation descriptor and a custom label stay. Custom widgets, tools and the version element stay.
	 */
	@Test
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
	 * A site that already has its own top-level ContentTypeManagement widget keeps that catalog.
	 * The standard controls are not merged in, and the pages datasource is added beside the custom ones.
	 */
	@Test
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
	@Test
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
	@Test
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

}
