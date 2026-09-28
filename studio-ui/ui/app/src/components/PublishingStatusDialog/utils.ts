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
import { EnhancedDialogProps } from '../EnhancedDialog';
import { PublishingStatus } from '../../models/Publishing';
import { EnhancedDialogState } from '../../hooks/useEnhancedDialogState';

export interface PublishingStatusBaseProps extends PublishingStatus {
	isFetching: boolean;
}

export interface PublishingStatusDialogProps extends PublishingStatusBaseProps, EnhancedDialogProps {
	onRefresh?(): void;
	onStartStop?(): void;
}

export interface PublishingStatusDialogStateProps extends PublishingStatusBaseProps, EnhancedDialogState {
	onClose: StandardAction;
	onRefresh: StandardAction;
}

export interface PublishingStatusDialogContainerProps
	extends PublishingStatusBaseProps, Pick<PublishingStatusDialogProps, 'onClose' | 'onRefresh' | 'onStartStop'> {}
