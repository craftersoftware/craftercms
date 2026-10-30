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

import org.apache.commons.io.FilenameUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

import static org.apache.commons.lang3.StringUtils.isEmpty;

/**
 * Directory index built from a {@link ContentStoreManifest}.
 * <p>
 * Each file path is split into its parent directories. Each path is stored once, with its type and the full paths
 * of its direct children, so existence and children lookups do not need to list the bucket. Every listed path is a
 * file, and every parent path is a directory. A published file is never the parent of another file.
 */
public class ContentStoreIndex {

	public static final String TYPE_FILE = "file";

	public static final String TYPE_DIRECTORY = "directory";

	public static final String ROOT_PATH = "/";

	private final Map<String, Entry> entries;

	private ContentStoreIndex(Map<String, Entry> entries) {
		this.entries = entries;
	}

	/**
	 * Splits the manifest's file paths into one path map.
	 * Every path is a file. Parent directories are derived from those paths.
	 *
	 * @param manifest the flat file list read from S3, or null
	 * @return the directory index
	 */
	public static ContentStoreIndex from(ContentStoreManifest manifest) {
		List<ContentStoreManifest.Item> files = manifest == null || manifest.getFiles() == null
			? List.of() : manifest.getFiles();
		// Entries are the files plus their parent directories. Shared parents keep that
		// close to one and a half entries per file, which avoids a resize at large manifests.
		int capacity = files.size() > Integer.MAX_VALUE / 3 ? Integer.MAX_VALUE : files.size() * 3 / 2;
		Map<String, MutableEntry> building = HashMap.newHashMap(capacity);

		for (ContentStoreManifest.Item item : files) {
			if (item == null || isEmpty(item.getPath())) {
				continue;
			}
			addFile(building, ContentStoreManifest.normalize(item.getPath()));
		}

		Map<String, Entry> entries = HashMap.newHashMap(building.size());
		building.forEach((path, node) -> entries.put(path, node.toEntry()));
		return new ContentStoreIndex(entries);
	}

	/**
	 * @param path a content-store path
	 * @return the entry type, or null when the path is not in the index
	 */
	public String typeOf(String path) {
		Entry entry = entryOf(path);
		if (entry == null) {
			return null;
		}
		return entry.directory ? TYPE_DIRECTORY : TYPE_FILE;
	}

	/**
	 * @param path a content-store path
	 * @return true when the path is a directory derived from a published file
	 */
	public boolean isDirectory(String path) {
		Entry entry = entryOf(path);
		return entry != null && entry.directory;
	}

	/**
	 * @param path a directory path
	 * @return the direct child paths, sorted. Empty when the directory is not in the index.
	 */
	public List<String> childrenOf(String path) {
		Entry entry = entryOf(path);
		return entry == null ? List.of() : entry.children;
	}

	private Entry entryOf(String path) {
		return entries.get(ContentStoreManifest.normalize(path));
	}

	private static void addFile(Map<String, MutableEntry> entries, String path) {
		entries.computeIfAbsent(path, key -> MutableEntry.file());
		String childPath = path;
		while (!ROOT_PATH.equals(childPath)) {
			String parentPath = FilenameUtils.getFullPathNoEndSeparator(childPath);
			// A child already recorded means every ancestor above it was linked when that child was first added.
			if (!entries.computeIfAbsent(parentPath, key -> MutableEntry.directory()).addChild(childPath)) {
				break;
			}
			childPath = parentPath;
		}
	}

	/**
	 * One indexed path. A file has an empty child list.
	 */
	private static final class Entry {

		private final boolean directory;

		private final List<String> children;

		private Entry(boolean directory, List<String> children) {
			this.directory = directory;
			this.children = children;
		}

	}

	/**
	 * Path accumulated while the manifest is read.
	 */
	private static final class MutableEntry {

		private final boolean file;

		private TreeSet<String> children;

		private MutableEntry(boolean file) {
			this.file = file;
		}

		private static MutableEntry file() {
			return new MutableEntry(true);
		}

		private static MutableEntry directory() {
			return new MutableEntry(false);
		}

		private boolean addChild(String childPath) {
			if (children == null) {
				children = new TreeSet<>();
			}
			return children.add(childPath);
		}

		private Entry toEntry() {
			List<String> childPaths = children == null ? List.of() : List.copyOf(children);
			return new Entry(!file, childPaths);
		}

	}

}
