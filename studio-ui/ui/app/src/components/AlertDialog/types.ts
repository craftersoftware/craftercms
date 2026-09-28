/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

import { ReactNode } from 'react';
import { DialogProps } from '@mui/material/Dialog';
import { PartialSxRecord } from '../../models';

export type AlertDialogClassKey = 'root' | 'image' | 'body' | 'title' | 'footer';

export interface AlertDialogBaseProps {
	title?: ReactNode;
	body?: ReactNode;
	hideBackdrop?: boolean;
	imageUrl?: string;
	disableEnforceFocus?: boolean;
	disableEscapeKeyDown?: boolean;
	disableBackdropClick?: boolean;
	maxWidth?: DialogProps['maxWidth'];
	buttons?: ReactNode;
	sxs?: PartialSxRecord<AlertDialogClassKey>;
}

export interface AlertDialogProps extends AlertDialogBaseProps, Omit<DialogProps, 'title' | 'classes'> {
	onClosed?(): void;
}

export interface AlertDialogContainerProps
	extends AlertDialogBaseProps, Pick<AlertDialogProps, 'onClosed' | 'children'> {}
