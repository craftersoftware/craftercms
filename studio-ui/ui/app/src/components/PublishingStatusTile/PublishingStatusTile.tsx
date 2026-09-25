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
import Typography from '@mui/material/Typography';
import * as React from 'react';
import Skeleton from '@mui/material/Skeleton';
import { PublishingStatus } from '../../models/Publishing';
import PublishingStatusAvatar from '../PublishingStatusAvatar/PublishingStatusAvatar';
import { getPublishingStatusState, getPublishingStatusText } from '../PublishingStatusDisplay';
import Box from '@mui/material/Box';
import { PartialSxRecord } from '../../models';
import { SystemStyleObject } from '@mui/system/styleFunctionSx';
import { Theme } from '@mui/material';

export type PublishingStatusTileClassKey = 'root' | 'avatar' | 'text';

export interface PublishingStatusTileProps extends React.HTMLAttributes<HTMLDivElement | HTMLButtonElement> {
	publishingStatus: PublishingStatus;
	isFetching?: boolean;
	classes?: Partial<Record<PublishingStatusTileClassKey, string>>;
	sxs?: PartialSxRecord<PublishingStatusTileClassKey>;
}

const PublishingStatusTile = React.forwardRef<HTMLDivElement | HTMLButtonElement, PublishingStatusTileProps>(
	function (props, ref) {
		const { formatMessage } = useIntl();
		const { publishingStatus, onClick, isFetching, sxs, ...rest } = props;
		const status = getPublishingStatusState(publishingStatus);
		const statusText = getPublishingStatusText(publishingStatus, formatMessage);
		return (
			<Box
				component={onClick ? 'button' : 'div'}
				ref={ref}
				{...rest}
				onClick={onClick}
				className={[!isFetching && status, props.classes?.root].filter(Boolean).join(' ')}
				sx={(theme) => ({
					width: '120px',
					height: '100px',
					display: 'flex',
					alignItems: 'center',
					flexDirection: 'column',
					justifyContent: 'center',
					textAlign: 'center',
					border: 'none',
					borderRadius: '4px',
					borderTop: 'none',
					background: theme.palette.background.paper,
					margin: '5px',
					'button&': {
						cursor: 'pointer',
						'&:hover, &:focus': {
							background: theme.palette.action.hover,
							boxShadow: theme.shadows[2]
						}
					},
					...(sxs?.root as SystemStyleObject<Theme>)
				})}
			>
				<PublishingStatusAvatar
					enabled={publishingStatus.enabled}
					status={isFetching ? null : status}
					className={props.classes?.avatar}
					sx={{
						margin: '5px',
						...sxs?.avatar
					}}
				/>
				<Typography
					className={props.classes?.text}
					sx={{
						width: '100%',
						...sxs?.text
					}}
					noWrap
					title={statusText}
					color="textPrimary"
				>
					{isFetching ? <Skeleton /> : statusText}
				</Typography>
			</Box>
		);
	}
);

export default PublishingStatusTile;
