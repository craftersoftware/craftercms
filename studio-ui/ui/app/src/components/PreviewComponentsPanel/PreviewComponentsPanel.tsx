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
import List from '@mui/material/List';
import ContentType from '../../models/ContentType';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import { getHostToGuestBus } from '../../utils/subjects';
import {
	componentDragEnded,
	componentDragStarted,
	contentTypeDropTargetsRequest,
	pushIcePanelPage,
	setContentTypeFilter,
	setPreviewEditMode
} from '../../state/actions/preview';
import { DraggablePanelListItem } from '../DraggablePanelListItem/DraggablePanelListItem';
import { useDispatch } from 'react-redux';
import { batchActions } from '../../state/actions/misc';
import { createToolsPanelPage, createWidgetDescriptor } from '../../utils/state';
import { useSelection } from '../../hooks/useSelection';
import SearchBar from '../SearchBar';
import LoadingState from '../LoadingState';
import ErrorBoundary from '../ErrorBoundary';
import EmptyState from '../EmptyState';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ListItemText, { listItemTextClasses } from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded';
import InfoRounded from '@mui/icons-material/InfoOutlined';
import { ExpandMoreRounded } from '@mui/icons-material';
import Alert, { alertClasses } from '@mui/material/Alert';
import { nou } from '../../utils/object';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import { ItemTypeIcon } from '../ItemTypeIcon';
import { ContentItem } from '../../models';
import Avatar from '@mui/material/Avatar';
import { getAvatarWithIconColors } from '../../utils/contentType';
import { darken, useTheme } from '@mui/material/styles';

/** Keyboard ring that stays visible when the theme turns ripples off. */
const focusVisibleSx = {
	'&.Mui-focusVisible': {
		outline: (theme) => `2px solid ${theme.palette.primary.main}`,
		outlineOffset: 2
	}
};

const translations = defineMessages({
	previewComponentsPanelTitle: {
		// Translation not used in code but powers i18n for `ui.xml`
		id: 'previewComponentsPanelTitle',
		defaultMessage: 'Create Content'
	},
	browse: {
		id: 'previewComponentsPanel.browse',
		defaultMessage: 'Browse existing'
	},
	listDropTargets: {
		id: 'previewComponentsPanel.listDropTargets',
		defaultMessage: 'List drop targets'
	},
	listInPageInstances: {
		id: 'previewComponentsPanel.listInPageInstances',
		defaultMessage: 'Instances on this page'
	},
	filter: {
		defaultMessage: 'Filter...'
	},
	shared: { defaultMessage: 'existing' },
	embedded: { defaultMessage: 'embedded' },
	sharedExisting: { defaultMessage: 'existing shared' }
});

type ContentTypeData = {
	allowedTypes: ContentType[];
	otherTypes: ContentType[];
};

export function PreviewComponentsPanel() {
	const contentTypesBranch = useSelection((state) => state.contentTypes);
	const allowedTypesData = useSelection((state) => state.preview.guest?.allowedContentTypes);
	const awaitingGuestCheckIn = nou(allowedTypesData);
	const contentTypesUpdated = useSelection((state) => state.preview.guest?.contentTypesUpdated);
	const [keyword, setKeyword] = useState('');
	const { formatMessage } = useIntl();
	const contentTypeData: ContentTypeData = useMemo(() => {
		const allowedTypes: ContentType[] = [];
		const otherTypes: ContentType[] = [];
		const result = { allowedTypes, otherTypes };
		if (!contentTypesBranch.byId || !allowedTypesData) return result;
		const lowerCaseKeyword = keyword.trim().toLowerCase();
		const typeLookup = contentTypesBranch.byId;
		for (const id in typeLookup) {
			const contentType = typeLookup[id];
			if (
				// Skip pages
				contentType.type === 'page' ||
				// Keyword isn't blank and the type name nor id match the keyword
				(lowerCaseKeyword !== '' &&
					!contentType.name.toLowerCase().includes(lowerCaseKeyword) &&
					!id.toLowerCase().includes(lowerCaseKeyword))
			) {
				continue;
			}
			// if contentType.type === 'component' ...
			// When selecting 'Allow any component' in the content type editor, there will be a key '*' in the allowedTypesData
			if (
				allowedTypesData[id]?.embedded ||
				allowedTypesData[id]?.shared ||
				allowedTypesData['*']?.embedded ||
				allowedTypesData['*']?.shared
			) {
				allowedTypes.push(contentType);
			} else {
				otherTypes.push(contentType);
			}
		}
		const sorter = (a: ContentType, b: ContentType) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
		allowedTypes.sort(sorter);
		otherTypes.sort(sorter);
		return result;
	}, [contentTypesBranch.byId, keyword, allowedTypesData]);
	const dispatch = useDispatch();
	const theme = useTheme();
	// region Context Menu
	const [menuContext, setMenuContext] = useState<{
		anchor: Element;
		contentType: ContentType;
		backgroundColor: string;
		textColor: string;
	}>();
	const onMenuClose = () => setMenuContext(null);
	const onBrowseSharedInstancesClicked = () => {
		dispatch(
			batchActions([
				setContentTypeFilter(menuContext.contentType.id),
				pushIcePanelPage(
					createToolsPanelPage(
						formatMessage({ defaultMessage: 'Existing {name}' }, { name: menuContext.contentType.name }),
						[createWidgetDescriptor({ id: 'craftercms.components.PreviewBrowseComponentsPanel' })],
						'icePanel'
					)
				)
			])
		);
	};
	const onListInPageInstancesClick = () => {
		dispatch(
			batchActions([
				setContentTypeFilter(menuContext.contentType.id),
				pushIcePanelPage(
					createToolsPanelPage(
						formatMessage({ defaultMessage: 'Instances of {name}' }, { name: menuContext.contentType.name }),
						[createWidgetDescriptor({ id: 'craftercms.components.PreviewInPageInstancesPanel' })],
						'icePanel'
					)
				)
			])
		);
	};
	const onListDropTargetsClick = () => {
		dispatch(
			pushIcePanelPage(
				createToolsPanelPage(
					formatMessage({ defaultMessage: 'Drop Targets for {name}' }, { name: menuContext.contentType.name }),
					[createWidgetDescriptor({ id: 'craftercms.components.PreviewDropTargetsPanel' })],
					'icePanel'
				)
			)
		);
		getHostToGuestBus().next(contentTypeDropTargetsRequest({ contentTypeId: menuContext.contentType.id }));
	};
	const onMenuButtonClickHandler = (e: React.MouseEvent<HTMLButtonElement>, contentType: ContentType) => {
		const { backgroundColor, textColor } = getAvatarWithIconColors(contentType.name, theme, darken);
		e.stopPropagation();
		setMenuContext({ anchor: e.currentTarget, contentType, backgroundColor, textColor });
	};
	// endregion
	// region Drag and Drop
	const editMode = useSelection((state) => state.preview.editMode);
	const [isBeingDragged, setIsBeingDragged] = useState<string | null>(null);
	const onDragStart = (contentType: ContentType) => {
		if (!editMode) {
			dispatch(setPreviewEditMode({ editMode: true }));
		}
		getHostToGuestBus().next({ type: componentDragStarted.type, payload: contentType });
		setIsBeingDragged(contentType.id);
	};
	const onDragEnd = () => {
		getHostToGuestBus().next({ type: componentDragEnded.type });
		setIsBeingDragged(null);
	};
	// endregion
	return (
		<ErrorBoundary>
			{contentTypesUpdated && (
				<Alert severity="warning" variant="outlined" sx={{ border: 0 }}>
					<FormattedMessage defaultMessage="Content type definitions have changed. Please refresh the preview application." />
				</Alert>
			)}
			<Box sx={{ padding: (theme) => `${theme.spacing(1)} ${theme.spacing(1)} 0` }}>
				<SearchBar
					placeholder={formatMessage(translations.filter)}
					showActionButton={Boolean(keyword)}
					onChange={setKeyword}
					keyword={keyword}
					autoFocus
				/>
			</Box>
			{contentTypesBranch.isFetching ? (
				<LoadingState
					title={<FormattedMessage id="componentsPanel.suspenseStateMessage" defaultMessage="Retrieving Page Model" />}
				/>
			) : (
				<>
					{/* **** */}
					<Box sx={{ pt: 1 }}>
						{awaitingGuestCheckIn ? (
							<Alert severity="info" variant="outlined" icon={<HourglassEmptyRounded />} sx={{ border: 0 }}>
								<FormattedMessage defaultMessage="Waiting for the preview application to load." />
							</Alert>
						) : contentTypeData.allowedTypes.length ? (
							<>
								<Box
									sx={{
										display: 'flex',
										placeContent: 'space-between',
										alignItems: 'center',
										px: 1.6,
										py: 1.5
									}}
								>
									<Typography variant="overline">
										<FormattedMessage defaultMessage="Compatible Types" />
									</Typography>
									<Tooltip
										arrow
										title={<FormattedMessage defaultMessage="Compatible types are configured in the content model." />}
									>
										<IconButton
											size="small"
											aria-label={formatMessage({
												defaultMessage: 'Compatible types are configured in the content model.'
											})}
											sx={focusVisibleSx}
										>
											<InfoRounded fontSize="small" />
										</IconButton>
									</Tooltip>
								</Box>
								<List sx={{ pt: 0 }}>
									{contentTypeData.allowedTypes.map((contentType) => (
										<DraggablePanelListItem
											key={contentType.id}
											primaryText={contentType.name}
											avatarColorBase={contentType.id}
											onDragStart={() => onDragStart(contentType)}
											onDragEnd={onDragEnd}
											onMenu={(e) => onMenuButtonClickHandler(e, contentType)}
											isBeingDragged={isBeingDragged === contentType.id}
										/>
									))}
								</List>
							</>
						) : (
							<EmptyState
								sxs={{ title: { textAlign: 'center' } }}
								title={
									keyword ? (
										<FormattedMessage
											defaultMessage='No content types were found matching "{keyword}"'
											values={{ keyword }}
										/>
									) : (
										<FormattedMessage defaultMessage="No compatible types were found." />
									)
								}
								subtitle={
									keyword ? undefined : (
										<FormattedMessage defaultMessage="Developers can configure the content model to add compatible types." />
									)
								}
							/>
						)}
					</Box>
					{/* **** */}
					{contentTypeData.otherTypes.length > 0 && (
						<Accordion square disableGutters elevation={0} sx={{ background: 'none' }}>
							<AccordionSummary expandIcon={<ExpandMoreRounded />}>
								<Typography variant="overline">
									<FormattedMessage defaultMessage="Other Types" />
								</Typography>
							</AccordionSummary>
							<AccordionDetails sx={{ p: 0 }}>
								<Alert
									severity="info"
									variant="outlined"
									sx={{ width: '100%', border: 'none', py: 0, [`.${alertClasses.icon}`]: { mr: 1 } }}
								>
									<FormattedMessage defaultMessage="Content types not configured for use." />
								</Alert>
								<List dense>
									{contentTypeData.otherTypes.map((type) => {
										const { backgroundColor, textColor } = getAvatarWithIconColors(
											contentTypesBranch.byId[type.id].name,
											theme,
											darken
										);
										return (
											<Box
												component="li"
												key={type.id}
												sx={{
													display: 'flex',
													alignItems: 'center',
													px: 2,
													py: 0.5
												}}
											>
												<ListItemText
													sx={{
														flex: 1,
														minWidth: 0,
														[`.${listItemTextClasses.primary}`]: {
															display: 'flex',
															flexDirection: 'row',
															alignItems: 'center'
														}
													}}
													primary={
														<>
															<Box
																component="span"
																sx={{
																	mr: 1,
																	flexShrink: 0,
																	width: '24px',
																	height: '24px',
																	borderRadius: '20px',
																	overflow: 'hidden',
																	backgroundColor,
																	borderColor: textColor,
																	borderStyle: 'solid',
																	borderWidth: '1px',
																	display: 'inline-block'
																}}
															/>
															<Box
																component="span"
																sx={{
																	flexShrink: 1,
																	flexGrow: 1,
																	textOverflow: 'ellipsis',
																	overflow: 'hidden',
																	whiteSpace: 'nowrap'
																}}
															>
																{type.name}
															</Box>
														</>
													}
												/>
												<Box sx={{ display: 'flex', flexShrink: 0 }}>
													<IconButton
														aria-label={formatMessage({ defaultMessage: 'Options for {name}' }, { name: type.name })}
														size="small"
														onClick={(e) => onMenuButtonClickHandler(e, type)}
														sx={focusVisibleSx}
													>
														<MoreVertRounded />
													</IconButton>
												</Box>
											</Box>
										);
									})}
								</List>
							</AccordionDetails>
						</Accordion>
					)}
					{/* **** */}
				</>
			)}
			<Menu
				open={Boolean(menuContext)}
				anchorEl={menuContext?.anchor}
				onClose={onMenuClose}
				slotProps={{
					paper: {
						sx: { maxWidth: 350, minWidth: 200 }
					}
				}}
			>
				<Box
					component="header"
					sx={{
						px: 2,
						py: 1,
						mb: 1,
						display: 'block',
						maxWidth: '100%',
						borderWidth: 1,
						borderColor: 'divider',
						borderBottomStyle: 'solid'
					}}
				>
					<Box
						component="section"
						sx={{
							display: 'flex',
							placeContent: 'space-between'
						}}
					>
						<Box>
							<Typography
								component="div"
								variant="caption"
								color="textSecondary"
								title={menuContext?.contentType.id}
								sx={{ wordBreak: 'break-all' }}
							>
								{menuContext?.contentType.id ?? <Skeleton variant="text" />}
							</Typography>
							<Typography>{menuContext?.contentType.name ?? <Skeleton variant="text" width="100px" />}</Typography>
						</Box>
						<Avatar component="div" sx={{ backgroundColor: menuContext?.backgroundColor, ml: 1 }}>
							<ItemTypeIcon
								fontSize="medium"
								item={{ systemType: menuContext?.contentType.type ?? '', mimeType: '' } as ContentItem}
								sx={{ color: menuContext?.textColor }}
							/>
						</Avatar>
					</Box>
					<Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
						<FormattedMessage
							defaultMessage="The model is configured for {modes}"
							values={{
								modes: Object.keys(allowedTypesData?.[menuContext?.contentType.id] ?? {})
									.map((mode) => (translations[mode] ? formatMessage(translations[mode]) : mode))
									.join(', ')
							}}
						/>
					</Typography>
				</Box>
				<MenuItem onClick={onListInPageInstancesClick}>{formatMessage(translations.listInPageInstances)}</MenuItem>
				<MenuItem onClick={onBrowseSharedInstancesClicked}>{formatMessage(translations.browse)}</MenuItem>
				<MenuItem onClick={onListDropTargetsClick}>{formatMessage(translations.listDropTargets)}</MenuItem>
			</Menu>
		</ErrorBoundary>
	);
}

export default PreviewComponentsPanel;
