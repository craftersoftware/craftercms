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

import React, { useState } from 'react';
import { ControlProps } from '../types';
import useEnv from '../../../hooks/useEnv';
import { menuItemClasses } from '@mui/material/MenuItem';
import { listItemIconClasses } from '@mui/material/ListItemIcon';
import { FormattedMessage, useIntl } from 'react-intl';
import Box from '@mui/material/Box';
import FormsEngineField from '../components/FormsEngineField';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { DeleteOutlined, DownloadOutlined, EditOutlined } from '@mui/icons-material';
import { svgIconClasses } from '@mui/material';
import { resolveMediaUrl } from '../../../utils/string';
import useVideoInfo from '../../../hooks/useVideoInfo';
import Skeleton from '@mui/material/Skeleton';
import { downloadMedia } from '../lib/controlHelpers';
import Tooltip from '@mui/material/Tooltip';
import { isFieldReadOnly } from '../lib/formUtils';
import Menu from '@mui/material/Menu';
import type { DataSourceSelection } from '../dataSources/types';
import GroupedDataSourceActionMenuItems from '../components/GroupedDataSourceActionMenuItems';
import { EmptyState } from '../../EmptyState';

export interface VideoPickerProps extends ControlProps {
	value: string;
}

export function VideoPicker(props: VideoPickerProps) {
	const { field, value, setValue, readonly: formReadonly, dataSources } = props;
	const { guestBase } = useEnv();
	const hasValue = Boolean(value);
	const mediaUrl = value ? resolveMediaUrl(guestBase, value) : '';
	const { formatMessage } = useIntl();
	const { videoInfo, isFetchingMetadata, isFetchingDimensions, errorDimensions, errorMetadata } =
		useVideoInfo(mediaUrl);
	const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
	const [addMenuOpen, setAddMenuOpen] = useState(false);

	const readonly: boolean = isFieldReadOnly(field, formReadonly);
	const actions = dataSources?.actions ?? [];
	const dataSourcesLoading = dataSources?.status === 'loading';
	const dataSourcesError = dataSources?.status === 'error';
	const actionsReady = Boolean(dataSources?.context) && actions.length > 0 && !dataSourcesLoading;
	const applySelection = (selection: DataSourceSelection | DataSourceSelection[] | null) => {
		const selected = Array.isArray(selection) ? selection[0] : selection;
		if (!selected) return;
		if (selected.kind === 'asset') setValue(selected.relativeUrl);
		else if (selected.kind === 'item' && selected.path) setValue(selected.path);
		else if (selected.kind === 'variants') setValue(selected.items[0]?.url ?? null);
	};
	const menuOptions = actionsReady ? (
		<GroupedDataSourceActionMenuItems
			actions={actions}
			context={dataSources.context}
			disabled={readonly}
			onResult={applySelection}
			onError={console.error}
			onMenuClose={() => setAddMenuOpen(false)}
		/>
	) : null;

	const handleRemove = () => {
		setValue(null);
	};

	return (
		<>
			<Menu
				anchorEl={anchorEl}
				open={addMenuOpen}
				onClose={() => setAddMenuOpen(false)}
				sx={{
					[`.${menuItemClasses.root}`]: { pl: 3 }
				}}
			>
				{menuOptions}
			</Menu>
			<FormsEngineField field={field}>
				{hasValue ? (
					<Card sx={{ display: 'flex' }}>
						<CardMedia component="video" sx={{ width: '40%' }} image={mediaUrl} />
						<Box sx={{ display: 'flex', flexDirection: 'column' }}>
							<CardContent sx={{ flex: '1 0 auto' }}>
								<Typography component="div" variant="body1" marginBottom={1}>
									{value}
								</Typography>
								<Typography variant="body2" component="div" color="textSecondary" marginBottom={1}>
									{isFetchingMetadata ? (
										<>
											<Skeleton variant="text" />
											<Skeleton variant="text" />
										</>
									) : errorMetadata ? (
										<Typography color="error" variant="body2">
											<FormattedMessage defaultMessage="Error loading video metadata" />
										</Typography>
									) : (
										<>
											{videoInfo?.contentType}
											<br />
											{videoInfo?.size ? `${videoInfo.size} KB` : ''}
											<br />
										</>
									)}
									<br />
									{isFetchingDimensions ? (
										<Skeleton variant="text" />
									) : errorDimensions ? (
										<Typography color="error" variant="body2">
											<FormattedMessage defaultMessage="Error loading video dimensions" />
										</Typography>
									) : (
										`${videoInfo?.width}x${videoInfo?.height}`
									)}
									<br />
								</Typography>
								<Box>
									<Tooltip title={<FormattedMessage defaultMessage="Replace" />}>
										<IconButton
											disabled={readonly || !actionsReady}
											aria-label={formatMessage({ defaultMessage: 'Replace' })}
											size="small"
											onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
												if (!actionsReady) return;
												setAnchorEl(event.currentTarget);
												setAddMenuOpen(true);
											}}
										>
											<EditOutlined />
										</IconButton>
									</Tooltip>
									<Tooltip title={<FormattedMessage defaultMessage="Download" />}>
										<IconButton
											aria-label={formatMessage({ defaultMessage: 'Download' })}
											size="small"
											onClick={() => {
												if (value) downloadMedia(guestBase, value);
											}}
										>
											<DownloadOutlined />
										</IconButton>
									</Tooltip>
									<Tooltip title={<FormattedMessage defaultMessage="Delete" />}>
										<IconButton
											disabled={readonly}
											size="small"
											onClick={handleRemove}
											aria-label={formatMessage({ defaultMessage: 'Delete' })}
										>
											<DeleteOutlined />
										</IconButton>
									</Tooltip>
								</Box>
							</CardContent>
						</Box>
					</Card>
				) : dataSourcesLoading ? (
					<Skeleton variant="rounded" height={56} />
				) : dataSourcesError ? (
					<Typography color="error" variant="body2">
						<FormattedMessage defaultMessage="Error loading video sources" />
					</Typography>
				) : !actionsReady ? (
					<EmptyState
						title={<FormattedMessage defaultMessage="No options are available for this control" />}
						subtitle={
							<FormattedMessage defaultMessage="Update the content type definition to add options to this control" />
						}
					/>
				) : (
					// TODO: same as in NodeSelector and ImagePicker - Refactor this when datasources implementation is ready.
					<Box
						children={menuOptions}
						sx={{
							p: 1,
							gap: 1,
							py: 0.5,
							display: 'flex',
							flexDirection: 'row',
							flexWrap: 'wrap',
							color: 'primary.main',
							justifyContent: 'center',
							[`.${svgIconClasses.root}`]: {
								color: 'primary.main'
							},
							[`.${menuItemClasses.root}`]: {
								flexDirection: 'column',
								justifyContent: 'center',
								borderRadius: 1
							},
							[`.${listItemIconClasses.root}`]: {
								justifyContent: 'center'
							}
						}}
					/>
				)}
			</FormsEngineField>
		</>
	);
}

export default VideoPicker;
