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

import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import PublishingStatusAvatar from '../PublishingStatusAvatar';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import * as React from 'react';
import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { type currentTaskStage, PublishingStatus } from '../../models/Publishing';
import { getPublishingStatusMessage, getPublishingStatusState } from './utils';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmptyOutlined';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';

export type PublishingStatusDisplayProps = PublishingStatus & {
	isFetching: boolean;
};

const getStateText = (state: currentTaskStage['state']) => {
	switch (state) {
		case 'READY':
			return <FormattedMessage defaultMessage="Ready" />;
		case 'IN_PROGRESS':
			return <FormattedMessage defaultMessage="In progress" />;
		case 'COMPLETED':
			return <FormattedMessage defaultMessage="Completed" />;
		default:
			return <FormattedMessage defaultMessage="Unknown" />;
	}
};

const stageStateIcons = {
	READY: <CheckCircleIcon sx={{ color: (theme) => theme.palette.success.main, fontSize: '16px' }} />,
	COMPLETED: <CheckCircleIcon sx={{ color: (theme) => theme.palette.success.main, fontSize: '16px' }} />,
	IN_PROGRESS: <HourglassEmptyIcon sx={{ color: (theme) => theme.palette.info.main, fontSize: '1em' }} />
};

const getStatusColor = (state: PublishingStatus['currentTask']['state']) => {
	switch (state) {
		case 'READY':
		case 'COMPLETED':
			return 'success';
		case 'IN_PROGRESS':
			return 'info';
		default:
			return 'default';
	}
};

const StageItem = ({ stage }: { stage: currentTaskStage }) => {
	const { name, processed, state, total } = stage;
	return (
		<Box>
			<Grid
				container
				sx={{
					alignItems: 'center',
					justifyContent: 'space-between'
				}}
			>
				<Grid
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: 1
					}}
				>
					{stageStateIcons[stage.state] || null}
					<Typography variant="subtitle1">{name}</Typography>
				</Grid>
				<Grid>
					<Chip
						label={state}
						variant="outlined"
						color={getStatusColor(stage.state)}
						size="small"
						sx={{ fontSize: '0.7em' }}
					/>
				</Grid>
			</Grid>
			<Typography
				variant="caption"
				sx={{
					color: 'text.secondary'
				}}
			>
				<FormattedMessage defaultMessage="{processed}/{total} items processed" values={{ processed, total }} />
			</Typography>
		</Box>
	);
};

export function PublishingStatusDisplay(props: PublishingStatusDisplayProps) {
	const { isFetching, enabled, published, currentTask } = props;
	const { formatMessage } = useIntl();
	const publishingStatusState = getPublishingStatusState({ enabled, published, currentTask });
	const [showTaskDetails, setShowTaskDetails] = useState(false);
	return (
		<>
			<ListItem component="div">
				<ListItemAvatar>
					<PublishingStatusAvatar enabled={enabled} status={isFetching ? null : publishingStatusState} />
				</ListItemAvatar>
				<ListItemText
					primary={isFetching ? <Skeleton /> : getPublishingStatusMessage(props, formatMessage)}
					secondary={
						currentTask && (
							<Box
								sx={{
									display: 'flex',
									alignItems: 'baseline',
									gap: 1
								}}
							>
								<Typography variant="body2">
									<FormattedMessage
										defaultMessage="Current publishing task {currentTaskType} - {state}."
										values={{
											state: getStateText(currentTask?.state),
											currentTaskType: currentTask?.type ? `(${currentTask?.type})` : ''
										}}
									/>
								</Typography>
								<Link onClick={() => setShowTaskDetails(!showTaskDetails)} sx={{ cursor: 'pointer' }}>
									{showTaskDetails ? (
										<FormattedMessage defaultMessage="Hide details" />
									) : (
										<FormattedMessage defaultMessage="View details" />
									)}
								</Link>
							</Box>
						)
					}
				/>
			</ListItem>
			<Paper
				elevation={0}
				sx={{
					display: currentTask ? 'block' : 'none',
					overflow: 'hidden',
					transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
					maxHeight: showTaskDetails ? 1000 : 0,
					width: '100%',
					maxWidth: '1000px',
					alignSelf: 'center'
				}}
			>
				<Stack spacing={2} sx={{ m: 2 }}>
					{currentTask?.stages?.map((stage, index) => (
						<>
							<StageItem key={index} stage={stage} />
							{index < currentTask.stages.length - 1 && <Divider />}
						</>
					))}
				</Stack>
			</Paper>
		</>
	);
}

export default PublishingStatusDisplay;
