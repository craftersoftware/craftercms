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

import { EnhancedDialogProps } from '../../EnhancedDialog';
import { MergeStrategy } from '../../../models/Repository';
import ApiResponse from '../../../models/ApiResponse';
import { PullResponse } from '../../../services/repositories';

export interface PullFromRemoteBaseProps {
	remoteName: string;
	mergeStrategies: MergeStrategy[];
}

export interface PullFromRemoteDialogProps extends PullFromRemoteBaseProps, EnhancedDialogProps {
	onPullSuccess?(result: PullResponse): void;
	onPullError?(response: ApiResponse): void;
}

export interface PullFromRemoteDialogContainerProps
	extends
		PullFromRemoteBaseProps,
		Pick<PullFromRemoteDialogProps, 'onClose' | 'onPullSuccess' | 'onPullError' | 'isSubmitting'> {
	disabled?: boolean;
	onPullStart?(): void;
}
