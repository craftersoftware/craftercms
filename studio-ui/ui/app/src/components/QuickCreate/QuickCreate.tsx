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

import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { defineMessages, FormattedMessage, IntlShape, useIntl } from 'react-intl';
import IconButton from '@mui/material/IconButton';
import AddCircleIcon from '@mui/icons-material/AddRounded';
import Menu, { menuClasses } from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useDispatch } from 'react-redux';
import { newContentCreationComplete } from '../../state/actions/dialogs';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import QuickCreateItem from '../../models/content/QuickCreateItem';
import palette from '../../styles/palette';
import Tooltip from '@mui/material/Tooltip';
import { ContentItem } from '../../models/Item';
import { useSelection } from '../../hooks/useSelection';
import { usePreviewState } from '../../hooks/usePreviewState';
import { useItemsByPath } from '../../hooks/useItemsByPath';
import { lookupItemByPath } from '../../utils/content';
import { getPreviewURLFromPath, processPathMacros } from '../../utils/path';
import { fetchQuickCreateList } from '../../state/actions/content';
import useQuickCreateState from '../../hooks/useQuickCreateState';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import useSystemVersion from '../../hooks/useSystemVersion';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { LoadingState } from '../LoadingState';
import { popDialog, pushDialog } from '../../state/actions/dialogStack';
import { createComponentId, showContentFormAction } from '../../utils/system';
import useEnv from '../../hooks/useEnv';
import { nanoid } from 'nanoid';
import { batchActions } from '../../state/actions/misc';
import useContentTypes from '../../hooks/useContentTypes';
import useArchetypes from '../../hooks/useArchetypes';
import type { ContentType, LookupTable } from '../../models';
import type { Archetype } from '../ContentTypeManagement/descriptors/archetypes';
import Box from '@mui/material/Box';
import { fetchItemByPath } from '../../services/content';

const translations = defineMessages({
	quickCreateBtnLabel: {
		id: 'quickCreateBtnLabel.label',
		defaultMessage: 'Open quick create menu'
	},
	quickCreateMenuTooltip: {
		id: 'previewToolbar.quickCreateMenuTooltip',
		defaultMessage: 'Quick create menu'
	}
});

interface QuickCreateMenuProps {
	open: boolean;
	item?: ContentItem;
	anchorEl: HTMLElement;
	onNewContentSelected?(): void;
	onQuickCreateItemSelected?(props: {
		authoringBase: string;
		path: string;
		contentTypeId: string;
		isNewContent: boolean;
	}): void;
	onClose?(): void;
}

interface QuickCreateMenuButtonProps {
	disabled?: boolean;
	onMenuBtnClick(e): void;
}

interface QuickCreateSectionProps {
	classes?: Partial<
		Record<
			| 'menuItem'
			| 'quickCreateEmptyRoot'
			| 'quickCreateEmptyCardContent'
			| 'quickCreateEmptyDescription'
			| 'quickCreateEmptyCardActions',
			string
		>
	>;
	onItemSelected: (item: QuickCreateItem) => any;
	version: string;
	quickCreateItems: QuickCreateItem[];
}

export function QuickCreateMenu(props: QuickCreateMenuProps) {
	const { open, onClose, anchorEl, onNewContentSelected, onQuickCreateItemSelected, item } = props;
	const authoringBase = useSelection<string>((state) => state.env.authoringBase);
	const itemNewContentButton = item?.availableActionsMap.createContent;
	const { error, isFetching, items: quickCreateItems } = useQuickCreateState();
	const systemVersion = useSystemVersion();
	const contentTypes = useContentTypes();

	const onFormDisplay = (item: QuickCreateItem) => {
		const { contentTypeId, path } = item;
		const contentType = contentTypes?.[contentTypeId];
		const type = contentType?.type ?? 'component';
		const defaultPath = type === 'page' ? '/site/website/' : '/site/components/';
		const formatPath = processPathMacros({
			path: path ? path : defaultPath,
			// Since we can't support these at this stage of creation, at least this will avoid the form opening with an error
			objectId: '{objectId}',
			objectGroupId: '(objectGroupId)',
			fullParentPath: '',
			useUUID: false
		});
		onQuickCreateItemSelected?.({
			path: formatPath,
			contentTypeId,
			isNewContent: true,
			authoringBase
		});
	};

	return (
		<>
			<Menu
				sx={{
					[`& .${menuClasses.paper}`]: {
						paddingTop: 0,
						minWidth: '140px'
					}
				}}
				anchorEl={anchorEl}
				open={open}
				onClose={onClose}
			>
				{itemNewContentButton && (
					<MenuItem onClick={onNewContentSelected} sx={{ fontSize: 14 }}>
						<FormattedMessage id="quickCreateMenu.title" defaultMessage="New Content" />
					</MenuItem>
				)}
				{error ? (
					<ApiResponseErrorState error={error} />
				) : isFetching ? (
					<LoadingState sxs={{ graphic: { width: '80px' } }} />
				) : quickCreateItems && systemVersion ? (
					<QuickCreateSection
						version={systemVersion}
						quickCreateItems={quickCreateItems}
						onItemSelected={onFormDisplay}
					/>
				) : null}
			</Menu>
		</>
	);
}

function QuickCreateSection(props: QuickCreateSectionProps) {
	const { version, quickCreateItems, classes, onItemSelected } = props;
	const archetypes = useArchetypes();
	const contentTypes = useContentTypes();
	const { formatMessage } = useIntl();

	const groupedItems = useMemo(() => {
		return getGroupedQuickCreateItems(quickCreateItems, archetypes, contentTypes, formatMessage);
	}, [quickCreateItems, archetypes, contentTypes, formatMessage]);

	return (
		<>
			{Object.keys(groupedItems).map((archetype, index) => (
				<Box key={index}>
					<Typography
						component="h4"
						sx={(theme) => ({
							fontSize: 12,
							backgroundColor: theme.palette.background.default,
							color: theme.palette.text.secondary,
							padding: '5px 16px'
						})}
					>
						{archetype}
					</Typography>
					{groupedItems[archetype].map((item, index) => (
						<MenuItem
							key={index}
							onClick={() => onItemSelected(item)}
							className={classes?.menuItem}
							sx={{ fontSize: 14 }}
						>
							{item.label}
						</MenuItem>
					))}
				</Box>
			))}
			{quickCreateItems.length === 0 && (
				<Card
					className={classes?.quickCreateEmptyRoot}
					sx={{
						width: '149px',
						justifyContent: 'center',
						display: 'flex',
						flexDirection: 'column',
						textAlign: 'center',
						alignItems: 'center',
						boxShadow: 'none'
					}}
				>
					<CardContent className={classes?.quickCreateEmptyCardContent} sx={{ padding: '5px 10px' }}>
						<Typography color="textSecondary" gutterBottom>
							<ErrorOutlineOutlinedIcon fontSize={'small'} />
						</Typography>
						<Typography className={classes?.quickCreateEmptyDescription} sx={{ fontSize: '12px' }}>
							<FormattedMessage
								id="quickCreateMenu.learnMoreError"
								defaultMessage="Quick create has not been configured. Please contact your system administrator."
							/>
						</Typography>
					</CardContent>
					<CardActions
						className={classes?.quickCreateEmptyCardActions}
						sx={{
							padding: 0,
							'& .MuiButton-root': {
								fontSize: '14px',
								textDecoration: 'underline',
								color: palette.blue.main
							}
						}}
					>
						{version && (
							<Button
								size="small"
								href={`https://craftercms.com/docs/current/by-role/developer/common/content-modeling/content-modeling.html#quick-create`}
								target="_blank"
								rel="nofollow noreferrer"
							>
								<FormattedMessage id="quickCreateMenu.learnMore" defaultMessage="Learn More" />
							</Button>
						)}
					</CardActions>
				</Card>
			)}
		</>
	);
}

const QuickCreateMenuButton = forwardRef<HTMLButtonElement, QuickCreateMenuButtonProps>((props, ref) => {
	const { onMenuBtnClick, disabled = false } = props;
	const { formatMessage } = useIntl();
	return (
		<Tooltip title={disabled ? '' : formatMessage(translations.quickCreateMenuTooltip)}>
			<IconButton
				disabled={disabled}
				ref={ref}
				size="small"
				color="primary"
				onClick={onMenuBtnClick}
				aria-label={formatMessage(translations.quickCreateBtnLabel)}
			>
				<AddCircleIcon fontSize="large" />
			</IconButton>
		</Tooltip>
	);
});

const QuickCreate = forwardRef<HTMLButtonElement, { item?: ContentItem }>((props, ref) => {
	const { item } = props;
	const [anchorEl, setAnchorEl] = useState(null);
	const [currentPreviewItemPath, setCurrentPreviewItemPath] = useState<string>(null);
	const { guest } = usePreviewState();
	const dispatch = useDispatch();
	const items = useItemsByPath();
	const site = useActiveSiteId();
	const { authoringBase } = useEnv();

	useEffect(() => {
		site && dispatch(fetchQuickCreateList());
	}, [site, dispatch]);

	const onMenuBtnClick = (e) => {
		setAnchorEl(e.currentTarget);
		if (guest) {
			const { modelId, models } = guest;
			const {
				craftercms: { path }
			} = models[modelId];
			setCurrentPreviewItemPath(path);
		}
	};

	const onMenuClose = () => setAnchorEl(null);

	const onNewContentSaveSuccess = (result?: { path?: string }) => {
		if (!result?.path) return;
		fetchItemByPath(site, result.path).subscribe((item) => {
			dispatch(
				newContentCreationComplete({
					item,
					redirectUrl: getPreviewURLFromPath(result.path)
				})
			);
		});
	};

	const onNewContentSelected = () => {
		onMenuClose();
		const dialogId = nanoid();
		dispatch(
			pushDialog({
				id: dialogId,
				component: createComponentId('NewContentDialog'),
				props: {
					item: lookupItemByPath(currentPreviewItemPath, items),
					onContentTypeSelected: ({ path, contentType }) => {
						dispatch(
							batchActions([
								popDialog({ id: dialogId }),
								showContentFormAction({
									authoringBase,
									path,
									contentTypeId: contentType.id,
									isNewContent: true,
									onSaveSuccess: onNewContentSaveSuccess
								})
							])
						);
					}
				}
			})
		);
	};

	const onQuickCreateItemSelected = (props) => {
		onMenuClose();
		dispatch(
			showContentFormAction({
				...props,
				onSaveSuccess: onNewContentSaveSuccess
			})
		);
	};

	return (
		<>
			<QuickCreateMenuButton ref={ref} onMenuBtnClick={onMenuBtnClick} />
			<QuickCreateMenu
				item={item}
				open={Boolean(anchorEl)}
				anchorEl={anchorEl}
				onClose={onMenuClose}
				onNewContentSelected={onNewContentSelected}
				onQuickCreateItemSelected={onQuickCreateItemSelected}
			/>
		</>
	);
});

function getGroupedQuickCreateItems(
	quickCreateItems: QuickCreateItem[],
	archetypes: LookupTable<Archetype>,
	contentTypes: LookupTable<ContentType>,
	formatMessage: IntlShape['formatMessage']
) {
	const grouped: Record<string, QuickCreateItem[]> = {};
	quickCreateItems
		.slice()
		.sort((a, b) => a.label.localeCompare(b.label))
		.forEach((item) => {
			const contentType = contentTypes?.[item.contentTypeId];
			const archetype = archetypes?.[contentType?.type];
			const archetypeLabel = archetype?.name || formatMessage({ defaultMessage: 'Other' });
			if (!grouped[archetypeLabel]) {
				grouped[archetypeLabel] = [];
			}
			grouped[archetypeLabel].push(item);
		});

	return grouped;
}

export default QuickCreate;
