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
package org.craftercms.studio.config;

import org.junit.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;

import static org.junit.Assert.assertTrue;

public class StudioCorsConfigurationTest {

	@Test
	public void corsBeanAssignsCustomHeaderAndMethodListsToTheMatchingArguments() throws Exception {
		try (InputStream input = getClass().getResourceAsStream("/crafter/studio/security/common.xml")) {
			DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
			factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
			factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
			Document document = factory.newDocumentBuilder().parse(input);
			Element bean = corsBean(document);

			assertTrue(value(bean, "allowMethods").contains("studio.cors.methods"));
			assertTrue(value(bean, "allowHeaders").contains("studio.cors.headers"));
			assertTrue(!value(bean, "allowMethods").contains("studio.cors.headers"));
			assertTrue(!value(bean, "allowHeaders").contains("studio.cors.methods"));
		}
	}

	private Element corsBean(Document document) {
		NodeList beans = document.getElementsByTagName("bean");
		for (int i = 0; i < beans.getLength(); i++) {
			Element bean = (Element) beans.item(i);
			if ("crafter.corsConfigSource".equals(bean.getAttribute("id"))) {
				return bean;
			}
		}
		throw new IllegalStateException("CORS bean not found");
	}

	private String value(Element bean, String name) {
		NodeList args = bean.getElementsByTagName("constructor-arg");
		for (int i = 0; i < args.getLength(); i++) {
			Element arg = (Element) args.item(i);
			if (name.equals(arg.getAttribute("name"))) {
				return arg.getAttribute("value");
			}
		}
		throw new IllegalStateException("Missing constructor arg " + name);
	}

}
