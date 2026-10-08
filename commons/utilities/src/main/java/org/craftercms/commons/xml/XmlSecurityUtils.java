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

import org.dom4j.io.SAXReader;
import org.xml.sax.SAXException;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

/**
 * Factories for XML parsers hardened against XXE and related attacks.
 * <p>
 * Returned parser instances are not thread-safe and must not be cached or shared across threads.
 * Create a new instance for each parse operation.
 */
public final class XmlSecurityUtils {

	private XmlSecurityUtils() {
	}

	/**
	 * Creates a JAXP {@link DocumentBuilder} that rejects DOCTYPE declarations and external entities.
	 *
	 * @return a hardened document builder
	 * @throws ParserConfigurationException if the parser cannot be configured securely
	 */
	public static DocumentBuilder createDocumentBuilder() throws ParserConfigurationException {
		DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
		factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
		factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
		factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
		factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
		factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
		factory.setXIncludeAware(false);
		factory.setExpandEntityReferences(false);
		return factory.newDocumentBuilder();
	}

	/**
	 * Creates a dom4j {@link SAXReader} that rejects DOCTYPE declarations and external entities.
	 *
	 * @return a hardened SAX reader
	 * @throws SAXException if a security feature cannot be configured
	 */
	public static SAXReader createSaxReader() throws SAXException {
		SAXReader reader = new SAXReader();
		reader.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
		reader.setFeature("http://xml.org/sax/features/external-general-entities", false);
		reader.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
		return reader;
	}

}
