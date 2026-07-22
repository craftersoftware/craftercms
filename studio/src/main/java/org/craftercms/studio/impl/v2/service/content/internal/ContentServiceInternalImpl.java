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

import java.beans.ConstructorProperties;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import static java.lang.String.format;
import static java.nio.charset.StandardCharsets.UTF_8;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import static java.util.Collections.emptyList;
import java.util.Comparator;
import static java.util.Comparator.naturalOrder;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import static java.util.Set.of;
import java.util.UUID;
import static java.util.function.Function.identity;
import java.util.regex.Pattern;
import static java.util.stream.Collectors.counting;
import static java.util.stream.Collectors.filtering;
import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.teeing;
import static java.util.stream.Collectors.toList;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;
import java.util.stream.Stream;

import static org.apache.commons.collections4.CollectionUtils.isEmpty;
import static org.apache.commons.collections4.CollectionUtils.isNotEmpty;
import static org.apache.commons.collections4.CollectionUtils.subtract;
import static org.apache.commons.collections4.ListUtils.union;
import static org.apache.commons.collections4.SetUtils.difference;
import static org.apache.commons.collections4.SetUtils.union;
import org.apache.commons.io.FilenameUtils;
import static org.apache.commons.io.FilenameUtils.directoryContains;
import static org.apache.commons.io.FilenameUtils.equalsNormalized;
import static org.apache.commons.io.FilenameUtils.getExtension;
import static org.apache.commons.io.FilenameUtils.getFullPathNoEndSeparator;
import static org.apache.commons.io.FilenameUtils.getName;
import org.apache.commons.io.IOUtils;
import static org.apache.commons.io.file.PathUtils.getBaseName;
import org.apache.commons.lang.mutable.MutableLong;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import static org.apache.commons.lang3.StringUtils.EMPTY;
import static org.apache.commons.lang3.StringUtils.defaultIfEmpty;
import static org.apache.commons.lang3.StringUtils.isNotBlank;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.apache.commons.lang3.Strings.CS;
import org.apache.ibatis.session.ExecutorType;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.craftercms.commons.entitlements.exception.EntitlementException;
import org.craftercms.commons.entitlements.model.EntitlementType;
import org.craftercms.commons.entitlements.validator.EntitlementValidator;
import org.craftercms.commons.rest.parameters.SortField;
import org.craftercms.commons.security.exception.ActionDeniedException;
import org.craftercms.commons.security.permissions.PermissionEvaluator;
import org.craftercms.core.exception.PathNotFoundException;
import org.craftercms.studio.api.v1.constant.DmConstants;
import static org.craftercms.studio.api.v1.constant.DmConstants.ROOT_PATTERN_ASSETS;
import static org.craftercms.studio.api.v1.constant.DmConstants.ROOT_PATTERN_PAGES;
import static org.craftercms.studio.api.v1.constant.DmConstants.SLASH_INDEX_FILE;
import static org.craftercms.studio.api.v1.constant.DmConstants.XML_PATTERN;
import static org.craftercms.studio.api.v1.constant.DmXmlConstants.ELM_CREATED_DATE;
import static org.craftercms.studio.api.v1.constant.DmXmlConstants.ELM_CREATED_DATE_DT;
import static org.craftercms.studio.api.v1.constant.DmXmlConstants.ELM_FOLDER_NAME;
import static org.craftercms.studio.api.v1.constant.DmXmlConstants.ELM_GROUP_ID;
import static org.craftercms.studio.api.v1.constant.DmXmlConstants.ELM_LAST_MODIFIED_DATE;
import static org.craftercms.studio.api.v1.constant.DmXmlConstants.ELM_LAST_MODIFIED_DATE_DT;
import static org.craftercms.studio.api.v1.constant.DmXmlConstants.ELM_OBJECT_ID;
import static org.craftercms.studio.api.v1.constant.DmXmlConstants.ELM_ORDER_DEFAULT;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_FOLDER;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_LEVEL_DESCRIPTOR;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_PAGE;
import static org.craftercms.studio.api.v1.constant.StudioConstants.DEFAULT_ORDER_XPATH;
import static org.craftercms.studio.api.v1.constant.StudioConstants.FILE_SEPARATOR;
import static org.craftercms.studio.api.v1.constant.StudioConstants.INTERNAL_NAME_XPATH;
import static org.craftercms.studio.api.v1.constant.StudioConstants.PLACE_IN_NAV_XPATH;
import static org.craftercms.studio.api.v1.constant.StudioConstants.SUPPORT_RENAME_CONTENT_TYPES;
import static org.craftercms.studio.api.v1.constant.StudioXmlConstants.DOCUMENT_ELM_CONTENT_TYPE;
import static org.craftercms.studio.api.v1.constant.StudioXmlConstants.DOCUMENT_ELM_DISABLED;
import static org.craftercms.studio.api.v1.constant.StudioXmlConstants.DOCUMENT_ELM_FILE_NAME;
import static org.craftercms.studio.api.v1.constant.StudioXmlConstants.DOCUMENT_ELM_INTERNAL_TITLE;
import static org.craftercms.studio.api.v1.constant.StudioXmlConstants.DOCUMENT_ELM_SAVED_AS_DRAFT;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.GeneralLockService;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.content.ContentLifecycle;
import org.craftercms.studio.api.v2.content.LifecycleContent;
import org.craftercms.studio.api.v2.content.LifecycleContent.ContentLifecycleItem;
import org.craftercms.studio.api.v2.content.LifecycleContent.LifecycleOperation;
import static org.craftercms.studio.api.v2.content.LifecycleContent.LifecycleOperation.COPY;
import static org.craftercms.studio.api.v2.content.LifecycleContent.LifecycleOperation.DELETE;
import static org.craftercms.studio.api.v2.content.LifecycleContent.LifecycleOperation.DUPLICATE;
import static org.craftercms.studio.api.v2.content.LifecycleContent.LifecycleOperation.NEW;
import static org.craftercms.studio.api.v2.content.LifecycleContent.LifecycleOperation.RENAME;
import static org.craftercms.studio.api.v2.content.LifecycleContent.LifecycleOperation.REVERT;
import static org.craftercms.studio.api.v2.content.LifecycleContent.LifecycleOperation.UPDATE;
import static org.craftercms.studio.api.v2.content.LifecycleContentProvider.ofPath;
import static org.craftercms.studio.api.v2.content.LifecycleContentProvider.ofStream;
import org.craftercms.studio.api.v2.dal.AuditLog;
import static org.craftercms.studio.api.v2.dal.AuditLog.createAuditLogEntry;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_CREATE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.OPERATION_MOVE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_CONTENT_ITEM;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_CONTENT_PACKAGE;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_FOLDER;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.TARGET_TYPE_SOURCE_PATH;
import org.craftercms.studio.api.v2.dal.AuditLogParameter;
import org.craftercms.studio.api.v2.dal.CommitAuthor;
import org.craftercms.studio.api.v2.dal.DependencyDAO;
import org.craftercms.studio.api.v2.dal.Item;
import org.craftercms.studio.api.v2.dal.ItemDAO;
import org.craftercms.studio.api.v2.dal.ItemState;
import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.dal.item.ContentItem;
import org.craftercms.studio.api.v2.dal.item.LightItem;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.event.content.ContentEvent;
import org.craftercms.studio.api.v2.event.content.DeleteContentEvent;
import org.craftercms.studio.api.v2.event.content.MoveContentEvent;
import org.craftercms.studio.api.v2.event.lock.LockContentEvent;
import org.craftercms.studio.api.v2.event.publish.RequestPublishEvent;
import org.craftercms.studio.api.v2.event.site.SyncFromRepoEvent;
import org.craftercms.studio.api.v2.event.workflow.WorkflowEvent;
import static org.craftercms.studio.api.v2.event.workflow.WorkflowEvent.WorkFlowEventType.DIRECT_PUBLISH;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.exception.content.ContentExistException;
import org.craftercms.studio.api.v2.exception.content.ContentInPublishQueueException;
import org.craftercms.studio.api.v2.exception.content.ContentLockedByAnotherUserException;
import org.craftercms.studio.api.v2.exception.contentType.ContentTypeInvalidLocationException;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.repository.ContentWriteItem;
import org.craftercms.studio.api.v2.repository.GitContentRepository;
import org.craftercms.studio.api.v2.security.SemanticsAvailableActionsResolver;
import org.craftercms.studio.api.v2.service.audit.ActivityStreamService;
import org.craftercms.studio.api.v2.service.audit.AuditService;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.api.v2.service.content.ContentTypeService;
import org.craftercms.studio.api.v2.service.dependency.DependencyService;
import org.craftercms.studio.api.v2.service.item.ItemService;
import org.craftercms.studio.api.v2.service.publish.PublishService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import static org.craftercms.studio.api.v2.utils.DalUtils.MY_BATIS_QUERY_BATCH_SIZE;
import static org.craftercms.studio.api.v2.utils.DalUtils.mapSortFields;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_GLOBAL_SYSTEM_SITE;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONTENT_ITEM_EDITABLE_TYPES;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.PAGE_NAVIGATION_ORDER_INCREMENT;
import org.craftercms.studio.api.v2.utils.StudioUtils;
import static org.craftercms.studio.api.v2.utils.StudioUtils.createTempFile;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getSandboxRepoLockKey;
import static org.craftercms.studio.api.v2.utils.StudioUtils.getTopLevelFolder;
import static org.craftercms.studio.api.v2.utils.StudioUtils.isDescriptor;
import static org.craftercms.studio.api.v2.utils.StudioUtils.isPageDescriptor;
import static org.craftercms.studio.api.v2.utils.StudioUtils.movePath;
import static org.craftercms.studio.api.v2.utils.StudioUtils.underDescriptorRoot;
import static org.craftercms.studio.api.v2.utils.StudioUtils.underPagesRoot;
import org.craftercms.studio.api.v2.utils.function.ThrowingRunnable;
import static org.craftercms.studio.impl.v1.repository.git.GitContentRepositoryConstants.IGNORE_FILES;
import org.craftercms.studio.impl.v1.util.ContentUtils;
import static org.craftercms.studio.impl.v1.util.ContentUtils.addOrUpdateSingleDocumentNode;
import static org.craftercms.studio.impl.v1.util.ContentUtils.convertStreamToXml;
import static org.craftercms.studio.impl.v1.util.ContentUtils.getContentItemId;
import static org.craftercms.studio.impl.v1.util.ContentUtils.getContentTypeClass;
import static org.craftercms.studio.impl.v1.util.ContentUtils.getParentUrl;
import static org.craftercms.studio.impl.v1.util.ContentUtils.readSingleDocumentFromXPath;
import static org.craftercms.studio.impl.v1.util.ContentUtils.readSingleDocumentNodeText;
import static org.craftercms.studio.impl.v1.util.ContentUtils.updateSingleDocumentFromXPath;
import static org.craftercms.studio.impl.v2.service.content.internal.ContentServiceInternalImpl.ContentItemIds.generate;
import org.craftercms.studio.impl.v2.utils.DateUtils;
import static org.craftercms.studio.impl.v2.utils.DateUtils.getCurrentTimeIso;
import org.craftercms.studio.impl.v2.utils.DependencyUtils;
import org.craftercms.studio.impl.v2.utils.db.DBUtils;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getAuthentication;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getCurrentUser;
import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getCurrentUsername;
import org.craftercms.studio.impl.v2.utils.spring.ContentResource;
import org.craftercms.studio.model.AuthenticatedUser;
import org.craftercms.studio.model.contentType.ContentType;
import org.craftercms.studio.model.contentType.CopyDependency;
import org.craftercms.studio.model.history.ItemVersion;
import org.craftercms.studio.model.history.RepositoryVersion;
import org.craftercms.studio.model.rest.Person;
import org.craftercms.studio.model.rest.content.DeleteContentResult;
import org.craftercms.studio.model.rest.content.GetChildrenBulkRequest.PathParams;
import org.craftercms.studio.model.rest.content.GetChildrenByPathsBulkResult;
import org.craftercms.studio.model.rest.content.GetChildrenByPathsBulkResult.ChildrenByPathResult;
import org.craftercms.studio.model.rest.content.GetChildrenResult;
import org.craftercms.studio.model.rest.content.PasteContentResult;
import org.craftercms.studio.model.rest.content.WriteContentResult;
import org.craftercms.studio.model.rest.content.WriteContentResult.WriteContentResultItem;
import org.craftercms.studio.model.rest.content.order.ItemOrder;
import org.craftercms.studio.model.rest.content.order.ReorderItemRequest;
import static org.craftercms.studio.permissions.CompositePermissionResolverImpl.PATH_LIST_RESOURCE_ID;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PATH_RESOURCE_ID;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_DELETE;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_WRITE;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.SITE_ID_RESOURCE_ID;
import org.dom4j.Document;
import org.dom4j.DocumentException;
import org.dom4j.Element;
import org.dom4j.Node;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationEventPublisherAware;
import org.springframework.core.io.Resource;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.PlatformTransactionManager;
import static org.springframework.transaction.TransactionDefinition.ISOLATION_READ_COMMITTED;
import org.springframework.util.MimeType;
import org.springframework.util.function.ThrowingSupplier;

import com.google.common.collect.Lists;

/**
 * Internal implementation of {@link ContentService}
 */
public class ContentServiceInternalImpl implements ContentService, ApplicationEventPublisherAware {

	private static final Logger logger = LoggerFactory.getLogger(ContentServiceInternalImpl.class);
	private static final int FETCH_AUTHOR_FROM_COMMITS_BATCH_SIZE = 1000;
	private static final int DEFAULT_PAGE_NAV_ORDER_INCREMENT = 1000;
	// Limit the number of children to fetch for page navigation order update to avoid performance issues.
	// There should not really be pages with that many children in the navigation anyway
	private static final int MAX_CHILDREN_FOR_GET_NAV_ORDER = 10000;

	private static final String MOVE_TRANSACTION_FORMAT = "CONTENT_MOVE_%s";
	private static final String DELETE_TRANSACTION_FORMAT = "CONTENT_DELETE_%s";
	private static final String COPY_TRANSACTION_FORMAT = "CONTENT_COPY_%s";
	private static final String WRITE_TRANSACTION_FORMAT = "CONTENT_WRITE_%s";
	private static final String CREATE_FOLDER_TRANSACTION_FORMAT = "CREATE_FOLDER_%s";

	private final static Pattern COPY_FILE_MODIFIER_PATTERN = Pattern.compile(".+(-copy-(\\d+))(.+)?(\\..*)?");
	private final static String COPY_FILE_MODIFIER_FORMAT = "%s-copy-%s%s";

	private final static String INTERNAL_NAME_MODIFIER_PATTERN = "\\s\\(Copy \\d+\\)";
	private final static String INTERNAL_NAME_MODIFIER_FORMAT = "%s (Copy %s)";

	private static final String COPY_DEP_XPATH = "//*/text()[contains(normalize-space(.),'{copyDep}')]/parent::*";
	private static final String COPY_DEP = "{copyDep}";


	private final GitContentRepository contentRepository;
	private final ItemDAO itemDao;
	private final StudioConfiguration studioConfiguration;
	private final int pageNavOrderIncrement;
	private SemanticsAvailableActionsResolver semanticsAvailableActionsResolver;
	private final AuditService auditService;
	private final DependencyService dependencyService;
	private final SitesService siteService;
	private final ItemService itemService;
	private final GeneralLockService generalLockService;
	private ApplicationEventPublisher eventPublisher;
	private final PublishService publishService;
	private final ContentLifecycle contentLifecycle;
	private final ContentLifecycle assetLifecycle;
	private final PermissionEvaluator<String, Object> permissionEvaluator;
	private final PlatformTransactionManager transactionManager;
	private final RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;
	private final ServicesConfig servicesConfig;
	private final ActivityStreamService activityStreamService;
	private final EntitlementValidator entitlementValidator;
	private final SqlSessionFactory sqlSessionFactory;
	private final ContentTypeService contentTypeService;

	@ConstructorProperties({"transactionManager", "studioConfiguration", "siteService",
			"retryingDatabaseOperationFacade", "publishService",
			"permissionEvaluator", "itemService",
			"itemDao", "generalLockService", "dependencyService",
			"contentRepository", "contentLifecycle",
			"auditService", "assetLifecycle",
			"servicesConfig", "activityStreamService",
			"entitlementValidator", "sqlSessionFactory",
			"contentTypeService"})
	public ContentServiceInternalImpl(PlatformTransactionManager transactionManager, StudioConfiguration studioConfiguration,
									  SitesService siteService,
									  RetryingDatabaseOperationFacade retryingDatabaseOperationFacade, PublishService publishService,
									  PermissionEvaluator<String, Object> permissionEvaluator,
									  ItemService itemService,
									  ItemDAO itemDao, GeneralLockService generalLockService,
									  DependencyService dependencyService,
									  GitContentRepository contentRepository, ContentLifecycle contentLifecycle,
									  AuditService auditService, ContentLifecycle assetLifecycle,
									  ServicesConfig servicesConfig, ActivityStreamService activityStreamService,
									  EntitlementValidator entitlementValidator, SqlSessionFactory sqlSessionFactory,
									  ContentTypeService contentTypeService) {
		this.transactionManager = transactionManager;
		this.studioConfiguration = studioConfiguration;
		this.siteService = siteService;
		this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
		this.publishService = publishService;
		this.permissionEvaluator = permissionEvaluator;
		this.itemService = itemService;
		this.itemDao = itemDao;
		this.generalLockService = generalLockService;
		this.dependencyService = dependencyService;
		this.contentRepository = contentRepository;
		this.contentLifecycle = contentLifecycle;
		this.auditService = auditService;
		this.assetLifecycle = assetLifecycle;
		this.servicesConfig = servicesConfig;
		this.activityStreamService = activityStreamService;
		this.entitlementValidator = entitlementValidator;
		this.sqlSessionFactory = sqlSessionFactory;
		this.contentTypeService = contentTypeService;
		this.pageNavOrderIncrement = studioConfiguration.getProperty(PAGE_NAVIGATION_ORDER_INCREMENT, Integer.class, DEFAULT_PAGE_NAV_ORDER_INCREMENT);
	}

	@Override
	public boolean contentExists(String siteId, String path) {
		return contentRepository.contentExists(siteId, path);
	}

	@Override
	public boolean shallowContentExists(String siteId, String path) {
		return contentRepository.shallowContentExists(siteId, path);
	}

	/**
	 * Get list of children for given path
	 *
	 * @param siteId       site identifier
	 * @param path         item path to children for
	 * @param locale       filter children by locale
	 * @param keyword      filter children by keyword
	 * @param systemTypes  filter children by type
	 * @param excludes     exclude items by path
	 * @param sortStrategy sort order
	 * @param order        ascending or descending
	 * @param offset       offset of the first child in the result
	 * @param limit        number of children to return
	 * @return list of children
	 */
	protected GetChildrenResult getChildrenByPath(String siteId, String path, String locale, String keyword,
												  List<String> systemTypes, List<String> excludes, String sortStrategy,
												  String order, int offset, int limit)
			throws ServiceLayerException, UserNotFoundException {
		if (!contentRepository.contentExists(siteId, path)) {
			throw new ContentNotFoundException(path, siteId, "Content not found at path " + path + " site " + siteId);
		}
		String parentFolderPath = CS.replace(path, SLASH_INDEX_FILE, "");
		Site site = siteService.getSite(siteId);
		int total = itemDao.getChildrenByPathTotal(site.getId(), parentFolderPath, locale, keyword, systemTypes,
				List.of(CONTENT_TYPE_LEVEL_DESCRIPTOR), excludes);
		List<ContentItem> resultSet = itemDao.getChildrenByPath(site.getId(), parentFolderPath,
				locale, keyword, systemTypes, List.of(CONTENT_TYPE_LEVEL_DESCRIPTOR),
				excludes,
				sortStrategy, order, offset, limit);

		processResultSet(siteId, resultSet);
		GetChildrenResult toRet = new GetChildrenResult();
		toRet.setChildren(resultSet);
		toRet.setLevelDescriptor(getLevelDescriptor(site, path, locale, keyword));
		toRet.setOffset(offset);
		toRet.setLimit(limit);
		toRet.setTotal(total);
		return toRet;
	}

	private ContentItem getLevelDescriptor(final Site site, final String path, final String locale, final String keyword) throws UserNotFoundException, ServiceLayerException {
		List<ContentItem> childItems = itemDao.getChildrenByPath(site.getId(), path,
				locale, keyword, List.of(CONTENT_TYPE_LEVEL_DESCRIPTOR), null, null,
				null, null, 0, 1);
		if (isEmpty(childItems)) {
			return null;
		}
		ContentItem levelDescriptorItem = childItems.getFirst();
		String user = getCurrentUsername();
		levelDescriptorItem.setAvailableActions(
				semanticsAvailableActionsResolver.calculateContentItemAvailableActions(user, site.getSiteId(), levelDescriptorItem));
		return levelDescriptorItem;
	}

	@Override
	public GetChildrenByPathsBulkResult getChildrenByPaths(String siteId, List<String> paths,
														   Map<String, PathParams> pathParams) throws UserNotFoundException, ServiceLayerException {
		List<ChildrenByPathResult> resultItems = new ArrayList<>(paths.size());

		Map<String, ContentItem> sandboxItemsByPath = getContentItemsByPath(siteId, paths, true).stream()
				.collect(toMap(ContentItem::getPath, identity()));
		List<String> missingItems = new LinkedList<>();
		for (PathParams params : pathParams.values()) {
			try {
				ChildrenByPathResult resultItem = new ChildrenByPathResult();
				resultItem.setPath(params.getPath());

				GetChildrenResult children = getChildrenByPath(siteId, params.getPath(), params.getLocaleCode(),
						params.getKeyword(), params.getSystemTypes(), params.getExcludes(), params.getSortStrategy(),
						params.getOrder(), params.getOffset(), params.getLimit());
				resultItem.setResult(children);
				resultItem.setItem(sandboxItemsByPath.get(params.getPath()));
				resultItems.add(resultItem);
			} catch (ContentNotFoundException e) {
				logger.error(format("Content not found at path %s site %s", params.getPath(), siteId), e);
				missingItems.add(params.getPath());
			}
		}
		return new GetChildrenByPathsBulkResult(resultItems, missingItems);
	}

	private void processResultSet(String siteId, List<ContentItem> resultSet)
			throws ServiceLayerException, UserNotFoundException {
		if (isEmpty(resultSet)) {
			return;
		}
		String user = getCurrentUsername();
		for (ContentItem child : resultSet) {
			child.setAvailableActions(
					semanticsAvailableActionsResolver.calculateContentItemAvailableActions(user, siteId, child));
		}
	}

	@Override
	public org.craftercms.core.service.Item getItem(String siteId, String path, boolean flatten) {
		return contentRepository.getItem(siteId, path, flatten);
	}

	@Override
	public long getContentSize(String siteId, String path) {
		return contentRepository.getContentSize(siteId, path);
	}

	@Override
	public List<ContentItem> getContentItemsByStates(String siteId, long statesBitMap, List<String> systemTypes, List<SortField> sortFields, int offset, int limit) throws UserNotFoundException, ServiceLayerException {
		List<ContentItem> items = itemDao.getContentItemsByStates(siteId, null, statesBitMap,
				systemTypes, mapSortFields(sortFields, ItemDAO.DETAILED_ITEM_SORT_FIELD_MAP), offset, limit);
		for (ContentItem item : items) {
			populateDetailedItemPropertiesFromRepository(siteId, item);
		}
		return items;
	}

	@Override
	public ContentItem getItemByPath(String siteId, String path, boolean preferContent)
			throws ServiceLayerException, UserNotFoundException {
		if (!contentRepository.contentExists(siteId, path)) {
			throw new ContentNotFoundException(path, siteId, format("Content not found at path '%s' site '%s'", path, siteId));
		}
		Site site = siteService.getSite(siteId);
		ContentItem item;
		if (preferContent) {
			item = itemDao.getContentItemByPathPreferContent(site.getId(), path);
		} else {
			item = itemDao.getContentItemByPath(site.getId(), path);
		}
		if (item == null) {
			throw new ContentNotFoundException(path, siteId, format("Content not found at path '%s' site '%s'", path, siteId));
		}
		populateDetailedItemPropertiesFromRepository(siteId, item);
		return item;
	}

	private void populateDetailedItemPropertiesFromRepository(String siteId, ContentItem item)
			throws ServiceLayerException, UserNotFoundException {
		if (Objects.nonNull(item)) {
			String user = getCurrentUsername();
			if (user != null) {
				item.setAvailableActions(
						semanticsAvailableActionsResolver.calculateContentItemAvailableActions(user, siteId, item));
			}
		}
	}

	@Override
	public List<ContentItem> getContentItemsByPath(String siteId, Collection<String> paths, boolean preferContent)
			throws ServiceLayerException, UserNotFoundException {
		Site site = siteService.getSite(siteId);
		List<ContentItem> items = itemDao.getContentItemsByPath(site.getId(), paths, preferContent);
		return calculatePossibleActions(siteId, items);
	}

	private List<ContentItem> calculatePossibleActions(String siteId, List<ContentItem> items)
			throws ServiceLayerException, UserNotFoundException {
		if (isEmpty(items)) {
			return emptyList();
		}
		List<ContentItem> toRet = new ArrayList<>();
		String user = getCurrentUsername();
		for (ContentItem item : items) {
			if (!contentRepository.contentExists(siteId, item.getPath())) {
				logger.warn("Content not found in site '{}' path '{}'", siteId, item.getPath());
			} else {
				if (user != null) {
					item.setAvailableActions(
							semanticsAvailableActionsResolver.calculateContentItemAvailableActions(user, siteId, item));
				}
				toRet.add(item);
			}
		}
		return toRet;
	}

	@Override
	public boolean isEditable(String itemPath, String mimeType) {
		List<String> editableMimeTypes =
				Arrays.asList(studioConfiguration.getArray(CONTENT_ITEM_EDITABLE_TYPES, String.class));

		MimeType itemMimeType;
		if (StringUtils.isEmpty(mimeType)) {
			itemMimeType = MimeType.valueOf(StudioUtils.getMimeType(itemPath));
		} else {
			itemMimeType = MimeType.valueOf(mimeType);
		}

		return editableMimeTypes.stream()
				.anyMatch(type -> (MimeType.valueOf(type)).isCompatibleWith(itemMimeType));
	}

	@Override
	public Optional<Resource> getContentByCommitId(String siteId, String path, String commitId)
			throws ServiceLayerException {
		return contentRepository.getContentByCommitId(siteId, path, commitId);
	}

	@Override
	public List<ItemVersion> getContentVersionHistory(final String siteId, final String path) throws ServiceLayerException {
		Site site = siteService.getSite(siteId);

		List<ItemVersion> history = contentRepository.getContentItemHistory(siteId, path);
		populateAuthor(site, history.stream().map(ItemVersion::getRepositoryVersion).toList(), path);
		return history;
	}

	/**
	 * Populate author information in the given history versions.
	 * This method extract the Studio user from the audit data in the DB.
	 *
	 * @param site    the site
	 * @param history the list of versions to populate author info
	 * @param path    the content path (null for repository history)
	 */
	private void populateAuthor(final Site site, final List<RepositoryVersion> history, final String path) {
		for (List<RepositoryVersion> batch : Lists.partition(history, FETCH_AUTHOR_FROM_COMMITS_BATCH_SIZE)) {
			List<String> commitIds = batch.stream()
					.map(RepositoryVersion::getVersionNumber)
					.filter(Objects::nonNull)
					.collect(toList());
			List<CommitAuthor> commitAuthors = auditService.getCommitAuthors(site.getId(), commitIds, path);
			Map<String, Person> authorsMap = commitAuthors.stream()
					.collect(toMap(CommitAuthor::getCommitId, CommitAuthor::getAuthor));
			for (RepositoryVersion version : batch) {
				String versionNumber = version.getVersionNumber();
				if (authorsMap.containsKey(versionNumber)) {
					version.setAuthor(authorsMap.get(versionNumber));
				}
			}
		}
	}

	@Override
	public Collection<RepositoryVersion> getHistory(String siteId, String start, int limit) throws ServiceLayerException {
		Site site = siteService.getSite(siteId);
		List<RepositoryVersion> history = contentRepository.getHistory(siteId, start, limit);
		populateAuthor(site, history, null);
		return history;
	}

	/**
	 * Run lifecycle script (for content descriptors) or asset pipeline (for assets)
	 * Return the LifecycleContent object
	 *
	 * @param siteId       the site id
	 * @param sourcePath   the source path for copy operations, null for write
	 * @param path         the path to write the content to
	 * @param content      the content to write, as an InputStream
	 * @param newItemLabel the new item label, if it has changed (e.g.: collision on an item copy)
	 */
	// TODO: Should we consider configuration files here?
	protected LifecycleContent runLifecycle(final String siteId, final String sourcePath, final String path,
											final ThrowingSupplier<InputStream> content, LifecycleOperation operation,
											final String newItemLabel) throws ServiceLayerException {
		logger.debug("Running lifecycle for site '{}' path '{}' operation '{}'", siteId, path, operation);
		ContentLifecycle lifecycle;
		LifecycleContent lifecycleContent;
		// Check if it is an asset
		if (underDescriptorRoot(path)) {
			try {
				logger.debug("Item at site '{}' path '{}' is a descriptor, updating XML and copying dependencies", siteId, path);
				Document document = convertStreamToXml(content.getWithException());
				if (document == null) {
					throw new InvalidParametersException("Content is not a valid XML document");
				}
				String contentType = document.getRootElement().valueOf(CONTENT_TYPE);
				if (NEW.equals(operation) && !contentTypeService.isContentTypeAllowed(siteId, path, contentType)) {
					throw new InvalidParametersException(format("Content type '%s' is not allowed at site '%s' for path '%s'", contentType, siteId, path));
				}
				if (isPageDescriptor(path)) {
					updateNavOrder(siteId, path, document, false);
				}
				Map<String, ContentWriteItem> dependencies = updateContentOnWrite(siteId, sourcePath, path, newItemLabel, operation, document.getRootElement());
				Path tempFile = createTempFile(path, document);
				lifecycleContent = new LifecycleContent(path, sourcePath, contentType, ofPath(() -> tempFile), operation, dependencies);
				lifecycle = contentLifecycle;
			} catch (DocumentException e) {
				logger.error("Error converting stream to XML for content at site '{}' path '{}'", siteId, path, e);
				throw new ServiceLayerException(format("Error converting stream to XML for site '%s' path '%s'", siteId, path), e);
			} catch (ServiceLayerException e) {
				logger.error("Failed to prepare lifecycleContent for site '{}' path '{}'", siteId, path, e);
				throw e;
			} catch (Exception e) {
				logger.error("Failed to prepare lifecycleContent for site '{}' path '{}'", siteId, path, e);
				throw new ServiceLayerException(format("Failed to prepare lifecycleContent for site '%s' path '%s'", siteId, path), e);
			}
		} else {
			logger.debug("Item at site '{}' path '{}' is an asset, preparing lifecycleContent", siteId, path);
			lifecycleContent = new LifecycleContent(path, sourcePath, null, ofStream(path, content), operation);
			lifecycle = assetLifecycle;
		}

		try {
			lifecycle.execute(siteId, lifecycleContent, this::loadContent);
		} catch (Exception e) {
			lifecycleContent.close();
			throw e;
		}

		return lifecycleContent;
	}

	/**
	 * Update the content XML with the new label and update the dependencies if needed.
	 *
	 * @param siteId   the site id
	 * @param path     the content path
	 * @param document the content XML document
	 * @param force    if true, the nav order will be updated even if it already has a value. This is used for move operations, where we want to update the nav order to the end of the list
	 * @return true if the document was updated and needs to be saved, false otherwise
	 * @throws ServiceLayerException if any error occurs during the update
	 */
	private boolean updateNavOrder(String siteId, String path, Document document, boolean force) throws ServiceLayerException {
		Element root = document.getRootElement();
		boolean placeInNav = Boolean.parseBoolean(readSingleDocumentFromXPath(root, PLACE_IN_NAV_XPATH));
		if (!placeInNav) {
			// Not placed in navigation, no need to update the order
			return false;
		}

		String order = readSingleDocumentNodeText(root, ELM_ORDER_DEFAULT);
		if (StringUtils.isNotEmpty(order) && !force) {
			// Order already exists, and we are not forcing the update, no need to update the order
			return false;
		}

		// ItemOrders for siblings of current item
		List<ItemOrder> itemsOrder = getItemsOrder(siteId, getParentUrl(path))
				.stream()
				.filter(item -> !CS.equals(path, item.getPath()))
				.toList();

		if (isEmpty(itemsOrder)) {
			// No siblings with order, set to default increment
			addOrUpdateSingleDocumentNode(root, ELM_ORDER_DEFAULT, String.valueOf(pageNavOrderIncrement));
		} else {
			// If there are other nav items, set item as last: order to the max order + default increment
			ItemOrder maxOrderItem = itemsOrder.getLast();
			double newOrder = maxOrderItem.getOrder() + pageNavOrderIncrement;
			addOrUpdateSingleDocumentNode(root, ELM_ORDER_DEFAULT, String.valueOf(newOrder));
		}

		return true;
	}

	/**
	 * Update the XML content objectId and groupId fields
	 */
	protected void updateObjectIds(Element root, ContentItemIds itemIds) {
		addOrUpdateSingleDocumentNode(root, ELM_OBJECT_ID, itemIds.objectId);
		addOrUpdateSingleDocumentNode(root, ELM_GROUP_ID, itemIds.groupId);
	}

	/**
	 * Validate the lifecycle affected paths
	 * Results are valid if:
	 * - The list is not empty
	 * - The user has write permission for the paths
	 * - The items are not in workflow. Notice that for move operations (sourcePath != null) the source path children
	 * will be checked for workflow as well
	 *
	 * @param siteId        the site id
	 * @param sourcePath    the source content path for move or delete operations
	 * @param targetPath    the path to write the content to
	 * @param affectedPaths the root paths affected by this operation
	 * @throws ServiceLayerException          if the list is empty
	 * @throws ContentInPublishQueueException if any of the items is in the publish queue
	 * @throws ActionDeniedException          if the user does not have write permission
	 */
	private void validateLifecycleResults(String siteId, String sourcePath, String targetPath, List<String> affectedPaths)
			throws ServiceLayerException, ActionDeniedException {
		// Check list is not empty or throw exception  (can't write empty set)
		if (affectedPaths.isEmpty()) {
			throw new ServiceLayerException(format("Item list after lifecycle processing is empty, nothing to write for site '%s' path '%s'", siteId, targetPath));
		}

		Map<String, Object> resource = Map.of(SITE_ID_RESOURCE_ID, siteId, PATH_LIST_RESOURCE_ID, affectedPaths);
		if (!permissionEvaluator.isAllowed(getCurrentUsername(), resource, PERMISSION_CONTENT_WRITE)) {
			throw new ActionDeniedException(PERMISSION_CONTENT_WRITE, affectedPaths);
		}

		// Check permissions for the oldPath for move operations
		if (sourcePath != null) {
			Map<String, Object> deleteResource = Map.of(SITE_ID_RESOURCE_ID, siteId, PATH_RESOURCE_ID, sourcePath);
			if (!permissionEvaluator.isAllowed(getCurrentUsername(), deleteResource, PERMISSION_CONTENT_DELETE)) {
				throw new ActionDeniedException(PERMISSION_CONTENT_DELETE, sourcePath);
			}
			assertNotInWorkflow(siteId, List.of(sourcePath), true);
			// Validate "not in workflow" for all affected paths outside of target
			List<String> externalAffectedPaths = affectedPaths.stream()
					.filter(p -> !directoryContains(targetPath, p))
					.filter(p -> !directoryContains(sourcePath, p))
					.toList();
			assertNotInWorkflow(siteId, externalAffectedPaths, false);
		} else {
			// Fail to continue the write operation if the item is in workflow
			assertNotInWorkflow(siteId, affectedPaths, false);
		}
	}

	/**
	 * Tries to set the system processing flag for the given site and path. If the flag is already set, it throws an exception.
	 *
	 * @param site  the site
	 * @param paths the path
	 * @throws ServiceLayerException if the flag is already set
	 */
	private void trySetSystemProcessing(final String site, final Collection<String> paths) throws ServiceLayerException {
		if (itemService.isSystemProcessing(site, paths)) {
			throw new ServiceLayerException(format("Failed to set system processing for content at site '%s' path '%s' " +
							"because state is already system processing",
					site, paths));
		}
		itemService.setSystemProcessingBulk(site, paths, true);
	}

	@Override
	public WriteContentResult write(final String siteId, final String path, final InputStream content, String comment)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		LifecycleOperation operation = contentExists(siteId, path) ? UPDATE : NEW;
		return doWrite(siteId, path, content, operation, comment);
	}

	/**
	 * Run a write operation in a transaction.
	 * This method will re-throw any exception of type ServiceLayerException, ActionDeniedException,AuthenticationException, UserNotFoundException,
	 * and wrap any other exception in a ServiceLayerException
	 *
	 * @param transactionId the transaction id
	 * @param supplier      the operation to run
	 * @param <T>           the type of the result
	 * @return the result of the operation
	 * @throws ServiceLayerException   if an error occurs
	 * @throws ActionDeniedException   if the user does not have permission
	 * @throws AuthenticationException if the user is not authenticated
	 * @throws UserNotFoundException   if the user is not found
	 */
	protected <T> T runWriteInTransaction(String transactionId, ThrowingSupplier<T> supplier)
			throws ServiceLayerException, ActionDeniedException, AuthenticationException, UserNotFoundException {
		return runWriteInTransaction(transactionId, null, supplier);
	}

	/**
	 * Run a write operation in a transaction.
	 * This method will re-throw any exception of type ServiceLayerException, ActionDeniedException,AuthenticationException, UserNotFoundException,
	 * and wrap any other exception in a ServiceLayerException
	 *
	 * @param transactionId  the transaction id
	 * @param isolationLevel the isolation level for the transaction, defaults to {@link org.springframework.transaction.TransactionDefinition#ISOLATION_DEFAULT} if null
	 * @param supplier       the operation to run
	 * @param <T>            the type of the result
	 * @return the result of the operation
	 * @throws ServiceLayerException   if an error occurs
	 * @throws ActionDeniedException   if the user does not have permission
	 * @throws AuthenticationException if the user is not authenticated
	 * @throws UserNotFoundException   if the user is not found
	 */
	protected <T> T runWriteInTransaction(String transactionId, Integer isolationLevel, ThrowingSupplier<T> supplier)
			throws ServiceLayerException, ActionDeniedException, AuthenticationException, UserNotFoundException {
		try {
			return DBUtils.runInTransaction(transactionManager, transactionId, isolationLevel, supplier);
		} catch (ServiceLayerException | ActionDeniedException | AuthenticationException | UserNotFoundException e) {
			throw e;
		} catch (Exception e) {
			throw new ServiceLayerException("Error during write transaction " + transactionId, e);
		}
	}

	protected WriteContentResult doRevert(final String siteId, final String path,
										  final InputStream content)
			throws UserNotFoundException, AuthenticationException, ServiceLayerException {
		return doWrite(siteId, path, content, REVERT, null);
	}

	protected WriteContentResult doWrite(final String siteId, final String path,
										 final InputStream content, final LifecycleOperation operation, final String comment)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		WriteContentResult writeContentResult;
		String sandboxRepoLockKey = getSandboxRepoLockKey(siteId);
		generalLockService.lock(sandboxRepoLockKey);
		try {
			Set<String> affectedPaths = new HashSet<>();
			trySetSystemProcessing(siteId, List.of(path));
			affectedPaths.add(path);
			try (content; LifecycleContent lifecycleContent = runLifecycle(siteId, null, path, () -> content, operation, null)) {
				Map<String, ContentLifecycleItem> lifecycleResultItems = lifecycleContent.getItems();
				validateLifecycleResults(siteId, null, path, new ArrayList<>(lifecycleResultItems.keySet()));
				Set<String> lifecycleItemPaths = lifecycleResultItems.values().stream()
						.map(ContentLifecycleItem::repoPath)
						.filter(p -> !affectedPaths.contains(p)) // Do not add path again
						.collect(toSet());
				// 'path' is already system_processing
				trySetSystemProcessing(siteId, lifecycleItemPaths);
				affectedPaths.addAll(lifecycleItemPaths);
				String transactionId = format(WRITE_TRANSACTION_FORMAT, siteId);
				writeContentResult = runWriteInTransaction(transactionId,
						() -> writeInternal(siteId, path, lifecycleContent, comment));
			} catch (IOException e) {
				logger.error("Failed to write content at site '{}' path '{}'", siteId, path, e);
				throw new ServiceLayerException(format("Failed to write content at site '%s' path '%s'", siteId, path), e);
			} catch (Exception e) {
				logger.error("Failed to write content at site '{}' path '{}'", siteId, path, e);
				throw e;
			} finally {
				itemService.setSystemProcessingBulk(siteId, affectedPaths, false);
			}
		} finally {
			generalLockService.unlock(sandboxRepoLockKey);
		}

		// Publish events
		eventPublisher.publishEvent(new SyncFromRepoEvent(siteId));
		eventPublisher.publishEvent(new ContentEvent(getAuthentication(), siteId, path));

		return writeContentResult;
	}

	@Override
	public PasteContentResult copy(final String siteId, final String from,
								   final String initialTargetPath, final Set<String> itemPaths)
			throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		return doCopy(siteId, from, initialTargetPath, itemPaths, COPY);
	}

	/**
	 * This is just an extra method for the copy operation with an extra
	 * {@link LifecycleOperation} parameter.
	 * This is meant to be consumed by the copy and duplicate operations.
	 */
	protected PasteContentResult doCopy(final String siteId, final String from,
										final String initialTargetPath, final Set<String> itemPaths,
										final LifecycleOperation operation)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		PastedPath pastedPath = constructNewPathForCutCopy(siteId, from, initialTargetPath);
		String to = pastedPath.path;
		if (!contentExists(siteId, from)) {
			throw new ContentNotFoundException(from, siteId, format("Content not found at path '%s' in site '%s'", from, siteId));
		}
		if (contentExists(siteId, to)) {
			throw new ContentExistException(format("Content '%s' in siteId '%s', cannot be copied " +
					"because an item already exists in target location '%s'.", from, siteId, to));
		}
		String sourcePath;
		String targetPath;
		if (isPageDescriptor(from) || isPageDescriptor(to)) {
			// Normalize the paths. If we're moving a page we need to move the folder anyway
			sourcePath = CS.removeEnd(from, SLASH_INDEX_FILE);
			targetPath = CS.removeEnd(to, SLASH_INDEX_FILE);
		} else {
			sourcePath = from;
			targetPath = to;
		}
		PasteContentResult pasteResult;
		String sandboxRepoLockKey = getSandboxRepoLockKey(siteId);
		generalLockService.lock(sandboxRepoLockKey);
		try {
			Collection<LifecycleContent> lifecycleContents = new ArrayList<>(itemPaths.size());
			try {
				validateCopyOperation(siteId, sourcePath, targetPath, itemPaths);
				Site site = siteService.getSite(siteId);
				for (String itemPath : itemPaths) {
					if (contentRepository.isFolder(siteId, itemPath)) {
						// No content lifecycle for a folder
						continue;
					}
					boolean isRootItem = CS.equals(sourcePath, CS.removeEnd(itemPath, SLASH_INDEX_FILE));
					String newPath = movePath(sourcePath, targetPath, itemPath);
					LifecycleContent lifecycleContent = runLifecycle(siteId, itemPath, newPath,
							() -> loadContent(siteId, itemPath), operation, isRootItem ? pastedPath.newLabel : null);
					lifecycleContents.add(lifecycleContent);
				}

				String transactionId = format(COPY_TRANSACTION_FORMAT, siteId);
				pasteResult = runWriteInTransaction(transactionId, ISOLATION_READ_COMMITTED,
						() -> copyInternal(site, sourcePath, targetPath, lifecycleContents, itemPaths, pastedPath.newLabel, operation));
			} finally {
				closeCollection(lifecycleContents);
			}
		} catch (Exception e) {
			logger.error("Failed to copy content from '{}' to '{}' in site '{}'", sourcePath, targetPath, siteId, e);
			throw e;
		} finally {
			generalLockService.unlock(sandboxRepoLockKey);
		}

		// Publish events
		eventPublisher.publishEvent(new SyncFromRepoEvent(siteId));
		eventPublisher.publishEvent(new ContentEvent(getAuthentication(), siteId, targetPath));

		return pasteResult;
	}

	@Override
	public PasteContentResult duplicate(String siteId, String path) throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		String parentUrl = getParentUrl(path);

		return doCopy(siteId, path, parentUrl, of(path), DUPLICATE);
	}

	@Override
	public void revert(String siteId, String path, String commitId) throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		InputStream content;
		try {
			content = contentRepository.getContentByCommitId(siteId, path, commitId)
					.orElseThrow(() -> new ContentNotFoundException(path, siteId,
							format("Content not found at path '%s' in site '%s' for commit '%s'", path, siteId, commitId)))
					.getInputStream();
		} catch (IOException e) {
			logger.error("Failed to load content for revert at site '{}' path '{}' commit '{}'", siteId, path, commitId, e);
			throw new ServiceLayerException(format("Failed to load content for revert at site '%s' path '%s' commit '%s'", siteId, path, commitId), e);
		}
		doRevert(siteId, path, content);
	}

	@Override
	public WriteContentResult createFolder(String siteId, String path) throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		validateEntitlements();
		WriteContentResult writeContentResult;
		String sandboxRepoLockKey = getSandboxRepoLockKey(siteId);
		generalLockService.lock(sandboxRepoLockKey);
		try {
			if (contentExists(siteId, path)) {
				throw new ContentExistException(format("Content '%s' in siteId '%s', cannot be created " +
						"because an item already exists in target location '%s'.", path, siteId, path));
			}
			String parentPath = getParentUrl(path);
			if (!contentExists(siteId, parentPath)) {
				throw new ContentNotFoundException(parentPath, siteId, format("Parent content not found at path '%s' in site '%s'", parentPath, siteId));
			}
			String transactionId = format(CREATE_FOLDER_TRANSACTION_FORMAT, siteId);
			writeContentResult = runWriteInTransaction(transactionId,
					() -> createFolderInternal(siteId, path));
		} catch (Exception e) {
			logger.error("Failed to create folder at site '{}' path '{}'", siteId, path, e);
			throw e;
		} finally {
			generalLockService.unlock(sandboxRepoLockKey);
		}

		eventPublisher.publishEvent(new SyncFromRepoEvent(siteId));
		eventPublisher.publishEvent(new ContentEvent(getAuthentication(), siteId, path));

		return writeContentResult;
	}

	@Override
	public void processCreatedFiles(Site site, User creator) throws ServiceLayerException {
		String siteId = site.getSiteId();
		ZonedDateTime now = ZonedDateTime.now();
		logger.debug("Processing created files for site '{}'", siteId);

		MutableLong itemCount = new MutableLong(0);
		try (SqlSession sqlSession = sqlSessionFactory.openSession(ExecutorType.BATCH)) {
			ItemDAO itemDao = sqlSession.getMapper(ItemDAO.class);
			DependencyDAO dependencyDao = sqlSession.getMapper(DependencyDAO.class);
			ThrowingRunnable checkCounter = getCheckCounterFunction(sqlSession, itemCount, siteId);
			contentRepository.forAllSitePaths(siteId,
					directory -> {
						processCreatedDirectory(itemDao, site.getSiteId(), directory, creator.getId(), now);
						checkCounter.run();
					},
					file -> {
						processCreatedFile(itemDao, dependencyDao, sqlSession, site, file, creator.getId(), now);
						checkCounter.run();
					}
			);
			logger.debug("Update parent ID for created items for site '{}'", siteId);
			itemDao.updateParentIdForSite(site.getId());
			logger.debug("Validate dependencies for site '{}'", siteId);
			dependencyDao.validateDependenciesForSite(siteId);
			sqlSession.flushStatements();
		} catch (Exception e) {
			logger.error("Failed to update database for processing created files in site '{}'", siteId, e);
			throw new ServiceLayerException(format("Failed to update database for processing created files in site '%s'", siteId), e);
		}
		logger.debug("Finished processing created files for site '{}'", siteId);
	}

	@Override
	public List<ItemOrder> getItemsOrder(String siteId, String parentPath) throws ServiceLayerException {
		Site site = siteService.getSite(siteId);
		List<ContentItem> pages = itemDao.getChildrenByPath(site.getId(), parentPath, null, null,
				List.of(CONTENT_TYPE_PAGE), null, null, null, null, 0, MAX_CHILDREN_FOR_GET_NAV_ORDER);
		List<ItemOrder> result = new ArrayList<>(pages.size());
		for (ContentItem child : pages) {
			try {
				Double order = getItemOrder(siteId, child.getPath());
				if (order != null) {
					ItemOrder itemOrder = new ItemOrder(child.getPath(), child.getLabel(), order);
					result.add(itemOrder);
				}
			} catch (NumberFormatException e) {
				logger.debug("Invalid order value for site '{}' path '{}', skipping item in order calculation", siteId, child.getPath(), e);
			}
		}
		result.sort(Comparator.comparingDouble(ItemOrder::getOrder));
		return result;
	}

	protected Double getItemOrder(String siteId, String path) throws ServiceLayerException {
		Document document;
		try {
			document = convertStreamToXml(contentRepository.getContent(siteId, path));
		} catch (DocumentException e) {
			throw new ServiceLayerException(format("Error converting stream to XML for content at site '%s' path '%s'", siteId, path), e);
		}

		Element rootElement = document.getRootElement();
		boolean placeInNav = Boolean.parseBoolean(rootElement.valueOf(PLACE_IN_NAV_XPATH));
		if (!placeInNav) {
			logger.debug("placeInNav is false for site '{}' path '{}', skipping order retrieval", siteId, path);
			return null;
		}

		String orderString = rootElement.valueOf(DEFAULT_ORDER_XPATH);
		Double order = null;
		try {
			if (isNotBlank(orderString)) {
				order = Double.parseDouble(orderString);
			}
		} catch (NumberFormatException e) {
			logger.debug("Invalid order value '{}' for site '{}' path '{}'", orderString, siteId, path, e);
		}
		return order;
	}

	@Override
	public double reorderItem(String siteId, ReorderItemRequest request) throws ServiceLayerException {
		return switch (request) {
			case ReorderItemRequest.AddBefore addBefore -> reorderItem(siteId, null, addBefore.getReferencePath());
			case ReorderItemRequest.AddAfter addAfter -> reorderItem(siteId, addAfter.getReferencePath(), null);
			case ReorderItemRequest.Insert insert ->
					reorderItem(siteId, insert.getPreviousPath(), insert.getNextPath());
		};
	}

	/**
	 * Calculate the order value for an item being reordered based on the order values of the previous and next items.
	 *
	 * @param siteId       the site id
	 * @param previousPath the path of the previous item, null if it should be before a reference item
	 * @param nextPath     the path of the next item, null if it should be after a reference item
	 * @return the new order value for the item being reordered
	 * @throws ContentNotFoundException   if any of the previous or next items does not exist
	 * @throws InvalidParametersException if the order values of the previous or next items are not valid, or if the previous item order is greater or equal to the next item order
	 */
	protected double reorderItem(String siteId, String previousPath, String nextPath) throws ServiceLayerException {
		String previousParent = getParentUrl(previousPath);
		String nextParent = getParentUrl(nextPath);
		if (previousPath != null && nextPath != null && !CS.equals(previousParent, nextParent)){
			throw new InvalidParametersException(format("Previous item '%s' and next item '%s' for site '%s' do not have the same parent, cannot reorder item",
					previousPath, nextPath, siteId));
		}

		Double beforeOrder = null;
		if (previousPath != null) {
			beforeOrder = getItemOrder(siteId, previousPath);
			if (beforeOrder == null) {
				throw new InvalidParametersException(format("Previous item '%s' for site '%s' does not have an order value, cannot reorder item", previousPath, siteId));
			}
		}
		Double afterOrder = null;
		if (nextPath != null) {
			afterOrder = getItemOrder(siteId, nextPath);
			if (afterOrder == null) {
				throw new InvalidParametersException(format("Next item '%s' for site '%s' does not have an order value, cannot reorder item", nextPath, siteId));
			}
		}
		if (beforeOrder != null && afterOrder != null) {
			if (beforeOrder >= afterOrder) {
				throw new InvalidParametersException(format("Invalid order for site '%s' previousPath '%s' and nextPath '%s'", siteId, previousPath, nextPath));
			}
			return (beforeOrder + afterOrder) / 2;
		}

		if (beforeOrder != null) {
			return beforeOrder + pageNavOrderIncrement;
		}

		return afterOrder - pageNavOrderIncrement;
	}

	/**
	 * Return a Runnable that will check if the counter has exceeded the batch size and if so,
	 * execute the queries and reset the counter
	 *
	 * @param sqlSession sql session instance
	 * @param counter    The counter to check
	 * @return runnable
	 */
	private ThrowingRunnable getCheckCounterFunction(final SqlSession sqlSession, final MutableLong counter, final String siteId) {
		return () -> {
			counter.increment();
			if (counter.longValue() >= MY_BATIS_QUERY_BATCH_SIZE) {
				logger.debug("Executing batch of items for site '{}'", siteId);
				sqlSession.flushStatements();
				logger.debug("Executed batch of items for site '{}'", siteId);
				counter.setValue(0);
			}
		};
	}

	private void processCreatedDirectory(ItemDAO itemDao, String siteId, String directory,
										 long userId, ZonedDateTime now) {
		String label = new File(directory).getName();
		Item item = itemService.instantiateItem(siteId, directory)
				.withPreviewUrl(null)
				.withState(0L)
				.withLockedBy(null)
				.withCreatedBy(userId)
				.withCreatedOn(now)
				.withLastModifiedBy(userId)
				.withLastModifiedOn(now)
				.withLastPublishedOn(null)
				.withLabel(label)
				.withContentTypeId(null)
				.withSystemType(CONTENT_TYPE_FOLDER)
				.withMimeType(null)
				.withLocaleCode(Locale.US.toString())
				.withTranslationSourceId(null)
				.withSize(0L)
				.build();
		itemDao.upsertEntry(item);
	}

	private void processCreatedFile(ItemDAO itemDao, DependencyDAO dependencyDao, SqlSession sqlSession,
									Site site, String path, long userId, ZonedDateTime now) throws SiteNotFoundException {
		// Item
		String label = FilenameUtils.getName(path);
		String contentTypeId = EMPTY;
		boolean disabled = false;
		boolean savedAsDraft = false;
		if (CS.endsWith(path, XML_PATTERN)) {
			try {
				Document contentDoc = ContentUtils.convertStreamToXml(getContent(site.getSiteId(), path));
				if (contentDoc != null) {
					Element rootElement = contentDoc.getRootElement();
					String internalName = rootElement.valueOf(DOCUMENT_ELM_INTERNAL_TITLE);
					if (StringUtils.isNotEmpty(internalName)) {
						label = internalName;
					}
					contentTypeId = rootElement.valueOf(DOCUMENT_ELM_CONTENT_TYPE);
					disabled = Boolean.parseBoolean(rootElement.valueOf(DOCUMENT_ELM_DISABLED));
					savedAsDraft = Boolean.parseBoolean(rootElement.valueOf(DOCUMENT_ELM_SAVED_AS_DRAFT));
				}
			} catch (DocumentException | ContentNotFoundException e) {
				logger.error("Failed to extract metadata from XML file at site '{}' path '{}'",
						site.getSiteId(), path, e);
			}
		}
		String previewUrl = null;
		if (CS.startsWith(path, ROOT_PATTERN_PAGES) ||
				CS.startsWith(path, ROOT_PATTERN_ASSETS)) {
			previewUrl = itemService.getBrowserUrl(site.getSiteId(), path);
		}
		long state = ItemState.NEW.value;
		if (disabled) {
			state = state | ItemState.DISABLED.value;
		}

		if (!ArrayUtils.contains(IGNORE_FILES, FilenameUtils.getName(path))) {
			Item item = itemService.instantiateItem(site.getSiteId(), path)
					.withPreviewUrl(previewUrl)
					.withState(state)
					.withLockedBy(null)
					.withCreatedBy(userId)
					.withCreatedOn(now)
					.withLastModifiedBy(userId)
					.withLastModifiedOn(now)
					.withLastPublishedOn(null)
					.withLabel(label)
					.withContentTypeId(contentTypeId)
					.withSystemType(getContentTypeClass(servicesConfig, studioConfiguration, site.getSiteId(), path))
					.withMimeType(StudioUtils.getMimeType(FilenameUtils.getName(path)))
					.withLocaleCode(Locale.US.toString())
					.withTranslationSourceId(null)
					.withSize(contentRepository.getContentSize(site.getSiteId(), path))
					.withSavedAsDraft(savedAsDraft)
					.build();
			itemDao.upsertEntry(item);

			DependencyUtils.updateDependencies(site.getSiteId(), path, null, dependencyService, dependencyDao,
					sqlSession, false, false);
		}
	}


	private WriteContentResult createFolderInternal(String siteId, String path)
			throws UserNotFoundException, ServiceLayerException, AuthenticationException {
		String commitId = contentRepository.createFolder(siteId, path);

		WriteContentResult writeContentResult = new WriteContentResult(commitId, List.of(new WriteContentResultItem(path, NEW, false)));
		if (StringUtils.isEmpty(commitId)) {
			return writeContentResult;
		}

		logger.debug("Persisting folder creation in the database for site '{}' path '{}'", siteId, path);
		persistNewFolder(siteId, path);

		insertContentAudit(siteId, path, commitId, NEW, writeContentResult);
		return writeContentResult;
	}

	/**
	 * Get the copy dependencies for the given item path.
	 * Notice that this method is indirectly recursive, as it will call {@link #updateContentOnWrite(String, String, String, String, LifecycleOperation, Element)}
	 *
	 * @param siteId             the site id
	 * @param sourcePath         the source path
	 * @param targetPath         the target path
	 * @param oldContentIds      the old content ids for the item being copied
	 * @param newContentItemIds  the new content ids for the item being copied
	 * @param root               the root element of the XML document
	 * @param copiedDependencies a map to store the copied dependencies
	 * @throws SiteNotFoundException if the site is not found
	 */
	protected void getCopyDependencies(String siteId, String sourcePath, String targetPath,
									   ContentItemIds oldContentIds, ContentItemIds newContentItemIds,
									   Element root, Map<String, ContentWriteItem> copiedDependencies,
									   LifecycleOperation operation)
			throws ServiceLayerException, DocumentException, IOException {
		logger.debug("Getting copy dependencies for item '{}' in site '{}'", targetPath, siteId);
		Map<String, String> dependencyMappings = getCopyDependencyMapping(siteId, sourcePath, oldContentIds, newContentItemIds, root);
		if (dependencyMappings.isEmpty()) {
			logger.debug("No copy dependencies found for item '{}' in site '{}'", targetPath, siteId);
			return;
		}

		for (Entry<String, String> dependencyMapping : dependencyMappings.entrySet()) {
			logger.debug("Generate a target path for the copied dependency '{}' in site '{}'", dependencyMapping.getKey(), siteId);
			PastedPath pastedPath = constructNewPathForCutCopy(siteId, dependencyMapping.getKey(), dependencyMapping.getValue());
			// Update the references in the XML document to point to the new dependency path
			logger.debug("Updating references for copied dependency '{}' -> '{}' in site '{}'", dependencyMapping.getKey(), pastedPath.path, siteId);
			updateReferences(root, dependencyMapping.getKey(), pastedPath.path);
			ThrowingSupplier<InputStream> contentSupplier;
			if (isDescriptor(pastedPath.path)) {
				Document dependencyDocument = convertStreamToXml(loadContent(siteId, dependencyMapping.getKey()));
				copiedDependencies.putAll(updateContentOnWrite(siteId, dependencyMapping.getKey(), pastedPath.path, pastedPath.newLabel, operation, dependencyDocument.getRootElement()));
				Path depTempPath = createTempFile(pastedPath.path, dependencyDocument);
				contentSupplier = () -> new FileInputStream(depTempPath.toFile());
			} else {
				contentSupplier = () -> loadContent(siteId, dependencyMapping.getKey());
			}
			copiedDependencies.put(pastedPath.path, new ContentWriteItem() {
				@Override
				public String repoPath() {
					return pastedPath.path;
				}

				@Override
				public InputStream content() throws IOException {
					try {
						return contentSupplier.getWithException();
					} catch (Exception e) {
						throw new IOException(format("Failed to load content for copy dependency '%s' in site '%s'", pastedPath.path, siteId), e);
					}
				}
			});
		}
	}

	/**
	 * Update the references in the XML document to point to the new dependency path.
	 *
	 * @param root       the root element of the XML document
	 * @param oldDepPath the old dependency path to be replaced
	 * @param newDepPath the new dependency path to replace the old one with
	 */
	protected void updateReferences(Element root, String oldDepPath, String newDepPath) {
		List<Node> includes = root.selectNodes(COPY_DEP_XPATH.replace(COPY_DEP, oldDepPath));
		if (includes != null) {
			for (Node includeNode : includes) {
				includeNode.setText(includeNode.getText().replace(oldDepPath, newDepPath));
			}
		}
	}

	/**
	 * Get a mapping of copy dependencies for the item.
	 * The keys of the map are the source dependency paths to be copied,
	 * and the values are the target directories where the dependencies will be copied to.
	 */
	protected Map<String, String> getCopyDependencyMapping(String siteId, String sourcePath,
														   ContentItemIds oldContentIds, ContentItemIds newContentItemIds,
														   Element root)
			throws ServiceLayerException {
		Map<String, String> copyDependencies = new HashMap<>();
		List<LightItem> itemSpecificDependencies = dependencyService.getItemSpecificDependencies(siteId, List.of(sourcePath));
		for (LightItem itemSpecificDependency : itemSpecificDependencies) {
			// Use the same parent
			String depTargetPath = getFullPathNoEndSeparator(itemSpecificDependency.getPath());
			copyDependencies.put(itemSpecificDependency.getPath(), replaceContentIdsInPath(depTargetPath, oldContentIds, newContentItemIds));
		}

		String contentTypeId = readSingleDocumentNodeText(root, CONTENT_TYPE);
		ContentType contentType = contentTypeService.getContentType(siteId, contentTypeId);
		List<CopyDependency> copyDepConfigs = contentType.getCopyDependencies();

		if (copyDepConfigs.isEmpty()) {
			return copyDependencies; // No copy dependencies config to process
		}
		Collection<String> allDependencies = dependencyService.getDependencyPaths(siteId, sourcePath);
		for (String dependency : allDependencies) {
			String dependencyPath = dependency;
			if (copyDependencies.containsKey(dependencyPath)) {
				// Skip if already included (some of these are item-specific processed above)
				continue;
			}
			copyDepConfigs.stream()
					.filter(copyDepConfig -> dependencyPath.matches(copyDepConfig.pattern()))
					.map(CopyDependency::target)
					.findAny()
					.map(t -> replaceContentIdsInPath(t, oldContentIds, newContentItemIds))
					.ifPresent(t -> copyDependencies.put(dependencyPath, t));
		}

		return copyDependencies;
	}

	/**
	 * Replace the content IDs in the given path.
	 */
	protected String replaceContentIdsInPath(String path, ContentItemIds oldContentIds, ContentItemIds newContentItemIds) {
		return path.replaceAll(oldContentIds.objectId(), newContentItemIds.objectId())
				.replaceAll(oldContentIds.groupId, newContentItemIds.groupId);
	}

	/**
	 * Internal method to copy content from one path to another.
	 *
	 * @param site              the site
	 * @param sourcePath        the root source path for the copy operation
	 * @param targetPath        the root target path for the copy operation
	 * @param lifecycleContents the lifecycle contents (already processed)
	 * @param sourceItemPaths   the list of source item paths to copy (this is used to persist the copy operation)
	 * @param newLabel          the new label for the root item in the target path, if it has changed
	 * @param operation         the lifecycle operation to perform (COPY or DUPLICATE)
	 * @return the {@link PasteContentResult} containing the results of the operation
	 * @throws ServiceLayerException   if the copy operation fails
	 * @throws UserNotFoundException   if the user is not found
	 * @throws AuthenticationException if the user is not authenticated
	 */
	protected PasteContentResult copyInternal(Site site, String sourcePath, String targetPath,
											  Collection<LifecycleContent> lifecycleContents, Set<String> sourceItemPaths,
											  String newLabel, LifecycleOperation operation)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException, DocumentException, IOException {
		String siteId = site.getSiteId();
		Set<String> sourcePathChildren = new HashSet<>(itemDao.getChildrenPaths(site.getId(), sourcePath));
		if (!ContentUtils.areSiblings(sourcePath, targetPath)) {
			// If the parent is the same, let's keep the nav order the same (so copy and original will be next to each other in the nav)
			updateNavOrderForCopyOrMove(siteId, targetPath, lifecycleContents, sourcePathChildren);
		}
		Map<String, ContentLifecycleItem> lifecycleItems = mergeLifecycleContents(lifecycleContents);
		Map<String, ContentWriteItem> dependencies =
				lifecycleContents.stream()
						.map(LifecycleContent::getDependencies)
						.collect(HashMap::new, HashMap::putAll, Map::putAll);
		// Source path is null since copy does not affect the source path
		validateLifecycleResults(siteId, null, targetPath, getMoveOrCopyWorkflowAffectedPaths(targetPath, lifecycleItems));
		Map<String, LifecycleOperation> operationsByPath = getOperationsByPath(siteId, sourceItemPaths, lifecycleItems.values(), operation);
		validateEntitlements(operationsByPath);
		Set<String> newFolders = getMissingFoldersForCopyOrMove(siteId, lifecycleItems.values());
		Map<String, ContentWriteItem> additionalItems = calculateAdditionalItemsForCopyOrMove(lifecycleItems);
		additionalItems.putAll(dependencies);
		for (String copyDependencyPath : dependencies.keySet()) {
			newFolders.addAll(calculateMissingFolders(siteId, copyDependencyPath));
		}

		String commitId = contentRepository.copy(siteId, sourcePath, targetPath, additionalItems.values(), newFolders);
		List<WriteContentResultItem> copyResultItems = lifecycleItems.values().stream()
				.map(i -> new WriteContentResultItem(i.repoPath(), operationsByPath.get(i.repoPath()), i.amended()))
				.toList();
		PasteContentResult pasteResult = new PasteContentResult(commitId, copyResultItems, targetPath);
		if (StringUtils.isEmpty(commitId)) {
			return pasteResult;
		}

		persistCopyToDB(site, sourcePath, targetPath, additionalItems, newFolders, operationsByPath, sourceItemPaths, newLabel);

		insertContentAudit(siteId, sourcePath, targetPath, operation, pasteResult);
		return pasteResult;
	}

	/**
	 * Persist the copy operation to the database.
	 * This method will insert the copied items into the database
	 */
	protected void persistCopyToDB(Site site, String sourcePath, String targetPath,
								   Map<String, ContentWriteItem> additionalItems, Set<String> newFolders,
								   Map<String, LifecycleOperation> operationsByPath, Set<String> sourceItemPaths,
								   String rootItemNewLabel)
			throws UserNotFoundException, AuthenticationException, ServiceLayerException {
		String siteId = site.getSiteId();
		String parentUrl = getFullPathNoEndSeparator(targetPath);
		Item parentItem = itemService.getItem(siteId, parentUrl, true);
		String label = null;
		if (!underDescriptorRoot(targetPath) || !targetPath.endsWith(DmConstants.XML_PATTERN)) {
			label = getName(targetPath);
		}
		persistItemCopy(siteId, sourcePath, targetPath, parentItem.getId(), label);

		String targetPageUrl = targetPath + SLASH_INDEX_FILE;
		String sourcePageUrl = sourcePath + SLASH_INDEX_FILE;
		if (isPageDescriptor(targetPageUrl) && contentExists(site.getSiteId(), targetPageUrl)) {
			persistItemCopy(siteId, sourcePageUrl, targetPageUrl, parentItem.getId(), rootItemNewLabel);
		}

		Set<String> targetItemPaths = new HashSet<>(sourceItemPaths.size());
		// Get all source item paths, excluding the source path and the source page URL.
		// Those are already persisted separately above, since they might have updated labels
		for (String sourceItemPath : difference(sourceItemPaths, of(sourcePath, sourcePageUrl))) {
			String targetItemPath = movePath(sourcePath, targetPath, sourceItemPath); // Normalize the path
			persistItemCopy(siteId, sourceItemPath, targetItemPath, parentItem.getId(), null);
			targetItemPaths.add(targetItemPath);
		}
		persistWriteToDB(siteId, additionalItems.values(), newFolders, operationsByPath);

		if (isNotEmpty(targetItemPaths)) {
			itemService.updateParentId(site.getId(), targetItemPaths);
		}

		dependencyService.validateDependenciesForTree(siteId, targetPath);
	}

	/**
	 * Persists a copy of an item in the database.
	 * Creates the copy in the item table and updates the dependencies.
	 */
	protected void persistItemCopy(String siteId, String sourceItemPath, String targetItemPath, long parentId, String label)
			throws ServiceLayerException, AuthenticationException {
		itemService.copyItem(siteId, sourceItemPath, targetItemPath, parentId, label, getCurrentUser().getId());
		dependencyService.upsertDependencies(siteId, targetItemPath);
	}

	/**
	 * Validates the copy operation.
	 * - General checks for copy or move operation. See {@link #validateMoveOrCopyOperation(String, String, String)}.
	 *
	 * @param siteId     the site id
	 * @param sourcePath the source content path for the copy operation
	 * @param targetPath the target content path for the copy operation
	 * @param childPaths the paths to copy from the source path to the target path
	 * @throws ContentNotFoundException   if the parent path of the target does not exist
	 * @throws InvalidParametersException if any of the validations fail
	 */
	protected void validateCopyOperation(String siteId, String sourcePath, String targetPath, Set<String> childPaths)
			throws ServiceLayerException, UserNotFoundException {
		validateMoveOrCopyOperation(siteId, sourcePath, targetPath);
		for (String childPath : childPaths) {
			if (!equalsNormalized(sourcePath, childPath) && !directoryContains(sourcePath, childPath)) {
				throw new InvalidParametersException(format("Cannot copy content from '%s' to '%s': " +
						"source path '%s' is not a parent of child item path '%s'", sourcePath, targetPath, sourcePath, childPath));
			}
		}
	}

	/**
	 * General checks for copy or move operations
	 * .
	 * - Check that the source and target paths have the same extension (if applicable).
	 * - Check that the target path parent exists.
	 * - Check that the source and target paths are both under the same top-level folder (e.g.: cannot move from site/components to static-assets).
	 *
	 * @param siteId     the site id
	 * @param sourcePath the source content path for move or copy operations
	 * @param targetPath the target content path for move or copy operations
	 * @throws InvalidParametersException if the source and target paths do not have the same extension, or if the source and target paths are not under the same top-level folder
	 * @throws ContentNotFoundException   if the parent path of the target does not exist
	 */
	protected void validateMoveOrCopyOperation(String siteId, String sourcePath, String targetPath)
			throws ServiceLayerException, UserNotFoundException {
		if (!CS.equals(getExtension(sourcePath), getExtension(targetPath))) {
			throw new InvalidParametersException(format("Cannot copy or move content from '%s' to '%s': " +
					"source and target paths must have the same extension", sourcePath, targetPath));
		}

		String parentUrl = getFullPathNoEndSeparator(targetPath);
		if (!contentExists(siteId, parentUrl)) {
			throw new ContentNotFoundException(parentUrl, siteId,
					format("Unable to copy or move content: parent path '%s' in site '%s' does not exist", parentUrl, siteId));
		}

		String sourceTopLevel = getTopLevelFolder(sourcePath);
		String targetTopLevel = getTopLevelFolder(targetPath);
		if (!Objects.equals(sourceTopLevel, targetTopLevel)) {
			throw new InvalidParametersException(format("Cannot copy or move content " +
							"from '%s' (%s) into '%s' (%s) for site '%s'. " +
							"Pasting across top level folders is not supported.",
					sourcePath, sourceTopLevel, targetPath, targetTopLevel, siteId));
		}

		ContentItem sourceItem = getItemByPath(siteId, sourcePath, true);
		if (isNotEmpty(sourceItem.getContentTypeId()) && !contentTypeService.isContentTypeAllowed(siteId, targetPath, sourceItem.getContentTypeId())) {
			throw new ContentTypeInvalidLocationException(siteId, sourceItem.getContentTypeId(), sourcePath, targetPath);
		}
	}

	protected WriteContentResult writeInternal(final String siteId, final String path,
											   final LifecycleContent lifecycleContent, final String comment)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		Map<String, ContentLifecycleItem> lifecycleResultItems = lifecycleContent.getItems();
		Map<String, LifecycleOperation> operationsByPath = getOperationsByPath(siteId, List.of(lifecycleContent.getRepoPath()),
				lifecycleResultItems.values(), lifecycleContent.getOperation());
		validateEntitlements(operationsByPath);
		Set<String> missingFolders = getMissingFolders(siteId, operationsByPath);
		// Write to the repository and commit.
		String commitId = contentRepository.writeContent(siteId, lifecycleResultItems.values(), missingFolders, comment);

		List<WriteContentResultItem> writeResultItems = lifecycleResultItems.values().stream()
				.map(item -> new WriteContentResultItem(item.repoPath(), operationsByPath.get(item.repoPath()), item.amended()))
				.toList();
		WriteContentResult writeContentResult = new WriteContentResult(commitId, writeResultItems);

		if (StringUtils.isEmpty(commitId)) {
			// If commitId is null it means the content was the same, so nothing to commit
			return writeContentResult;
		}

		logger.debug("Persisting write operation for site '{}' path '{}'", siteId, path);
		persistWriteToDB(siteId, lifecycleResultItems.values(), missingFolders, operationsByPath);

		// Audit write operation
		insertContentAudit(siteId, null, path, lifecycleContent.getOperation(), writeContentResult);
		return writeContentResult;
	}

	/**
	 * Validate the entitlements for the write operation
	 * It counts the number of new items being created and validates the entitlement for that number of items
	 * minus the number of items being deleted.
	 *
	 * @param operationsByPath the map of operations by path
	 * @throws ServiceLayerException if the entitlement validation fails
	 */
	protected void validateEntitlements(Map<String, LifecycleOperation> operationsByPath) throws ServiceLayerException {
		int netAddedCount = operationsByPath.values().stream()
				.collect(teeing(
						filtering(op -> op == NEW || op.isCopy, counting()),
						filtering(op -> op == DELETE, counting()),
						(added, deleted) -> added - deleted
				)).intValue();
		try {
			entitlementValidator.validateEntitlement(EntitlementType.ITEM, netAddedCount);
		} catch (EntitlementException e) {
			throw new ServiceLayerException(format("Failed to perform write operation to add %s new items due to entitlement validation failure",
					netAddedCount), e);
		}
	}

	/**
	 * Validate the entitlements with a count of 0, so only the
	 * license is validated.
	 *
	 * @throws ServiceLayerException if the entitlement validation fails
	 */
	protected void validateEntitlements() throws ServiceLayerException {
		try {
			// Validate just the license
			entitlementValidator.validateEntitlement(EntitlementType.ITEM, 0);
		} catch (EntitlementException e) {
			throw new ServiceLayerException("Failed to perform write operation, license is not valid", e);
		}
	}

	/**
	 * Extract the missing folders from a write operation
	 * Missing folders are the newly created paths that need empty file added to the repo
	 */
	protected Set<String> getMissingFolders(final String siteId, final Map<String, LifecycleOperation> operationsByPath) {
		return operationsByPath.entrySet().stream()
				.filter(entry -> entry.getValue() == NEW)
				.map(Entry::getKey)
				.map(p -> calculateMissingFolders(siteId, p))
				.flatMap(Collection::stream)
				.collect(toSet());
	}

	/**
	 * Calculate the missing folders for a copy or move operation
	 * Missing folders are the newly created paths that need empty file added to the repo
	 */
	protected Set<String> getMissingFoldersForCopyOrMove(String siteId, Collection<ContentLifecycleItem> lifecycleItems) {
		return lifecycleItems.stream()
				.flatMap(item -> calculateMissingFolders(siteId, item.repoPath()).stream())
				.collect(toSet());
	}

	/**
	 * Calculate "additional items" for a copy or move operation.
	 * Additional items are:
	 * - items that were amended or added by the lifecycle
	 * - descriptors (metadata is always updated)
	 * so they need to be added after the original items are moved or copied.
	 */
	protected Map<String, ContentWriteItem> calculateAdditionalItemsForCopyOrMove(Map<String, ContentLifecycleItem> lifecycleItems) {
		return lifecycleItems.entrySet().stream()
				.filter(entry -> isDescriptor(entry.getValue().repoPath()) || entry.getValue().amended()
						|| entry.getValue().sourcePath() == null)
				.collect(toMap(Entry::getKey, Entry::getValue));
	}

	/**
	 * Overloaded method for non-DELETE operations
	 */
	protected Map<String, LifecycleOperation> getOperationsByPath(String siteId, Collection<String> sourcePaths,
																  Collection<ContentLifecycleItem> resultItems,
																  LifecycleOperation mainItemOperation) {
		return getOperationsByPath(siteId, emptyList(), sourcePaths, resultItems, mainItemOperation);
	}


	/**
	 * Creates a map out of the ContentLifecycleItems, where the key is the path and
	 * the value is the operation performed.
	 *
	 * @param siteId            the site id
	 * @param deletedPaths      the list of paths that are being deleted (applies for DELETE operations)
	 * @param sourcePaths       the initial user-requested list of paths
	 * @param resultItems       the result items from the lifecycle processing
	 * @param mainItemOperation the operation for the main item (e.g. the one that was requested by the user)
	 * @return a map of path to operation
	 */
	protected Map<String, LifecycleOperation> getOperationsByPath(String siteId, Collection<String> deletedPaths,
																  Collection<String> sourcePaths,
																  Collection<ContentLifecycleItem> resultItems,
																  LifecycleOperation mainItemOperation) {
		Map<String, LifecycleOperation> result = new HashMap<>();
		// Add the deleted paths first, so they are not overridden by the result items in case
		// they are added by the lifecycle processing
		deletedPaths.forEach(p -> result.put(p, DELETE));
		result.putAll(resultItems.stream()
				.collect(toMap(ContentWriteItem::repoPath, item -> {
					if (item.sourcePath() != null && sourcePaths.contains(item.sourcePath())) {
						// Preserve the operation for the main item
						return mainItemOperation;
					}
					if (contentExists(siteId, item.repoPath())) {
						return UPDATE;
					}
					return NEW;
				})));

		return result;
	}

	/**
	 * Provides a comparator to sort the paths so parents are created first
	 *
	 * @return a comparator to sort the paths
	 */
	protected Comparator<String> creationPathComparator() {
		// index.xml should go first
		// Otherwise sort by length so parents go first
		return Comparator.<String, Integer>comparing(s -> CS.removeEnd(s, DmConstants.INDEX_FILE).length())
				// If they have the same length after removing index.xml, we are comparing folder and page for the same path:
				// 	/site/website/en/index.xml
				// 	/site/website/en
				// Natural order will give us the folder first
				.thenComparing(naturalOrder());
	}

	/**
	 * Persist a new folder to the database
	 *
	 * @param siteId    the site id
	 * @param newFolder the new folder path
	 */
	protected void persistNewFolder(final String siteId, final String newFolder) throws UserNotFoundException, AuthenticationException, ServiceLayerException {
		Item parentItem = itemService.getItem(siteId, getParentUrl(newFolder), true);
		Long parentId = parentItem != null ? parentItem.getId() : null;
		itemService.persistItemAfterCreateFolder(siteId, newFolder, getBaseName(Path.of(newFolder)), parentId);
	}

	/**
	 * Persist an item to the database
	 *
	 * @param siteId    the site id
	 * @param item      the item to persist
	 * @param operation the content lifecycle operation
	 */
	protected void persistItemWrite(final String siteId, final ContentWriteItem item,
									LifecycleOperation operation) throws UserNotFoundException, AuthenticationException, ServiceLayerException {
		String path = item.repoPath();
		if (NEW == operation) {
			boolean isPage = isPageDescriptor(path);
			String parentItemPath = getParentUrl(path);
			Item parent = itemService.getItem(siteId, parentItemPath, isPage);
			itemService.persistItemAfterCreate(siteId, path, parent.getId());
			if (isPage) {
				itemService.updateNewPageChildren(siteId, CS.removeEnd(path, SLASH_INDEX_FILE));
			}
		} else {
			itemService.persistItemAfterWrite(siteId, path);
		}
		dependencyService.upsertDependencies(siteId, path);
		dependencyService.validateDependencies(siteId, path);
	}

	/**
	 * Persist changes to the DB
	 */
	protected void persistWriteToDB(String siteId, Collection<? extends ContentWriteItem> lifecycleResultItems,
									Set<String> missingFolders, Map<String, LifecycleOperation> operationsByPath)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		// Gather all the persist calls so we can sort them
		Map<String, ThrowingRunnable> persistItemCalls = new HashMap<>();
		for (String missingFolder : missingFolders) {
			persistItemCalls.put(missingFolder, () -> persistNewFolder(siteId, missingFolder));
		}
		for (ContentWriteItem item : lifecycleResultItems) {
			LifecycleOperation operation = operationsByPath.computeIfAbsent(item.repoPath(), k -> NEW);
			persistItemCalls.put(item.repoPath(), () -> persistItemWrite(siteId, item, operation));
		}

		List<String> allPaths = persistItemCalls.keySet().stream().sorted(creationPathComparator()).toList();
		for (String path : allPaths) {
			try {
				persistItemCalls.get(path).run();
			} catch (ServiceLayerException | UserNotFoundException | AuthenticationException e) {
				throw e;
			} catch (Exception e) {
				throw new ServiceLayerException(format("Failed to persist item for site '%s' path '%s'", siteId, path), e);
			}
		}
	}

	/**
	 * Calculate the missing folders for a given path.
	 * Missing folders are the ancestors of the path that do not exist in the repository.
	 */
	protected Collection<String> calculateMissingFolders(final String siteId, final String path) {
		List<String> missingFolders = new ArrayList<>();
		String parentItemPath = getFullPathNoEndSeparator(path);
		Path current = Path.of(parentItemPath);
		while (current != null && !contentExists(siteId, current.toString())) {
			missingFolders.add(current.toString());
			current = current.getParent();
		}
		return missingFolders;
	}

	/**
	 * Content loader method to support the content lifecycle script
	 *
	 * @param siteId the site id
	 * @param path   the path
	 * @return InputStream to read the content
	 */
	protected InputStream loadContent(String siteId, String path) {
		if (!contentRepository.contentExists(siteId, path)) {
			return null;
		}
		try {
			return contentRepository.getContent(siteId, path);
		} catch (ContentNotFoundException e) {
			logger.error("Failed to load content for site '{}' path '{}'", siteId, path, e);
			return null;
		}
	}

	/**
	 * Insert an audit log entry for the write operation
	 *
	 * @param siteId      the site id
	 * @param sourcePath  the source path (if applicable, e.g. for copy/move operations)
	 * @param path        the path
	 * @param operation   the operation performed
	 * @param writeResult the result of the write operation
	 */
	protected void insertContentAudit(String siteId, String sourcePath, String path,
									  LifecycleOperation operation, WriteContentResult writeResult) throws SiteNotFoundException, AuthenticationException {
		Map<LifecycleOperation, List<WriteContentResultItem>> resultByOperation = writeResult.getItems().stream()
				.collect(groupingBy(WriteContentResultItem::operation, mapping(identity(), toList())));
		AuthenticatedUser currentUser = getCurrentUser();
		Site site = siteService.getSite(siteId);

		if (resultByOperation.isEmpty()) {
			// This could happen for example when renaming an empty folder
			String targetType = contentRepository.isFolder(siteId, path) ? TARGET_TYPE_FOLDER : TARGET_TYPE_CONTENT_ITEM;
			AuditLog auditLog = createAuditLogEntry();
			auditLog.setOperation(operation == NEW ? OPERATION_CREATE : operation.name());
			auditLog.setActorId(getCurrentUsername());
			auditLog.setSiteId(site.getId());
			auditLog.setPrimaryTargetId(getContentItemId(siteId, path));
			auditLog.setPrimaryTargetType(targetType);
			auditLog.setPrimaryTargetValue(path);
			auditLog.setCommitId(writeResult.getCommitId());

			if (sourcePath != null) {
				AuditLogParameter sourcePathParameter = new AuditLogParameter();
				sourcePathParameter.setTargetId(getContentItemId(siteId, sourcePath));
				sourcePathParameter.setTargetType(TARGET_TYPE_SOURCE_PATH);
				sourcePathParameter.setTargetValue(sourcePath);
				auditLog.setParameters(List.of(sourcePathParameter));
			}

			auditService.insertAuditLog(auditLog);
			return;
		}


		for (Entry<LifecycleOperation, List<WriteContentResultItem>> entry : resultByOperation.entrySet()) {
			String activityType = switch (operation) {
				case COPY, DUPLICATE, NEW -> OPERATION_CREATE;
				case RENAME -> OPERATION_MOVE;
				default -> operation.name();
			};
			String auditTargetId = writeResult.getCommitId();
			String auditTargetValue = writeResult.getCommitId();
			String targetType = TARGET_TYPE_CONTENT_PACKAGE;
			var parameterItems = entry.getValue();
			if (entry.getValue().size() == 1) {
				// If there is only one item, add it to the audit table primary target, so it is visible right away
				String itemPath = entry.getValue().getFirst().path();
				auditTargetId = getContentItemId(siteId, itemPath);
				auditTargetValue = itemPath;
				targetType = contentRepository.isFolder(siteId, itemPath) ? TARGET_TYPE_FOLDER : TARGET_TYPE_CONTENT_ITEM;
				// Prevent unnecessary duplication of data
				parameterItems = emptyList();
				Item item = itemService.getItem(siteId, itemPath, true);
				activityStreamService.insertActivity(site.getId(), currentUser.getId(), activityType,
						DateUtils.getCurrentTime(), item, null);
			}

			AuditLog auditLog = createAuditLogEntry();
			auditLog.setOperation(entry.getKey() == NEW ? OPERATION_CREATE : entry.getKey().name());
			auditLog.setActorId(getCurrentUsername());
			auditLog.setSiteId(site.getId());
			auditLog.setPrimaryTargetId(auditTargetId);
			auditLog.setPrimaryTargetType(targetType);
			auditLog.setPrimaryTargetValue(auditTargetValue);
			auditLog.setCommitId(writeResult.getCommitId());

			// Source path makes sense for the main operation only. e.g.: a copy operation that also creates/updates other items
			String sourcePathParam = operation == entry.getKey() ? sourcePath : null;
			List<AuditLogParameter> auditLogParameters = getAuditParameters(siteId, sourcePathParam, path, parameterItems);
			auditLog.setParameters(auditLogParameters);
			auditService.insertAuditLog(auditLog);

			for (WriteContentResultItem parameterItem : parameterItems) {
				Item item = itemService.getItem(siteId, parameterItem.path(), true);
				activityStreamService.insertActivity(site.getId(), currentUser.getId(), activityType,
						DateUtils.getCurrentTime(), item, null);
			}
		}
	}

	/**
	 * Get the audit parameters for a write operation.
	 *
	 * @param siteId      the site id
	 * @param path        the path of the content item being written
	 * @param resultItems the result items of the write operation
	 * @return a list of audit log parameters
	 */
	protected @NonNull List<AuditLogParameter> getAuditParameters(String siteId, String sourcePath, String path,
																  Collection<WriteContentResultItem> resultItems) {
		List<AuditLogParameter> auditLogParameters = new ArrayList<>();
		if (sourcePath != null) {
			AuditLogParameter sourcePathParameter = new AuditLogParameter();
			sourcePathParameter.setTargetId(getContentItemId(siteId, sourcePath));
			sourcePathParameter.setTargetType(TARGET_TYPE_SOURCE_PATH);
			sourcePathParameter.setTargetValue(sourcePath);
			auditLogParameters.add(sourcePathParameter);
		}
		auditLogParameters.addAll(resultItems.stream()
				.map(WriteContentResultItem::path)
				.filter(itemPath -> path == null || !CS.equals(itemPath, path))
				.map(itemPath -> {
					AuditLogParameter auditLogParameter = new AuditLogParameter();
					auditLogParameter.setTargetId(getContentItemId(siteId, itemPath));
					auditLogParameter.setTargetType(TARGET_TYPE_CONTENT_ITEM);
					auditLogParameter.setTargetValue(itemPath);
					return auditLogParameter;
				})
				.toList());

		return auditLogParameters;
	}

	@Override
	public List<LightItem> getChildItems(final String siteId, final List<String> paths) {
		Collection<LightItem> subtreeItems = itemDao.getSubtreeItems(siteId, paths);
		List<String> subtreePaths = subtreeItems.stream().map(LightItem::getPath).toList();
		List<LightItem> childItems = new ArrayList<>(subtreeItems);
		childItems.addAll(dependencyService.getItemSpecificDependencies(siteId, union(paths, subtreePaths)));
		return childItems;
	}

	protected void assertNotInWorkflow(final String siteId, final List<String> paths, final boolean includeChildren)
			throws ServiceLayerException {
		Collection<PublishPackage> packagesForItems = publishService.getActivePackagesForItems(siteId, paths, includeChildren);
		if (isNotEmpty(packagesForItems)) {
			throw new ContentInPublishQueueException("Unable to edit content that is part of an active publish package", packagesForItems);
		}
	}

	@Override
	public DeleteContentResult deleteContent(String siteId, Set<String> paths, String publishTitle, String publishComment)
			throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		DeleteContentResult deleteResult;
		// Lock the sandbox repository to prevent publish packages being submitted (delete operation might conflict with submitted packages)
		String sandboxRepoLockKey = getSandboxRepoLockKey(siteId);
		generalLockService.lock(sandboxRepoLockKey);
		Set<String> allPaths;
		try {
			allPaths = new HashSet<>();
			try {
				if (itemService.isSystemProcessing(siteId, paths)) {
					throw new ServiceLayerException(format("Failed to delete content at site '%s' paths '%s' " +
									"because some items are being processed  (Object State is system processing)",
							siteId, paths));
				}
				itemService.setSystemProcessingBulk(siteId, paths, true);
				allPaths.addAll(paths);

				Optional<String> notFound = paths.stream().filter(path -> !contentRepository.contentExists(siteId, path)).findFirst();
				if (notFound.isPresent()) {
					throw new ContentNotFoundException(notFound.get(), siteId, "Content '%s' not found in site '%s'".formatted(notFound.get(), siteId));
				}

				Set<String> children = itemDao.getSubtreeItems(siteId, paths).stream()
						.map(LightItem::getPath)
						.collect(toSet());
				itemService.setSystemProcessingBulk(siteId, children, true);
				allPaths.addAll(children);

				Set<String> dependencies = dependencyService.getItemSpecificDependencies(siteId, allPaths).stream()
						.map(LightItem::getPath).collect(toSet());
				itemService.setSystemProcessingBulk(siteId, dependencies, true);
				allPaths.addAll(dependencies);

				Collection<LifecycleContent> lifecycleContents = runLifecycleForDelete(siteId, allPaths);
				try {
					String transactionId = format(DELETE_TRANSACTION_FORMAT, UUID.randomUUID());
					deleteResult = runWriteInTransaction(transactionId,
							() -> deleteInternal(siteId, union(paths, children), dependencies, lifecycleContents, publishTitle, publishComment));
				} finally {
					closeCollection(lifecycleContents);
				}
				// Do this after the transaction to ensure the visibility of the changes
				if (deleteResult.getPublishPackageId() > 0) {
					eventPublisher.publishEvent(
							new RequestPublishEvent(siteId, deleteResult.getPublishPackageId()));
					eventPublisher.publishEvent(new WorkflowEvent(getAuthentication(), siteId, deleteResult.getPublishPackageId(), DIRECT_PUBLISH));
				}
			} catch (Exception e) {
				logger.error("Failed to delete content in site '{}' at paths '{}'", siteId, paths, e);
				throw e;
			} finally {
				itemService.setSystemProcessingBulk(siteId, allPaths, false);
			}
		} finally {
			generalLockService.unlock(sandboxRepoLockKey);
		}

		Authentication auth = getAuthentication();
		for (String path : allPaths) {
			eventPublisher.publishEvent(new DeleteContentEvent(auth, siteId, path));
		}

		return deleteResult;
	}

	/**
	 * Run the lifecycle for delete operation.
	 *
	 * @param siteId the site id
	 * @param paths  the delete paths
	 * @return a collection of {@link LifecycleContent} objects representing the lifecycle contents
	 * @throws ServiceLayerException if the lifecycle execution fails
	 */
	protected Collection<LifecycleContent> runLifecycleForDelete(String siteId, Set<String> paths) throws ServiceLayerException {
		ArrayList<LifecycleContent> lifecycleContents = new ArrayList<>(paths.size());
		try {
			for (String path : paths) {
				// No delete lifecycle for assets
				if (isDescriptor(path)) {
					Item item = itemService.getItem(siteId, path, false);
					String contentType = item.getContentTypeId();
					LifecycleContent lifecycleContent = new LifecycleContent(path, null, contentType,
							ofStream(path, () -> loadContent(siteId, path)),
							DELETE);
					contentLifecycle.execute(siteId, lifecycleContent, this::loadContent);
					lifecycleContents.add(lifecycleContent);
				}
			}
		} catch (Exception e) {
			closeCollection(lifecycleContents);
			logger.error("Failed to run lifecycle for delete operation for site '{}' paths '{}'", siteId, paths, e);
			throw e;
		}
		return lifecycleContents;
	}

	protected DeleteContentResult deleteInternal(String siteId, Set<String> userRequestedPaths,
												 Set<String> dependencies, Collection<LifecycleContent> lifecycleContents,
												 String publishTitle, String publishComment)
			throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		Site site = siteService.getSite(siteId);
		long publishPackageId = 0;
		Set<String> deletePaths = new HashSet<>(userRequestedPaths.size() + dependencies.size());
		deletePaths.addAll(userRequestedPaths);
		deletePaths.addAll(dependencies);

		Map<String, ContentLifecycleItem> additionalItems = lifecycleContents.stream()
				.flatMap(lifecycleContent -> lifecycleContent.getItems().values()
						.stream()
						.filter(item -> !deletePaths.contains(item.repoPath())))
				.collect(toMap(ContentLifecycleItem::repoPath, identity()));

		Map<String, LifecycleOperation> operationsByPath = getOperationsByPath(siteId, deletePaths, emptyList(), additionalItems.values(), DELETE);
		validateEntitlements(operationsByPath);
		Set<String> newFolders = additionalItems.values().stream()
				.flatMap(i -> calculateMissingFolders(siteId, i.repoPath()).stream())
				.collect(toSet());

		// check and fail if any of the items is part of a publish package
		assertNotInWorkflow(siteId, new ArrayList<>(deletePaths), false);
		String commitId = contentRepository.deleteContent(siteId, deletePaths, additionalItems.values(), newFolders);

		if (contentRepository.publishedRepositoryExists(siteId)) {
			Set<String> writtenPaths = additionalItems.values().stream()
					.map(ContentWriteItem::repoPath)
					.collect(toSet());
			// Do not publish deletePaths that were not really deleted
			publishPackageId = publishService.publishDelete(siteId, difference(userRequestedPaths, writtenPaths),
					difference(dependencies, writtenPaths), publishTitle, publishComment);
		}

		List<WriteContentResultItem> resultItems = new LinkedList<>();
		resultItems.addAll(
				deletePaths.stream()
						.filter(path -> !additionalItems.containsKey(path))
						.map(path -> new WriteContentResultItem(path, DELETE, false))
						.toList());
		resultItems.addAll(
				additionalItems.values().stream()
						.map(item -> new WriteContentResultItem(item.repoPath(), UPDATE, false))
						.toList()
		);

		DeleteContentResult deleteResult = new DeleteContentResult(commitId, resultItems, publishPackageId);

		insertDeleteContentAudit(siteId, deleteResult);

		for (String path : deletePaths) {
			dependencyService.deleteItemDependencies(siteId, path);
			dependencyService.invalidateDependencies(siteId, path);
			itemService.deleteItem(site.getId(), path, true);
		}
		persistWriteToDB(site.getSiteId(), additionalItems.values(), newFolders, operationsByPath);

		return deleteResult;
	}

	/**
	 * Insert an audit log entry for the delete operation.
	 *
	 * @param siteId       the site id
	 * @param deleteResult the result of the delete operation
	 * @throws SiteNotFoundException if the site is not found
	 */
	protected void insertDeleteContentAudit(String siteId, DeleteContentResult deleteResult) throws SiteNotFoundException, AuthenticationException {
		insertContentAudit(siteId, null, null, DELETE, deleteResult);
	}

	@Override
	public Document getItemDescriptor(String siteId, String path, boolean flatten) throws ContentNotFoundException {
		try {
			org.craftercms.core.service.Item item = getItem(siteId, path, flatten);
			Document descriptor = item.getDescriptorDom();
			if (descriptor == null) {
				throw new ContentNotFoundException(path, siteId, format("No descriptor found for '%s' in site '%s'", path, siteId));
			}
			return descriptor;
		} catch (PathNotFoundException e) {
			logger.error("Content not found for site '{}' at path '{}'", siteId, path, e);
			throw new ContentNotFoundException(path, siteId, format("Content not found in site '%s' at path '%s'", siteId, path));
		}
	}

	@Override
	public void lockContent(String siteId, String path) throws UserNotFoundException, ServiceLayerException {
		generalLockService.lockContentItem(siteId, path);
		try {
			var item = itemService.getItem(siteId, path);
			if (Objects.isNull(item)) {
				throw new ContentNotFoundException(path, siteId, format("Content not found in site '%s' at path '%s'",
						siteId, path));
			}
			var username = getCurrentUsername();
			boolean lockedByAnotherUser = ItemState.isUserLocked(item.getState()) &&
					Objects.nonNull(item.getLockOwner()) && !CS.equals(item.getLockOwner().getUsername(), username);
			if (lockedByAnotherUser) {
				throw new ContentLockedByAnotherUserException(item.getLockOwner().getUsername());
			}

			contentRepository.lockItem(siteId, path);
			itemService.lockItemByPath(siteId, path, username);
			eventPublisher.publishEvent(
					new LockContentEvent(getAuthentication(), siteId, path, true));
		} finally {
			generalLockService.unlockContentItem(siteId, path);
		}
	}

	@Override
	public void unlockContent(String siteId, String path) throws ContentNotFoundException, RepositoryException {
		logger.debug("Unlock item in site '{}' path '{}'", siteId, path);
		generalLockService.lockContentItem(siteId, path);
		try {
			var item = itemService.getItem(siteId, path);
			if (Objects.isNull(item)) {
				logger.debug("Item not found in site '{}' path '{}'", siteId, path);
				throw new ContentNotFoundException(path, siteId, format("Item not found in site '%s' path '%s'", siteId, path));
			}
			if (!ItemState.isUserLocked(item.getState()) && Objects.isNull(item.getLockOwner())) {
				logger.warn("Skipping unlock operation for item in site '{}' at path '{}': Item is already unlocked.", siteId, path);
				return;
			}
			contentRepository.unlockItem(siteId, path);
			itemService.unlockItemByPath(siteId, path);
			logger.debug("Item in site '{}' path '{}' successfully unlocked", siteId, path);
			eventPublisher.publishEvent(
					new LockContentEvent(getAuthentication(), siteId, path, false));
		} finally {
			generalLockService.unlockContentItem(siteId, path);
		}
	}

	@Override
	public void renameContent(final String siteId, final String path, final String name) throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		logger.debug("Rename path '{}' to new name '{}' for site '{}'", path, name, siteId);
		String parentPath = getParentUrl(path);
		String targetPath = parentPath + FILE_SEPARATOR + name;
		doMove(siteId, path, targetPath, null, null);
	}

	/**
	 * Validate the move operation.
	 * - General checks for copy or move operations. See {@link #validateMoveOrCopyOperation(String, String, String)}.
	 * - Check that the target path is not a child of the source path (to prevent moving a folder into itself).
	 *
	 * @param siteId     the site id
	 * @param sourcePath the source path
	 * @param targetPath the target path
	 * @throws ContentNotFoundException   if the source path does not exist
	 * @throws InvalidParametersException if any of the validation checks fail
	 */
	protected void validateMoveOperation(String siteId, String sourcePath, String targetPath)
			throws ServiceLayerException, UserNotFoundException {
		validateMoveOrCopyOperation(siteId, sourcePath, targetPath);
		if (directoryContains(sourcePath, targetPath)) {
			throw new InvalidParametersException(format("Cannot move content from '%s' to a directory of itself: '%s' in site '%s': " +
					"target path is a child of the source path", sourcePath, targetPath, siteId));
		}
		Item sourceItem = itemService.getItem(siteId, sourcePath, true);
		String systemType = sourceItem.getSystemType();
		if (!SUPPORT_RENAME_CONTENT_TYPES.contains(systemType)) {
			throw new ServiceLayerException(format("Failed to rename content at site '%s' path '%s' " +
					"with content type '%s'", siteId, sourcePath, systemType));
		}
	}

	@Override
	public PasteContentResult move(final String siteId, final String sourcePath, final String targetPath)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		return doMove(siteId, sourcePath, targetPath, null, null);
	}

	@Override
	public PasteContentResult moveToParentPath(String siteId, String sourcePath, String targetParent) throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		PastedPath pastedPath = constructNewPathForCutCopy(siteId, sourcePath, targetParent);
		return doMove(siteId, sourcePath, pastedPath.path, pastedPath.newLabel, null);
	}

	@Override
	public WriteContentResult moveAndUpdate(String siteId, String sourcePath, String targetPath, String content) throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		return doMove(siteId, sourcePath, targetPath, null, () -> IOUtils.toInputStream(content, UTF_8));
	}

	/**
	 * This is an internal move method that will accept the full source and target paths (vs source path and target parent)
	 *
	 * @param siteId   the site id
	 * @param from     the source path
	 * @param to       the full target path
	 * @param newLabel the new label for the content
	 * @return the result of the move operation
	 */
	protected PasteContentResult doMove(final String siteId, final String from, final String to, final String newLabel,
										final ThrowingSupplier<InputStream> newContent)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		if (!contentExists(siteId, from)) {
			throw new ContentNotFoundException(from, siteId, format("Content not found at path '%s' in site '%s'", from, siteId));
		}
		if (contentExists(siteId, to)) {
			throw new ContentExistException(format("Content '%s' in siteId '%s', cannot be renamed " +
					"because an item already exists in target location '%s'.", from, siteId, to));
		}
		String sourcePath;
		String targetPath;
		if (isPageDescriptor(from) || isPageDescriptor(to)) {
			// Normalize the paths. If we're moving a page we need to move the folder anyway
			sourcePath = CS.removeEnd(from, SLASH_INDEX_FILE);
			targetPath = CS.removeEnd(to, SLASH_INDEX_FILE);
		} else {
			sourcePath = from;
			targetPath = to;
		}
		PasteContentResult pasteResult;
		String sandboxRepoLockKey = getSandboxRepoLockKey(siteId);
		generalLockService.lock(sandboxRepoLockKey);
		try {
			validateMoveOperation(siteId, sourcePath, targetPath);
			Site site = siteService.getSite(siteId);
			Set<String> processingPaths = new HashSet<>();
			try {
				processingPaths.add(sourcePath);
				if (underPagesRoot(sourcePath)) {
					processingPaths.add(sourcePath + SLASH_INDEX_FILE);
				}
				trySetSystemProcessing(siteId, processingPaths);
				Set<String> sourcePathChildren = new HashSet<>(itemDao.getChildrenPaths(site.getId(), sourcePath));
				if (!contentRepository.isFolder(siteId, sourcePath)) {
					sourcePathChildren.add(sourcePath);
				}
				Collection<LifecycleContent> lifecycleContents = runLifecycleForMove(siteId, sourcePath, targetPath, sourcePathChildren, newLabel, newContent);
				try {
					Collection<String> lifecyclePaths = getPathsForSystemProcessing(lifecycleContents);
					// Set system processing for paths added by the lifecycle
					trySetSystemProcessing(siteId, subtract(lifecyclePaths, processingPaths));
					processingPaths.addAll(lifecyclePaths);
					String transactionId = format(MOVE_TRANSACTION_FORMAT, UUID.randomUUID());
					logger.debug("Persisting move operation to DB for site '{}' source path '{}' target path '{}' transaction ID '{}'", siteId, sourcePath, targetPath, transactionId);
					pasteResult = runWriteInTransaction(transactionId,
							() -> moveInternal(site, sourcePath, targetPath, lifecycleContents, sourcePathChildren));
				} finally {
					closeCollection(lifecycleContents);
				}
			} catch (Exception e) {
				logger.error("Failed to persist move operation for site '{}' source path '{}' target path '{}'", siteId, sourcePath, targetPath, e);
				throw e;
			} finally {
				itemService.setSystemProcessingBulk(siteId, processingPaths, false);
			}
		} finally {
			generalLockService.unlock(sandboxRepoLockKey);
		}

		eventPublisher.publishEvent(new SyncFromRepoEvent(siteId));
		eventPublisher.publishEvent(new MoveContentEvent(getAuthentication(), siteId, from, to));

		return pasteResult;
	}

	/**
	 * Map a collection of LifecycleContent to a list of paths to set to SYSTEM_PROCESSING
	 *
	 * @param lifecycleContents the collection of LifecycleContent
	 * @return a list of paths to set to SYSTEM_PROCESSING
	 */
	protected Collection<String> getPathsForSystemProcessing(Collection<LifecycleContent> lifecycleContents) {
		return lifecycleContents.stream()
				.map(LifecycleContent::getItems)
				.map(Map::values)
				.flatMap(Collection::stream)
				.map(i -> defaultIfEmpty(i.sourcePath(), i.repoPath()))
				// If the path is a page descriptor, we need to add the folder as well
				.flatMap(p -> isPageDescriptor(p) ? Stream.of(CS.removeEnd(p, SLASH_INDEX_FILE), p) : Stream.of(p))
				.toList();
	}

	protected PasteContentResult moveInternal(final Site site, final String sourcePath, final String targetPath,
											  Collection<LifecycleContent> lifecycleContents, Set<String> sourcePathChildren)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException, DocumentException, IOException {
		String siteId = site.getSiteId();
		updateNavOrderForCopyOrMove(siteId, sourcePath, lifecycleContents, sourcePathChildren);
		// Consolidate the items into a single map
		Map<String, ContentLifecycleItem> lifecycleItems = mergeLifecycleContents(lifecycleContents);
		List<String> workflowAffectedPaths = getMoveOrCopyWorkflowAffectedPaths(targetPath, lifecycleItems);
		validateLifecycleResults(siteId, sourcePath, targetPath, workflowAffectedPaths);

		Set<String> newFolders = getMissingFoldersForCopyOrMove(siteId, lifecycleItems.values());

		// Items that are either amended or not in the moved paths
		Map<String, ContentWriteItem> additionalItems = calculateAdditionalItemsForCopyOrMove(lifecycleItems);
		// We need to calculate this before the commit
		Map<String, LifecycleOperation> operationsByPath = getOperationsByPath(siteId, sourcePathChildren, lifecycleItems.values(), RENAME);
		validateEntitlements(operationsByPath);
		// Commit the changeset
		String commitId = contentRepository.moveContent(siteId, sourcePath, targetPath, additionalItems.values(), newFolders);
		List<WriteContentResultItem> moveResultItems = lifecycleItems.values().stream()
				.map(i -> new WriteContentResultItem(i.repoPath(), operationsByPath.get(i.repoPath()), i.amended()))
				.toList();
		PasteContentResult pasteResult = new PasteContentResult(commitId, moveResultItems, targetPath);
		if (StringUtils.isEmpty(commitId)) {
			return pasteResult;
		}

		persistMoveToDB(site, sourcePath, targetPath, sourcePathChildren, additionalItems, newFolders, operationsByPath);

		// Audit operation
		insertContentAudit(siteId, sourcePath, targetPath, RENAME, pasteResult);
		return pasteResult;
	}

	/**
	 * Merge the lifecycle contents into a single map.
	 *
	 * @param lifecycleContents the collection of {@link LifecycleContent} to combine
	 * @return a map of path to {@link ContentLifecycleItem} containing all items from the lifecycle contents,
	 * using the path as the key.
	 */
	protected static @NonNull Map<String, ContentLifecycleItem> mergeLifecycleContents(Collection<LifecycleContent> lifecycleContents) {
		return lifecycleContents.stream()
				.map(LifecycleContent::getItems)
				.flatMap(m -> m.entrySet().stream())
				.collect(toMap(Entry::getKey, Entry::getValue));
	}

	/**
	 * Get the paths that are affected by the move or copy operation.
	 * This includes the root target path and any other item added during the lifecycle.
	 */
	protected List<String> getMoveOrCopyWorkflowAffectedPaths(String targetPath, Map<String, ContentLifecycleItem> lifecycleItems) {
		List<String> workflowAffectedPaths = new ArrayList<>();
		workflowAffectedPaths.add(targetPath);
		// The affected paths are the targetPath plus any other items that might have been added by the lifecycle
		workflowAffectedPaths.addAll(lifecycleItems.keySet().stream()
				.filter(path -> !directoryContains(targetPath, path))
				.toList());
		return workflowAffectedPaths;
	}

	/**
	 * Persist the move operation to the database
	 * This method will update the items in the database with the new path and preview url (when applicable)
	 */
	protected void persistMoveToDB(Site site, String sourcePath, String targetPath, Collection<String> sourcePathChildren,
								   Map<String, ContentWriteItem> additionalItems, Set<String> newFolders,
								   Map<String, LifecycleOperation> operationsByPath)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		String parentUrl = getFullPathNoEndSeparator(targetPath);
		Item parentItem = itemService.getItem(site.getSiteId(), parentUrl, true);
		String label = null;
		if (!underDescriptorRoot(targetPath) || !targetPath.endsWith(DmConstants.XML_PATTERN)) {
			label = getName(targetPath);
		}
		persistItemMove(site.getSiteId(), sourcePath, targetPath, parentItem.getId(), label);

		String targetPageUrl = targetPath + SLASH_INDEX_FILE;
		if (isPageDescriptor(targetPageUrl) && contentExists(site.getSiteId(), targetPageUrl)) {
			persistItemMove(site.getSiteId(), sourcePath + SLASH_INDEX_FILE, targetPageUrl, parentItem.getId(), null);
		}

		// Update the children of the moved item
		for (String sourcePathChild : sourcePathChildren) {
			String newPath = movePath(sourcePath, targetPath, sourcePathChild);
			persistItemMove(site.getSiteId(), sourcePathChild, newPath, null, null);
		}
		retryingDatabaseOperationFacade.retry(() -> itemDao.updateMovedFolders(site.getId(), sourcePath, targetPath));

		persistWriteToDB(site.getSiteId(), additionalItems.values(), newFolders, operationsByPath);

		dependencyService.updateDependenciesOnTreeDelete(site.getSiteId(), sourcePath);
		dependencyService.deleteItemDependencies(site.getSiteId(), sourcePath);

		dependencyService.validateDependenciesForTree(site.getSiteId(), targetPath);
	}

	/**
	 * Update the item and upsert the dependencies for the moved item.
	 */
	protected void persistItemMove(String siteId, String childSourcePath, String newPath,
								   Long parentId, String newLabel) throws ServiceLayerException, AuthenticationException {
		itemService.moveItem(siteId, childSourcePath, newPath, parentId, newLabel, getCurrentUser().getId());
		dependencyService.upsertDependencies(siteId, newPath);
	}

	/**
	 * Run the lifecycle for the move operation.
	 * This method returns the list of items to update (moved items and any item added by the lifecycle scripts)
	 *
	 * @param siteId             the site id
	 * @param sourcePath         the source path
	 * @param targetPath         the target path
	 * @param sourcePathChildren all non-folder children of the source path
	 * @return a map (path->contentLifecycleItem) of items to update (moved items and any item added by the lifecycle scripts)
	 * @throws ServiceLayerException if there is an error running the lifecycle
	 */
	protected Collection<LifecycleContent> runLifecycleForMove(String siteId, String sourcePath, String targetPath,
															   Set<String> sourcePathChildren, String newLabel,
															   ThrowingSupplier<InputStream> newContent) throws ServiceLayerException {
		ArrayList<LifecycleContent> lifecycleContents = new ArrayList<>(sourcePathChildren.size());
		try {
			for (String itemSourcePath : sourcePathChildren) {
				boolean isRootItem = CS.equals(sourcePath, CS.removeEnd(itemSourcePath, SLASH_INDEX_FILE));
				String itemTargetPath = movePath(sourcePath, targetPath, itemSourcePath);
				ThrowingSupplier<InputStream> contentSupplier = isRootItem && newContent != null
						? newContent
						: () -> loadContent(siteId, itemSourcePath);
				lifecycleContents.add(runLifecycle(siteId, itemSourcePath, itemTargetPath,
						contentSupplier, RENAME, isRootItem ? newLabel : null));
			}
		} catch (Exception e) {
			closeCollection(lifecycleContents);
			logger.error("Failed to run lifecycle for move operation for site '{}' source path '{}' target path '{}'",
					siteId, sourcePath, targetPath, e);
			throw e;
		}
		return lifecycleContents;
	}

	/**
	 * Updates the XML after a write operation.
	 * Return the copy-dependencies for copy operations.
	 * Notice that for copy operations, this method is indirectly recursive, as it will call
	 * {@link #getCopyDependencies(String, String, String, ContentItemIds, ContentItemIds, Element, Map, LifecycleOperation)},
	 * which will call back for each descriptor dependency
	 *
	 * @param siteId     the site id
	 * @param sourcePath the source path of the item being written (for move or copy operations)
	 * @param path       item path
	 * @param newLabel   new label for the item
	 * @param operation  the lifecycle operation performed
	 * @param root       the XML root element to update
	 * @return the dependencies (for copy operations)
	 */
	protected Map<String, ContentWriteItem> updateContentOnWrite(final String siteId, final String sourcePath,
																 final String path, final String newLabel,
																 final LifecycleOperation operation, final Element root)
			throws DocumentException, ServiceLayerException, IOException {
		boolean contentExists = contentExists(siteId, path);

		String nowFormatted = getCurrentTimeIso();
		addOrUpdateSingleDocumentNode(root, ELM_LAST_MODIFIED_DATE, nowFormatted);
		addOrUpdateSingleDocumentNode(root, ELM_LAST_MODIFIED_DATE_DT, nowFormatted);

		Map<String, ContentWriteItem> copyDependencies = new HashMap<>();
		if (!contentExists) {
			addOrUpdateSingleDocumentNode(root, ELM_CREATED_DATE, nowFormatted);
			addOrUpdateSingleDocumentNode(root, ELM_CREATED_DATE_DT, nowFormatted);
			if (operation.isCopy) {
				ContentItemIds newContentIds = generate();
				ContentItemIds oldContentIds = extractContentIds(root);
				getCopyDependencies(siteId, sourcePath, path, oldContentIds, newContentIds, root, copyDependencies, operation);
				updateObjectIds(root, newContentIds);
			}
		}

		// New label means there was a name collision, so we need to update file and folder name fields as well
		if (StringUtils.isNotEmpty(newLabel)) {
			addOrUpdateSingleDocumentNode(root, DOCUMENT_ELM_FILE_NAME, getName(path));
			if (isPageDescriptor(path)) {
				String folder = FilenameUtils.getBaseName(CS.removeEnd(path, SLASH_INDEX_FILE));
				addOrUpdateSingleDocumentNode(root, ELM_FOLDER_NAME, folder);
			}
			updateSingleDocumentFromXPath(root, INTERNAL_NAME_XPATH, newLabel);
		}

		return copyDependencies;
	}

	/**
	 * Extract the content item ids from the XML.
	 *
	 * @param root the XML root element
	 * @return the content item ids extracted from the XML
	 */
	protected ContentItemIds extractContentIds(Element root) {
		String objectId = readSingleDocumentNodeText(root, ELM_OBJECT_ID);
		String groupId = readSingleDocumentNodeText(root, ELM_GROUP_ID);
		return new ContentItemIds(objectId, groupId);
	}

	/**
	 * Update the navigation order for the copied/moved items.
	 * This method will update the navigation order for all page items that are not in the sourcePathChildren set
	 * Notice that the paths in the sourcePathChildren set are the ones that were copied/moved, so they do not need to be
	 * updated (because they have the same parent)
	 *
	 * @param siteId             the site id
	 * @param targetPath         the root target path of the move operation
	 * @param lifecycleContents  the lifecycle contents containing the items to update
	 * @param sourcePathChildren the set of source path children that were moved
	 * @throws DocumentException if there is an error parsing the document
	 * @throws IOException       if there is an error reading the document or writing it back to the lifecycleContent
	 */
	protected void updateNavOrderForCopyOrMove(String siteId, String targetPath, Collection<LifecycleContent> lifecycleContents,
											   Set<String> sourcePathChildren)
			throws DocumentException, IOException, ServiceLayerException {
		for (LifecycleContent lifecycleContent : lifecycleContents) {
			List<ContentLifecycleItem> itemsToUpdate =
					lifecycleContent.getItems().values().stream()
							.filter(item -> isPageDescriptor(item.sourcePath()))
							// Update the nav order if the item is the root of the move operation OR if it was added by the lifecycle
							.filter(item -> CS.equals(targetPath, CS.removeEnd(item.repoPath(), SLASH_INDEX_FILE))
									|| !sourcePathChildren.contains(item.sourcePath()))
							.toList();

			for (ContentLifecycleItem navUpdated : itemsToUpdate) {
				Document document = navUpdated.contentAsDocument();
				if (updateNavOrder(siteId, navUpdated.repoPath(), document, true)) {
					// This will update the ContentLifecycleItem and clean the resources of the previous version
					lifecycleContent.write(navUpdated.repoPath(), document);
				}
			}
		}
	}

	/**
	 * Quietly close the lifecycle items.
	 */
	protected void closeCollection(Collection<? extends AutoCloseable> closeables) {
		for (AutoCloseable closeable : closeables) {
			try {
				closeable.close();
			} catch (Exception e) {
				logger.debug("Failed to close item", e);
			}
		}
	}

	/**
	 * Constructs a new path for cut/copy operations.
	 *
	 * @param site the site id
	 * @param from the source path of the content item to be cut/copy
	 * @param to   the target path where the content item will be pasted
	 * @return the full target path for the cut/copy operation, including the file name
	 * @throws ServiceLayerException if an error occurs while calculating the target path
	 */
	protected PastedPath constructNewPathForCutCopy(String site, String from, String to) throws ServiceLayerException {
		String sourcePath = CS.removeEnd(from, FILE_SEPARATOR);
		String targetPath = CS.removeEnd(to, FILE_SEPARATOR);
		if (isPageDescriptor(from) || isPageDescriptor(to)) {
			// Normalize the paths. If we're moving a page we need to move the folder anyway
			sourcePath = CS.removeEnd(from, SLASH_INDEX_FILE);
			targetPath = CS.removeEnd(to, SLASH_INDEX_FILE);
		}
		PastedPath result = constructNewPathForCutCopyInternal(site, sourcePath, targetPath);
		if (isPageDescriptor(from)) {
			result.path += SLASH_INDEX_FILE;
		}
		return result;
	}

	/**
	 * Constructs a new path for cut/copy operations.
	 * This will build the new path based on the source and target paths provided,
	 * and also check if the target path already exists, adjusting the name if necessary.
	 * <p>
	 * Notice that this method expects the fromPath and toPath NOT to contain the /index.xml portion
	 * of the path if they are page descriptors. For components and assets, they are expected to
	 * contain the full path
	 *
	 * @param site     the site id
	 * @param fromPath the source path of the content item to be cut/copy
	 * @param toPath   the target path where the content item will be pasted
	 * @return the full target path for the cut/copy operation, including the file name
	 * @throws ServiceLayerException if an error occurs while calculating the target path
	 */
	protected PastedPath constructNewPathForCutCopyInternal(String site, String fromPath, String toPath) throws ServiceLayerException {
		// The following rules apply to content under the site folder
		String fromPathOnly = fromPath.substring(0, fromPath.lastIndexOf(FILE_SEPARATOR));
		String fromFileNameOnly = fromPath.substring(fromPath.lastIndexOf(FILE_SEPARATOR) + 1);
		logger.debug("Cut/copy name rules for site '{}' from path '{}' name '{}'", site,
				fromPathOnly, fromFileNameOnly);

		String newFileNameOnly = (toPath.contains(".xml")) ?
				toPath.substring(toPath.lastIndexOf(FILE_SEPARATOR) + 1) : fromFileNameOnly;

		logger.debug("Cut/copy name rules for site '{}' to path '{}' name '{}'", site, toPath, newFileNameOnly);

		String proposedDestPath;
		// Example NON INDEX FILES MOVE TO FOLDER
		// fromPath: "/site/website/search.xml"
		// toPath:   "/site/website/a-folder"
		// newPath:  "/site/website/products/a-folder/search.xml"
		//
		// Example  INDEX FILES MOVE to FOLDER
		// fromPath: "/site/website/search.xml"
		// toPath:   "/site/website/products/search.xml"
		// newPath:  "/site/website/products/search.xml"

		// Move location
		if (!contentRepository.contentExists(site, toPath) ||
				contentRepository.isFolder(site, toPath)) {
			proposedDestPath = toPath + FILE_SEPARATOR + fromFileNameOnly;
		} else {
			proposedDestPath = toPath;
		}

		logger.debug("Initial Proposed Path '{}' for site '{}' ", proposedDestPath, site);

		PastedPath result = new PastedPath(proposedDestPath, null);
		if (contentExists(site, proposedDestPath)) {
			result = adjustOnCollide(site, fromPath, toPath, proposedDestPath);
		}

		logger.debug("Final proposed path in site '{}' from '{}' to '{}' final name '{}'", site, fromPath, toPath,
				proposedDestPath);
		return result;
	}

	/**
	 * Adjusts the destination path in case the target path already exists.
	 *
	 * @param site            the site id
	 * @param fromPath        the source path of the content item to be cut/copy
	 * @param newPathOnly     the new path without the file name
	 * @param initialDestPath the initial destination path that was proposed
	 * @return the adjusted destination path
	 * @throws ServiceLayerException if an error occurs while calculating the target path
	 */
	protected PastedPath adjustOnCollide(final String site, final String fromPath,
										 final String newPathOnly, final String initialDestPath) throws ServiceLayerException {
		logger.debug("File already found at path '{}' in site '{}', create a new name", initialDestPath, site);
		try {
			String adjustedDestPath = initialDestPath;
			var siblings = contentRepository.getContentChildren(site, newPathOnly);
			var modifier = 1;
			var collisionFound = true;
			while (collisionFound) {
				String adjustedDestFilenameOnly = FilenameUtils.getName(adjustedDestPath);
				var matcher = COPY_FILE_MODIFIER_PATTERN.matcher(adjustedDestFilenameOnly);
				// check if the file already has a modifier (it is a copy of something)
				if (matcher.matches()) {
					// extract the values from the path
					var existingModifier = matcher.group(1); // the full modifier
					var modifierVersion = matcher.group(2); // the number of the modifier
					// remove the existing modifier
					adjustedDestPath = FilenameUtils.getFullPath(adjustedDestPath) + adjustedDestFilenameOnly.replaceFirst(existingModifier, "");
					// calculate the new modifier
					modifier = Integer.parseInt(modifierVersion) + 1;
				}
				int pdpli = adjustedDestPath.lastIndexOf(".");
				if (pdpli == -1) pdpli = adjustedDestPath.length();
				adjustedDestPath = format(COPY_FILE_MODIFIER_FORMAT,
						adjustedDestPath.substring(0, pdpli), modifier, adjustedDestPath.substring(pdpli));

				// for pages, we have to check the parent folder, in any other case the full path
				String newCollisionCheck = adjustedDestPath;
				collisionFound = siblings.stream()
						.map(item -> item.path() + File.separator + item.name())
						.anyMatch(newCollisionCheck::equals);
			}

			return new PastedPath(adjustedDestPath, getNewLabel(site, fromPath, modifier));
		} catch (Exception e) {
			throw new ServiceLayerException(format("Unable to generate an alternate path " +
					"for the name collision '%s' in site '%s'", initialDestPath, site), e);
		}
	}

	/**
	 * Reads the internal name of the content item and generates a new label, according to the
	 * modifier parameter.
	 *
	 * @param siteId   the site id
	 * @param path     the path of the content item
	 * @param modifier the "copy" number to be appended to the internal name
	 * @return the new label to set to the new content
	 */
	protected String getNewLabel(String siteId, String path, Integer modifier)
			throws ContentNotFoundException {
		String itemPath = underPagesRoot(path) ? path + SLASH_INDEX_FILE : path;
		if (modifier == null || !isDescriptor(itemPath)) {
			return null;
		}
		String oldLabel = FilenameUtils.getBaseName(path);
		if (isDescriptor(itemPath) && contentExists(siteId, itemPath)) {
			Document document = getItemDescriptor(siteId, itemPath, false);
			Element root = document.getRootElement();
			oldLabel = readSingleDocumentFromXPath(root, INTERNAL_NAME_XPATH);
		}
		if (StringUtils.isNotEmpty(oldLabel)) {
			String baseLabel = oldLabel.replaceFirst(INTERNAL_NAME_MODIFIER_PATTERN, "");
			return format(INTERNAL_NAME_MODIFIER_FORMAT, baseLabel, modifier);
		}
		return null;
	}

	@Override
	public Resource getContentAsResource(String site, String path) throws ContentNotFoundException {
		boolean exists;
		if (CS.equals(site, studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE))) {
			exists = contentExists(StringUtils.EMPTY, path);
		} else {
			exists = contentExists(site, path);
		}
		if (!exists) {
			throw new ContentNotFoundException(path, site,
					format("File '%s' not found in site '%s'", path, site));
		}
		return new ContentResource(this, site, path);
	}

	@Override
	public InputStream getContent(String siteId, String path) throws ContentNotFoundException {
		if (CS.equals(siteId, studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE))) {
			return this.contentRepository.getContent(StringUtils.EMPTY, path);
		}
		return this.contentRepository.getContent(siteId, path);
	}

	@SuppressWarnings("unused")
	public void setSemanticsAvailableActionsResolver(final SemanticsAvailableActionsResolver semanticsAvailableActionsResolver) {
		this.semanticsAvailableActionsResolver = semanticsAvailableActionsResolver;
	}

	@Override
	public void setApplicationEventPublisher(final @NonNull ApplicationEventPublisher eventPublisher) {
		this.eventPublisher = eventPublisher;
	}

	/**
	 * Record to hold the content item ids.
	 *
	 * @param objectId the object id
	 * @param groupId  the group id
	 */
	public record ContentItemIds(String objectId, String groupId) {

		/**
		 * Create a new ContentItemIds instance with the given objectId.
		 * This constructor generates a groupId based on the first 4 characters of the objectId.
		 *
		 * @param objectId the object id
		 */
		public ContentItemIds(String objectId) {
			this(objectId, objectId.substring(0, 4));
		}

		/**
		 * Generates a new ContentItemIds instance with a random UUID.
		 *
		 * @return a new ContentItemIds instance
		 */
		static ContentItemIds generate() {
			String objectId = UUID.randomUUID().toString();
			return new ContentItemIds(objectId);
		}
	}

	/**
	 * Simple record to hold the new path and label of a pasted item.
	 */
	protected static class PastedPath {
		protected String path;
		protected String newLabel;

		public PastedPath(final String path, final String newLabel) {
			this.path = path;
			this.newLabel = newLabel;
		}
	}
}
