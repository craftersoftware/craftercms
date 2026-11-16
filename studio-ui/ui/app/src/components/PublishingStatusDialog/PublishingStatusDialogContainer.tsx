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

import { useIntl } from 'react-intl';
import DialogHeader from '../DialogHeader';
import DialogBody from '../DialogBody/DialogBody';
import * as React from 'react';
import PublishingStatusDisplay, { publishingStatusMessages } from '../PublishingStatusDisplay';
import { PublishingStatusDialogContainerProps } from './utils';
import useActiveUser from '../../hooks/useActiveUser';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import useSelection from '../../hooks/useSelection';

const permittedRoles = ['developer', 'admin'];

export function PublishingStatusDialogContainer(props: PublishingStatusDialogContainerProps) {
	const { onClose, onRefresh, onStartStop, titleId } = props;
	const state = useSelection((state) => state.publishing);
	const { enabled, published, currentTask, isFetching } = state;
	const { formatMessage } = useIntl();
	const user = useActiveUser();
	const siteId = useActiveSiteId();
	const userRoles = user?.rolesBySite[siteId];
	const allowedUser = (userRoles && permittedRoles?.some((role) => userRoles.includes(role))) ?? false;

	return (
		<>
			<DialogHeader
				titleId={titleId}
				title={formatMessage(publishingStatusMessages.publishingStatus)}
				onCloseButtonClick={onClose}
				rightActions={[
					onStartStop &&
						allowedUser && {
							icon: enabled
								? { id: '@mui/icons-material/PauseCircleOutlineOutlined' }
								: { id: '@mui/icons-material/PlayCircleOutlineOutlined' },
							onClick: onStartStop,
							tooltip: formatMessage(enabled ? publishingStatusMessages.stop : publishingStatusMessages.start)
						},
					onRefresh && {
						icon: { id: '@mui/icons-material/RefreshRounded' },
						onClick: onRefresh,
						tooltip: formatMessage(publishingStatusMessages.refresh)
					}
				].filter(Boolean)}
			/>
			<DialogBody
				sx={{
					minHeight: 145,
					placeContent: 'center'
				}}
			>
				<PublishingStatusDisplay
					enabled={enabled}
					isFetching={isFetching}
					published={published}
					currentTask={currentTask}
				/>
			</DialogBody>
		</>
	);
}

export default PublishingStatusDialogContainer;
