/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.api.v2.content;

import org.apache.commons.io.FilenameUtils;
import org.craftercms.studio.api.v2.repository.ContentWriteItem;
import org.dom4j.Document;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import static java.util.Collections.unmodifiableMap;
import static org.apache.commons.collections4.MapUtils.emptyIfNull;
import static org.apache.commons.io.FileUtils.deleteQuietly;
import static org.craftercms.studio.api.v2.content.LifecycleContentProvider.ofPath;
import static org.craftercms.studio.api.v2.utils.StudioUtils.createTempFile;

/**
 * Container for content items to be passed to the content lifecycle controller
 */
public class LifecycleContent implements AutoCloseable {

	private final String repoPath;
	private final LifecycleOperation operation;
	private final String contentType;
	private final Map<String, ContentLifecycleItem> items;
	private final Map<String, ContentWriteItem> dependencies;

	/**
	 * Constructor for creating a new LifecycleContent object.
	 *
	 * @param repoPath        the path to the content item in the repository
	 * @param sourcePath      source path for move operations
	 * @param contentType     the content type of the item
	 * @param contentProvider provider to get the content from
	 * @param operation       the lifecycle operation to be performed
	 */
	public LifecycleContent(String repoPath, String sourcePath, String contentType,
							LifecycleContentProvider contentProvider, LifecycleOperation operation,
							Map<String, ContentWriteItem> dependencies) {
		this.items = new HashMap<>();
		this.repoPath = repoPath;
		this.operation = operation;
		this.contentType = contentType;
		this.items.put(repoPath, new ContentLifecycleItem(repoPath, sourcePath, contentProvider));
		this.dependencies = emptyIfNull(dependencies);
	}

	public LifecycleContent(String repoPath, String sourcePath, String contentType,
							LifecycleContentProvider contentProvider, LifecycleOperation operation) {
		this(repoPath, sourcePath, contentType, contentProvider, operation, null);
	}

	/**
	 * Add a new content item to the lifecycle operation.
	 *
	 * @param path    the path to the content item
	 * @param content InputStream of the content item
	 * @throws IOException if an error occurs while reading the stream or storing the content
	 */
	public void write(String path, InputStream content) throws IOException {
		Path filePath = createTempFile(path, content);
		write(path, filePath);
	}

	/**
	 * Write the content to the given path in the repository.
	 *
	 * @param path     the path to write the content to
	 * @param document the Document to write
	 * @throws IOException if an error occurs while writing the content
	 */
	public void write(String path, Document document) throws IOException {
		Path filePath = createTempFile(path, document);
		write(path, filePath);
	}

	/**
	 * Write the content to the given path and keep the item's source path.
	 * Used when an existing copy or move item is rewritten, such as a navigation-order fix.
	 *
	 * @param path       the path to write the content to
	 * @param document   the Document to write
	 * @param sourcePath the source path to retain, or null when the item has none
	 * @throws IOException if an error occurs while writing the content
	 */
	public void write(String path, Document document, String sourcePath) throws IOException {
		Path filePath = createTempFile(path, document);
		write(path, filePath, sourcePath);
	}

	/**
	 * Write the content to the given path in the repository.
	 *
	 * @param path     the path to write the content to
	 * @param filePath the path containing the content to write
	 */
	public void write(String path, Path filePath) {
		write(path, filePath, null);
	}

	/**
	 * Write the content to the given path in the repository.
	 *
	 * @param path       the path to write the content to
	 * @param filePath   the path containing the content to write
	 * @param sourcePath the source path to retain, or null when the item has none
	 */
	public void write(String path, Path filePath, String sourcePath) {
		try {
			String normalizedPath = FilenameUtils.normalize(path);
			// Remove the temporary file if it exists
			exclude(normalizedPath);
			// Add a new entry with amended=<path is the same as the original repoPath>
			// If the paths are not the same, that means the content was added by the controller and should NOT be considered amended
			boolean amended = repoPath.equals(normalizedPath);
			this.items.put(normalizedPath, new ContentLifecycleItem(normalizedPath, sourcePath, ofPath(() -> filePath), amended));
		} catch (Exception e) {
			// Clean the temporary file if it exists
			if (filePath != null) {
				deleteQuietly(filePath.toFile());
			}
			throw e;
		}
	}

	/**
	 * Exclude the given path from the write operation.
	 * Do not delete the content from repo if it exists.
	 *
	 * @param path the path to exclude
	 */
	private void exclude(final String path) {
		ContentLifecycleItem removed = items.remove(path);
		if (removed != null) {
			removed.close();
		}
	}

	/**
	 * Get the content lifecycle items.
	 *
	 * @return a map of content lifecycle items, where the key is the repository path
	 */
	public Map<String, ContentLifecycleItem> getItems() {
		return unmodifiableMap(items);
	}

	/**
	 * Get the content lifecycle item for the given path.
	 *
	 * @param repoPath the path in the repository
	 * @return the content lifecycle item, or null if it does not exist
	 */
	public ContentLifecycleItem get(String repoPath) {
		return items.get(repoPath);
	}

	public LifecycleOperation getOperation() {
		return operation;
	}

	public String getRepoPath() {
		return repoPath;
	}

	public String getSourcePath() {
		ContentLifecycleItem item = items.get(repoPath);
		return item != null ? item.sourcePath() : null;
	}

	public String getContentType() {
		return contentType;
	}

	public Map<String, ContentWriteItem> getDependencies() {
		return dependencies;
	}

	@Override
	public void close() {
		// Remove the remaining temporary files
		items.values().forEach(ContentLifecycleItem::close);
	}

	/**
	 * Represents a content lifecycle item.
	 *
	 * @param repoPath        the path in the repository where the content will be stored (or deleted from)
	 * @param sourcePath      the source path for move/copy operations, can be null
	 * @param contentProvider provider to access the content as stream
	 * @param amended         true if the content has been amended by the controller, false otherwise
	 */
	public record ContentLifecycleItem(String repoPath, String sourcePath, LifecycleContentProvider contentProvider,
									   boolean amended) implements ContentWriteItem, AutoCloseable {

		/**
		 * Constructor for creating a new {@link ContentLifecycleItem}.
		 *
		 * @param repoPath        the path in the repository where the content will be stored (or deleted from)
		 * @param contentProvider provider to access the content as stream
		 * @param amended         true if the content has been amended by the controller, false otherwise
		 */
		public ContentLifecycleItem(String repoPath, LifecycleContentProvider contentProvider, boolean amended) {
			this(repoPath, null, contentProvider, amended);
		}

		/**
		 * Constructor for creating a new {@link ContentLifecycleItem}.
		 *
		 * @param repoPath        the path in the repository where the content will be stored (or deleted from)
		 * @param sourcePath      the source path for move/copy operations
		 * @param contentProvider provider to access the content as stream
		 */
		public ContentLifecycleItem(String repoPath, String sourcePath, LifecycleContentProvider contentProvider) {
			this(repoPath, sourcePath, contentProvider, false);
		}

		@Override
		public InputStream content() throws IOException {
			if (contentProvider == null) {
				throw new FileNotFoundException("No content file available for " + repoPath);
			}
			try {
				return contentProvider.getContent();
			} catch (Exception e) {
				throw new IOException("Failed to get content for " + repoPath, e);
			}
		}

		@Override
		public void close() {
			if (contentProvider != null) {
				contentProvider.close();
			}
		}

		/**
		 * Get a {@link Path} for the content item
		 *
		 * @return Path for the content
		 * @throws IOException if there is an error retrieving the pah
		 */
		public Path filePath() throws IOException {
			return contentProvider.filePath();
		}
	}


	/**
	 * The lifecycle operation to be performed on the content.
	 */
	public enum LifecycleOperation {
		COPY(true),
		DELETE,
		DUPLICATE(true),
		NEW,
		RENAME,
		REVERT,
		UPDATE;

		/**
		 * Indicates that the operation is a copy or duplicate operation,
		 * so new object ids should be generated for the affected content item and
		 * configured copy-dependencies (and item-specific dependencies) should be copied.
		 */
		public final boolean isCopy;

		LifecycleOperation() {
			this(false);
		}

		LifecycleOperation(final boolean isCopy) {
			this.isCopy = isCopy;
		}
	}
}
