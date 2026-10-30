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

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.craftercms.core.util.ContentStoreUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.TreeMap;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

import static org.apache.commons.lang3.StringUtils.isEmpty;

/**
 * Flat list of files published to S3.
 * <p>
 * Deployer writes this document and Engine reads the same list back. The on-disk form is gzip-compressed JSON:
 * <pre>
 * { "files": [ { "path": "/site/website/index.xml" }, { "path": "/site/website/crafter-level-descriptor.level.xml" } ] }
 * </pre>
 * Each entry is a path. Engine derives existence and parent directories from those paths.
 * Extra JSON properties are ignored so a newer document still loads on an older Engine.
 */
public class ContentStoreManifest {

	public static final String FILE_NAME = "content-store-manifest.json.gz";

	private static final ObjectMapper MAPPER = new ObjectMapper()
		.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

	private static final Pattern DUPLICATE_SLASHES = Pattern.compile("/+");

	private List<Item> files = List.of();

	/**
	 * Used by Jackson when reading the manifest document.
	 */
	public ContentStoreManifest() {
	}

	private ContentStoreManifest(List<Item> files) {
		this.files = files;
	}

	/**
	 * One published file.
	 */
	public static class Item {

		private String path;

		/**
		 * Used by Jackson when reading a file entry.
		 */
		public Item() {
		}

		/**
		 * @param path store path, with a leading slash and no trailing slash
		 */
		public Item(String path) {
			this.path = path;
		}

		/**
		 * @return the store path
		 */
		public String getPath() {
			return path;
		}

		/**
		 * @param path the store path
		 */
		public void setPath(String path) {
			this.path = path;
		}

		@Override
		public boolean equals(Object obj) {
			if (this == obj) {
				return true;
			}
			if (!(obj instanceof Item other)) {
				return false;
			}
			return Objects.equals(path, other.path);
		}

		@Override
		public int hashCode() {
			return Objects.hash(path);
		}

	}

	/**
	 * Builds the file list Deployer uploads. Duplicate paths keep the last occurrence.
	 *
	 * @param paths repo paths of the files uploaded to S3
	 * @return the manifest document
	 */
	public static ContentStoreManifest ofPaths(Collection<String> paths) {
		TreeMap<String, Item> byPath = new TreeMap<>();
		if (paths != null) {
			for (String path : paths) {
				if (isEmpty(path)) {
					continue;
				}
				String normalized = normalize(path);
				byPath.put(normalized, new Item(normalized));
			}
		}
		return new ContentStoreManifest(List.copyOf(byPath.values()));
	}

	/**
	 * Reads a gzip-compressed manifest document.
	 *
	 * @param in the gzip payload
	 * @return the file list stored in the document
	 * @throws IOException if the payload cannot be read
	 */
	public static ContentStoreManifest readGzipJson(InputStream in) throws IOException {
		try (GZIPInputStream gzip = new GZIPInputStream(in)) {
			return MAPPER.readValue(gzip, ContentStoreManifest.class);
		}
	}

	/**
	 * Writes this manifest as gzip-compressed JSON.
	 *
	 * @return the gzip payload
	 * @throws IOException if the payload cannot be written
	 */
	public byte[] toGzipJson() throws IOException {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		try (GZIPOutputStream gzip = new GZIPOutputStream(out)) {
			MAPPER.writeValue(gzip, this);
		}
		return out.toByteArray();
	}

	/**
	 * @return the published files, in document order
	 */
	public List<Item> getFiles() {
		return files;
	}

	/**
	 * @param files the published files
	 */
	public void setFiles(List<Item> files) {
		this.files = files == null ? List.of() : files;
	}

	/**
	 * Normalizes a repo or store path to a leading-slash path without a trailing slash.
	 * Paths that already use single forward slashes skip separator collapsing.
	 */
	public static String normalize(String path) {
		if (path.indexOf('\\') < 0 && path.indexOf("//") < 0) {
			return ContentStoreUtils.normalizePath(path);
		}
		String collapsed = DUPLICATE_SLASHES.matcher(path.replace('\\', '/')).replaceAll("/");
		return ContentStoreUtils.normalizePath(collapsed);
	}

}
