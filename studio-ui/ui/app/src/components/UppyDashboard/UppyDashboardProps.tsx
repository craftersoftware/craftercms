/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import { Uppy, type DashboardOptions } from 'uppy';
import React from 'react';
import type { UppyFile, Meta, Body } from '@uppy/core';

export interface UppyDashboardProps {
	uppy: Uppy<Meta, Body>;
	site: string;
	path: string;
	title: string;
	maxActiveUploads: number;
	onMinimized?(): void;
	onPendingChanges?(pending: boolean): void;
	onClose?(): void;
	options?: DashboardOptions<Meta, Body> & {
		successfulUploadButton?: {
			/** One of the "known" icon ids (e.g. more, edit, download), or a `d` attribute for a `path` tag with a "0 0 24 24" view box */
			icon: 'more' | 'edit' | 'download' | 'MoreVertRounded' | 'EditRounded' | 'DownloadRounded' | string;
			label: string;
			onClick(event: React.MouseEvent, file: UppyFile<Meta, Body>, api: { remove(): void }): void;
		};
		autoProceed: boolean;
	};
}

export default UppyDashboardProps;
