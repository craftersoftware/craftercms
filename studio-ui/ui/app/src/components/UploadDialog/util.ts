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

import StandardAction from '../../models/StandardAction';
import { PropsWithChildren } from 'react';
import { Uppy, type XHRUploadOptions } from 'uppy';
import type { UppyFile, Meta, Body } from '@uppy/core';
import UppyDashboardProps from '../UppyDashboard/UppyDashboardProps';
import ApiResponse from '../../models/ApiResponse';
import { IntlShape } from 'react-intl';

export interface UploadDialogBaseProps {
	open: boolean;
	path: string;
	site: string;
	maxSimultaneousUploads?: number;
	endpoint?: string;
	method?: XHRUploadOptions<Meta, Body>['method'];
	headers?: XHRUploadOptions<Meta, Body>['headers'];
	meta?: Record<string, unknown>;
	allowedMetaFields?: XHRUploadOptions<Meta, Body>['allowedMetaFields'];
	useFormData?: boolean;
	fieldName?: string;
	showRemoveButtonAfterComplete?: boolean;
	successfulUploadButton?: UppyDashboardProps['options']['successfulUploadButton'];
	autoProceed?: boolean;
}

export type UploadDialogProps = PropsWithChildren<
	UploadDialogBaseProps & {
		onClose(): void;
		onClosed?(): void;
		onFileAdded?(data: { file: UppyFile<Meta, Body>; uppy: Uppy<Meta, Body> }): void;
		onUploadSuccess?(data: { file: UppyFile<Meta, Body> | undefined; response }): void;
		validateStatus?(statusCode: number, responseText: string, response: unknown): boolean;
		getResponseData?(response: XMLHttpRequest): void;
		getResponseError?(response: XMLHttpRequest): Error;
	}
>;

export interface UploadDialogStateProps extends UploadDialogBaseProps {
	onClose?: StandardAction;
	onClosed?: StandardAction;
	onFileAdded?: StandardAction<{
		file: UppyFile<Meta, Body>;
		uppy: Uppy<Meta, Body>;
		[key: string]: unknown;
	}>;
	onUploadSuccess?: StandardAction<{ file: UppyFile<Meta, Body>; response; [key: string]: unknown }>;
}

export interface UploadDialogContainerProps extends UploadDialogProps {
	hasPendingChanges: boolean;
	setPendingChanges?(pending: boolean): void;
	onMinimized?(): void;
}

export const getResponseError = (responseText: string, formatMessage: IntlShape['formatMessage']) => {
	try {
		const parsed = JSON.parse(responseText);
		if (parsed.response) {
			const error: ApiResponse = parsed.response;
			return new Error(
				`[${error.code}] ${error.message}. ${error.remedialAction}. ${error.documentationUrl}.`
					.replace('. .', '.')
					.replace('. .', '.')
			);
		} else {
			return new Error(parsed.message.replace('. .', '.').replace('. .', '.'));
		}
	} catch {
		return new Error(formatMessage({ defaultMessage: 'An error occurred uploading the file.' }));
	}
};
