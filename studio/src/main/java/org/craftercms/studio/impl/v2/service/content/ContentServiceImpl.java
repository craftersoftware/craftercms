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

package org.craftercms.studio.impl.v2.service.content;

import java.io.InputStream;
import static java.lang.String.format;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.craftercms.commons.rest.parameters.SortField;
import org.craftercms.commons.security.permissions.DefaultPermission;
import org.craftercms.commons.security.permissions.annotations.HasPermission;
import org.craftercms.commons.security.permissions.annotations.ProtectedResourceId;
import org.craftercms.commons.validation.ValidationException;
import org.craftercms.commons.validation.annotations.param.ValidateSecurePathParam;
import org.craftercms.core.exception.PathNotFoundException;
import org.craftercms.core.service.Item;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.annotation.policy.ActionSourcePath;
import org.craftercms.studio.api.v2.annotation.policy.ActionTargetFilename;
import org.craftercms.studio.api.v2.annotation.policy.ActionTargetPath;
import org.craftercms.studio.api.v2.annotation.policy.ValidateAction;
import org.craftercms.studio.api.v2.annotation.precondition.RequireContentExists;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteBootstrapComplete;
import org.craftercms.studio.api.v2.annotation.precondition.RequireSiteReady;
import org.craftercms.studio.api.v2.annotation.resourceids.ContentPath;
import org.craftercms.studio.api.v2.annotation.resourceids.ContentPathList;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.Site;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.dal.item.ContentItem;
import org.craftercms.studio.api.v2.dal.item.LightItem;
import org.craftercms.studio.api.v2.exception.repository.RepositoryException;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.model.history.ItemVersion;
import org.craftercms.studio.model.history.RepositoryVersion;
import org.craftercms.studio.model.policy.Type;
import static org.craftercms.studio.model.policy.Type.COPY;
import org.craftercms.studio.model.rest.content.DeleteContentResult;
import org.craftercms.studio.model.rest.content.GetChildrenBulkRequest.PathParams;
import org.craftercms.studio.model.rest.content.GetChildrenByPathsBulkResult;
import org.craftercms.studio.model.rest.content.PasteContentResult;
import org.craftercms.studio.model.rest.content.WriteContentResult;
import org.craftercms.studio.model.rest.content.order.ItemOrder;
import org.craftercms.studio.model.rest.content.order.ReorderItemRequest;
import org.craftercms.studio.permissions.CompositePermission;
import org.craftercms.studio.permissions.PermissionOrOwnership;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PATH_RESOURCE_ID;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_DELETE;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_READ;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_CONTENT_WRITE;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_FOLDER_CREATE;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_GET_CHILDREN;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_ITEM_UNLOCK;
import org.dom4j.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;

import jakarta.validation.Valid;

public class ContentServiceImpl implements ContentService {

	private static final Logger logger = LoggerFactory.getLogger(ContentServiceImpl.class);

	private ContentService contentServiceInternal;

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public boolean contentExists(@SiteId String siteId,
								 @ProtectedResourceId(PATH_RESOURCE_ID) String path) {
		return contentServiceInternal.contentExists(siteId, path);
	}

	@Override
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public boolean shallowContentExists(@SiteId String site, String path) throws SiteNotFoundException {
		return contentServiceInternal.shallowContentExists(site, path);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = CompositePermission.class, action = PERMISSION_CONTENT_READ)
	public List<LightItem> getChildItems(@SiteId String siteId,
										 @ContentPathList List<String> paths) throws SiteNotFoundException {
		return contentServiceInternal.getChildItems(siteId, paths);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = CompositePermission.class, action = PERMISSION_CONTENT_DELETE)
	public DeleteContentResult deleteContent(@SiteId String siteId,
											 @ContentPathList Set<String> paths,
											 String publishTitle,
											 String publishComment)
			throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		return contentServiceInternal.deleteContent(siteId, paths, publishTitle, publishComment);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = CompositePermission.class, action = PERMISSION_GET_CHILDREN)
	public GetChildrenByPathsBulkResult getChildrenByPaths(@SiteId String siteId,
														   @ContentPathList List<String> paths,
														   Map<String, PathParams> pathParams)
			throws ServiceLayerException, UserNotFoundException {
		return contentServiceInternal.getChildrenByPaths(siteId, paths, pathParams);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public Item getItem(@SiteId String siteId,
						@ProtectedResourceId(PATH_RESOURCE_ID) String path, boolean flatten)
			throws SiteNotFoundException, ContentNotFoundException {
		try {
			return contentServiceInternal.getItem(siteId, path, flatten);
		} catch (PathNotFoundException e) {
			logger.error("Content not found for site '{}' at path '{}'", siteId, path, e);
			throw new ContentNotFoundException(path, siteId, format("Content not found in site '%s' at path '%s'", siteId, path));
		}
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public Document getItemDescriptor(@SiteId String siteId,
									  @ProtectedResourceId(PATH_RESOURCE_ID) String path, boolean flatten)
			throws SiteNotFoundException, ContentNotFoundException {
		return contentServiceInternal.getItemDescriptor(siteId, path, flatten);
	}

	@Override
	@RequireSiteReady
	@RequireContentExists
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_GET_CHILDREN)
	public ContentItem getItemByPath(@SiteId String siteId, @ContentPath String path, boolean preferContent)
			throws ServiceLayerException, UserNotFoundException {
		return contentServiceInternal.getItemByPath(siteId, path, preferContent);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = CompositePermission.class, action = PERMISSION_GET_CHILDREN)
	public List<ContentItem> getContentItemsByPath(@SiteId String siteId,
												   @ContentPathList Collection<String> paths,
												   boolean preferContent)
			throws ServiceLayerException, UserNotFoundException {
		return contentServiceInternal.getContentItemsByPath(siteId, paths, preferContent);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = CompositePermission.class, action = PERMISSION_CONTENT_WRITE)
	public void lockContent(@SiteId String siteId,
							@ProtectedResourceId(PATH_RESOURCE_ID) String path)
			throws UserNotFoundException, ServiceLayerException {
		contentServiceInternal.lockContent(siteId, path);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = PermissionOrOwnership.class, action = PERMISSION_ITEM_UNLOCK)
	public void unlockContent(@SiteId String siteId,
							  @ProtectedResourceId(PATH_RESOURCE_ID) String path)
			throws ContentNotFoundException, SiteNotFoundException, RepositoryException {
		contentServiceInternal.unlockContent(siteId, path);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public Optional<Resource> getContentByCommitId(@SiteId String siteId,
												   @ProtectedResourceId(PATH_RESOURCE_ID) String path,
												   String commitId) throws ServiceLayerException {
		return contentServiceInternal.getContentByCommitId(siteId, path, commitId);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@ValidateAction(type = Type.RENAME)
	@HasPermission(type = CompositePermission.class, action = PERMISSION_CONTENT_WRITE)
	public void renameContent(@SiteId String site,
							  @ContentPath @ActionTargetPath String path, @ActionTargetFilename String name)
			throws ServiceLayerException, UserNotFoundException, ValidationException, AuthenticationException {
		contentServiceInternal.renameContent(site, path, name);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@ValidateAction(type = Type.MOVE)
	@HasPermission(type = CompositePermission.class, action = PERMISSION_CONTENT_WRITE)
	public PasteContentResult move(@SiteId String siteId, @ActionSourcePath String sourcePath, @ActionTargetPath @ContentPath String targetPath)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		return contentServiceInternal.move(siteId, sourcePath, targetPath);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@ValidateAction(type = Type.MOVE)
	@HasPermission(type = CompositePermission.class, action = PERMISSION_CONTENT_WRITE)
	public PasteContentResult moveToParentPath(@SiteId String siteId, @ActionSourcePath String sourcePath, @ActionTargetPath String targetParent)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		return contentServiceInternal.moveToParentPath(siteId, sourcePath, targetParent);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@ValidateAction(type = Type.MOVE)
	@HasPermission(type = CompositePermission.class, action = PERMISSION_CONTENT_WRITE)
	public WriteContentResult moveAndUpdate(@SiteId String siteId, @ActionSourcePath String sourcePath,
											@ActionTargetPath String targetPath, String content)
			throws AuthenticationException, ServiceLayerException, UserNotFoundException {
		return contentServiceInternal.moveAndUpdate(siteId, sourcePath, targetPath, content);
	}

	@Override
	@Valid
	@RequireSiteReady
	@RequireContentExists
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public Resource getContentAsResource(@SiteId String site,
										 @ValidateSecurePathParam @ContentPath String path)
			throws ContentNotFoundException {
		return contentServiceInternal.getContentAsResource(site, path);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public InputStream getContent(@SiteId String siteId, @ContentPath String path) throws ContentNotFoundException {
		return contentServiceInternal.getContent(siteId, path);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@RequireContentExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public List<ItemVersion> getContentVersionHistory(@SiteId String siteId, @ContentPath String path) throws ServiceLayerException {
		return contentServiceInternal.getContentVersionHistory(siteId, path);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public Collection<RepositoryVersion> getHistory(@SiteId String siteId, String start, int limit) throws ServiceLayerException {
		return contentServiceInternal.getHistory(siteId, start, limit);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@ValidateAction(type = Type.CREATE)
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_WRITE)
	public WriteContentResult write(@SiteId String siteId, @ContentPath @ActionTargetPath String path, InputStream content, String comment)
			throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		return contentServiceInternal.write(siteId, path, content, comment);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@ValidateAction(type = COPY)
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_WRITE)
	public PasteContentResult copy(@SiteId String siteId, @ActionSourcePath String sourcePath,
								   @ActionTargetPath @ContentPath String targetPath, Set<String> copyPaths)
			throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		return contentServiceInternal.copy(siteId, sourcePath, targetPath, copyPaths);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@ValidateAction(type = COPY)
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public PasteContentResult duplicate(@SiteId String siteId, @ContentPath String sourcePath) throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		return contentServiceInternal.duplicate(siteId, sourcePath);
	}

	@Override
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_WRITE)
	@ValidateAction(type = Type.EDIT)
	public void revert(@SiteId String siteId, @ActionTargetPath @ContentPath String path, String commitId) throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		contentServiceInternal.revert(siteId, path, commitId);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_FOLDER_CREATE)
	@ValidateAction(type = Type.CREATE)
	public WriteContentResult createFolder(@SiteId String siteId, @ActionTargetPath @ContentPath String path)
			throws UserNotFoundException, ServiceLayerException, AuthenticationException {
		return contentServiceInternal.createFolder(siteId, path);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@RequireContentExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public long getContentSize(@SiteId String siteId, @ContentPath String path) {
		return contentServiceInternal.getContentSize(siteId, path);
	}

	@Override
	public boolean isEditable(String itemPath, String itemMimeType) {
		return contentServiceInternal.isEditable(itemPath, itemMimeType);
	}

	@Override
	@RequireSiteReady
	@RequireSiteBootstrapComplete
	@RequireContentExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public List<ContentItem> getContentItemsByStates(@SiteId String siteId, long statesBitMap,
													 List<String> systemTypes, List<SortField> sortFields, int offset, int limit) throws UserNotFoundException, ServiceLayerException {
		return contentServiceInternal.getContentItemsByStates(siteId, statesBitMap, systemTypes, sortFields, offset, limit);
	}

	// This method is internal, no need for permission annotations
	@Override
	public void processCreatedFiles(Site site, User creator) throws ServiceLayerException {
		contentServiceInternal.processCreatedFiles(site, creator);
	}

	@Override
	@RequireSiteReady
	@RequireContentExists
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public List<ItemOrder> getItemsOrder(@SiteId String siteId, @ContentPath String parentPath) throws ServiceLayerException {
		return contentServiceInternal.getItemsOrder(siteId, parentPath);
	}

	@Override
	@RequireSiteReady
	@HasPermission(type = DefaultPermission.class, action = PERMISSION_CONTENT_READ)
	public double reorderItem(@SiteId String siteId, ReorderItemRequest request) throws ServiceLayerException {
		return contentServiceInternal.reorderItem(siteId, request);
	}

	@SuppressWarnings("unused")
	public void setContentServiceInternal(final ContentService contentServiceInternal) {
		this.contentServiceInternal = contentServiceInternal;
	}
}
