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

package org.craftercms.studio.impl.v2.upgrade.providers;

import org.craftercms.commons.upgrade.exception.UpgradeException;
import org.craftercms.studio.api.v1.repository.ContentRepository;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import javax.xml.stream.XMLInputFactory;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class XmlStreamVersionProviderTest {

	private static final String SITE_ID = "test-site";
	private static final String FILE_PATH = "/config/studio/studio_version.xml";
	private static final String XPATH = "//version";
	private static final String DEFAULT_VERSION = "0.0.0";
	private static final String VERSION_ELEMENT_NAME = "version";

	@Mock
	private ContentRepository contentRepository;

	private XmlStreamVersionProvider provider;

	@Before
	public void setUp() {
		provider = new XmlStreamVersionProvider(FILE_PATH, XPATH, DEFAULT_VERSION, contentRepository, VERSION_ELEMENT_NAME);
	}

	@Test
	public void testCreateXmlInputFactoryHasSecurityProperties() {
		XMLInputFactory factory = provider.createXmlInputFactory();
		assertNotNull(factory);
		assertEquals(Boolean.FALSE, factory.getProperty(XMLInputFactory.SUPPORT_DTD));
		assertEquals(Boolean.FALSE, factory.getProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES));
	}

	@Test
	public void testGetVersionFromFileValidXml() throws Exception {
		String validXml = "<site><version>4.1.0</version></site>";
		InputStream stream = new ByteArrayInputStream(validXml.getBytes(StandardCharsets.UTF_8));
		when(contentRepository.getContent(SITE_ID, FILE_PATH)).thenReturn(stream);

		String version = provider.getVersionFromFile(SITE_ID, FILE_PATH);
		assertEquals("4.1.0", version);
	}

	@Test
	public void testGetVersionFromFileRejectsDoctypeXxe() throws Exception {
		String xxeXml = """
				<?xml version="1.0" encoding="UTF-8"?>
				<!DOCTYPE foo [
				  <!ELEMENT foo ANY >
				  <!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
				<site><version>&xxe;</version></site>""";
		InputStream stream = new ByteArrayInputStream(xxeXml.getBytes(StandardCharsets.UTF_8));
		when(contentRepository.getContent(SITE_ID, FILE_PATH)).thenReturn(stream);

		assertThrows(UpgradeException.class, () -> provider.getVersionFromFile(SITE_ID, FILE_PATH));
	}

	@Test
	public void testGetVersionFromFileElementNotFoundReturnsDefault() throws Exception {
		String xmlWithoutVersion = "<site><other>value</other></site>";
		InputStream stream = new ByteArrayInputStream(xmlWithoutVersion.getBytes(StandardCharsets.UTF_8));
		when(contentRepository.getContent(SITE_ID, FILE_PATH)).thenReturn(stream);

		String version = provider.getVersionFromFile(SITE_ID, FILE_PATH);
		assertEquals(DEFAULT_VERSION, version);
	}
}
