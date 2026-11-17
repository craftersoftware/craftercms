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

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.PrintStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.UUID;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;
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

	@Test
	public void validateRejectsExternalHttpEntityWithoutConnecting() throws Exception {
		try (ServerSocket server = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
			String xml = "<?xml version=\"1.0\"?>" +
					"<!DOCTYPE foo [<!ENTITY ext SYSTEM \"http://127.0.0.1:" + server.getLocalPort() + "/secret\">]>" +
					"<foo>&ext;</foo>";
			assertRejected(bytes(xml), "config");
			server.setSoTimeout(500);
			assertThrows(SocketTimeoutException.class, server::accept);
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
		InvalidConfigurationException error = assertThrows(filename, InvalidConfigurationException.class,
				() -> service.validate(new ByteArrayInputStream(content), filename));
		assertNotNull(filename, error.getCause());
		return error;
	}

	private void assertAccepted(String content, String filename) throws Exception {
		InputStream result = service.validate(stream(content), filename);
		assertEquals(filename, content, IOUtils.toString(result, StandardCharsets.UTF_8));
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
