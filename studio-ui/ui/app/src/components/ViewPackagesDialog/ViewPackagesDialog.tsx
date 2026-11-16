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

import React from 'react';
import { EnhancedDialog, EnhancedDialogProps } from '../EnhancedDialog';
import { EnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import StandardAction from '../../models/StandardAction';
import { FormattedMessage } from 'react-intl';
import ViewPackagesDialogContainer from './ViewPackagesDialogContainer';
import { ContentItem } from '../../models';

export interface ViewPackagesDialogBaseProps {
	item: ContentItem;
	cancelPackagesInitialComment?: string;
}

export interface ViewPackagesDialogProps extends ViewPackagesDialogBaseProps, EnhancedDialogProps {
	onContinue?(cancelPackagesMessage: string): void;
}

export interface ViewPackagesDialogStateProps extends ViewPackagesDialogBaseProps, EnhancedDialogState {
	onClose?: StandardAction;
	onClosed?: StandardAction;
	onContinue?: StandardAction;
}

export function ViewPackagesDialog(props: ViewPackagesDialogProps) {
	const { item, cancelPackagesInitialComment, onContinue, subtitle, ...enhancedDialogProps } = props;
	return (
		<EnhancedDialog
			fullWidth
			maxWidth="sm"
			title={<FormattedMessage defaultMessage="View Packages" />}
			subtitle={
				subtitle ?? (
					<FormattedMessage defaultMessage="The item is part of one or more publishing packages. Editing it will cancel the packages." />
				)
			}
			{...enhancedDialogProps}
		>
			<ViewPackagesDialogContainer
				item={item}
				cancelPackagesInitialComment={cancelPackagesInitialComment}
				onContinue={onContinue}
			/>
		</EnhancedDialog>
	);
}

export default ViewPackagesDialog;
