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

import React, { useMemo, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { getHostToGuestBus } from '../../utils/subjects';
import { ContentTypeDropTarget } from '../../models/ContentTypeDropTarget';
import ListItemText from '@mui/material/ListItemText';
import List from '@mui/material/List';
import MenuItem from '@mui/material/MenuItem';
import Select, { selectClasses } from '@mui/material/Select';
import ContentType from '../../models/ContentType';
import { useDispatch } from 'react-redux';
import {
	clearDropTargets,
	clearHighlightedDropTargets,
	contentTypeDropTargetsRequest,
	scrollToDropTarget,
	setPreviewEditMode
} from '../../state/actions/preview';
import { useSelection } from '../../hooks/useSelection';
import { useMount } from '../../hooks/useMount';
import { getAvatarWithIconColors } from '../../utils/contentType';
import { darken, useTheme } from '@mui/material/styles';
import { ContentTypeField } from '../../icons';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemButton from '@mui/material/ListItemButton';
import Box from '@mui/material/Box';
import { nou } from '../../utils/object';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import ListSubheader from '@mui/material/ListSubheader';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded';
import Alert from '@mui/material/Alert';
import { EmptyState } from '../EmptyState';
import FormHelperText from '@mui/material/FormHelperText';
import { LoadingState } from '../LoadingState';

const translations = defineMessages({
	dropTargetsPanel: {
		// Translation not used in code but powers i18n for `ui.xml`
		id: 'previewDropTargetsPanelTitle',
		defaultMessage: 'Drop Targets'
	},
	selectedContentType: {
		defaultMessage: 'Selected content type'
	},
	noResults: {
		id: 'previewDropTargetsPanel.noResults',
		defaultMessage: 'No results found.'
	},
	chooseContentType: {
		id: 'previewDropTargetsPanel.chooseContentType',
		defaultMessage: 'Please choose a content type.'
	}
});

export function PreviewDropTargetsPanel() {
	const hostToGuest$ = getHostToGuestBus();
	const dropTargetsBranch = useSelection((state) => state.preview.dropTargets);
	const contentTypesBranch = useSelection((state) => state.contentTypes);
	const editMode = useSelection((state) => state.preview.editMode);
	const contentTypesUpdated = useSelection((state) => state.preview.guest?.contentTypesUpdated);
	const contentTypes = contentTypesBranch.byId
		? Object.values(contentTypesBranch.byId).filter((contentType) => contentType.type === 'component')
		: null;
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const [listMode, setListMode] = useState(true);
	const allowedTypesData = useSelection((state) => state.preview.guest?.allowedContentTypes);
	const awaitingGuestCheckIn = nou(allowedTypesData);
	const allowedContentTypes = useMemo(() => {
		const allowedTypes: ContentType[] = [];
		if (!contentTypes || !allowedTypesData) return allowedTypes;
		contentTypes.forEach((contentType) => {
			allowedTypesData[contentType.id] && allowedTypes.push(contentType);
		});
		return allowedTypes;
	}, [allowedTypesData, contentTypes]);
	const filteredDropTargets = useMemo(() => {
		return dropTargetsBranch
			? dropTargetsBranch.byId
				? Object.values(dropTargetsBranch.byId).filter(
						(dropTarget) => dropTarget.contentTypeId === dropTargetsBranch.selectedContentType
					)
				: []
			: null;
	}, [dropTargetsBranch]);

	useMount(() => {
		return () => {
			dispatch(clearDropTargets());
			hostToGuest$.next({
				type: clearHighlightedDropTargets.type
			});
		};
	});

	const onSelectedDropZone = (dropTarget: ContentTypeDropTarget) => {
		if (!editMode) {
			dispatch(setPreviewEditMode({ editMode: true }));
		}
		hostToGuest$.next({
			type: scrollToDropTarget.type,
			payload: dropTarget
		});
	};

	function handleSelectChange(contentTypeId: string) {
		hostToGuest$.next(contentTypeDropTargetsRequest({ contentTypeId }));
	}

	const resetState = () => {
		setListMode(true);
		dispatch(clearDropTargets());
		hostToGuest$.next(clearHighlightedDropTargets());
	};

	return awaitingGuestCheckIn ? (
		<Alert severity="info" variant="outlined" icon={<HourglassEmptyRounded />} sx={{ border: 0 }}>
			<FormattedMessage defaultMessage="Waiting for the preview application to load." />
		</Alert>
	) : (
		<>
			{contentTypesUpdated && (
				<Alert severity="warning" variant="outlined" sx={{ border: 0 }}>
					<FormattedMessage defaultMessage="Content type definitions have changed. Please refresh the preview application." />
				</Alert>
			)}
			{allowedContentTypes.length ? (
				listMode ? (
					<>
						<FormHelperText sx={{ p: 2 }}>
							<FormattedMessage defaultMessage="Select content type to view the available drop targets for it" />
						</FormHelperText>
						<ListSubheader>
							<FormattedMessage defaultMessage="Compatible types" />
						</ListSubheader>
						{allowedContentTypes?.map((contentType: ContentType, i: number) => (
							<ListItemButton
								key={i}
								onClick={() => {
									setListMode(false);
									handleSelectChange(contentType.id);
								}}
							>
								<ContentTypeItem contentType={contentType} />
							</ListItemButton>
						))}
					</>
				) : (
					<>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								width: '100%',
								padding: '15px 15px 0',

								'& > div': {
									width: '100%'
								}
							}}
						>
							<FormControl>
								<InputLabel>{formatMessage(translations.selectedContentType)}</InputLabel>
								<Select
									value={dropTargetsBranch.selectedContentType || ''}
									label={formatMessage(translations.selectedContentType)}
									sx={{
										[`& .${selectClasses.select}`]: {
											display: 'flex',
											alignItems: 'center',
											overflow: 'hidden'
										}
									}}
									onChange={(event) => {
										event.stopPropagation();
										handleSelectChange(event.target.value);
									}}
								>
									<ListSubheader>
										<FormattedMessage defaultMessage="Compatible types" />
									</ListSubheader>
									{allowedContentTypes?.map((contentType: ContentType, i: number) => (
										<MenuItem value={contentType.id} key={i}>
											<ContentTypeItem contentType={contentType} />
										</MenuItem>
									))}
								</Select>
							</FormControl>
							{dropTargetsBranch?.selectedContentType && (
								<Tooltip title={<FormattedMessage defaultMessage="Cancel selection" />}>
									<IconButton edge="end" sx={{ ml: 0.625 }} onClick={() => resetState()}>
										<CloseRoundedIcon />
									</IconButton>
								</Tooltip>
							)}
						</Box>
						<List>
							{dropTargetsBranch?.selectedContentType !== null && !Boolean(dropTargetsBranch?.byId) ? (
								<LoadingState />
							) : filteredDropTargets ? (
								filteredDropTargets.length > 0 ? (
									<DropTargetsList dropTargets={filteredDropTargets} onSelectedDropZone={onSelectedDropZone} />
								) : (
									<EmptyState
										title={
											dropTargetsBranch.selectedContentType
												? formatMessage(translations.noResults)
												: formatMessage(translations.chooseContentType)
										}
									/>
								)
							) : (
								<></>
							)}
						</List>
					</>
				)
			) : (
				<EmptyState title="No drop targets were found on the current view." sxs={{ title: { textAlign: 'center' } }} />
			)}
		</>
	);
}

interface ContentTypeItemContentProps {
	contentType: ContentType;
}

function ContentTypeItem(props: ContentTypeItemContentProps) {
	const { contentType } = props;
	const theme = useTheme();
	const { backgroundColor, textColor } = getAvatarWithIconColors(contentType.name, theme, darken);

	return (
		<>
			<ListItemIcon sx={{ minWidth: 'unset !important' }}>
				<Box
					sx={{
						flexShrink: 0,
						width: '24px',
						height: '24px',
						borderRadius: '20px',
						overflow: 'hidden',
						backgroundColor,
						borderColor: textColor,
						borderStyle: 'solid',
						borderWidth: '1px'
					}}
				/>
			</ListItemIcon>
			<ListItemText slotProps={{ primary: { noWrap: true } }} title={contentType.name}>
				{contentType.name}
			</ListItemText>
		</>
	);
}

interface DropTargetsListProps {
	dropTargets: ContentTypeDropTarget[];
	onSelectedDropZone(dropTarget: ContentTypeDropTarget): void;
}

function DropTargetsList(props: DropTargetsListProps) {
	const { dropTargets } = props;
	return dropTargets?.map((dropTarget: ContentTypeDropTarget) => (
		<ListItemButton key={dropTarget.id} onClick={() => props.onSelectedDropZone(dropTarget)}>
			<ListItemIcon>
				<ContentTypeField />
			</ListItemIcon>
			<ListItemText primary={dropTarget.label} />
		</ListItemButton>
	));
}

export default PreviewDropTargetsPanel;
