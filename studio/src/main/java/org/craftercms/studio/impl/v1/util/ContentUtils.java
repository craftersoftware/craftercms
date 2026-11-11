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
package org.craftercms.studio.impl.v1.util;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.studio.api.v1.constant.DmConstants;
import org.craftercms.studio.api.v1.constant.StudioConstants;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.dom4j.Document;
import org.dom4j.DocumentException;
import org.dom4j.Element;
import org.dom4j.Node;
import org.dom4j.io.SAXReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.xml.sax.SAXException;

import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.List;

import static java.lang.String.format;
import static java.nio.charset.StandardCharsets.UTF_8;
import static org.apache.commons.io.FilenameUtils.getFullPathNoEndSeparator;
import static org.apache.commons.lang3.Strings.CS;
import static org.craftercms.studio.api.v1.constant.DmConstants.SLASH_INDEX_FILE;
import static org.craftercms.studio.api.v1.constant.StudioConstants.*;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_SITE_CONTENT_TYPES_CONFIG_BASE_PATH;
import static org.craftercms.studio.api.v2.utils.StudioUtils.matchesPatterns;


public class ContentUtils {

	private static final Logger logger = LoggerFactory.getLogger(ContentUtils.class);

	private static final String AUTHORING_URL_FORMAT = "%s/preview/#/?page=%s&site=%s";

	/**
	 * Release a resource
	 *
	 * @param resource resource to close
	 */
	public static void release(Closeable resource) {
		try {
			if (resource != null) {
				resource.close();
			}
		} catch (IOException e) {
			logger.error("Failed to release resource", e);
		} finally {
			IOUtils.closeQuietly(resource);
		}
	}

	/**
	 * convert InputStream to string
	 *
	 * @param is input stream to convert
	 * @return the converted Document, or null if the document could not be parsed
	 */
	public static Document convertStreamToXml(InputStream is) throws DocumentException {
		InputStreamReader isReader = null;
		try (is) {
			isReader = new InputStreamReader(is, StudioConstants.CONTENT_ENCODING);
			SAXReader saxReader = new SAXReader();
			try {
				saxReader.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
				saxReader.setFeature("http://xml.org/sax/features/external-general-entities", false);
				saxReader.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
				// TODO: SJ: Investigate the need for the following
				// TODO: SJ: saxReader.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
				// TODO: SJ: saxReader.setXIncludeAware(false);
				// TODO: SJ: saxReader.setExpandEntityReferences(false);
				saxReader.setMergeAdjacentText(true);
			} catch (SAXException e) {
				logger.error("Failed to turn off external entity loading. This could be a security risk.", e);
			}
			return saxReader.read(isReader);
		} catch (DocumentException | IOException e) {
			logger.error("Failed to parse XML document", e);
			return null;
		} finally {
			ContentUtils.release(is);
			ContentUtils.release(isReader);
		}
	}

	/**
	 * Reads a string content from an InputStream
	 * The stream is closed after reading.
	 *
	 * @param stream the input stream to read from
	 * @return the string content
	 */
	public static String convertStreamToString(InputStream stream) throws IOException {
		try (stream) {
			return IOUtils.toString(stream, UTF_8);
		}
	}

	/**
	 * Get the parent url: for folders and components it's just parent, for pages it's the parent of the parent.
	 * e.g.:
	 * /site/website/articles/page1/index.xml -> /site/website/articles
	 * /site/components/posts/january/clickbait.xml -> /site/components/posts/january
	 * /site/components/articles/health/ -> /site/components/articles
	 *
	 * @param path path of the content item
	 * @return path of the parent item
	 */
	public static String getParentUrl(String path) {
		return getFullPathNoEndSeparator(CS.removeEnd(path, SLASH_INDEX_FILE));
	}

	/**
	 * Returns the content item id for a given site and path. e.g.: "my-site:/site/website/test1/index.xml"
	 *
	 * @param siteId the site id
	 * @param path   the content item path
	 * @return the content item id
	 */
	public static String getContentItemId(String siteId, String path) {
		return format("%s:%s", siteId, path);
	}

	/**
	 * Helper method to add or update a single child element of the root with the indicated value.
	 * Elements of the same name in nested (embedded) components are not affected.
	 *
	 * @param root     root element
	 * @param nodeName name of the node to update
	 * @param value    new text value of the node
	 */
	public static void addOrUpdateSingleDocumentNode(final Element root, final String nodeName, final String value) {
		Element element = root.element(nodeName);
		if (element != null) {
			element.setText(value);
		} else {
			root.addElement(nodeName).setText(value);
		}
	}

	/**
	 * Helper method to update a single node element with the indicated value, using the provided XPath expression to select the node to update.
	 *
	 * @param root  root element
	 * @param xpath XPath expression to select the node to update
	 * @param value new text value of the node, if found
	 */
	public static void updateSingleDocumentFromXPath(final Element root, final String xpath, final String value) {
		Node node = root.selectSingleNode(xpath);
		if (node != null) {
			node.setText(value);
		}
	}

	/**
	 * Reads the text of a single child element of the root.
	 * Elements of the same name in nested (embedded) components are not read.
	 *
	 * @param root     root element of the document
	 * @param nodeName name of the node to read
	 * @return the text of the node, or null if the node is not found
	 */
	public static String readSingleDocumentNodeText(final Element root, final String nodeName) {
		return root.elementTextTrim(nodeName);
	}

	/**
	 * Reads the text of a single node in a document, using the provided XPath expression.
	 *
	 * @param root  root element of the document
	 * @param xpath XPath expression to select the node to read
	 * @return the text of the node, or null if the node is not found
	 */
	public static String readSingleDocumentFromXPath(final Element root, final String xpath) {
		Node node = root.selectSingleNode(xpath);
		if (node != null) {
			return node.getText();
		}

		return null;
	}

	/**
	 * Get the authoring URL for a given content item path, based on the configured patterns for the site.
	 *
	 * @param servicesConfig {@link ServicesConfig} instance to get the configured patterns for the site and the authoring URL
	 * @param site           the site for which to get the authoring URL
	 * @param previewUri      the preview URI for the content item, e.g.: "/articles/test1/"
	 * @return the authoring URL for the given content item path, or null if the path matches any of the patterns that should not have a preview URL
	 * @throws SiteNotFoundException if the site is not found in the configuration
	 */
	public static String getAuthoringUrl(ServicesConfig servicesConfig, String site, String previewUri) throws SiteNotFoundException {
		if (previewUri != null) {
			previewUri = format(AUTHORING_URL_FORMAT, servicesConfig.getAuthoringUrl(site), previewUri, site);
		}
		return previewUri;
	}

	/**
	 * Get the preview URL for a given content item path, based on the configured patterns for the site.
	 * If the path matches any of the patterns that should not have a preview URL, null is returned.
	 *
	 * @param servicesConfig {@link ServicesConfig} instance to get the configured patterns for the site
	 * @param site           the site for which to get the preview URL
	 * @param path           the content item path for which to get the preview URL
	 * @return the preview URL for the given content item path, or null if the path matches any of the patterns that should not have a preview URL
	 * @throws SiteNotFoundException if the site is not found in the configuration
	 */
	public static String getPreviewUrl(ServicesConfig servicesConfig, String site, String path) throws SiteNotFoundException {
		String replacePattern;
		boolean isPage = false;
		if (matchesPatterns(path, servicesConfig.getRenderingTemplatePatterns(site))) {
			return null;
		} else if (matchesPatterns(path, List.of(CONTENT_TYPE_TAXONOMY_REGEX))) {
			return null;
		} else if (matchesPatterns(path, servicesConfig.getComponentPatterns(site)) ||
				CS.endsWith(path, FILE_SEPARATOR + servicesConfig.getLevelDescriptorName(site))) {
			return null;
		} else if (matchesPatterns(path, servicesConfig.getScriptsPatterns(site))) {
			return null;
		} else if (matchesPatterns(path, List.of(CONTENT_TYPE_CONFIG_REGEX))) {
			return null;
		} else if (matchesPatterns(path, servicesConfig.getAssetPatterns(site))) {
			replacePattern = StringUtils.EMPTY;
		} else if (matchesPatterns(path, servicesConfig.getDocumentPatterns(site))) {
			replacePattern = DmConstants.ROOT_PATTERN_DOCUMENTS;
		} else {
			replacePattern = DmConstants.ROOT_PATTERN_PAGES;
			isPage = true;
		}

		String browserUri = path.replaceFirst(replacePattern, "");
		browserUri = browserUri.replaceFirst(FILE_SEPARATOR + DmConstants.INDEX_FILE, "");
		if (browserUri.isEmpty()) {
			browserUri = FILE_SEPARATOR;
		}
		// TODO: come up with a better way of doing this.
		if (isPage) {
			browserUri = browserUri.replaceFirst("\\.xml", ".html");
		}
		return browserUri;
	}

	/**
	 * Get content type class for given site and uri.
	 * It will default to {@link org.craftercms.studio.api.v1.constant.StudioConstants#CONTENT_TYPE_FILE} if
	 * the path does not match any content type pattern.
	 *
	 * @param servicesConfig      {@link ServicesConfig} instance to get the configured patterns for the site
	 * @param studioConfiguration {@link StudioConfiguration} instance to get the configured content types base
	 * @param site                the site id
	 * @param uri                 the content uri
	 * @return the content type class
	 * @throws SiteNotFoundException if site is not found
	 */
	public static String getContentTypeClass(ServicesConfig servicesConfig, StudioConfiguration studioConfiguration,
											 String site, String uri) throws SiteNotFoundException {
		if (uri.endsWith(FILE_SEPARATOR + servicesConfig.getLevelDescriptorName(site))) {
			return CONTENT_TYPE_LEVEL_DESCRIPTOR;
		}
		if (matchesPatterns(uri, servicesConfig.getPagePatterns(site))) {
			return CONTENT_TYPE_PAGE;
		}
		if (matchesPatterns(uri, servicesConfig.getComponentPatterns(site))) {
			return CONTENT_TYPE_COMPONENT;
		}
		if (matchesPatterns(uri, servicesConfig.getDocumentPatterns(site))) {
			return CONTENT_TYPE_DOCUMENT;
		}
		if (matchesPatterns(uri, servicesConfig.getAssetPatterns(site))) {
			return CONTENT_TYPE_ASSET;
		}
		if (matchesPatterns(uri, servicesConfig.getRenderingTemplatePatterns(site))) {
			return CONTENT_TYPE_RENDERING_TEMPLATE;
		}
		if (CS.startsWith(uri, studioConfiguration.getProperty(CONFIGURATION_SITE_CONTENT_TYPES_CONFIG_BASE_PATH))) {
			return CONTENT_TYPE_CONTENT_TYPE;
		}
		if (matchesPatterns(uri, List.of(CONTENT_TYPE_TAXONOMY_REGEX))) {
			return CONTENT_TYPE_TAXONOMY;
		}
		if (matchesPatterns(uri, servicesConfig.getScriptsPatterns(site))) {
			return CONTENT_TYPE_SCRIPT;
		}
		if (matchesPatterns(uri, servicesConfig.getConfigurationPatterns(site))) {
			return CONTENT_TYPE_CONFIGURATION;
		}
		return CONTENT_TYPE_FILE;
	}

	/**
	 * Checks if two content items are siblings, meaning they have the same parent URL.
	 *
	 * @param sourcePath the path of the first content item
	 * @param targetPath the path of the second content item
	 * @return true if the content items are siblings, false otherwise
	 */
	public static boolean areSiblings(String sourcePath, String targetPath) {
		return CS.equals(getParentUrl(sourcePath), getParentUrl(targetPath));
	}
}
