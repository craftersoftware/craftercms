/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import { defineMessages } from 'react-intl';

export const guestMessages = defineMessages({
	maxCount: {
		id: 'validations.maxCount',
		defaultMessage: 'The max number of items is {maxCount}'
	},
	minCount: {
		id: 'validations.minCount',
		defaultMessage: 'The min number of items is {minCount}'
	},
	required: {
		id: 'validations.required',
		defaultMessage: '{field} is required'
	},
	maxLength: {
		id: 'validations.maxLength',
		defaultMessage: 'Maximum length reached ({maxLength})'
	},
	yes: {
		id: 'words.yes',
		defaultMessage: 'Yes'
	},
	registerNotFound: {
		id: 'register.notFound',
		defaultMessage: "{name} is not visible or was not registered by it's developer"
	},
	dropTargetsNotFound: {
		id: 'register.dropTargetsNotFound',
		defaultMessage: 'There are no drop targets for {contentType} components'
	},
	sortOperationComplete: {
		id: 'operations.sortOperationComplete',
		defaultMessage: 'Sort operation completed.'
	},
	sortOperationFailed: {
		id: 'operations.sortOperationFailed',
		defaultMessage: 'Sort operation failed.'
	},
	insertOperationComplete: {
		id: 'operations.insertOperationComplete',
		defaultMessage: 'Insert component operation completed.'
	},
	insertOperationFailed: {
		id: 'operations.insertOperationFailed',
		defaultMessage: 'Insert component operation failed.'
	},
	insertItemOperationComplete: {
		id: 'operations.insertItemOperationComplete',
		defaultMessage: 'Item created successfully.'
	},
	insertItemOperationFailed: {
		id: 'operations.insertItemOperationFailed',
		defaultMessage: 'Item creation failed.'
	},
	duplicateItemOperationComplete: {
		id: 'operations.duplicateItemOperationComplete',
		defaultMessage: 'Item duplicated successfully.'
	},
	duplicateItemOperationFailed: {
		id: 'operations.duplicateItemOperationFailed',
		defaultMessage: 'Item duplication failed.'
	},
	moveOperationComplete: {
		id: 'operations.moveOperationComplete',
		defaultMessage: 'Move operation completed'
	},
	moveOperationFailed: {
		id: 'operations.moveOperationFailed',
		defaultMessage: 'Move operation failed.'
	},
	deleteOperationComplete: {
		id: 'operations.deleteOperationComplete',
		defaultMessage: 'Delete operation completed.'
	},
	deleteOperationFailed: {
		id: 'operations.deleteOperationFailed',
		defaultMessage: 'Delete operation failed.'
	},
	updateOperationComplete: {
		id: 'operations.updateOperationComplete',
		defaultMessage: 'Update operation completed.'
	},
	updateOperationFailed: {
		id: 'operations.updateOperationFailed',
		defaultMessage: 'Update operation failed.'
	},
	assetUploadStarted: {
		id: 'operations.assetUploadStarted',
		defaultMessage: 'Asset upload started.'
	},
	assetUploadFailed: {
		id: 'operations.assetUploadFailed',
		defaultMessage: 'Asset Upload failed.'
	},
	itemLocked: {
		id: 'validations.itemLocked',
		defaultMessage: 'The item is already locked by {lockOwner}. Please try again later.'
	},
	outOfSyncContent: {
		id: 'validations.outOfSyncContent',
		defaultMessage:
			'An automatic reload was performed because the item was changed in the background. Please try again.'
	},
	currentContentChangedByAnotherUser: {
		id: 'previewConcierge.currentContentChangedByAnotherUser',
		defaultMessage: '{name} has changed the current page. Reload?'
	},
	contentWasChangedByAnotherUser: {
		id: 'previewConcierge.contentWasChangedByAnotherUser',
		defaultMessage: '{name} has changed {content}. Reload?'
	},
	contentWasLockedByAnotherUser: {
		id: 'previewConcierge.contentWasLockedByAnotherUser',
		defaultMessage: 'The item was locked by {name}. Edit mode disabled until lock is released.'
	},
	allowImagesFromRepo: {
		id: 'datasourceActionList.imageFromRepoLabel',
		defaultMessage: 'Image from repository'
	},
	allowImageUpload: {
		id: 'datasourceActionList.imageFromDesktopLabel',
		defaultMessage: 'Upload image from desktop'
	},
	allowVideosFromRepo: {
		id: 'datasourceActionList.videoFromRepoLabel',
		defaultMessage: 'Video from repository'
	},
	allowVideoUpload: {
		id: 'datasourceActionList.videoFromDesktopLabel',
		defaultMessage: 'Upload video from desktop'
	},
	allowAudioUpload: {
		defaultMessage: 'Upload audio from desktop'
	},
	allowAudioFromRepo: {
		defaultMessage: 'Audio from repository'
	},
	noDataSourcesSet: {
		id: 'validations.noDataSourcesSet',
		defaultMessage:
			'No data sources are configured for this editor. Please contact your administrator to complete this configuration.'
	},
	noPathSetInDataSource: {
		id: 'validations.noPathSetInDataSource',
		defaultMessage: 'No path was set for the data source'
	},
	noPolicyComply: {
		id: 'desktopAssetUpload.noPolicyComply',
		defaultMessage: 'File "{fileName}" doesn\'t comply with project policies: {detail}'
	},
	uploadError: {
		id: 'desktopAssetUpload.uploadError',
		defaultMessage: 'Upload error. File was not uploaded'
	},
	outdatedExpBuilderVersion: {
		id: 'validations.outdatedExpBuilderVersion',
		defaultMessage:
			"Your application's Experience Builder package version is out of date. Please notify the development team to perform the necessary updates to avoid any possible issues."
	},
	noDocTypeError: {
		id: 'validations.noDocTypeError',
		defaultMessage:
			'Unable to initialize Rich Text Editor (No document type was found for the current content). Please contact your administrator for assistance.'
	}
});
