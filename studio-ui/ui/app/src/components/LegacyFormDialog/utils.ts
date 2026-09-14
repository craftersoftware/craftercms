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

import { PropsWithChildren } from 'react';
import StandardAction from '../../models/StandardAction';
import { type DialogProps } from '@mui/material/Dialog';

export interface LegacyFormDialogBaseProps {
	open?: boolean;
	path: string;
	selectedFields?: string[];
	authoringBase: string;
	site?: string;
	isHidden?: boolean;
	modelId?: string;
	/** When true, opens the form for an embedded component under `path` identified by `modelId`. */
	isEmbedded?: boolean;
	readonly?: boolean;
	changeTemplate?: string;
	contentTypeId?: string;
	isNewContent?: boolean;
	inProgress?: boolean;
	pendingChanges?: boolean;
	isSubmitting?: boolean;
	disableHeader?: boolean;
	iceGroupId?: string;
	newEmbedded?: {
		contentType: string;
		index: number;
		datasource: string;
		fieldId: string;
	};
	index?: string | number;
	dialogId?: string;
}

export type LegacyFormDialogProps = PropsWithChildren<
	LegacyFormDialogBaseProps & {
		isMinimized?: boolean;
		onTransitionExited?: DialogProps['onTransitionExited'];
		onMaximize?(): any;
		onMinimize?(): any;
		onClose?(): any;
		onClosed?(): any;
		onSaveSuccess?(response?: any): any;
	}
>;

export interface LegacyFormDialogStateProps extends LegacyFormDialogBaseProps {
	isMinimized?: boolean;
	onSaveSuccess?: StandardAction;
	onClose?: StandardAction;
	onClosed?: StandardAction;
	onMaximize?: StandardAction;
	onMinimize?: StandardAction;
}

export interface LegacyFormDialogContainerProps
	extends
		LegacyFormDialogBaseProps,
		Pick<LegacyFormDialogProps, 'onMinimize' | 'onClose' | 'onClosed' | 'onSaveSuccess'> {
	setIframeLoaded(loaded: boolean): void;
}
