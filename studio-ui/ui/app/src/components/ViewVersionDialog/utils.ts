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

import { EntityState } from '../../models/EntityState';
import ContentType, { ContentTypeField } from '../../models/ContentType';
import { DialogHeaderStateAction } from '../DialogHeader';
import { DialogHeaderActionProps } from '../DialogHeaderAction';
import { ApiResponse } from '../../models/ApiResponse';
import StandardAction from '../../models/StandardAction';
import { LookupTable } from '../../models/LookupTable';
import { EnhancedDialogProps } from '../EnhancedDialog';
import { EnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import { ContentInstance, ItemHistoryEntry } from '../../models';
import type { BuiltInControlType } from '../FormsEngine/lib/controlMap';
import { ElementType } from 'react';

export interface ViewVersionDialogBaseProps {
	error: ApiResponse;
	isFetching: boolean;
	version?: ItemHistoryEntry;
	data?: {
		content: ContentInstance;
		xml: string;
		fields: LookupTable<ContentTypeField>;
	};
}

export interface ViewVersionDialogProps extends ViewVersionDialogBaseProps, EnhancedDialogProps {
	contentTypesBranch?: EntityState<ContentType>;
	leftActions?: DialogHeaderActionProps[];
	rightActions?: DialogHeaderActionProps[];
}

export interface ViewVersionDialogStateProps extends ViewVersionDialogBaseProps, EnhancedDialogState {
	leftActions?: DialogHeaderStateAction[];
	rightActions?: DialogHeaderStateAction[];
	onClose?: StandardAction;
	onClosed?: StandardAction;
}

export interface ViewVersionDialogContainerProps
	extends ViewVersionDialogBaseProps, Pick<ViewVersionDialogProps, 'contentTypesBranch'> {
	showXml: boolean;
}

export interface ViewComponentBaseProps {
	xml?: string;
	field?: ContentTypeField;
	content?: string;
}

export const textViewLanguageMap = {
	'file-name': 'text',
	textarea: 'text',
	rte: 'html',
	dropdown: 'text'
} as Record<Partial<BuiltInControlType>, ElementType>;
