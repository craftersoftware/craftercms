/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

export interface PublishingPackageResubmitDialogBaseProps {
	type: 'resubmit' | 'promote';
	pkg: PublishPackage;
}

export interface PublishingPackageResubmitDialogProps
	extends PublishingPackageResubmitDialogBaseProps, EnhancedDialogProps {
	onSuccess?(): void;
}

export interface PublishingPackageResubmitDialogStateProps
	extends PublishingPackageResubmitDialogBaseProps, EnhancedDialogState {
	onClose?: StandardAction;
	onClosed?: StandardAction;
	onSuccess?: StandardAction;
}

export interface PublishingPackageResubmitDialogContainerProps
	extends
		PublishingPackageResubmitDialogBaseProps,
		Pick<PublishingPackageResubmitDialogProps, 'isSubmitting' | 'onSuccess' | 'onClose'> {}
