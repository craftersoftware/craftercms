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
import org.apache.commons.io.output.ByteArrayOutputStream;
import org.craftercms.studio.impl.v2.utils.XsltUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;
import org.xmlunit.builder.DiffBuilder;
import org.xmlunit.diff.Diff;

import javax.xml.transform.TransformerException;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

import static java.nio.charset.StandardCharsets.UTF_8;
import static java.util.Collections.emptyMap;
import static org.apache.commons.io.IOUtils.toInputStream;
import static org.testng.Assert.assertEquals;

/**
 * @author joseross
 */
public class XsltTest {

	private static final Logger logger = LoggerFactory.getLogger(XsltTest.class);

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
