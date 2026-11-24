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

package org.craftercms.studio.impl.v2.upgrade.operations.contentType;

import org.apache.commons.collections4.IterableUtils;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.io.IOUtils;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v2.upgrade.StudioUpgradeContext;
import org.craftercms.studio.impl.v2.upgrade.operations.site.AbstractXsltFileUpgradeOperation;
import org.craftercms.studio.impl.v2.upgrade.operations.site.BatchXsltFileUpgradeOperation;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.MockitoJUnitRunner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.xmlunit.builder.DiffBuilder;
import org.xmlunit.diff.Diff;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import java.util.stream.Stream;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_SITE_CONTENT_TYPES_CONFIG_FILE_NAME;
import static org.craftercms.studio.api.v2.utils.StudioUtils.createTempFile;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getStudioTemporaryFilesRoot;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@RunWith(MockitoJUnitRunner.class)
public class ContentTypeConfigMergeUpgraderTest {
	private static final Logger logger = LoggerFactory.getLogger(ContentTypeConfigMergeUpgraderTest.class);

	@Mock
	private StudioConfiguration studioConfiguration;
	@Spy
	@InjectMocks
	private ContentTypeConfigMergeUpgrader upgrader;

	private String configFileName;

	@Before
	public void setUp() throws Exception {
		configFileName = UUID.randomUUID() + "config.xml";
		var config = mock(HierarchicalConfiguration.class);
		when(config.getString(BatchXsltFileUpgradeOperation.CONFIG_KEY_REGEX)).thenReturn("config/studio/content-types/.+/form-definition\\.xml");
		when(config.getString(AbstractXsltFileUpgradeOperation.CONFIG_KEY_TEMPLATE)).thenReturn("crafter/studio/upgrade/5.0.x/content-type/content-type-merge-v5.0.0.2.xslt");
		when(studioConfiguration.getProperty(CONFIGURATION_SITE_CONTENT_TYPES_CONFIG_FILE_NAME)).thenReturn(configFileName);
		upgrader.init("1", "2", config);
	}

	@Test
	public void testUpgrade() throws Exception {
		String basePath = "src/test/resources/crafter/studio/upgrade/content-type/5.0/5.0.0.2/";
		File originalFormFile = new File(basePath + "form-definition.xml");
		File originalConfigFile = new File(basePath + "config.xml");
		Path configFilePath = getStudioTemporaryFilesRoot().resolve(configFileName);
		Path formFilePath = createTempFile("form-definition.xml");
		formFilePath.toFile().deleteOnExit();
		configFilePath.toFile().deleteOnExit();
		Files.copy(originalFormFile.toPath(), formFilePath, StandardCopyOption.REPLACE_EXISTING);

		Files.copy(originalConfigFile.toPath(), configFilePath, StandardCopyOption.REPLACE_EXISTING);

		File resultFile = formFilePath.toFile();
		File expectedFile = new File(basePath + "expected.xml");

		StudioUpgradeContext context = mock(StudioUpgradeContext.class);
		when(context.getTarget()).thenReturn("test-site");
		when(context.getRepositoryPath()).thenReturn(Path.of(getStudioTemporaryFilesRoot().toString()));
		when(context.getFile(getStudioTemporaryFilesRoot().relativize(formFilePath).toString())).thenReturn(formFilePath);

		(doReturn(Stream.of(formFilePath)).when(upgrader)).getPaths(any());

		upgrader.doExecute(context);

		// Assert
		try (InputStream expectedIn = new FileInputStream(expectedFile);
			 InputStream actualIn = new FileInputStream(resultFile)) {
			String expectedXml = IOUtils.toString(expectedIn, StandardCharsets.UTF_8);
			String actualXml = IOUtils.toString(actualIn, StandardCharsets.UTF_8);

			// Compare the result
			Diff diff = DiffBuilder
					.compare(expectedXml)
					.withTest(actualXml)
					.ignoreWhitespace()
					.ignoreComments()
					.checkForSimilar()
					.build();

			if (diff.hasDifferences()) {
				logger.debug(actualXml);
			}

			// there should not be any differences
			assertEquals(0, IterableUtils.size(diff.getDifferences()),
					"The result XML should be equal to the expected XML");
		}
	}

	/**
	 * A {@code noThumbnail} element already stored on the form definition is left as-is.
	 * The element in {@code config.xml} is not copied over it.
	 */
	@Test
	public void testExistingNoThumbnailIsLeftUntouched() throws Exception {
		String basePath = "src/test/resources/crafter/studio/upgrade/content-type/5.0/5.0.0.2/";
		String existingNoThumbnail = "    <noThumbnail>true</noThumbnail>\n";
		String formXml = IOUtils.toString(new FileInputStream(basePath + "form-definition.xml"), StandardCharsets.UTF_8)
				.replace("</form>", existingNoThumbnail + "</form>");
		// config.xml still has <noThumbnail>false</noThumbnail>; the upgraded form must keep the original true value
		// and must not gain a second copy from config.xml. Copied fields are appended after existing form children.
		String expectedXml = IOUtils.toString(new FileInputStream(basePath + "expected.xml"), StandardCharsets.UTF_8)
				.replace("    <previewable>", existingNoThumbnail + "    <previewable>");

		Path configFilePath = getStudioTemporaryFilesRoot().resolve(configFileName);
		Path formFilePath = createTempFile("form-definition.xml");
		formFilePath.toFile().deleteOnExit();
		configFilePath.toFile().deleteOnExit();
		Files.writeString(formFilePath, formXml);
		Files.copy(Path.of(basePath + "config.xml"), configFilePath, StandardCopyOption.REPLACE_EXISTING);

		StudioUpgradeContext context = mock(StudioUpgradeContext.class);
		when(context.getTarget()).thenReturn("test-site");
		when(context.getRepositoryPath()).thenReturn(Path.of(getStudioTemporaryFilesRoot().toString()));
		when(context.getFile(getStudioTemporaryFilesRoot().relativize(formFilePath).toString())).thenReturn(formFilePath);

		(doReturn(Stream.of(formFilePath)).when(upgrader)).getPaths(any());

		upgrader.doExecute(context);

		try (InputStream actualIn = new FileInputStream(formFilePath.toFile())) {
			String actualXml = IOUtils.toString(actualIn, StandardCharsets.UTF_8);

			Diff diff = DiffBuilder
					.compare(expectedXml)
					.withTest(actualXml)
					.ignoreWhitespace()
					.ignoreComments()
					.checkForSimilar()
					.build();

			if (diff.hasDifferences()) {
				logger.debug(actualXml);
			}

			assertEquals(0, IterableUtils.size(diff.getDifferences()),
					"An existing noThumbnail in form-definition.xml should be left untouched");
		}
	}
}
