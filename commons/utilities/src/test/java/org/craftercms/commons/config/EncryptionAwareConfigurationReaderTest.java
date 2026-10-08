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
package org.craftercms.commons.config;

import junit.framework.TestCase;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.craftercms.commons.crypto.TextEncryptor;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.core.io.FileSystemResource;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.ServerSocket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class EncryptionAwareConfigurationReaderTest extends TestCase {
    private static final String CONFIG_CONTENT = "<configuration>" +
            "<header>This is the site: ${siteName}</header>" +
            "<java-version>${sys:java.version}</java-version>" +
            "<env-var>${env:TEST_ENV_PROPERTY1}</env-var>" +
            "<secret>${enc:ENCRYPTED_VALUE}</secret>" +
            "</configuration>";
    private static final String SITE_NAME = "test-site";
    private static final String SITE_NAME_VARIABLE = "siteName";
    private static final String CONFIGURATION_PROPERTY_KEY = "header";
    private static final String ENV_VARIABLE_PROPERTY_KEY = "env-var";
    private static final String ENV_VARIABLE_VALUE = "CUSTOM_VALUE";
    public static final String SECRET_PROPERTY_KEY = "secret";
    private static final String DECRYPTED_SECRET_VALUE = "this is the secret";
    private static final String ENCRYPTED_VALUE = "ENCRYPTED_VALUE";
	private static final String XXE_MARKER = "XXE_MARKER_SHOULD_NOT_LEAK";
    private Map<String, String> lookupVariables;

    @Mock
    protected TextEncryptor textEncryptor;
    protected EncryptionAwareConfigurationReader encryptionAwareConfigurationReader;

    @Override
    @Before
    public void setUp() throws Exception {
        when(textEncryptor.decrypt(ENCRYPTED_VALUE)).thenReturn(DECRYPTED_SECRET_VALUE);
        encryptionAwareConfigurationReader = new EncryptionAwareConfigurationReader(textEncryptor);
        lookupVariables = Map.of(SITE_NAME_VARIABLE, SITE_NAME);
    }

    @Test
    public void testReadXmlLookupVariable() throws UnsupportedEncodingException, ConfigurationException {
        HierarchicalConfiguration<?> xmlConfiguration = encryptionAwareConfigurationReader
                .readXmlConfiguration(new ByteArrayInputStream(CONFIG_CONTENT.getBytes(StandardCharsets.UTF_8)), lookupVariables);
        assertEquals("This is the site: " + SITE_NAME, xmlConfiguration.getString(CONFIGURATION_PROPERTY_KEY));
    }

    @Test
    public void testReadXmlEnvVariable() throws UnsupportedEncodingException, ConfigurationException {
        HierarchicalConfiguration<?> xmlConfiguration = encryptionAwareConfigurationReader
                .readXmlConfiguration(new ByteArrayInputStream(CONFIG_CONTENT.getBytes(StandardCharsets.UTF_8)), lookupVariables);
        assertEquals(ENV_VARIABLE_VALUE, xmlConfiguration.getString(ENV_VARIABLE_PROPERTY_KEY));
    }

    @Test
    public void testReadXmlEncryptedValue() throws UnsupportedEncodingException, ConfigurationException {
        HierarchicalConfiguration<?> xmlConfiguration = encryptionAwareConfigurationReader
                .readXmlConfiguration(new ByteArrayInputStream(CONFIG_CONTENT.getBytes(StandardCharsets.UTF_8)), lookupVariables);
        assertEquals(DECRYPTED_SECRET_VALUE, xmlConfiguration.getString(SECRET_PROPERTY_KEY));
    }

	@Test
	public void testReadXmlResource() throws IOException, ConfigurationException {
		Path config = Files.createTempFile("config", ".xml");
		Files.writeString(config, "<configuration><header>ok</header></configuration>");
		try {
			HierarchicalConfiguration<?> xmlConfiguration = encryptionAwareConfigurationReader
					.readXmlConfiguration(new FileSystemResource(config), lookupVariables);
			assertEquals("ok", xmlConfiguration.getString("header"));
		} finally {
			Files.deleteIfExists(config);
		}
	}

	@Test
	public void testReadXmlRejectsExternalEntity() throws IOException {
		Path secret = Files.createTempFile("xxe-secret", ".txt");
		Files.writeString(secret, XXE_MARKER);
		String payload = externalEntityPayload(secret);
		try {
			ConfigurationException ex = assertThrows(ConfigurationException.class, () ->
					encryptionAwareConfigurationReader.readXmlConfiguration(
							new ByteArrayInputStream(payload.getBytes(StandardCharsets.UTF_8)), lookupVariables));
			assertFalse(exceptionText(ex).contains(XXE_MARKER));
			assertTrue(exceptionText(ex).toLowerCase().contains("doctype"));
		} finally {
			Files.deleteIfExists(secret);
		}
	}

	@Test
	public void testReadXmlResourceRejectsExternalEntity() throws IOException {
		Path secret = Files.createTempFile("xxe-secret", ".txt");
		Path config = Files.createTempFile("xxe-config", ".xml");
		Files.writeString(secret, XXE_MARKER);
		Files.writeString(config, externalEntityPayload(secret));
		try {
			ConfigurationException ex = assertThrows(ConfigurationException.class, () ->
					encryptionAwareConfigurationReader.readXmlConfiguration(new FileSystemResource(config), lookupVariables));
			assertTrue(ex.getMessage().contains("Unable to read XML configuration"));
			assertFalse(ex.getMessage().contains("Unable to get URL"));
			assertFalse(exceptionText(ex).contains(XXE_MARKER));
			assertTrue(exceptionText(ex).toLowerCase().contains("doctype"));
		} finally {
			Files.deleteIfExists(config);
			Files.deleteIfExists(secret);
		}
	}

	@Test
	public void testReadXmlIgnoresXInclude() throws IOException {
		Path secret = Files.createTempFile("xxe-secret", ".txt");
		Files.writeString(secret, XXE_MARKER);
		String payload = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
				"<configuration xmlns:xi=\"http://www.w3.org/2001/XInclude\">" +
				"<secret><xi:include href=\"" + secret.toUri() + "\" parse=\"text\"/></secret>" +
				"</configuration>";
		try {
			try {
				HierarchicalConfiguration<?> xmlConfiguration = encryptionAwareConfigurationReader.readXmlConfiguration(
						new ByteArrayInputStream(payload.getBytes(StandardCharsets.UTF_8)), lookupVariables);
				String value = xmlConfiguration.getString("secret");
				assertFalse(value != null && value.contains(XXE_MARKER));
			} catch (ConfigurationException ex) {
				assertFalse(exceptionText(ex).contains(XXE_MARKER));
			}
		} finally {
			Files.deleteIfExists(secret);
		}
	}

	@Test
	public void testReadXmlRejectsRemoteEntityWithoutConnecting() throws IOException {
		try (ServerSocket server = new ServerSocket(0)) {
			server.setSoTimeout(250);
			String payload = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
					"<!DOCTYPE configuration [<!ENTITY xxe SYSTEM \"http://127.0.0.1:" + server.getLocalPort() + "/probe\">]>" +
					"<configuration><secret>&xxe;</secret></configuration>";
			ConfigurationException ex = assertThrows(ConfigurationException.class, () ->
					encryptionAwareConfigurationReader.readXmlConfiguration(
							new ByteArrayInputStream(payload.getBytes(StandardCharsets.UTF_8)), lookupVariables));
			assertFalse(exceptionText(ex).contains(XXE_MARKER));
			assertTrue(exceptionText(ex).toLowerCase().contains("doctype"));
			assertThrows(SocketTimeoutException.class, server::accept);
		}
	}

	private static String externalEntityPayload(Path secret) {
		return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
				"<!DOCTYPE configuration [<!ENTITY xxe SYSTEM \"" + secret.toUri() + "\">]>" +
				"<configuration><secret>&xxe;</secret></configuration>";
	}

	private static String exceptionText(Throwable error) {
		StringBuilder text = new StringBuilder();
		Throwable current = error;
		while (current != null) {
			if (current.getMessage() != null) {
				text.append(current.getMessage());
			}
			current = current.getCause();
		}
		return text.toString();
	}
}
