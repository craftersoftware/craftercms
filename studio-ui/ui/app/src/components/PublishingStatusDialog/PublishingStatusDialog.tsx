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

import * as React from 'react';
import { useId } from 'react';
import PublishingStatusDialogContainer from './PublishingStatusDialogContainer';
import { PublishingStatusDialogProps } from './utils';
import EnhancedDialog from '../EnhancedDialog';

function PublishingStatusDialog(props: PublishingStatusDialogProps) {
	const { published, enabled, currentTask, onRefresh, onStartStop, isFetching, ...rest } = props;
	const titleId = useId();
	return (
		<EnhancedDialog omitHeader={true} aria-labelledby={titleId} maxWidth="xs" {...rest}>
			<PublishingStatusDialogContainer {...props} titleId={titleId} />
		</EnhancedDialog>
	);
}

export default PublishingStatusDialog;
