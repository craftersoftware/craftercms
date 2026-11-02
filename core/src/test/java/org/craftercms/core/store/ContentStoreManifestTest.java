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
package org.craftercms.core.store;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.GZIPOutputStream;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

/**
 * Tests for {@link ContentStoreManifest}.
 */
public class ContentStoreManifestTest {

	@Test
	public void testOfPathsStoresNormalizedFiles() {
		ContentStoreManifest manifest = ContentStoreManifest.ofPaths(List.of(
			"site/website/index.xml",
			"/site/website/crafter-level-descriptor.level.xml",
			"",
			"/site/website/index.xml"
		));

		assertEquals(List.of(
			new ContentStoreManifest.Item("/site/website/crafter-level-descriptor.level.xml"),
			new ContentStoreManifest.Item("/site/website/index.xml")
		), manifest.getFiles());
	}

	@Test
	public void testGzipRoundTripKeepsTheFileList() throws Exception {
		ContentStoreManifest manifest = ContentStoreManifest.ofPaths(List.of(
			"/site/website/index.xml",
			"/site/website/crafter-level-descriptor.level.xml"
		));

		ContentStoreManifest restored = ContentStoreManifest.readGzipJson(new ByteArrayInputStream(manifest.toGzipJson()));

		assertEquals(manifest.getFiles(), restored.getFiles());
	}

	@Test
	public void testNormalizesSeparators() {
		ContentStoreManifest manifest = ContentStoreManifest.ofPaths(List.of("site\\website\\index.xml"));

		assertEquals(List.of(new ContentStoreManifest.Item("/site/website/index.xml")), manifest.getFiles());
	}

	@Test
	public void testCollapsesDuplicateSlashes() {
		ContentStoreManifest manifest = ContentStoreManifest.ofPaths(List.of(
			"//site//website///index.xml/",
			"site\\/website\\/about.xml"
		));

		assertEquals(List.of(
			new ContentStoreManifest.Item("/site/website/about.xml"),
			new ContentStoreManifest.Item("/site/website/index.xml")
		), manifest.getFiles());
	}

	@Test
	public void testReadGzipJsonIgnoresUnknownProperties() throws Exception {
		String json = "{\"schemaVersion\":2,\"files\":[{\"path\":\"/site/website/index.xml\",\"type\":\"file\",\"size\":12}]}";
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		try (GZIPOutputStream gzip = new GZIPOutputStream(out)) {
			gzip.write(json.getBytes(StandardCharsets.UTF_8));
		}

		ContentStoreManifest restored = ContentStoreManifest.readGzipJson(new ByteArrayInputStream(out.toByteArray()));

		assertEquals(List.of(new ContentStoreManifest.Item("/site/website/index.xml")), restored.getFiles());
	}

	@Test
	public void testReadGzipJsonRejectsMissingFiles() throws Exception {
		InputStream missingFiles = gzip("{}");

		IOException error = assertThrows(IOException.class, () -> ContentStoreManifest.readGzipJson(missingFiles));

		assertEquals("Content store manifest is missing the files property", error.getMessage());
	}

	@Test
	public void testReadGzipJsonRejectsNullFiles() throws Exception {
		InputStream nullFiles = gzip("{\"files\":null}");

		IOException error = assertThrows(IOException.class, () -> ContentStoreManifest.readGzipJson(nullFiles));

		assertEquals("Content store manifest is missing the files property", error.getMessage());
	}

	@Test
	public void testReadGzipJsonAcceptsEmptyFileList() throws Exception {
		ContentStoreManifest restored = ContentStoreManifest.readGzipJson(gzip("{\"files\":[]}"));

		assertEquals(List.of(), restored.getFiles());
	}

	@Test
	public void testReadGzipJsonRejectsNullFileEntry() throws Exception {
		InputStream nullEntry = gzip("{\"files\":[null]}");

		IOException error = assertThrows(IOException.class, () -> ContentStoreManifest.readGzipJson(nullEntry));

		assertEquals("Content store manifest has a file entry with an unusable path", error.getMessage());
	}

	@Test
	public void testReadGzipJsonRejectsMissingPath() throws Exception {
		InputStream missingPath = gzip("{\"files\":[{}]}");

		IOException error = assertThrows(IOException.class, () -> ContentStoreManifest.readGzipJson(missingPath));

		assertEquals("Content store manifest has a file entry with an unusable path", error.getMessage());
	}

	@Test
	public void testReadGzipJsonRejectsNullPath() throws Exception {
		InputStream nullPath = gzip("{\"files\":[{\"path\":null}]}");

		IOException error = assertThrows(IOException.class, () -> ContentStoreManifest.readGzipJson(nullPath));

		assertEquals("Content store manifest has a file entry with an unusable path", error.getMessage());
	}

	@Test
	public void testReadGzipJsonRejectsEmptyPath() throws Exception {
		InputStream emptyPath = gzip("{\"files\":[{\"path\":\"/site/website/index.xml\"},{\"path\":\"\"}]}");

		IOException error = assertThrows(IOException.class, () -> ContentStoreManifest.readGzipJson(emptyPath));

		assertEquals("Content store manifest has a file entry with an unusable path", error.getMessage());
	}

	private static ByteArrayInputStream gzip(String json) throws IOException {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		try (GZIPOutputStream gzip = new GZIPOutputStream(out)) {
			gzip.write(json.getBytes(StandardCharsets.UTF_8));
		}
		return new ByteArrayInputStream(out.toByteArray());
	}

}
