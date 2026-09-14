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

package org.craftercms.studio.impl.v2.security;

import org.apache.commons.collections4.CollectionUtils;
import org.craftercms.commons.lang.RegexUtils;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.dal.ItemDAO;
import org.craftercms.studio.api.v2.dal.ItemState;
import org.craftercms.studio.api.v2.dal.SiteDAO;
import org.craftercms.studio.api.v2.dal.item.ContentItem;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobStore;
import org.craftercms.studio.api.v2.repository.blob.StudioBlobStoreResolver;
import org.craftercms.studio.api.v2.security.AvailableActionsResolver;
import org.craftercms.studio.api.v2.security.SemanticsAvailableActionsResolver;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.api.v2.service.content.ContentTypeService;
import org.craftercms.studio.api.v2.service.security.UserService;
import org.craftercms.studio.model.rest.Person;

import java.util.List;
import java.util.Set;

import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.apache.commons.lang3.Strings.CS;
import static org.craftercms.studio.api.v1.constant.StudioConstants.CONTENT_TYPE_FOLDER;
import static org.craftercms.studio.api.v1.constant.StudioConstants.TOP_LEVEL_FOLDERS;
import static org.craftercms.studio.api.v2.dal.ItemState.USER_LOCKED;
import static org.craftercms.studio.api.v2.dal.ItemState.isSystemProcessing;
import static org.craftercms.studio.api.v2.security.ContentItemAvailableActionsConstants.*;
import static org.craftercms.studio.api.v2.security.ContentItemPossibleActionsConstants.getPossibleActionsForItemState;
import static org.craftercms.studio.api.v2.security.ContentItemPossibleActionsConstants.getPossibleActionsForObject;
import static org.craftercms.studio.api.v2.utils.StudioUtils.matchesPatterns;
import static org.craftercms.studio.permissions.StudioPermissionsConstants.PERMISSION_ITEM_UNLOCK;

/**
 * Default implementation of {@link SemanticsAvailableActionsResolver}
 */
public class SemanticsAvailableActionsResolverImpl implements SemanticsAvailableActionsResolver {

	private UserService userService;
	private AvailableActionsResolver availableActionsResolver;
	private ContentService contentService;
	private ItemDAO itemDAO;
	private ServicesConfig servicesConfig;
	private StudioBlobStoreResolver studioBlobStoreResolver;
	private ContentTypeService contentTypeService;
	private SiteDAO siteDAO;

	@Override
	public long calculateContentItemAvailableActions(String username, String siteId, ContentItem detailedItem)
			throws ServiceLayerException, UserNotFoundException {
		long userPermissionsBitmap = availableActionsResolver.getContentItemAvailableActions(username, siteId, detailedItem.getPath());
		long systemTypeBitmap = getPossibleActionsForObject(detailedItem.getSystemType());

		long result = userPermissionsBitmap & systemTypeBitmap;
		if (!CONTENT_TYPE_FOLDER.equals(detailedItem.getSystemType())) {
			long workflowStateBitmap = getPossibleActionsForItemState(detailedItem.getState(),
					hasUnlockPermission(detailedItem.getLockOwner(), detailedItem.getState(), siteId, detailedItem.getPath(), username));

			result &= workflowStateBitmap;
		}

		return applySpecialUseCaseFilters(username, siteId, detailedItem.getPath(), detailedItem.getMimeType(),
				detailedItem.getSystemType(), detailedItem.getContentTypeId(),
				detailedItem.getState(),
				result);
	}

	/**
	 * Determines if a user has the unlock permission for a specified path.
	 * A user has the unlock permission if any of the following conditions are met:
	 * 1. The user is the lock owner of the item.
	 * 2. The user has the "item_unlock" permission assigned through the permissions mapping.
	 *
	 * @param lockOwner the {@link Person} to check for unlock permissions.
	 * @param state the item state
	 * @param siteId site identifier
	 * @param path the path to check permission
	 * @param username The username of the user to check.
	 * @return {@code true} if the user has the unlock permission; {@code false} otherwise.
	 */
	private boolean hasUnlockPermission(Person lockOwner, long state, String siteId, String path, String username) throws ServiceLayerException, UserNotFoundException {
		boolean itemLocked = ItemState.isUserLocked(state);
		String lockOwnerUsername = itemLocked && lockOwner != null ? lockOwner.getUsername() : null;
		boolean isLockOwner = CS.equals(username, lockOwnerUsername);

		Set<String> userPermissions = userService.getUserPermissions(siteId, path, username);
		boolean hasUnlockPermission = CollectionUtils.isNotEmpty(userPermissions) && userPermissions.contains(PERMISSION_ITEM_UNLOCK);

		return isLockOwner || hasUnlockPermission;
	}

	private long applySpecialUseCaseFilters(String username, String siteId, String itemPath, String itemMimeType,
											String itemSystemType, String itemContentTypeId,
											long itemState,
											long availableActions)
			throws ServiceLayerException, UserNotFoundException {
		long result = availableActions;

		// The item is locked and the user is not the owner of the lock
		if ((itemState & USER_LOCKED.value) > 0 && (result & ITEM_UNLOCK) == 0) {
			// If the user is system_admin or site_admin, add the unlock action back
			if (userService.isSiteAdmin(username, siteId)) {
				result |= ITEM_UNLOCK;
			}
		}

		if (isSystemProcessing(itemState)) {
			result &= ~CONTENT_EDIT;
			result &= ~CONTENT_CUT;
			result &= ~CONTENT_COPY;
			result &= ~CONTENT_DELETE;
			result &= ~CONTENT_DUPLICATE;
			result &= ~CONTENT_PASTE;
			result &= ~CONTENT_REVERT;
			result &= ~CONTENT_CHANGE_TYPE;
			result &= ~CONTENT_RENAME;
			result &= ~PUBLISH_REQUEST;
			result &= ~BITMAP_PUBLISH;
			result &= ~CONTENT_CREATE;
			result &= ~FOLDER_CREATE;
		}

		if (RegexUtils.matchesAny(itemPath, TOP_LEVEL_FOLDERS)) {
			result &= ~CONTENT_DELETE;
			result &= ~CONTENT_CUT;
			result &= ~CONTENT_RENAME;
			result &= ~CONTENT_DUPLICATE;
			result &= ~CONTENT_COPY;
		}

		boolean isPublished = siteDAO.getSite(siteId).getPublishedRepoCreated();
		if (!isPublished) {
			// If initial publish is not done, the user cannot request a publish (PUBLISH_REQUEST will be added back later if there is a site-wide rule
			// granting the permission)
			result &= ~PUBLISH_REQUEST;
		}

		List<String> protectedFolderPatterns = servicesConfig.getProtectedFolderPatterns(siteId);
		if (CollectionUtils.isNotEmpty(protectedFolderPatterns) &&
				matchesPatterns(itemPath, protectedFolderPatterns)) {
			result &= ~CONTENT_DELETE;
			result &= ~CONTENT_CUT;
			result &= ~CONTENT_RENAME;
		}

		result = applyBlobStoreFilters(siteId, itemPath, itemSystemType, result);

		if ((result & CONTENT_EDIT) > 0 && (!contentService.isEditable(itemPath, itemMimeType))) {
			result &= ~CONTENT_EDIT;
		}

		if ((result & CONTENT_UPLOAD) > 0 &&
				(!CS.equals(itemSystemType, CONTENT_TYPE_FOLDER) ||
						!matchesPatterns(itemPath, servicesConfig.getAssetPatterns(siteId)))) {
			result &= ~CONTENT_UPLOAD;
		}

		// controller and template
		if (isNotEmpty(itemContentTypeId)) {
			String controllerPath = contentTypeService.getContentTypeControllerPath(itemContentTypeId);
			result = checkActionForDependency(siteId, username, controllerPath, result,
					CONTENT_EDIT_CONTROLLER, CONTENT_DELETE_CONTROLLER);
			String templatePath = contentTypeService.getContentTypeTemplatePath(siteId, itemContentTypeId);
			result = checkActionForDependency(siteId, username, templatePath, result,
					CONTENT_EDIT_TEMPLATE, CONTENT_DELETE_TEMPLATE);
		}

		long siteWideActions = availableActionsResolver.getSiteWideActions(siteId, username);
		result = result | siteWideActions;

		if (CONTENT_TYPE_FOLDER.equals(itemSystemType)) {
			long childrenCount = itemDAO.getSubtreeItemCount(siteId, List.of(itemPath));
			if (childrenCount == 0) {
				result &= ~PUBLISH;
				result &= ~PUBLISH_REQUEST;
			}
		}

		return result;
	}

	private long applyBlobStoreFilters(final String siteId, final String itemPath, String itemSystemType, final long availableActions) throws ServiceLayerException {
		long result = availableActions;

		if (studioBlobStoreResolver.isBlob(siteId, itemPath)) {
			result &= ~CONTENT_READ_VERSION_HISTORY;
			result &= ~CONTENT_REVERT;
		}

		String blobStorePath = itemPath;
		if ("folder".equals(itemSystemType)) {
			blobStorePath = CS.appendIfMissing(itemPath, "/");
		}
		StudioBlobStore blobStore = studioBlobStoreResolver.getByPaths(siteId, blobStorePath);
		if (blobStore != null && blobStore.isReadOnly()) {
			result &= ~CONTENT_DELETE;
			result &= ~CONTENT_EDIT;
			result &= ~CONTENT_DUPLICATE;
			result &= ~CONTENT_CUT;
			result &= ~CONTENT_PASTE;
			result &= ~CONTENT_UPLOAD;
			result &= ~CONTENT_CREATE;
			result &= ~CONTENT_RENAME;
			result &= ~FOLDER_CREATE;
		}

		return result;
	}

	private long checkActionForDependency(String siteId, String username, String dependencyPath,
										  long actions, long itemEditMask,
										  long itemDeleteMask)
			throws UserNotFoundException, ServiceLayerException {
		if (isNotEmpty(dependencyPath)) {
			long depAvailableActions = availableActionsResolver.getContentItemAvailableActions(username, siteId, dependencyPath);
			actions = updateForDependency(actions, depAvailableActions, itemEditMask, CONTENT_EDIT);
			actions = updateForDependency(actions, depAvailableActions, itemDeleteMask, CONTENT_DELETE);
		} else {
			actions &= ~itemEditMask;
			actions &= ~itemDeleteMask;
		}
		return actions;
	}

	private long updateForDependency(long itemActions, long dependencyActions, long itemActionMask,
									 long dependencyActionMask) {
		// Check if the available actions for the dependency contain the required bit
		if ((dependencyActions & dependencyActionMask) > 0) {
			// If so, turn on the bit for the item too
			itemActions |= itemActionMask;
		} else {
			// Otherwise, turn off the bit for the item
			itemActions &= ~itemActionMask;
		}
		return itemActions;
	}

	@SuppressWarnings("unused")
	public void setAvailableActionsResolver(AvailableActionsResolver availableActionsResolver) {
		this.availableActionsResolver = availableActionsResolver;
	}

	public void setContentService(ContentService contentService) {
		this.contentService = contentService;
	}

	public void setServicesConfig(ServicesConfig servicesConfig) {
		this.servicesConfig = servicesConfig;
	}

	@SuppressWarnings("unused")
	public void setStudioBlobStoreResolver(StudioBlobStoreResolver studioBlobStoreResolver) {
		this.studioBlobStoreResolver = studioBlobStoreResolver;
	}

	public void setContentTypeService(ContentTypeService contentTypeService) {
		this.contentTypeService = contentTypeService;
	}

	@SuppressWarnings("unused")
	public void setUserService(UserService userService) {
		this.userService = userService;
	}

	@SuppressWarnings("unused")
	public void setItemDAO(final ItemDAO itemDAO) {
		this.itemDAO = itemDAO;
	}

	@SuppressWarnings("unused")
	public void setSiteDAO(final SiteDAO siteDAO) {
		this.siteDAO = siteDAO;
	}
}
