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

package org.craftercms.studio.api.v2.security;

import org.apache.commons.lang3.StringUtils;

import static org.craftercms.studio.api.v1.constant.StudioConstants.*;
import static org.craftercms.studio.api.v2.dal.ItemState.*;
import static org.craftercms.studio.api.v2.security.ContentItemAvailableActionsConstants.*;

public final class ContentItemPossibleActionsConstants {

	/**
	 * Common possible actions shared by all content item types.
	 */
	public static final long COMMON = CONTENT_READ + CONTENT_COPY + CONTENT_READ_VERSION_HISTORY +
		CONTENT_GET_DEPENDENCIES + PUBLISH_REQUEST + CONTENT_EDIT + CONTENT_CUT +
		CONTENT_DUPLICATE + CONTENT_REVERT + CONTENT_DELETE + PUBLISH +
		ITEM_UNLOCK;

	/*
		TODO:
		Temporarily disabled RENAME permission until proper rename API is provided for all renamable content
		types and system types.
	 */
	public static final long PAGE = COMMON + CONTENT_CREATE + CONTENT_PASTE + CONTENT_CHANGE_TYPE +
		CONTENT_EDIT_CONTROLLER + CONTENT_EDIT_TEMPLATE + FOLDER_CREATE +
		CONTENT_DELETE_CONTROLLER + CONTENT_DELETE_TEMPLATE;

	public static final long ASSET = COMMON + CONTENT_RENAME;

	/*
		TODO:
		Temporarily disabled RENAME permission until proper rename API is provided for all renamable content
		types and system types.
	 */
	public static final long COMPONENT = COMMON + CONTENT_CHANGE_TYPE + CONTENT_EDIT_CONTROLLER +
		CONTENT_EDIT_TEMPLATE + CONTENT_DELETE_CONTROLLER + CONTENT_DELETE_TEMPLATE;

	/*
		TODO:
		Temporarily disabled RENAME permission until proper rename API is provided for all renamable content
		types and system types.
	 */
	public static final long DOCUMENT = COMMON;

	public static final long RENDERING_TEMPLATE = COMMON + CONTENT_RENAME;

	/*
		TODO:
		Temporarily disabled RENAME permission until proper rename API is provided for all renamable content
		types and system types.
	 */
	public static final long TAXONOMY = COMMON;

	public static final long CONTENT_TYPE = PUBLISH + PUBLISH_REQUEST;

	public static final long CONFIGURATION = PUBLISH + PUBLISH_REQUEST;

	public static final long FOLDER = CONTENT_COPY + CONTENT_CREATE + CONTENT_PASTE + CONTENT_RENAME + CONTENT_CUT +
		CONTENT_UPLOAD + FOLDER_CREATE + CONTENT_DELETE;

	public static final long USER = 0L;

	public static final long GROUP = 0L;

	public static final long FORM_DEFINITION = 0L;

	public static final long SITE = 0L;

	public static final long REMOTE_REPOSITORY = 0L;

	public static final long CONFIG_FOLDER = 0L;

	public static final long SCRIPT = COMMON + CONTENT_RENAME;

	/*
		TODO:
		Temporarily disabled RENAME permission until proper rename API is provided for all renamable content
		types and system types.
	 */
	public static final long LEVEL_DESCRIPTOR = COMMON;

	// Semantics Matrix for available actions
	public static final long ITEM_STATE_NEW = CONTENT_READ + CONTENT_COPY + CONTENT_READ_VERSION_HISTORY +
		CONTENT_GET_DEPENDENCIES + PUBLISH_REQUEST + CONTENT_CREATE + CONTENT_PASTE + CONTENT_EDIT +
		CONTENT_RENAME + CONTENT_CUT + CONTENT_UPLOAD + CONTENT_DUPLICATE + CONTENT_CHANGE_TYPE + CONTENT_REVERT +
		CONTENT_EDIT_CONTROLLER + CONTENT_EDIT_TEMPLATE + FOLDER_CREATE + CONTENT_DELETE +
		CONTENT_DELETE_CONTROLLER + CONTENT_DELETE_TEMPLATE + PUBLISH;

	public static final long ITEM_STATE_MODIFIED = CONTENT_READ + CONTENT_COPY + CONTENT_READ_VERSION_HISTORY +
		CONTENT_GET_DEPENDENCIES + PUBLISH_REQUEST + CONTENT_CREATE + CONTENT_PASTE + CONTENT_EDIT +
		CONTENT_RENAME + CONTENT_CUT + CONTENT_UPLOAD + CONTENT_DUPLICATE + CONTENT_CHANGE_TYPE + CONTENT_REVERT +
		CONTENT_EDIT_CONTROLLER + CONTENT_EDIT_TEMPLATE + FOLDER_CREATE + CONTENT_DELETE +
		CONTENT_DELETE_CONTROLLER + CONTENT_DELETE_TEMPLATE + PUBLISH;

	public static final long ITEM_STATE_DELETED = 0L;

	public static final long ITEM_STATE_USER_LOCKED = CONTENT_READ + CONTENT_COPY + CONTENT_READ_VERSION_HISTORY +
		CONTENT_GET_DEPENDENCIES + PUBLISH_REQUEST + CONTENT_CREATE + CONTENT_PASTE + CONTENT_EDIT +
		CONTENT_RENAME + CONTENT_CUT + CONTENT_UPLOAD + CONTENT_DUPLICATE + CONTENT_CHANGE_TYPE + CONTENT_REVERT +
		CONTENT_EDIT_CONTROLLER + CONTENT_EDIT_TEMPLATE + FOLDER_CREATE + CONTENT_DELETE +
		CONTENT_DELETE_CONTROLLER + CONTENT_DELETE_TEMPLATE + PUBLISH + ITEM_UNLOCK;

	public static final long ITEM_STATE_SYSTEM_PROCESSING = CONTENT_READ + CONTENT_COPY + CONTENT_READ_VERSION_HISTORY +
		CONTENT_GET_DEPENDENCIES + CONTENT_CREATE + CONTENT_PASTE + CONTENT_UPLOAD + CONTENT_DUPLICATE +
		FOLDER_CREATE;

	public static final long ITEM_STATE_IN_WORKFLOW = CONTENT_READ + CONTENT_COPY + CONTENT_READ_VERSION_HISTORY +
		CONTENT_GET_DEPENDENCIES + PUBLISH_REQUEST + CONTENT_CREATE + CONTENT_PASTE + CONTENT_EDIT +
		CONTENT_RENAME + CONTENT_CUT + CONTENT_UPLOAD + CONTENT_DUPLICATE + CONTENT_CHANGE_TYPE + CONTENT_REVERT +
		CONTENT_EDIT_CONTROLLER + CONTENT_EDIT_TEMPLATE + FOLDER_CREATE + CONTENT_DELETE +
		CONTENT_DELETE_CONTROLLER + CONTENT_DELETE_TEMPLATE + PUBLISH;

	public static final long ITEM_STATE_SCHEDULED = CONTENT_READ + CONTENT_COPY + CONTENT_READ_VERSION_HISTORY +
		CONTENT_GET_DEPENDENCIES + PUBLISH_REQUEST + CONTENT_CREATE + CONTENT_PASTE + CONTENT_EDIT +
		CONTENT_RENAME + CONTENT_CUT + CONTENT_UPLOAD + CONTENT_DUPLICATE + CONTENT_CHANGE_TYPE + CONTENT_REVERT +
		CONTENT_EDIT_CONTROLLER + CONTENT_EDIT_TEMPLATE + FOLDER_CREATE + CONTENT_DELETE +
		CONTENT_DELETE_CONTROLLER + CONTENT_DELETE_TEMPLATE + PUBLISH;

	public static final long ITEM_STATE_PUBLISHING = CONTENT_READ + CONTENT_COPY + CONTENT_READ_VERSION_HISTORY +
		CONTENT_GET_DEPENDENCIES + CONTENT_CREATE + CONTENT_PASTE + CONTENT_EDIT +
		CONTENT_RENAME + CONTENT_CUT + CONTENT_UPLOAD + CONTENT_DUPLICATE + CONTENT_CHANGE_TYPE + CONTENT_REVERT +
		CONTENT_EDIT_CONTROLLER + CONTENT_EDIT_TEMPLATE + FOLDER_CREATE;

	public static final long ITEM_STATE_STAGED = CONTENT_READ + CONTENT_COPY + CONTENT_READ_VERSION_HISTORY +
		CONTENT_GET_DEPENDENCIES + PUBLISH_REQUEST + CONTENT_CREATE + CONTENT_PASTE + CONTENT_EDIT +
		CONTENT_RENAME + CONTENT_CUT + CONTENT_UPLOAD + CONTENT_DUPLICATE + CONTENT_CHANGE_TYPE + CONTENT_REVERT +
		CONTENT_EDIT_CONTROLLER + CONTENT_EDIT_TEMPLATE + FOLDER_CREATE + CONTENT_DELETE +
		CONTENT_DELETE_CONTROLLER + CONTENT_DELETE_TEMPLATE + PUBLISH;

	public static final long ITEM_STATE_LIVE = CONTENT_READ + CONTENT_COPY + CONTENT_READ_VERSION_HISTORY +
		CONTENT_GET_DEPENDENCIES + CONTENT_CREATE + CONTENT_PASTE + CONTENT_EDIT +
		CONTENT_RENAME + CONTENT_CUT + CONTENT_UPLOAD + CONTENT_DUPLICATE + CONTENT_CHANGE_TYPE + CONTENT_REVERT +
		CONTENT_EDIT_CONTROLLER + CONTENT_EDIT_TEMPLATE + FOLDER_CREATE + CONTENT_DELETE +
		CONTENT_DELETE_CONTROLLER + CONTENT_DELETE_TEMPLATE + PUBLISH + PUBLISH_REQUEST;

	public static final long ITEM_STATE_TRANSLATION_UP_TO_DATE = 0L;

	public static final long ITEM_STATE_TRANSLATION_PENDING = 0L;

	public static final long ITEM_STATE_TRANSLATION_IN_PROGRESS = 0L;

	/**
	 * Get possible actions for item state
	 * @param itemState item state
	 * @param hasUnlockPermission flag if user has the unlock item permission
	 * @return a number present the possible actions
	 */
	public static long getPossibleActionsForItemState(long itemState, boolean hasUnlockPermission) {
		long result = 0L;
		if ((itemState & NEW.value) > 0) {
			result = result | ITEM_STATE_NEW;
		}
		if ((itemState & MODIFIED.value) > 0) {
			result = result | ITEM_STATE_MODIFIED;
		}
		if ((itemState & DELETED.value) > 0) {
			result = result | ITEM_STATE_DELETED;
		}
		if ((itemState & USER_LOCKED.value) > 0) {
			result = result | ITEM_STATE_USER_LOCKED;
		}
		if ((itemState & SYSTEM_PROCESSING.value) > 0) {
			result = result | ITEM_STATE_SYSTEM_PROCESSING;
		}
		if ((itemState & IN_WORKFLOW.value) > 0) {
			result = result | ITEM_STATE_IN_WORKFLOW;
		}
		if ((itemState & PUBLISHING.value) > 0) {
			result = result | ITEM_STATE_PUBLISHING;
		}
		if ((itemState & SCHEDULED.value) > 0) {
			result = result | ITEM_STATE_SCHEDULED;
		}
		if ((itemState & STAGED.value) > 0) {
			result = result | ITEM_STATE_STAGED;
		}
		if ((itemState & LIVE.value) > 0) {
			result = result | ITEM_STATE_LIVE;
		}
		if ((itemState & TRANSLATION_UP_TO_DATE.value) > 0) {
			result = result | ITEM_STATE_TRANSLATION_UP_TO_DATE;
		}
		if ((itemState & TRANSLATION_PENDING.value) > 0) {
			result = result | ITEM_STATE_TRANSLATION_PENDING;
		}
		if ((itemState & TRANSLATION_IN_PROGRESS.value) > 0) {
			result = result | ITEM_STATE_TRANSLATION_IN_PROGRESS;
		}

		if ((itemState & USER_LOCKED.value) > 0) {
			if (!hasUnlockPermission) {
				result &= ~PUBLISH_REQUEST;
				result &= ~CONTENT_EDIT;
				result &= ~CONTENT_RENAME;
				result &= ~CONTENT_CUT;
				result &= ~CONTENT_UPLOAD;
				result &= ~CONTENT_CHANGE_TYPE;
				result &= ~CONTENT_DELETE;
				result &= ~CONTENT_DELETE_CONTROLLER;
				result &= ~CONTENT_DELETE_TEMPLATE;
				result &= ~PUBLISH;
				result &= ~ITEM_UNLOCK;
				result &= ~CONTENT_REVERT;
				result &= ~CONTENT_DUPLICATE;
			}
		}
		return result;
	}

	public static long getPossibleActionsForObject(String type) {
		if (StringUtils.isEmpty(type)) return 0L;
		return switch (type) {
			case CONTENT_TYPE_PAGE -> PAGE;
			case CONTENT_TYPE_ASSET -> ASSET;
			case CONTENT_TYPE_COMPONENT -> COMPONENT;
			case CONTENT_TYPE_DOCUMENT -> DOCUMENT;
			case CONTENT_TYPE_RENDERING_TEMPLATE -> RENDERING_TEMPLATE;
			case CONTENT_TYPE_TAXONOMY -> TAXONOMY;
			case CONTENT_TYPE_CONTENT_TYPE -> CONTENT_TYPE;
			case CONTENT_TYPE_CONFIGURATION -> CONFIGURATION;
			case CONTENT_TYPE_FOLDER -> FOLDER;
			case CONTENT_TYPE_USER -> USER;
			case CONTENT_TYPE_GROUP -> GROUP;
			case CONTENT_TYPE_FORM_DEFINITION -> FORM_DEFINITION;
			case CONTENT_TYPE_SITE -> SITE;
			case CONTENT_TYPE_REMOTE_REPOSITORY -> REMOTE_REPOSITORY;
			case CONTENT_TYPE_CONFIG_FOLDER -> CONFIG_FOLDER;
			case CONTENT_TYPE_SCRIPT -> SCRIPT;
			case CONTENT_TYPE_LEVEL_DESCRIPTOR -> LEVEL_DESCRIPTOR;
			default -> 0L;
		};
	}

	private ContentItemPossibleActionsConstants() {
	}
}
