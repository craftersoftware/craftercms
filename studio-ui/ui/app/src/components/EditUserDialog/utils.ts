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

import User from '../../models/User';
import { Site } from '../../models/Site';
import LookupTable from '../../models/LookupTable';
import { EnhancedDialogProps } from '../EnhancedDialog';
import React from 'react';

export interface EditUserBaseProps {
	user: User;
	passwordRequirementsMinComplexity: number;
}

export interface EditUserDialogProps extends EditUserBaseProps, EnhancedDialogProps {
	onUserEdited(): void;
}

export interface EditUserDialogContainerProps
	extends EditUserBaseProps, Pick<EditUserDialogProps, 'onClose' | 'isSubmitting' | 'onUserEdited' | 'open'> {}

export interface EditUserDialogUIProps {
	user: User;
	inProgress: boolean;
	submitOk: boolean;
	dirty: boolean;
	openResetPassword: boolean;
	sites: Site[];
	passwordRequirementsMinComplexity: number;
	rolesBySite: LookupTable<string[]>;
	onInputChange(value: object): void;
	onEnableChange(value: object): void;
	onCancelForm(): void;
	onSave(): void;
	onCloseButtonClick?(e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
	onCloseResetPasswordDialog(): void;
	onResetPassword(value: boolean): void;
}
