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

package org.craftercms.studio.impl.v2.service.configuration.internal;

import org.apache.commons.io.IOUtils;
import org.craftercms.studio.api.v2.exception.configuration.InvalidConfigurationException;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.junit.Test;
import org.xml.sax.ContentHandler;
import org.xml.sax.DTDHandler;
import org.xml.sax.EntityResolver;
import org.xml.sax.ErrorHandler;
import org.xml.sax.InputSource;
import org.xml.sax.Parser;
import org.xml.sax.SAXException;
import org.xml.sax.SAXNotRecognizedException;
import org.xml.sax.SAXNotSupportedException;
import org.xml.sax.XMLReader;
import org.xml.sax.ext.DefaultHandler2;

import javax.xml.XMLConstants;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.parsers.SAXParser;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.LockSupport;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

public class ConfigurationServiceInternalImplValidationTest {

	private static final String WELL_FORMED_XML = "<configuration><header>ok</header></configuration>";
	private static final String DOCTYPE_XML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
			"<!DOCTYPE configuration [<!ENTITY xxe SYSTEM \"file:///etc/hostname\">]>" +
			"<configuration><header>&xxe;</header></configuration>";
	private static final String DOCTYPE_AFTER_COMMENT = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
			"<!-- leading --><!DOCTYPE configuration [<!ENTITY internal \"x\">]><configuration/>";
	private static final String DOCTYPE_AFTER_PI = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
			"<?crafter id=\"cfg\"?><!DOCTYPE configuration [<!ENTITY internal \"x\">]><configuration/>";
	private static final String INTERNAL_SUBSET_XML = "<?xml version=\"1.0\"?>" +
			"<!DOCTYPE configuration [<!ENTITY internal \"expanded-value\">]>" +
			"<configuration>&internal;</configuration>";
	private static final String BILLION_LAUGHS_XML = "<?xml version=\"1.0\"?>" +
			"<!DOCTYPE lolz [" +
			"<!ENTITY lol \"lol\">" +
			"<!ENTITY lol1 \"&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;\">" +
			"<!ENTITY lol2 \"&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;\">" +
			"<!ENTITY lol3 \"&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;\">" +
			"<!ENTITY lol4 \"&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;\">" +
			"<!ENTITY lol5 \"&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;\">" +
			"<!ENTITY lol6 \"&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;\">" +
			"<!ENTITY lol7 \"&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;\">" +
			"<!ENTITY lol8 \"&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;\">" +
			"<!ENTITY lol9 \"&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;\">" +
			"]><lolz>&lol9;</lolz>";
	private static final String COMMENT_CONTAINING_DOCTYPE = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
			"<!-- <!DOCTYPE configuration SYSTEM \"file:///etc/hostname\"> -->" +
			"<configuration><header>ok</header></configuration>";
	private static final String LOWERCASE_DOCTYPE = "<!doctype html><html><body>hello</body></html>";
	private static final String SIMPLE_DOCTYPE = "<?xml version=\"1.0\"?><!DOCTYPE configuration><configuration/>";
	private static final String UTF16_DECLARED_DOCTYPE =
			"<?xml version=\"1.0\" encoding=\"UTF-16\"?><!DOCTYPE configuration><configuration/>";
	private static final String[] NON_XML_FILENAMES = {
			"controller.groovy",
			"template.ftl",
			"widget.json",
			"page.html",
			"config"
	};

	private final ConfigurationServiceInternalImpl service = new ConfigurationServiceInternalImpl();

	@Test
	public void validateAcceptsWellFormedXml() throws Exception {
		InputStream result = service.validate(stream(WELL_FORMED_XML), "site-config.xml");
		assertEquals(WELL_FORMED_XML, IOUtils.toString(result, StandardCharsets.UTF_8));
	}

	@Test
	public void validateRejectsDoctype() {
		assertThrows(InvalidConfigurationException.class, () -> service.validate(stream(DOCTYPE_XML), "global-menu-config.xml"));
	}

	@Test
	public void validateRejectsDoctypeRegardlessOfExtensionCase() {
		assertThrows(InvalidConfigurationException.class, () -> service.validate(stream(DOCTYPE_XML), "site-config.XML"));
	}

	@Test
	public void validateRejectsDoctypeWithoutExtension() {
		assertThrows(InvalidConfigurationException.class, () -> service.validate(stream(DOCTYPE_XML), "config"));
	}

	@Test
	public void validateAllowsNonXmlWithoutExtension() throws Exception {
		String text = "key: value";
		InputStream result = service.validate(stream(text), "config");
		assertEquals(text, IOUtils.toString(result, StandardCharsets.UTF_8));
	}

	@Test
	public void writeConfigurationRejectsExtensionlessDoctypeBeforePersist() {
		ContentService contentService = mock(ContentService.class);
		service.setContentService(contentService);

		assertThrows(InvalidConfigurationException.class, () ->
				service.writeConfiguration("site", "studio", "config", null, stream(DOCTYPE_XML)));
		verifyNoInteractions(contentService);
	}

	@Test
	public void writeConfigurationRejectsDoctypeBeforePersist() {
		ContentService contentService = mock(ContentService.class);
		service.setContentService(contentService);

		assertThrows(InvalidConfigurationException.class, () ->
				service.writeConfiguration("site", "studio", "/config/studio/site-config.xml", null, stream(DOCTYPE_XML)));
		verifyNoInteractions(contentService);
	}

	@Test
	public void writeGlobalConfigurationRejectsDoctypeBeforePersist() {
		ContentService contentService = mock(ContentService.class);
		service.setContentService(contentService);

		assertThrows(InvalidConfigurationException.class, () ->
				service.writeGlobalConfiguration("/configuration/global-menu-config.xml", stream(DOCTYPE_XML)));
		verifyNoInteractions(contentService);
	}

	@Test
	public void validateRejectsDoctypeInNonXmlFiles() {
		for (String filename : NON_XML_FILENAMES) {
			assertRejected(bytes(DOCTYPE_XML), filename);
			assertRejected(bytes(DOCTYPE_AFTER_COMMENT), filename);
			assertRejected(bytes(DOCTYPE_AFTER_PI), filename);
			assertRejected(withUtf8Bom(DOCTYPE_XML), filename);
		}
	}

	@Test
	public void validateRejectsInternalSubsetEntity() {
		assertRejected(bytes(INTERNAL_SUBSET_XML), "template.ftl");
	}

	@Test(timeout = 2000)
	public void validateRejectsBillionLaughsWithinTwoSeconds() {
		assertRejected(bytes(BILLION_LAUGHS_XML), "config");
	}

	@Test
	public void validateRejectsExternalFileEntityWithoutLeakingContents() throws Exception {
		String secret = "crafter-doctype-secret-" + UUID.randomUUID();
		Path file = Files.createTempFile("crafter-doctype-", ".dtd");
		try {
			Files.writeString(file, secret);
			String xml = "<?xml version=\"1.0\"?>" +
					"<!DOCTYPE foo [<!ENTITY ext SYSTEM \"" + file.toUri() + "\">]>" +
					"<foo>&ext;</foo>";
			InvalidConfigurationException error = assertRejected(bytes(xml), "page.html");
			assertDoesNotLeak(error, secret);
		} finally {
			Files.deleteIfExists(file);
		}
	}

	@Test(timeout = 5000)
	public void validateRejectsExternalHttpEntityWithoutConnecting() throws Exception {
		try (ServerSocket server = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
			server.setSoTimeout(200);
			List<Socket> connections = new ArrayList<>();
			AtomicBoolean running = new AtomicBoolean(true);
			AtomicBoolean validationDone = new AtomicBoolean();
			AtomicInteger idleTimeouts = new AtomicInteger();
			Thread acceptor = new Thread(() -> {
				while (running.get()) {
					boolean acceptAfterValidation = validationDone.get();
					try {
						Socket socket = server.accept();
						connections.add(socket);
						socket.close();
					} catch (SocketTimeoutException e) {
						if (acceptAfterValidation) {
							idleTimeouts.incrementAndGet();
						}
					} catch (IOException e) {
						return;
					}
				}
			});
			acceptor.setDaemon(true);
			acceptor.start();
			try {
				String xml = "<?xml version=\"1.0\"?>" +
						"<!DOCTYPE foo [<!ENTITY ext SYSTEM \"http://127.0.0.1:" + server.getLocalPort() + "/secret\">]>" +
						"<foo>&ext;</foo>";
				assertRejected(bytes(xml), "config");
				validationDone.set(true);
				long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(2000);
				while (idleTimeouts.get() == 0 && System.nanoTime() < deadline) {
					LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(10));
				}
				assertTrue("acceptor never went idle after validation", idleTimeouts.get() > 0);
				running.set(false);
				acceptor.join(1000);
				assertFalse(acceptor.isAlive());
				assertEquals(0, connections.size());
			} finally {
				running.set(false);
				try {
					server.close();
				} finally {
					acceptor.join(1000);
					if (!acceptor.isAlive()) {
						for (Socket socket : connections) {
							socket.close();
						}
					}
				}
			}
		}
	}

	@Test
	public void validateAcceptsNonXmlConfiguration() throws Exception {
		assertAccepted("def config = [site: \"demo\"]\nreturn config\n", "controller.groovy");
		assertAccepted("<#assign title=\"Hello\">\n${title}\n", "template.ftl");
		assertAccepted("{\"site\":\"demo\",\"enabled\":true}\n", "widget.json");
		assertAccepted("site: demo\nenabled: true\n", "config.yaml");
		assertAccepted("site: demo\nenabled: true\n", "config.yml");
		assertAccepted("This note mentions a doctype but is not XML.\n", "config");
		assertAccepted(LOWERCASE_DOCTYPE, "page.html");
		assertAccepted(COMMENT_CONTAINING_DOCTYPE, "config");
		assertAccepted(WELL_FORMED_XML, "config");
		assertAccepted(WELL_FORMED_XML, "site-config.xml");
	}

	@Test
	public void validateRejectsDoctypeAcrossLocales() throws Exception {
		Locale original = Locale.getDefault();
		try {
			for (String language : new String[] {"de", "fr", "ja", "tr"}) {
				Locale.setDefault(Locale.forLanguageTag(language));
				assertRejected(bytes(DOCTYPE_XML), "config");
				assertAccepted("def value = 1\n", "script.groovy");
			}
		} finally {
			Locale.setDefault(original);
		}
	}

	@Test
	public void validateRejectsUtf16DoctypeWithBom() {
		assertRejected(utf16(SIMPLE_DOCTYPE, StandardCharsets.UTF_16BE, true), "config");
		assertRejected(utf16(SIMPLE_DOCTYPE, StandardCharsets.UTF_16LE, true), "page.html");
	}

	@Test
	public void validateRejectsUtf16DeclaredDoctypeWithoutBom() {
		assertRejected(utf16(UTF16_DECLARED_DOCTYPE, StandardCharsets.UTF_16BE, false), "template.ftl");
		assertRejected(utf16(UTF16_DECLARED_DOCTYPE, StandardCharsets.UTF_16LE, false), "widget.json");
	}

	@Test
	public void validateRejectsDoctypeWithLongRootName() {
		String name = "a".repeat(1001);
		assertRejected(bytes("<!DOCTYPE " + name + "><x/>"), "script.groovy");
		assertRejected(bytes("<!DOCTYPE " + name + " SYSTEM \"file:///etc/hostname\"><x/>"), "script.groovy");
		assertRejected(bytes("<!DOCTYPE " + "a".repeat(200_000) + "><x/>"), "script.groovy");
	}

	@Test
	public void validateAcceptsDoctypeTextThatIsNotADeclaration() throws Exception {
		assertAccepted("<root><![CDATA[<!DOCTYPE x>]]></root>", "config");
		assertAccepted("<root>before <!DOCTYPE x> after</root>", "page.html");
		assertAccepted("garbage<!DOCTYPE x><x/>", "template.ftl");
		assertAccepted(new byte[] {'<', (byte) 0xFF, (byte) 0xFE, 'a'}, "config");
	}

	@Test
	public void validateRejectsDoctypeBytesWhenReaderCannotBeConfigured() {
		ConfigurationServiceInternalImpl failing = unconfiguredDoctypeReader();
		ContentService contentService = mock(ContentService.class);
		failing.setContentService(contentService);

		InvalidConfigurationException error = assertRejected(failing, bytes(DOCTYPE_XML), "script.groovy");
		assertEquals("Invalid XML configuration file 'script.groovy'", error.getMessage());
		assertRejected(failing, "<!DOCTYPE".getBytes(StandardCharsets.UTF_16BE), "page.html");
		assertRejected(failing, "<!DOCTYPE".getBytes(StandardCharsets.UTF_16LE), "template.ftl");

		assertThrows(InvalidConfigurationException.class, () ->
				failing.writeConfiguration("site", "studio", "script.groovy", null, stream(DOCTYPE_XML)));
		verifyNoInteractions(contentService);
	}

	@Test
	public void validateAcceptsCleanContentWhenReaderCannotBeConfigured() throws Exception {
		ConfigurationServiceInternalImpl failing = unconfiguredDoctypeReader();
		assertAccepted(failing, bytes("def value = 1\n"), "script.groovy");
		assertAccepted(failing, bytes("This note mentions a doctype.\n"), "config");
		assertAccepted(failing, bytes("<!doctype html>"), "page.html");
	}

	@Test
	public void validateUsesByteFallbackWhenReaderCreationThrowsUnsupportedOperation() throws Exception {
		ConfigurationServiceInternalImpl failing = new ConfigurationServiceInternalImpl() {
			@Override
			XMLReader createDoctypeDetectingReader(DefaultHandler2 handler) {
				throw new UnsupportedOperationException("setXIncludeAware");
			}
		};
		assertAccepted(failing, bytes("def value = 1\n"), "script.groovy");
		InvalidConfigurationException error = assertRejected(failing, bytes(DOCTYPE_XML), "script.groovy");
		assertEquals("Invalid XML configuration file 'script.groovy'", error.getMessage());
		assertEquals(UnsupportedOperationException.class, error.getCause().getClass());
	}

	@Test
	public void validateRejectsDoctypeWhenExternalAccessPropertiesAreUnsupported() throws Exception {
		ConfigurationServiceInternalImpl unsupported = new ConfigurationServiceInternalImpl() {
			@Override
			XMLReader createDoctypeDetectingReader(DefaultHandler2 handler)
					throws ParserConfigurationException, SAXException {
				SAXParser parser = new AccessRejectingParser(newDoctypeParser());
				return bindDoctypeReader(parser, parser.getXMLReader(), handler);
			}
		};
		InvalidConfigurationException error = assertRejected(unsupported, bytes(SIMPLE_DOCTYPE), "config");
		assertEquals("Invalid XML configuration file 'config'", error.getMessage());
		assertAccepted(unsupported, bytes(COMMENT_CONTAINING_DOCTYPE), "config");
	}

	@Test
	public void validateAcceptsRuntimeExceptionBeforeDoctype() throws Exception {
		ConfigurationServiceInternalImpl failing = readerThat((handler, input) -> {
			throw new IllegalStateException("before startDTD");
		});
		assertAccepted(failing, bytes("not xml"), "config");
	}

	@Test
	public void validateRejectsRuntimeExceptionAfterDoctype() {
		ConfigurationServiceInternalImpl failing = readerThat((handler, input) -> {
			try {
				handler.startDTD("configuration", null, null);
			} catch (SAXException e) {
				throw new IllegalStateException("after startDTD", e);
			}
		});
		InvalidConfigurationException error = assertRejected(failing, bytes(SIMPLE_DOCTYPE), "config");
		assertEquals("Invalid XML configuration file 'config'", error.getMessage());
	}

	@Test
	public void validateDoesNotPrintFatalError() throws Exception {
		PrintStream original = System.err;
		ByteArrayOutputStream captured = new ByteArrayOutputStream();
		System.setErr(new PrintStream(captured, true, StandardCharsets.UTF_8));
		try {
			assertRejected(bytes(DOCTYPE_XML), "page.html");
			assertAccepted("def value = 1\n", "script.groovy");
		} finally {
			System.setErr(original);
		}
		assertFalse(captured.toString(StandardCharsets.UTF_8),
				captured.toString(StandardCharsets.UTF_8).contains("[Fatal Error]"));
	}

	private InvalidConfigurationException assertRejected(byte[] content, String filename) {
		return assertRejected(service, content, filename);
	}

	private InvalidConfigurationException assertRejected(ConfigurationServiceInternalImpl target, byte[] content,
														  String filename) {
		InvalidConfigurationException error = assertThrows(filename, InvalidConfigurationException.class,
				() -> target.validate(new ByteArrayInputStream(content), filename));
		assertNotNull(filename, error.getCause());
		return error;
	}

	private void assertAccepted(String content, String filename) throws Exception {
		assertAccepted(service, bytes(content), filename);
	}

	private void assertAccepted(byte[] content, String filename) throws Exception {
		assertAccepted(service, content, filename);
	}

	private void assertAccepted(ConfigurationServiceInternalImpl target, byte[] content, String filename) throws Exception {
		InputStream result = target.validate(new ByteArrayInputStream(content), filename);
		assertArrayEquals(filename, content, IOUtils.toByteArray(result));
	}

	private static ConfigurationServiceInternalImpl unconfiguredDoctypeReader() {
		return new ConfigurationServiceInternalImpl() {
			@Override
			XMLReader createDoctypeDetectingReader(DefaultHandler2 handler) throws ParserConfigurationException {
				throw new ParserConfigurationException("forced");
			}
		};
	}

	private static ConfigurationServiceInternalImpl readerThat(ParseFailure failure) {
		return new ConfigurationServiceInternalImpl() {
			@Override
			XMLReader createDoctypeDetectingReader(DefaultHandler2 handler) {
				return new ThrowingXmlReader(handler, failure);
			}
		};
	}

	@FunctionalInterface
	private interface ParseFailure {
		void parse(DefaultHandler2 handler, InputSource input);
	}

	private static final class ThrowingXmlReader extends UnusedXmlReader {

		private final DefaultHandler2 handler;
		private final ParseFailure failure;

		private ThrowingXmlReader(DefaultHandler2 handler, ParseFailure failure) {
			this.handler = handler;
			this.failure = failure;
		}

		@Override
		public void parse(InputSource input) {
			failure.parse(handler, input);
		}
	}

	private static final class AccessRejectingParser extends SAXParser {

		private final SAXParser delegate;
		private XMLReader reader;

		private AccessRejectingParser(SAXParser delegate) {
			this.delegate = delegate;
		}

		@Override
		@SuppressWarnings("deprecation")
		public Parser getParser() {
			throw new UnsupportedOperationException();
		}

		@Override
		public XMLReader getXMLReader() throws SAXException {
			if (reader == null) {
				reader = new AccessRejectingReader(delegate.getXMLReader());
			}
			return reader;
		}

		@Override
		public boolean isNamespaceAware() {
			return delegate.isNamespaceAware();
		}

		@Override
		public boolean isValidating() {
			return delegate.isValidating();
		}

		@Override
		public void setProperty(String name, Object value) throws SAXNotRecognizedException, SAXNotSupportedException {
			if (isExternalAccess(name)) {
				throw new SAXNotRecognizedException(name);
			}
			delegate.setProperty(name, value);
		}

		@Override
		public Object getProperty(String name) throws SAXNotRecognizedException, SAXNotSupportedException {
			return delegate.getProperty(name);
		}
	}

	private static final class AccessRejectingReader extends UnusedXmlReader {

		private final XMLReader delegate;

		private AccessRejectingReader(XMLReader delegate) {
			this.delegate = delegate;
		}

		@Override
		public boolean getFeature(String name) throws SAXNotRecognizedException, SAXNotSupportedException {
			return delegate.getFeature(name);
		}

		@Override
		public void setFeature(String name, boolean value) throws SAXNotRecognizedException, SAXNotSupportedException {
			delegate.setFeature(name, value);
		}

		@Override
		public Object getProperty(String name) throws SAXNotRecognizedException, SAXNotSupportedException {
			return delegate.getProperty(name);
		}

		@Override
		public void setProperty(String name, Object value) throws SAXNotRecognizedException, SAXNotSupportedException {
			if (isExternalAccess(name)) {
				throw new SAXNotSupportedException(name);
			}
			delegate.setProperty(name, value);
		}

		@Override
		public void setEntityResolver(EntityResolver resolver) {
			delegate.setEntityResolver(resolver);
		}

		@Override
		public EntityResolver getEntityResolver() {
			return delegate.getEntityResolver();
		}

		@Override
		public void setDTDHandler(DTDHandler dtdHandler) {
			delegate.setDTDHandler(dtdHandler);
		}

		@Override
		public DTDHandler getDTDHandler() {
			return delegate.getDTDHandler();
		}

		@Override
		public void setContentHandler(ContentHandler contentHandler) {
			delegate.setContentHandler(contentHandler);
		}

		@Override
		public ContentHandler getContentHandler() {
			return delegate.getContentHandler();
		}

		@Override
		public void setErrorHandler(ErrorHandler errorHandler) {
			delegate.setErrorHandler(errorHandler);
		}

		@Override
		public ErrorHandler getErrorHandler() {
			return delegate.getErrorHandler();
		}

		@Override
		public void parse(InputSource input) throws IOException, SAXException {
			delegate.parse(input);
		}

		@Override
		public void parse(String systemId) throws IOException, SAXException {
			delegate.parse(systemId);
		}
	}

	private abstract static class UnusedXmlReader implements XMLReader {

		@Override
		public boolean getFeature(String name) throws SAXNotRecognizedException, SAXNotSupportedException {
			throw new UnsupportedOperationException(name);
		}

		@Override
		public void setFeature(String name, boolean value) throws SAXNotRecognizedException, SAXNotSupportedException {
			throw new UnsupportedOperationException(name);
		}

		@Override
		public Object getProperty(String name) throws SAXNotRecognizedException, SAXNotSupportedException {
			throw new UnsupportedOperationException(name);
		}

		@Override
		public void setProperty(String name, Object value) throws SAXNotRecognizedException, SAXNotSupportedException {
			throw new UnsupportedOperationException(name);
		}

		@Override
		public void setEntityResolver(EntityResolver resolver) {
			throw new UnsupportedOperationException();
		}

		@Override
		public EntityResolver getEntityResolver() {
			throw new UnsupportedOperationException();
		}

		@Override
		public void setDTDHandler(DTDHandler dtdHandler) {
			throw new UnsupportedOperationException();
		}

		@Override
		public DTDHandler getDTDHandler() {
			throw new UnsupportedOperationException();
		}

		@Override
		public void setContentHandler(ContentHandler contentHandler) {
			throw new UnsupportedOperationException();
		}

		@Override
		public ContentHandler getContentHandler() {
			throw new UnsupportedOperationException();
		}

		@Override
		public void setErrorHandler(ErrorHandler errorHandler) {
			throw new UnsupportedOperationException();
		}

		@Override
		public ErrorHandler getErrorHandler() {
			throw new UnsupportedOperationException();
		}

		@Override
		public void parse(InputSource input) throws IOException, SAXException {
			throw new UnsupportedOperationException();
		}

		@Override
		public void parse(String systemId) throws IOException, SAXException {
			throw new UnsupportedOperationException();
		}
	}

	private static boolean isExternalAccess(String name) {
		return XMLConstants.ACCESS_EXTERNAL_DTD.equals(name) || XMLConstants.ACCESS_EXTERNAL_SCHEMA.equals(name);
	}

	private static void assertDoesNotLeak(Throwable error, String secret) {
		Throwable current = error;
		int guard = 0;
		while (current != null && guard++ < 20) {
			if (current.getMessage() != null) {
				assertFalse(current.getMessage(), current.getMessage().contains(secret));
			}
			for (Throwable suppressed : current.getSuppressed()) {
				assertDoesNotLeak(suppressed, secret);
			}
			current = current.getCause();
		}
	}

	private static byte[] bytes(String content) {
		return content.getBytes(StandardCharsets.UTF_8);
	}

	private static byte[] utf16(String content, Charset charset, boolean bom) {
		byte[] body = content.getBytes(charset);
		if (!bom) {
			return body;
		}
		byte[] prefix = charset.equals(StandardCharsets.UTF_16LE)
				? new byte[] {(byte) 0xFF, (byte) 0xFE}
				: new byte[] {(byte) 0xFE, (byte) 0xFF};
		byte[] result = new byte[prefix.length + body.length];
		System.arraycopy(prefix, 0, result, 0, prefix.length);
		System.arraycopy(body, 0, result, prefix.length, body.length);
		return result;
	}

	private static byte[] withUtf8Bom(String content) {
		byte[] body = bytes(content);
		byte[] result = new byte[body.length + 3];
		result[0] = (byte) 0xEF;
		result[1] = (byte) 0xBB;
		result[2] = (byte) 0xBF;
		System.arraycopy(body, 0, result, 3, body.length);
		return result;
	}

	private static ByteArrayInputStream stream(String content) {
		return new ByteArrayInputStream(bytes(content));
	}

}
