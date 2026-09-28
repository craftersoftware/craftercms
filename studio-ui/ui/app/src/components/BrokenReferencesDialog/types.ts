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

import { EnhancedDialogProps } from '../EnhancedDialog';
import { EnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import StandardAction from '../../models/StandardAction';
import React from 'react';
import { ApiResponse, ContentItem } from '../../models';

export interface BrokenReferencesDialogBaseProps {
	path?: string;
	references?: ContentItem[];
	error?: ApiResponse;
}

export interface BrokenReferencesDialogProps extends BrokenReferencesDialogBaseProps, EnhancedDialogProps {
	onContinue?(response?: any): any;
}

export interface BrokenReferencesDialogStateProps extends BrokenReferencesDialogBaseProps, EnhancedDialogState {
	onClose?: StandardAction;
	onClosed?: StandardAction;
	onContinue?: StandardAction;
}

export interface BrokenReferencesDialogContainerProps
	extends BrokenReferencesDialogBaseProps, Pick<BrokenReferencesDialogProps, 'onContinue' | 'onClose'> {}
