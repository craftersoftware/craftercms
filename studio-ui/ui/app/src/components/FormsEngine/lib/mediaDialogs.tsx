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

import { FormattedMessage } from 'react-intl';
import { getFileNameFromPath } from '../../../utils/path';
import { isExternalMediaUrl, resolveMediaUrl } from '../../../utils/string';
import { Dispatch as ReduxDispatch } from 'redux';
import type { BrowseFilesDialogProps } from '../../BrowseFilesDialog';
import type { BrowseExternalAssetDialogProps } from '../../BrowseS3Dialog';
import type { ExternalAssetUploadDialogProps } from '../../ExternalAssetUploadDialog';
import { nanoid } from 'nanoid';
import { popDialog, pushDialog, pushNonDialog } from '../../../state/actions/dialogStack';
import { createComponentId } from '../../../utils/system';
import type { SearchProps } from '../../Search';
import type { ImageRestrictions } from '../../ImageEditorDialog/types';
import type { SingleFileUploadDialogProps } from '../../SingleFileUploadDialog';
import type { FileUploadResult } from '../../SingleFileUpload';

/** Triggers a browser download of the media at `url`, resolved against `base`. */
export function downloadMedia(base: string, url: string) {
	const link = document.createElement('a');
	link.href = resolveMediaUrl(base, url);
	link.download = getFileNameFromPath(url); // Extracts the file name from the URL
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

export const showBrowseFilesDialog = ({
	dispatch,
	onSuccess,
	path,
	contentTypes,
	mimeTypes,
	multiSelect = true,
	preselectedPaths = [],
	initialParameters = {},
	onClose
}: {
	path: string;
	dispatch: ReduxDispatch;
	onSuccess: BrowseFilesDialogProps['onSuccess'];
	contentTypes?: string[];
	mimeTypes?: string[];
	multiSelect?: boolean;
	preselectedPaths?: string[];
	initialParameters?: BrowseFilesDialogProps['initialParameters'];
	onClose?(): void;
}): void => {
	const id = nanoid();
	dispatch(
		pushDialog({
			id,
			component: createComponentId('BrowseFilesDialog'),
			props: {
				path,
				multiSelect,
				allowUpload: false,
				contentTypes: contentTypes ?? [],
				mimeTypes,
				preselectedPaths,
				initialParameters,
				onClose: () => {
					dispatch(popDialog({ id }));
					onClose?.();
				},
				onSuccess(items) {
					dispatch(popDialog({ id }));
					onSuccess(items);
				}
			} as Partial<BrowseFilesDialogProps>
		})
	);
};

export const showBrowseExternalAssetDialog = ({
	dispatch,
	onSuccess,
	path,
	profileId,
	profileType = 'aws',
	type,
	multiSelect = true,
	preselectedPaths = [],
	onClose
}: {
	dispatch: ReduxDispatch;
	onSuccess: BrowseExternalAssetDialogProps['onSuccess'];
	path: string;
	profileId: string;
	profileType?: BrowseExternalAssetDialogProps['profileType'];
	type?: string;
	multiSelect?: boolean;
	preselectedPaths?: string[];
	onClose?(): void;
}): void => {
	const id = nanoid();
	dispatch(
		pushDialog({
			id,
			component: createComponentId('BrowseExternalAssetDialog'),
			props: {
				path,
				profileId,
				profileType,
				type,
				multiSelect,
				preselectedPaths,
				onClose: () => {
					dispatch(popDialog({ id }));
					onClose?.();
				},
				onSuccess(items) {
					dispatch(popDialog({ id }));
					onSuccess?.(items);
				}
			} as Partial<BrowseExternalAssetDialogProps>
		})
	);
};

export const showSearchDialog = ({
	dispatch,
	path,
	preselectedPaths = [],
	contentTypes,
	onAcceptSelection,
	initialParameters,
	onClose
}: {
	path: string;
	contentTypes?: string[];
	preselectedPaths?: string[];
	initialParameters?: SearchProps['initialParameters'];
	dispatch: ReduxDispatch;
	onAcceptSelection: SearchProps['onAcceptSelection'];
	onClose?(): void;
}): void => {
	const id = nanoid();
	dispatch(
		pushNonDialog({
			id,
			component: createComponentId('Search'),
			props: {
				mode: 'select',
				embedded: true,
				initialParameters: {
					path,
					sortBy: 'internalName',
					...initialParameters,
					...(contentTypes && {
						filters: {
							...(initialParameters?.filters ?? {}),
							'content-type': contentTypes
						}
					})
				},
				preselectedPaths,
				onClose: () => {
					dispatch(popDialog({ id }));
					onClose?.();
				},
				onAcceptSelection(paths, items) {
					dispatch(popDialog({ id }));
					onAcceptSelection(paths, items);
				}
			} as Partial<SearchProps>
		})
	);
};

export const showSingleFileUploadDialog = ({
	dispatch,
	siteId,
	path,
	fileTypes,
	onFileAdded,
	onUploadComplete
}: {
	dispatch: ReduxDispatch;
	siteId: string;
	path: string;
	fileTypes?: string[];
	onFileAdded?: SingleFileUploadDialogProps['onFileAdded'];
	onUploadComplete?: SingleFileUploadDialogProps['onUploadComplete'];
}): void => {
	const id = nanoid();
	dispatch(
		pushDialog({
			id,
			component: createComponentId('SingleFileUploadDialog'),
			props: {
				site: siteId,
				path,
				fileTypes,
				onFileAdded,
				onUploadComplete: (result: FileUploadResult) => {
					dispatch(popDialog({ id }));
					onUploadComplete?.(result);
				}
			} as SingleFileUploadDialogProps
		})
	);
};

export const showExternalAssetUploadDialog = ({
	dispatch,
	path,
	profileId,
	inputProfileId,
	outputProfileId,
	profileType = 'aws',
	fileTypes,
	transcode,
	onUploadComplete,
	onClose
}: {
	dispatch: ReduxDispatch;
	path: string;
	profileId?: string;
	inputProfileId?: string;
	outputProfileId?: string;
	profileType?: ExternalAssetUploadDialogProps['profileType'];
	fileTypes?: string[];
	transcode?: boolean;
	onUploadComplete?: ExternalAssetUploadDialogProps['onUploadComplete'];
	onClose?(): void;
}): void => {
	const id = nanoid();
	dispatch(
		pushDialog({
			id,
			component: createComponentId('ExternalAssetUploadDialog'),
			props: {
				path,
				profileId,
				inputProfileId,
				outputProfileId,
				profileType,
				fileTypes,
				transcode,
				onClose: () => {
					dispatch(popDialog({ id }));
					onClose?.();
				},
				onUploadComplete: (result) => {
					dispatch(popDialog({ id }));
					onUploadComplete?.(result);
				}
			} as Partial<ExternalAssetUploadDialogProps>
		})
	);
};

export const showImageCropDialog = ({
	dispatch,
	path,
	mimeType,
	restrictions,
	writeContent,
	onCrop
}: {
	dispatch: ReduxDispatch;
	path: string;
	mimeType?: string;
	restrictions?: ImageRestrictions;
	writeContent?: boolean;
	onCrop: (blob: Blob, newPath?: string) => void;
}): void => {
	const dialogId = nanoid();
	// Remote/absolute URLs load as `src` in the editor; writing cropped content back requires a site path.
	const canWriteContent = writeContent !== false && !isExternalMediaUrl(path);
	dispatch(
		pushDialog({
			id: dialogId,
			component: createComponentId('ImageEditorDialog'),
			props: {
				path,
				mimeType,
				subtitle: restrictions ? <ImageRestrictionSubtitle restrictions={restrictions} /> : undefined,
				restrictions,
				writeContent: canWriteContent,
				onCrop: (blob: Blob, newPath: string) => {
					dispatch(popDialog({ id: dialogId }));
					onCrop?.(blob, newPath);
				}
			}
		})
	);
};

/** Generates user-friendly messages for image width and height restrictions.
 *
 * @param restrictions - An object containing image dimension restrictions.
 * @returns An object with formatted width and height restriction messages.
 */
export const getImageRestrictionMessages = (restrictions: ImageRestrictions) => {
	const width = [
		restrictions.width ? ` equal to ${restrictions.width}px` : null,
		restrictions.minWidth ? ` minimum ${restrictions.minWidth}px` : null,
		restrictions.maxWidth ? ` maximum ${restrictions.maxWidth}px` : null
	]
		.filter(Boolean)
		.join(',');
	const height = [
		restrictions.height ? ` equal to ${restrictions.height}px` : null,
		restrictions.minHeight ? ` minimum ${restrictions.minHeight}px` : null,
		restrictions.maxHeight ? ` maximum ${restrictions.maxHeight}px` : null
	]
		.filter(Boolean)
		.join(',');
	return { width, height };
};

const hasWidthRestriction = (restrictions: ImageRestrictions) =>
	Boolean(restrictions.width || restrictions.minWidth || restrictions.maxWidth);

const hasHeightRestriction = (restrictions: ImageRestrictions) =>
	Boolean(restrictions.height || restrictions.minHeight || restrictions.maxHeight);

export const ImageRestrictionSubtitle = ({ restrictions }: { restrictions?: ImageRestrictions }) => {
	if (!restrictions) return null;
	const { width, height } = getImageRestrictionMessages(restrictions);
	const hasWidth = hasWidthRestriction(restrictions);
	const hasHeight = hasHeightRestriction(restrictions);

	if (hasWidth && hasHeight) {
		return (
			<FormattedMessage
				defaultMessage="The image does not meet the width & height constraints (Width: {width}. Height: {height})."
				values={{ width, height }}
			/>
		);
	}
	if (hasWidth) {
		return (
			<FormattedMessage
				defaultMessage="The image does not meet the width constraint (Width: {width})."
				values={{ width }}
			/>
		);
	}
	if (hasHeight) {
		return (
			<FormattedMessage
				defaultMessage="The image does not meet the height constraint (Height: {height})."
				values={{ height }}
			/>
		);
	}
	return null;
};
