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
package org.craftercms.commons.xml;

import org.dom4j.DocumentException;
import org.dom4j.io.SAXReader;
import org.junit.Test;
import org.xml.sax.InputSource;
import org.xml.sax.SAXParseException;

import javax.xml.parsers.DocumentBuilder;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class XmlSecurityUtilsTest {

	private static final String DOCTYPE_XML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
			"<!DOCTYPE root [<!ENTITY xxe SYSTEM \"file:///etc/hostname\">]>" +
			"<root>&xxe;</root>";

	@Test
	public void createDocumentBuilderRejectsDoctype() throws Exception {
		DocumentBuilder builder = XmlSecurityUtils.createDocumentBuilder();
		assertNotNull(builder);
		assertThrows(SAXParseException.class, () ->
				builder.parse(new InputSource(new ByteArrayInputStream(DOCTYPE_XML.getBytes(StandardCharsets.UTF_8)))));
	}

	@Test
	public void createSaxReaderHasSecurityFeatures() throws Exception {
		SAXReader reader = XmlSecurityUtils.createSaxReader();
		assertNotNull(reader);
		assertTrue(reader.getXMLReader().getFeature("http://apache.org/xml/features/disallow-doctype-decl"));
		assertFalse(reader.getXMLReader().getFeature("http://xml.org/sax/features/external-general-entities"));
		assertFalse(reader.getXMLReader().getFeature("http://xml.org/sax/features/external-parameter-entities"));
	}

	@Test
	public void createSaxReaderRejectsDoctype() throws Exception {
		SAXReader reader = XmlSecurityUtils.createSaxReader();
		assertThrows(DocumentException.class, () ->
				reader.read(new ByteArrayInputStream(DOCTYPE_XML.getBytes(StandardCharsets.UTF_8))));
	}

}
