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
import org.craftercms.studio.api.v2.repository.ContentRepository;
import org.craftercms.studio.impl.v2.upgrade.StudioUpgradeContext;
import org.dom4j.DocumentException;
import org.dom4j.io.SAXReader;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class XmlFileVersionProviderTest {

	private static final String SITE_ID = "test-site";
	private static final String FILE_PATH = "/config/studio/studio_version.xml";
	private static final String XPATH = "//version";
	private static final String DEFAULT_VERSION = "0.0.0";

	@Mock
	private ContentRepository contentRepository;

	@Mock
	private StudioUpgradeContext upgradeContext;

	@Rule
	public TemporaryFolder temporaryFolder = new TemporaryFolder();

	private XmlFileVersionProvider provider;

	@Before
	public void setUp() {
		provider = new XmlFileVersionProvider(FILE_PATH, XPATH, DEFAULT_VERSION, contentRepository);
	}

	@Test
	public void testCreateSaxReaderHasSecurityFeatures() throws Exception {
		SAXReader reader = provider.createSaxReader();
		assertNotNull(reader);
		assertTrue(reader.getXMLReader().getFeature("http://apache.org/xml/features/disallow-doctype-decl"));
		assertFalse(reader.getXMLReader().getFeature("http://xml.org/sax/features/external-general-entities"));
		assertFalse(reader.getXMLReader().getFeature("http://xml.org/sax/features/external-parameter-entities"));
	}

	@Test
	public void testGetVersionFromFileValidXml() throws Exception {
		String validXml = "<site><version>4.0.0</version></site>";
		InputStream stream = new ByteArrayInputStream(validXml.getBytes(StandardCharsets.UTF_8));
		when(contentRepository.getContent(SITE_ID, FILE_PATH)).thenReturn(stream);

		String version = provider.getVersionFromFile(SITE_ID, FILE_PATH);
		assertEquals("4.0.0", version);
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

		assertThrows(DocumentException.class, () -> provider.getVersionFromFile(SITE_ID, FILE_PATH));
	}

	@Test
	public void testGetVersionFromFileMalformedXmlThrowsException() throws Exception {
		String malformedXml = "<site><version>unclosed";
		InputStream stream = new ByteArrayInputStream(malformedXml.getBytes(StandardCharsets.UTF_8));
		when(contentRepository.getContent(SITE_ID, FILE_PATH)).thenReturn(stream);

		assertThrows(DocumentException.class, () -> provider.getVersionFromFile(SITE_ID, FILE_PATH));
	}

	@Test
	public void testDoGetVersionWrapsXxeInUpgradeException() throws Exception {
		String xxeXml = """
				<?xml version="1.0" encoding="UTF-8"?>
				<!DOCTYPE foo [
				  <!ELEMENT foo ANY >
				  <!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
				<site><version>&xxe;</version></site>""";
		InputStream stream = new ByteArrayInputStream(xxeXml.getBytes(StandardCharsets.UTF_8));

		when(upgradeContext.getTarget()).thenReturn(SITE_ID);
		when(upgradeContext.isConfigPresent()).thenReturn(false);
		when(contentRepository.contentExists(SITE_ID, "/config/studio")).thenReturn(true);
		when(contentRepository.contentExists(SITE_ID, FILE_PATH)).thenReturn(true);
		when(contentRepository.getContent(SITE_ID, FILE_PATH)).thenReturn(stream);

		assertThrows(UpgradeException.class, () -> provider.doGetVersion(upgradeContext));
	}

	@Test
	public void testDoSetVersionRejectsDoctypeXxe() throws Exception {
		String xxeXml = """
				<?xml version="1.0" encoding="UTF-8"?>
				<!DOCTYPE foo [
				  <!ELEMENT foo ANY >
				  <!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
				<site><version>&xxe;</version></site>""";
		Path tempFile = temporaryFolder.newFile("test_version.xml").toPath();
		Files.writeString(tempFile, xxeXml, StandardCharsets.UTF_8);

		when(upgradeContext.isConfigPresent()).thenReturn(false);
		when(upgradeContext.getFile(FILE_PATH)).thenReturn(tempFile);

		assertThrows(DocumentException.class, () -> provider.doSetVersion(upgradeContext, "2.0.0"));
		verify(upgradeContext, never()).commitChanges(anyString(), anyList(), any());
	}

	@Test
	public void testDoSetVersionHappyPath() throws Exception {
		String validXml = """
				<?xml version="1.0" encoding="UTF-8"?>
				<site>
					<version>1.0.0</version>
				</site>""";
		Path tempFile = temporaryFolder.newFile("test_version_valid.xml").toPath();
		Files.writeString(tempFile, validXml, StandardCharsets.UTF_8);

		when(upgradeContext.isConfigPresent()).thenReturn(false);
		when(upgradeContext.getFile(FILE_PATH)).thenReturn(tempFile);

		provider.doSetVersion(upgradeContext, "2.0.0");

		verify(upgradeContext).commitChanges(eq("[Upgrade Manager] Update version"), eq(List.of(FILE_PATH)), isNull());
		String updatedContent = Files.readString(tempFile);
		assertTrue(updatedContent.contains("2.0.0"));
	}
}
