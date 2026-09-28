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
import { EnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import { EnhancedDialogProps } from '../EnhancedDialog';

export interface CreateFolderBaseProps {
	path?: string;
	rename?: boolean;
	value?: string;
	allowBraces?: boolean;
}

export interface CreateFolderProps extends CreateFolderBaseProps, EnhancedDialogProps {
	onCreated?(response: { path: string; name: string; rename: boolean }): void;
	onRenamed?(response: { path: string; name: string; rename: boolean }): void;
}

export interface CreateFolderStateProps extends CreateFolderBaseProps, EnhancedDialogState {
	onClose?: StandardAction;
	onClosed?: StandardAction;
	onCreated?: StandardAction;
	onRenamed?: StandardAction;
}

export interface CreateFolderContainerProps extends Pick<
	CreateFolderProps,
	'path' | 'allowBraces' | 'value' | 'rename' | 'onRenamed' | 'onCreated' | 'onClose'
> {}
