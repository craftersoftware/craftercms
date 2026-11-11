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

import { EnhancedDialogProps } from '../EnhancedDialog';
import { EnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import { PublishPackage, StandardAction } from '../../models';

/**
 * The editable fields of an existing publishing package. The publishing
 * target and the package items are not editable, so they are not part of
 * this payload (the target is echoed back for the caller's convenience).
 */
export interface EditPublishPackageFormData {
	packageId: number;
	title: string;
	comment: string;
	schedule: string | null;
	publishingTarget: PublishPackage['target'];
}

export interface EditPublishPackageDialogBaseProps {
	pkg: PublishPackage;
}

export interface EditPublishPackageDialogProps extends EditPublishPackageDialogBaseProps, EnhancedDialogProps {
	onSuccess?(data?: EditPublishPackageFormData): void;
}

export interface EditPublishPackageDialogStateProps extends EditPublishPackageDialogBaseProps, EnhancedDialogState {
	onClose?: StandardAction;
	onClosed?: StandardAction;
	onSuccess?: StandardAction;
}

export interface EditPublishPackageDialogContainerProps
	extends
		EditPublishPackageDialogBaseProps,
		Pick<EditPublishPackageDialogProps, 'isSubmitting' | 'onSuccess' | 'onClose'> {}
