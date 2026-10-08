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

package org.craftercms.studio.impl.v2.utils;

import org.apache.commons.io.output.ByteArrayOutputStream;
import org.junit.Test;
import org.springframework.core.io.ClassPathResource;

import javax.xml.XMLConstants;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.stream.StreamSource;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.apache.commons.io.IOUtils.toInputStream;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

/**
 * Security and behavior tests for {@link XsltUtils}.
 */
public class XsltUtilsTest {

	private static final String IDENTITY_TEMPLATE = """
			<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
				<xsl:template match="@*|node()">
					<xsl:copy>
						<xsl:apply-templates select="@*|node()"/>
					</xsl:copy>
				</xsl:template>
			</xsl:stylesheet>
			""";

	private static final String VALUE_OF_DESCRIPTION_TEMPLATE = """
			<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
				<xsl:template match="/">
					<out><xsl:value-of select="//description"/></out>
				</xsl:template>
			</xsl:stylesheet>
			""";

	@Test
	public void testCreateTransformerFactoryHasSecureProcessing() throws Exception {
		TransformerFactory factory = XsltUtils.createTransformerFactory();
		assertTrue(factory.getFeature(XMLConstants.FEATURE_SECURE_PROCESSING));
	}

	@Test
	public void testRejectsDoctypeXxeInContent() {
		String xxeContent = """
				<?xml version="1.0" encoding="UTF-8"?>
				<!DOCTYPE form [<!ENTITY xxeFile SYSTEM "file:///etc/passwd">]>
				<form>
					<description>&xxeFile;</description>
				</form>
				""";

		TransformerException thrown = assertThrows(TransformerException.class,
				() -> execute(VALUE_OF_DESCRIPTION_TEMPLATE, xxeContent));
		assertTrue(thrown.getMessage().toLowerCase().contains("doctype")
				|| String.valueOf(thrown.getCause()).toLowerCase().contains("doctype"));
	}

	@Test
	public void testRejectsDoctypeXxeInStylesheet() {
		String xxeTemplate = """
				<?xml version="1.0" encoding="UTF-8"?>
				<!DOCTYPE xsl:stylesheet [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
				<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
					<xsl:template match="/"><out>&xxe;</out></xsl:template>
				</xsl:stylesheet>
				""";

		assertThrows(TransformerException.class, () -> execute(xxeTemplate, "<form/>"));
	}

	@Test
	public void testRejectsExternalDocumentFunction() {
		String template = """
				<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
					<xsl:template match="/">
						<out><xsl:value-of select="doc('file:///etc/passwd')"/></out>
					</xsl:template>
				</xsl:stylesheet>
				""";

		assertThrows(TransformerException.class, () -> execute(template, "<form/>"));
	}

	@Test
	public void testUriResolverCanLoadRepositoryDocuments() throws Exception {
		Path tempFile = Files.createTempFile("xslt-uri-resolver-", ".xml");
		try {
			Files.writeString(tempFile, "<root>from-resolver</root>", UTF_8);
			String template = """
					<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
						<xsl:template match="/">
							<out><xsl:value-of select="document('stuff.xml')/*"/></out>
						</xsl:template>
					</xsl:stylesheet>
					""";

			ByteArrayOutputStream output = new ByteArrayOutputStream();
			XsltUtils.executeTemplate(
					toInputStream(template, UTF_8),
					null,
					(href, base) -> new StreamSource(tempFile.toFile()),
					toInputStream("<form/>", UTF_8),
					output);

			String result = output.toString(UTF_8);
			assertTrue(result.contains("from-resolver"));
			assertFalse(result.toLowerCase().contains("passwd"));
		} finally {
			Files.deleteIfExists(tempFile);
		}
	}

	@Test
	public void testLegitimateTransformationSucceeds() throws Exception {
		String content = """
				<?xml version="1.0" encoding="UTF-8"?>
				<form>
					<title>OK</title>
					<description>safe</description>
				</form>
				""";

		ByteArrayOutputStream output = new ByteArrayOutputStream();
		XsltUtils.executeTemplate(
				toInputStream(IDENTITY_TEMPLATE, UTF_8),
				null,
				null,
				toInputStream(content, UTF_8),
				output);

		String result = output.toString(UTF_8);
		assertTrue(result.contains("<title>OK</title>"));
		assertTrue(result.contains("<description>safe</description>"));
	}

	@Test
	public void testLegitimateTransformationWithParamsSucceeds() throws Exception {
		String template = """
				<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
					<xsl:param name="site"/>
					<xsl:template match="/">
						<out><xsl:value-of select="$site"/></out>
					</xsl:template>
				</xsl:stylesheet>
				""";

		ByteArrayOutputStream output = new ByteArrayOutputStream();
		XsltUtils.executeTemplate(
				toInputStream(template, UTF_8),
				Map.of("site", "demo"),
				null,
				toInputStream("<form/>", UTF_8),
				output);

		assertTrue(output.toString(UTF_8).contains("demo"));
	}

	@Test
	public void testRteRefactorUpgradeTemplateStillWorks() throws Exception {
		ClassPathResource template = new ClassPathResource(
				"crafter/studio/upgrade/4.0.x/4.0.0.2/site/rte-refactor.xslt");
		ClassPathResource content = new ClassPathResource(
				"crafter/studio/upgrade/xslt/rte-refactor/form-definition.xml");

		ByteArrayOutputStream output = new ByteArrayOutputStream();
		try (InputStream templateIs = template.getInputStream();
			 InputStream contentIs = content.getInputStream()) {
			XsltUtils.executeTemplate(templateIs, null, null, contentIs, output);
		}

		String result = output.toString(UTF_8);
		assertTrue(result.contains("form"));
		assertFalse(result.contains("<!DOCTYPE"));
		assertFalse(result.contains("<!ENTITY"));
	}

	@Test
	public void testCdataElementsArePreserved() throws Exception {
		String template = """
				<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
					<xsl:output method="xml" cdata-section-elements="${cdataElements}"/>
					<xsl:template match="@*|node()">
						<xsl:copy>
							<xsl:apply-templates select="@*|node()"/>
						</xsl:copy>
					</xsl:template>
				</xsl:stylesheet>
				""";
		String content = """
				<?xml version="1.0" encoding="UTF-8"?>
				<form>
					<script><![CDATA[alert(1);]]></script>
				</form>
				""";

		ByteArrayOutputStream output = new ByteArrayOutputStream();
		XsltUtils.executeTemplate(
				toInputStream(template, UTF_8),
				null,
				null,
				toInputStream(content, UTF_8),
				output);

		assertTrue(output.toString(UTF_8).contains("alert(1);"));
	}

	private static void execute(String template, String content) throws TransformerException, IOException {
		XsltUtils.executeTemplate(
				new ByteArrayInputStream(template.getBytes(StandardCharsets.UTF_8)),
				null,
				null,
				new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)),
				new ByteArrayOutputStream());
	}
}
