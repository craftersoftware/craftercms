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
package org.craftercms.engine.url.rewrite;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.parsers.SAXParser;
import javax.xml.parsers.SAXParserFactory;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.tuckey.web.filters.urlrewrite.Conf;
import org.w3c.dom.Document;
import org.w3c.dom.DocumentType;
import org.w3c.dom.NamedNodeMap;
import org.xml.sax.DTDHandler;
import org.xml.sax.EntityResolver;
import org.xml.sax.ErrorHandler;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import org.xml.sax.SAXParseException;
import org.xml.sax.XMLReader;
import org.xml.sax.ext.DeclHandler;
import org.xml.sax.ext.EntityResolver2;

import jakarta.servlet.ServletContext;

import static org.craftercms.commons.xml.XmlSecurityUtils.DECLARATION_HANDLER;
import static org.craftercms.commons.xml.XmlSecurityUtils.ENTITY_EXPANSION_LIMIT;
import static org.craftercms.commons.xml.XmlSecurityUtils.EXTERNAL_GENERAL_ENTITIES;
import static org.craftercms.commons.xml.XmlSecurityUtils.EXTERNAL_PARAMETER_ENTITIES;
import static org.craftercms.commons.xml.XmlSecurityUtils.LOAD_EXTERNAL_DTD;

/**
 * Tuckey {@link Conf} that loads URL rewrite XML without resolving external entities.
 * <p>
 * Shipped site configuration declares the Tuckey DTD, so rejecting every DOCTYPE would
 * stop those sites from loading. This parser accepts only the DTD public ids packaged in
 * urlrewritefilter and reads those DTDs from that jar. Internal subsets and any other
 * entity are rejected. {@link Conf#loadDom(InputStream)} is not used.
 * <p>
 * {@code Conf}'s constructor calls {@code loadDom} before any instance field on this
 * class could be initialized. Parser settings and the DTD allowlist are static.
 * Parse failures are written to {@link Conf#getErrors()}, which {@code Conf} initializes
 * before that call. {@code loadDom} must not read instance fields.
 */
public final class SecuredConf extends Conf {

	private static final Logger logger = LoggerFactory.getLogger(SecuredConf.class);

	/**
	 * Above the predefined entities a rewrite file uses, and below an expansion bomb.
	 */
	private static final int MAX_ENTITY_EXPANSIONS = 10_000;

	/**
	 * Public ids shipped in urlrewritefilter 5.1.3. Values are classpath resources in that jar.
	 */
	private static final Map<String, String> TUCKEY_DTDS = Map.ofEntries(
		Map.entry("-//tuckey.org//DTD UrlRewrite 1.0//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite1.0.dtd"),
		Map.entry("-//tuckey.org//DTD UrlRewrite 2.0//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite2.0.dtd"),
		Map.entry("-//tuckey.org//DTD UrlRewrite 2.3//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite2.3.dtd"),
		Map.entry("-//tuckey.org//DTD UrlRewrite 2.4//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite2.4.dtd"),
		Map.entry("-//tuckey.org//DTD UrlRewrite 2.5//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite2.5.dtd"),
		Map.entry("-//tuckey.org//DTD UrlRewrite 2.6//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite2.6.dtd"),
		Map.entry("-//tuckey.org//DTD UrlRewrite 3.0//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite3.0.dtd"),
		Map.entry("-//tuckey.org//DTD UrlRewrite 3.1//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite3.1.dtd"),
		Map.entry("-//tuckey.org//DTD UrlRewrite 3.2//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite3.2.dtd"),
		Map.entry("-//tuckey.org//DTD UrlRewrite 3.3//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite3.3.dtd"),
		Map.entry("-//tuckey.org//DTD UrlRewrite 4.0//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite4.0.dtd"),
		Map.entry("-//tuckey.org//DTD UrlRewrite 5.0//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite5.0.dtd"),
		Map.entry("-//tuckey.org//DTD UrlRewrite 5.1//EN", "/org/tuckey/web/filters/urlrewrite/dtds/urlrewrite5.1.dtd")
	);

	private static final EntityResolver ENTITY_RESOLVER = new ClasspathDtdResolver();
	private static final ErrorHandler ERROR_HANDLER = new RejectingErrorHandler();
	private static final RejectingDtdHandler DTD_HANDLER = new RejectingDtdHandler();

	public SecuredConf(ServletContext context, InputStream inputStream, String fileName, String systemId, boolean modRewriteStyleConf) {
		super(context, inputStream, fileName, systemId, modRewriteStyleConf);
	}

	/**
	 * Replaces Tuckey's parser. A secure parser cannot be configured by calling
	 * {@code super.loadDom}: that method builds its own factory and resolver.
	 * <p>
	 * Called from the superclass constructor. Uses only static state.
	 */
	@Override
	protected synchronized void loadDom(InputStream inputStream) {
		if (inputStream == null) {
			recordError("URL rewrite configuration stream is null");
			logger.error("URL rewrite configuration stream is null");
			return;
		}
		try {
			byte[] xml = inputStream.readAllBytes();
			rejectEntityDeclarations(xml);
			Document document = newSecureDocumentBuilder().parse(new ByteArrayInputStream(xml));
			rejectUnsafeDoctype(document);
			processConfDoc(document);
		} catch (SAXParseException e) {
			recordError("Parse error on line " + e.getLineNumber() + " " + detailOf(e));
			logger.error("Failed to parse URL rewrite configuration at line '{}'", e.getLineNumber(), e);
		} catch (Exception e) {
			recordError("Rejected URL rewrite configuration: " + detailOf(e));
			logger.error("Rejected URL rewrite configuration", e);
		}
	}

	private static DocumentBuilder newSecureDocumentBuilder() throws ParserConfigurationException {
		DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
		factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
		factory.setFeature(EXTERNAL_GENERAL_ENTITIES, false);
		factory.setFeature(EXTERNAL_PARAMETER_ENTITIES, false);
		factory.setFeature(LOAD_EXTERNAL_DTD, false);
		factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
		factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
		factory.setAttribute(ENTITY_EXPANSION_LIMIT, MAX_ENTITY_EXPANSIONS);
		factory.setValidating(false);
		factory.setNamespaceAware(true);
		factory.setIgnoringComments(true);
		factory.setXIncludeAware(false);
		// Tuckey reads only the first text child of <from> and <to>. Turning expansion
		// off splits predefined entities such as &amp; into their own nodes and drops
		// the rest of the value. External entities stay disabled by the features above.
		factory.setExpandEntityReferences(true);

		DocumentBuilder builder = factory.newDocumentBuilder();
		builder.setEntityResolver(ENTITY_RESOLVER);
		builder.setErrorHandler(ERROR_HANDLER);
		return builder;
	}

	private static void rejectUnsafeDoctype(Document document) throws SAXException {
		DocumentType docType = document.getDoctype();
		if (docType == null) {
			return;
		}
		String publicId = docType.getPublicId();
		if (publicId == null || !TUCKEY_DTDS.containsKey(publicId)) {
			throw new SAXException("URL rewrite DOCTYPE is not a bundled Tuckey DTD");
		}
		String internalSubset = docType.getInternalSubset();
		if (internalSubset != null && !internalSubset.isBlank()) {
			throw new SAXException("URL rewrite configuration must not declare an internal DTD subset");
		}
		NamedNodeMap entities = docType.getEntities();
		if (entities != null && entities.getLength() > 0) {
			throw new SAXException("URL rewrite configuration must not declare XML entities");
		}
		NamedNodeMap notations = docType.getNotations();
		if (notations != null && notations.getLength() > 0) {
			throw new SAXException("URL rewrite configuration must not declare notations");
		}
	}

	/**
	 * Rejects entity and notation declarations while the DTD is read.
	 * {@code DocumentType#getInternalSubset()} is not sufficient on its own: the DOM
	 * spec allows that value to be null even when a subset was present.
	 */
	private static void rejectEntityDeclarations(byte[] xml)
		throws ParserConfigurationException, SAXException, IOException {
		SAXParserFactory factory = SAXParserFactory.newInstance();
		factory.setNamespaceAware(true);
		factory.setXIncludeAware(false);
		factory.setValidating(false);
		factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
		factory.setFeature(EXTERNAL_GENERAL_ENTITIES, false);
		factory.setFeature(EXTERNAL_PARAMETER_ENTITIES, false);
		factory.setFeature(LOAD_EXTERNAL_DTD, false);
		SAXParser parser = factory.newSAXParser();
		parser.setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "");
		parser.setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
		parser.setProperty(ENTITY_EXPANSION_LIMIT, MAX_ENTITY_EXPANSIONS);
		XMLReader reader = parser.getXMLReader();
		reader.setEntityResolver(ENTITY_RESOLVER);
		reader.setErrorHandler(ERROR_HANDLER);
		reader.setDTDHandler(DTD_HANDLER);
		reader.setProperty(DECLARATION_HANDLER, DTD_HANDLER);
		reader.parse(new InputSource(new ByteArrayInputStream(xml)));
	}

	/**
	 * Stores the failure on the list {@code Conf} creates before it calls {@code loadDom}.
	 * An instance list declared here would still be null during that call.
	 */
	@SuppressWarnings("unchecked")
	private void recordError(String message) {
		getErrors().add(message);
	}

	private static String detailOf(Throwable failure) {
		String message = failure.getMessage();
		Throwable cause = failure.getCause();
		if (cause != null && cause.getMessage() != null
			&& (message == null || !message.contains(cause.getMessage()))) {
			message = message == null ? cause.getMessage() : message + " " + cause.getMessage();
		}
		return message == null ? failure.getClass().getSimpleName() : message;
	}

	/**
	 * Serves bundled Tuckey DTDs and rejects every other entity. Returning null would
	 * tell the parser to open the caller-supplied system id.
	 */
	private static final class ClasspathDtdResolver implements EntityResolver2 {

		@Override
		public InputSource getExternalSubset(String name, String baseURI) {
			return null;
		}

		@Override
		public InputSource resolveEntity(String name, String publicId, String baseURI, String systemId)
			throws SAXException {
			return resolveBundledDtd(publicId);
		}

		@Override
		public InputSource resolveEntity(String publicId, String systemId) throws SAXException {
			return resolveBundledDtd(publicId);
		}

		private static InputSource resolveBundledDtd(String publicId) throws SAXException {
			String resource = publicId == null ? null : TUCKEY_DTDS.get(publicId);
			if (resource == null) {
				throw new SAXException("External XML entity rejected");
			}
			InputStream dtd = Conf.class.getResourceAsStream(resource);
			if (dtd == null) {
				throw new SAXException("Bundled URL rewrite DTD was not found");
			}
			InputSource source = new InputSource(dtd);
			source.setPublicId(publicId);
			return source;
		}
	}

	private static final class RejectingErrorHandler implements ErrorHandler {

		@Override
		public void warning(SAXParseException exception) {
			logger.debug("URL rewrite configuration warning: '{}'", exception.getMessage());
		}

		@Override
		public void error(SAXParseException exception) throws SAXException {
			throw exception;
		}

		@Override
		public void fatalError(SAXParseException exception) throws SAXException {
			throw exception;
		}
	}

	/**
	 * Fails the parse when the DTD declares an entity or notation. Element and attribute
	 * declarations in the bundled Tuckey DTDs are left alone; those DTDs declare neither.
	 */
	private static final class RejectingDtdHandler implements DeclHandler, DTDHandler {

		@Override
		public void elementDecl(String name, String model) {
		}

		@Override
		public void attributeDecl(String elementName, String attributeName, String type, String mode, String value) {
		}

		@Override
		public void internalEntityDecl(String name, String value) throws SAXException {
			throw new SAXException("URL rewrite configuration must not declare XML entities");
		}

		@Override
		public void externalEntityDecl(String name, String publicId, String systemId) throws SAXException {
			throw new SAXException("URL rewrite configuration must not declare XML entities");
		}

		@Override
		public void notationDecl(String name, String publicId, String systemId) throws SAXException {
			throw new SAXException("URL rewrite configuration must not declare notations");
		}

		@Override
		public void unparsedEntityDecl(String name, String publicId, String systemId, String notationName)
			throws SAXException {
			throw new SAXException("URL rewrite configuration must not declare XML entities");
		}
	}

}
