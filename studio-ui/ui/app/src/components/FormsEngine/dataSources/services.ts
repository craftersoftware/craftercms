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

import type { Dispatch } from 'redux';
import type { BrowseFilesDialogProps } from '../../BrowseFilesDialog';
import type { SearchProps } from '../../Search';
import type { FormsEngineGlobalApiContextProps } from '../lib/formsEngineContext';
import {
	showBrowseExternalAssetDialog,
	showBrowseFilesDialog,
	showExternalAssetUploadDialog,
	showSearchDialog,
	showSingleFileUploadDialog
} from '../lib/controlHelpers';
import type { DataSourceServices } from './types';

/** Redux dispatch + site + forms API needed to bridge dialog / `pushForm` UI into promise services. */
export interface CreateDataSourceServicesOptions {
	dispatch: Dispatch;
	siteId: string;
	formsApi: Pick<FormsEngineGlobalApiContextProps, 'pushForm'>;
}

/**
 * Adapts callback-driven Studio UI operations into the promise-based data-source extension API.
 * Cancel / close resolves empty or `null` so actions treat dismiss as no selection.
 */
export function createDataSourceServices({
	dispatch,
	siteId,
	formsApi
}: CreateDataSourceServicesOptions): DataSourceServices {
	return {
		browseFiles(request) {
			return new Promise((resolve) => {
				showBrowseFilesDialog({
					dispatch,
					path: request.path,
					contentTypes: request.contentTypes,
					mimeTypes: request.mimeTypes,
					multiSelect: request.multiSelect,
					preselectedPaths: request.preselectedPaths,
					initialParameters: request.initialParameters as BrowseFilesDialogProps['initialParameters'],
					onClose: () => resolve([]),
					onSuccess(items) {
						resolve(Array.isArray(items) ? items : [items]);
					}
				});
			});
		},
		browseExternalAssets(request) {
			return new Promise((resolve) => {
				showBrowseExternalAssetDialog({
					dispatch,
					path: request.path,
					profileId: request.profileId,
					profileType: request.profileType,
					type: request.type,
					multiSelect: request.multiSelect,
					preselectedPaths: request.preselectedPaths,
					onClose: () => resolve([]),
					onSuccess(items) {
						resolve(Array.isArray(items) ? items : [items]);
					}
				});
			});
		},
		search(request) {
			return new Promise((resolve) => {
				showSearchDialog({
					dispatch,
					path: request.path,
					contentTypes: request.contentTypes,
					preselectedPaths: request.preselectedPaths,
					initialParameters: request.initialParameters as SearchProps['initialParameters'],
					onClose: () => resolve({ paths: [], items: [] }),
					onAcceptSelection(paths, items) {
						resolve({ paths, items });
					}
				});
			});
		},
		upload(request) {
			return new Promise((resolve) => {
				showSingleFileUploadDialog({
					dispatch,
					siteId,
					path: request.path,
					fileTypes: request.fileTypes,
					onUploadComplete: resolve
				});
			});
		},
		uploadExternalAssets(request) {
			return new Promise((resolve) => {
				showExternalAssetUploadDialog({
					dispatch,
					path: request.path,
					profileId: request.profileId,
					profileType: request.profileType,
					fileTypes: request.fileTypes,
					onClose: () => resolve(null),
					onUploadComplete: resolve
				});
			});
		},
		createContent(request) {
			return new Promise((resolve) => {
				let settled = false;
				const finish = (result: Parameters<typeof resolve>[0]) => {
					if (!settled) {
						settled = true;
						resolve(result);
					}
				};
				formsApi.pushForm({
					create: {
						path: request.path,
						contentTypeId: request.contentTypeId,
						embedded: request.embedded
					},
					onClose: () => finish(null),
					onSave({ values, path }) {
						finish({
							kind: 'item',
							path,
							contentTypeId: request.contentTypeId,
							value: values
						});
						return Promise.resolve({ close: true });
					}
				});
			});
		},
		pushForm: formsApi.pushForm
	};
}
