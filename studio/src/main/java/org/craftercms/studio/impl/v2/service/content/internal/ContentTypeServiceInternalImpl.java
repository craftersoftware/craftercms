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

package org.craftercms.studio.impl.v2.service.content.internal;

import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import com.google.common.cache.Cache;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteExists;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.ItemDAO;
import org.craftercms.studio.api.v2.dal.QuickCreateItem;
import org.craftercms.studio.api.v2.dal.item.LightItem;
import org.craftercms.studio.api.v2.exception.configuration.ConfigurationException;
import org.craftercms.studio.api.v2.exception.contentType.ContentTypeUsageException;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.api.v2.utils.GitRepositoryHelper;
import org.craftercms.studio.impl.v2.utils.Wrapper;
import org.craftercms.studio.impl.v2.utils.security.SecurityUtils;
import org.craftercms.studio.model.contentType.ContentType;
import org.craftercms.studio.model.contentType.ContentTypeUsage;
import org.dom4j.Document;
import org.dom4j.Node;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

import java.beans.ConstructorProperties;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;

import static java.lang.String.format;
import static java.nio.file.Files.walkFileTree;
import static java.util.Collections.singletonList;
import static java.util.stream.Collectors.toList;
import static org.apache.commons.collections4.CollectionUtils.isEmpty;
import static org.apache.commons.io.FilenameUtils.normalize;
import static org.apache.commons.lang3.RegExUtils.replaceAll;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.apache.commons.lang3.Strings.CI;
import static org.craftercms.commons.lang.UrlUtils.concat;
import static org.craftercms.studio.api.v1.constant.GitRepositories.SANDBOX;
import static org.craftercms.studio.api.v1.constant.StudioConstants.*;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_CREATE;

/**
 * Internal implementation of {@link org.craftercms.studio.api.v2.service.content.ContentTypeService}.
 */
public class ContentTypeServiceInternalImpl implements org.craftercms.studio.api.v2.service.content.ContentTypeService {

	private static final Logger logger = LoggerFactory.getLogger(ContentTypeServiceInternalImpl.class);

	protected final UserService userService;
	protected final ConfigurationService configurationService;
	protected final ItemDAO itemDao;
	protected ContentService contentService;

	protected final String contentTypeBasePathPattern;
	protected final String contentTypesRootPath;
	protected final String contentTypeDefinitionFilename;
	protected final String templateXPath;
	protected final String controllerPattern;
	protected final String controllerFormat;
	protected final String previewImageXPath;
	protected final String defaultPreviewImagePath;
	protected final String formControllerFilePath;
	private final GitRepositoryHelper gitRepositoryHelper;
	private final Cache<String, ContentType> cache;
	private final XmlMapper xmlMapper;

	@ConstructorProperties({"userService", "configurationService", "itemDao",
			"contentTypeBasePathPattern", "contentTypeDefinitionFilename",
			"contentTypesRootPath",
			"templateXPath", "controllerPattern", "controllerFormat", "previewImageXPath", "defaultPreviewImagePath",
			"formControllerFilePath", "gitRepositoryHelper",
			"cache"})
	public ContentTypeServiceInternalImpl(UserService userService,
										  ConfigurationService configurationService, ItemDAO itemDao, String contentTypeBasePathPattern,
										  String contentTypeDefinitionFilename,
										  String contentTypesRootPath, String templateXPath,
										  String controllerPattern, String controllerFormat,
										  String previewImageXPath, String defaultPreviewImagePath,
										  String formControllerFilePath, GitRepositoryHelper gitRepositoryHelper,
										  Cache<String, ContentType> cache) {
		this.userService = userService;
		this.configurationService = configurationService;
		this.itemDao = itemDao;
		this.contentTypeBasePathPattern = contentTypeBasePathPattern;
		this.contentTypeDefinitionFilename = contentTypeDefinitionFilename;
		this.contentTypesRootPath = contentTypesRootPath;
		this.templateXPath = templateXPath;
		this.controllerPattern = controllerPattern;
		this.controllerFormat = controllerFormat;
		this.previewImageXPath = previewImageXPath;
		this.defaultPreviewImagePath = defaultPreviewImagePath;
		this.formControllerFilePath = formControllerFilePath;
		this.gitRepositoryHelper = gitRepositoryHelper;
		this.cache = cache;
		this.xmlMapper = new XmlMapper();
	}

	@Lazy
	@Autowired
	@Qualifier("contentServiceInternal")
	public void setContentService(ContentService contentService) {
		this.contentService = contentService;
	}

	@Override
	public List<QuickCreateItem> getQuickCreatableContentTypes(String siteId) throws ServiceLayerException {
		List<ContentType> quickCreateContentTypes = getAllContentTypes(siteId).stream()
				.filter(ContentType::isQuickCreate).collect(toList());

		List<QuickCreateItem> result = new ArrayList<>();
		for (ContentType contentType : quickCreateContentTypes) {
			try {
				if (userService.getUserPermissions(siteId, contentType.getQuickCreatePath(), SecurityUtils.getCurrentUsername())
						.contains(PERMISSION_CONTENT_CREATE)) {
					QuickCreateItem item = new QuickCreateItem();
					item.setSiteId(siteId);
					item.setContentTypeId(contentType.getId());
					item.setLabel(contentType.getLabel());
					item.setPath(contentType.getQuickCreatePath());
					result.add(item);
				}
			} catch (UserNotFoundException e) {
				// This should never happen. If the site does not exist then getAllContentTypes() call above should have thrown an exception
				logger.trace(format("User not found, unable to get permissions for content type '%s'", contentType.getId()), e);
			}
		}
		return result;
	}

	@Override
	public Collection<ContentType> getAllContentTypes(String siteId) throws ServiceLayerException {
		Collection<ContentType> contentTypes = new ArrayList<>();

		Path repoRootPath = gitRepositoryHelper.buildRepoPath(SANDBOX, siteId);
		Path contentTypesRepoPath = repoRootPath.resolve(gitRepositoryHelper.getGitPath(contentTypesRootPath));
		try {
			Wrapper<Exception> fileVisitorException = new Wrapper<>();
			walkFileTree(contentTypesRepoPath, new SimpleFileVisitor<>() {
				@Override
				public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
					if (!file.getFileName().toString().equals(contentTypeDefinitionFilename)) {
						return FileVisitResult.CONTINUE;
					}
					try {
						contentTypes.add(getContentType(siteId, contentTypesRepoPath.relativize(file.getParent()).toString()));
					} catch (ServiceLayerException e) {
						fileVisitorException.set(e);
						return FileVisitResult.TERMINATE;
					}
					return FileVisitResult.SKIP_SIBLINGS;
				}
			});
			if (fileVisitorException.hasValue()) {
				throw fileVisitorException.get();
			}
		} catch (Exception e) {
			throw new ServiceLayerException(format("Failed to retrieve content types for site '%s'", siteId), e);
		}

		return contentTypes;
	}

	@Override
	public ContentType getContentType(String siteId, String contentTypeId) throws ServiceLayerException {
		String configFileFullPath = getContentTypeFormPath(contentTypeId);
		var cacheKey = configurationService.getCacheKey(siteId, null, configFileFullPath,
				null, "object");
		ContentType contentType = cache.getIfPresent(cacheKey);
		if (contentType == null) {
			logger.debug("Cache miss for key '{}'", cacheKey);
			contentType = loadContentType(siteId, contentTypeId);
			cache.put(cacheKey, contentType);
		}

		return contentType;
	}

	/**
	 * Get content type form-definition.xml full path in content repository
	 */
	private String getContentTypeFormPath(String contentTypeId) {
		String siteConfigPath = getContentTypePath(contentTypeId);
		String configFileFullPath = siteConfigPath + FILE_SEPARATOR + contentTypeDefinitionFilename;
		return configFileFullPath;
	}

	/**
	 * Load content type form-definition.xml from content repository and map it to ContentType object
	 *
	 * @param siteId        the site id
	 * @param contentTypeId the content type id
	 * @return the ContentType object mapped from form-definition.xml
	 * @throws ConfigurationException if there is any error reading the content type configuration
	 */
	protected ContentType loadContentType(String siteId, String contentTypeId) throws ConfigurationException, ContentNotFoundException {
		try (InputStream configurationAsStream = contentService.getContent(siteId, getContentTypeFormPath(contentTypeId))) {
			return xmlMapper.readValue(configurationAsStream, ContentType.class);
		} catch (IOException e) {
			throw new ConfigurationException(format("Failed to read content type configuration for content type '%s' in site '%s'", contentTypeId, siteId), e);
		}
	}

	@Override
	public Collection<String> getAllowedContentTypes(String siteId, String path) throws ServiceLayerException {
		return getAllContentTypes(siteId).stream()
				.filter(ct -> isEmpty(ct.getPathIncludes()) || ct.getPathIncludes().stream().anyMatch(path::matches))
				.filter(ct -> ct.getPathExcludes().stream().noneMatch(path::matches))
				.map(ContentType::getId)
				.collect(toList());
	}

	@Override
	public boolean isContentTypeAllowed(String siteId, String path, String contentTypeId) throws ServiceLayerException {
		Collection<String> allowedContentTypes = getAllowedContentTypes(siteId, path);
		return allowedContentTypes.contains(contentTypeId);
	}

	@Override
	public ContentTypeUsage getContentTypeUsage(String siteId, String contentType) throws ServiceLayerException {

		var usages = new ContentTypeUsage();

		String template = getContentTypeTemplatePath(siteId, contentType);
		if (isNotEmpty(template)) {
			usages.setTemplates(singletonList(template));
		}

		String scriptPath = getContentTypeControllerPath(contentType);

		List<LightItem> items = itemDao.getContentTypeUsages(siteId, contentType, scriptPath);

		usages.setContent(items.stream()
				.filter(i -> CI.equalsAny(i.getMetadata().systemType(), CONTENT_TYPE_PAGE, CONTENT_TYPE_COMPONENT))
				.map(LightItem::getPath)
				.collect(toList()));

		usages.setScripts(items.stream()
				.filter(i -> CI.equals(i.getMetadata().systemType(), (CONTENT_TYPE_SCRIPT)))
				.map(LightItem::getPath)
				.collect(toList()));

		return usages;
	}

	@Override
	public ImmutablePair<String, Resource> getContentTypePreviewImage(String siteId,
																	  String contentTypeId) throws ServiceLayerException {

		String filename = getContentTypePreviewImageFilename(siteId, contentTypeId);
		boolean hasPreviewImage = isNotEmpty(filename) && !filename.equals("undefined"); // form-definition could have undefined value for imageThumbnail
		if (hasPreviewImage) {
			String previewImagePath = concat(getContentTypePath(contentTypeId), filename);
			return (new ImmutablePair<>(previewImagePath, contentService.getContentAsResource(siteId, previewImagePath)));
		}

		return (new ImmutablePair<>(defaultPreviewImagePath, new ClassPathResource(defaultPreviewImagePath)));
	}

	@Override
	public ImmutablePair<String, Resource> getContentTypeFormController(String siteId, String contentTypeId) throws ServiceLayerException {
		if (contentService.contentExists(siteId, concat(getContentTypePath(contentTypeId), contentTypeDefinitionFilename))) {
			String controllerPath = concat(getContentTypePath(contentTypeId), formControllerFilePath);
			return new ImmutablePair<>(controllerPath, contentService.getContentAsResource(siteId, controllerPath));
		}

		throw new ContentNotFoundException(contentTypeId, siteId, "Content-Type not found");
	}

	@Override
	public void deleteContentType(String siteId, String contentType, boolean deleteDependencies)
			throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		ContentTypeUsage usage = getContentTypeUsage(siteId, contentType);

		var files = new HashSet<String>();

		if (CollectionUtils.isNotEmpty(usage.getContent())) {
			if (!deleteDependencies) {
				throw new ContentTypeUsageException(siteId, contentType);
			}

			files.addAll(usage.getContent());
		}

		files.addAll(usage.getTemplates());
		files.addAll(usage.getScripts());
		files.add(getContentTypePath(contentType));

		String message = "Delete content-type %s".formatted(contentType);
		contentService.deleteContent(siteId, files, StringUtils.left(message, PublishService.PACKAGE_TITLE_MAX_LENGTH), message);
	}

	@Override
	public String getContentTypeControllerPath(String contentTypeId) {
		return replaceAll(contentTypeId, controllerPattern, controllerFormat);
	}

	@Override
	public String getContentTypeTemplatePath(String siteId, String contentTypeId) throws ServiceLayerException {
		Document definition = getFormDefinitionDocument(siteId, contentTypeId);

		Node templateNode = definition.selectSingleNode(templateXPath);

		if (templateNode != null && isNotEmpty(templateNode.getText())) {
			return templateNode.getText();
		}

		return null;
	}

	@Override
	@RequireSiteExists
	public Collection<String> getAllModelDefinitions(@SiteId String site) throws ServiceLayerException {
		List<String> modelDefinitions = new LinkedList<>();

		Path repoRootPath = gitRepositoryHelper.buildRepoPath(SANDBOX, site);
		Path contentTypesRepoPath = repoRootPath.resolve(gitRepositoryHelper.getGitPath(contentTypesRootPath));
		try {
			walkFileTree(contentTypesRepoPath, new SimpleFileVisitor<>() {
				@Override
				public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
					return visitContentTypeFile(file, modelDefinitions);
				}
			});
		} catch (IOException e) {
			throw new ServiceLayerException(format("Failed to retrieve content types for site '%s'", site), e);
		}

		return modelDefinitions;
	}

	@NonNull
	private FileVisitResult visitContentTypeFile(final Path file, final List<String> contentTypes) throws IOException {
		if (!file.getFileName().toString().equals(contentTypeDefinitionFilename)) {
			return FileVisitResult.CONTINUE;
		}
		contentTypes.add(Files.readString(file));
		return FileVisitResult.SKIP_SIBLINGS;
	}

	protected String getContentTypePath(String contentType) {
		return normalize(contentTypeBasePathPattern.replaceFirst(PATTERN_CONTENT_TYPE, contentType));
	}

	/**
	 * Get preview image filename extract from form-definition.xml
	 *
	 * @param siteId        the site id
	 * @param contentTypeId the content type id
	 * @return preview image filename
	 * @throws ServiceLayerException if there is any error reading the content type definition
	 */
	protected String getContentTypePreviewImageFilename(String siteId, String contentTypeId) throws ServiceLayerException {
		Document definition = getFormDefinitionDocument(siteId, contentTypeId);

		Node previewImageNode = definition.selectSingleNode(previewImageXPath);

		if (previewImageNode != null && isNotEmpty(previewImageNode.getText())) {
			return previewImageNode.getText();
		}

		return null;
	}

	/**
	 * Get form-definition.xml as Document of a content type
	 *
	 * @param siteId        the site id
	 * @param contentTypeId the content type id
	 * @return Document of form-definition.xml
	 * @throws ServiceLayerException if there is any error reading the content type definition or if the definition file does not exist
	 */
	@RequireSiteExists
	protected Document getFormDefinitionDocument(@SiteId String siteId, String contentTypeId) throws ServiceLayerException {
		String definitionPath = getContentTypePath(contentTypeId) + File.separator + contentTypeDefinitionFilename;
		Document definition = configurationService.getConfigurationAsDocument(siteId, null, definitionPath, null);

		if (definition == null) {
			throw new ContentNotFoundException(definitionPath, siteId, "Content-Type not found");
		}

		return definition;
	}

}
