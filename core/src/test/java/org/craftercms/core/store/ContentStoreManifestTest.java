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
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.GZIPOutputStream;

import static org.junit.Assert.assertEquals;

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

}
