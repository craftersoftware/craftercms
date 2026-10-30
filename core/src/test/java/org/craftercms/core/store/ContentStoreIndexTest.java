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
import java.util.List;

import static org.craftercms.core.store.ContentStoreIndex.TYPE_DIRECTORY;
import static org.craftercms.core.store.ContentStoreIndex.TYPE_FILE;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

/**
 * Tests for {@link ContentStoreIndex}.
 */
public class ContentStoreIndexTest {

	@Test
	public void testSplitsPathsIntoTypesAndChildren() {
		ContentStoreIndex index = ContentStoreIndex.from(ContentStoreManifest.ofPaths(List.of(
			"site/website/index.xml",
			"/site/website/crafter-level-descriptor.level.xml",
			"/site/website/products/index.xml",
			"/templates/web/entry.ftl"
		)));

		assertEquals(TYPE_DIRECTORY, index.typeOf("/"));
		assertEquals(TYPE_DIRECTORY, index.typeOf("/site/website"));
		assertEquals(TYPE_DIRECTORY, index.typeOf("/site/website/products"));
		assertEquals(TYPE_FILE, index.typeOf("/site/website/index.xml"));
		assertEquals(TYPE_FILE, index.typeOf("/site/website/crafter-level-descriptor.level.xml"));
		assertEquals(TYPE_FILE, index.typeOf("/templates/web/entry.ftl"));
		assertNull(index.typeOf("/site/missing"));

		assertEquals(List.of("/site", "/templates"), index.childrenOf("/"));
		assertEquals(List.of(
			"/site/website/crafter-level-descriptor.level.xml",
			"/site/website/index.xml",
			"/site/website/products"),
			index.childrenOf("/site/website"));
		assertEquals(List.of("/site/website/products/index.xml"), index.childrenOf("/site/website/products"));
		assertEquals(List.of(), index.childrenOf("/site/missing"));
	}

	@Test
	public void testIndexFromRestoredManifest() throws Exception {
		ContentStoreManifest manifest = ContentStoreManifest.ofPaths(List.of(
			"/site/website/crafter-level-descriptor.level.xml",
			"/site/website/index.xml"
		));
		ContentStoreManifest restored = ContentStoreManifest.readGzipJson(new ByteArrayInputStream(manifest.toGzipJson()));

		ContentStoreIndex index = ContentStoreIndex.from(restored);

		assertEquals(TYPE_FILE, index.typeOf("/site/website/crafter-level-descriptor.level.xml"));
		assertEquals(TYPE_FILE, index.typeOf("/site/website/index.xml"));
		assertEquals(List.of(
			"/site/website/crafter-level-descriptor.level.xml",
			"/site/website/index.xml"),
			index.childrenOf("/site/website"));
	}

	@Test
	public void testLookupNormalizesSeparators() {
		ContentStoreIndex index = ContentStoreIndex.from(ContentStoreManifest.ofPaths(List.of("/site/website/index.xml")));

		assertEquals(TYPE_FILE, index.typeOf("site\\website\\index.xml"));
		assertEquals(TYPE_DIRECTORY, index.typeOf("site\\website"));
		assertEquals(TYPE_FILE, index.typeOf("//site//website//index.xml/"));
		assertEquals(TYPE_DIRECTORY, index.typeOf("site\\/website"));
	}

}
