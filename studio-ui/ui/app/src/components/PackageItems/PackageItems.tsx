/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import useSpreadState from '../../hooks/useSpreadState';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchPackageItems } from '../../services/publishing';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { FormattedMessage, useIntl } from 'react-intl';
import { AllItemActions, ApiResponse, LightItem } from '../../models';
import Popover, { getOffsetLeft, getOffsetTop } from '@mui/material/Popover';
import { EmptyState } from '../EmptyState';
import PackageItemsList from './PackageItemsList';
import { nnou } from '../../utils/object';
import useActiveUser from '../../hooks/useActiveUser';
import { getPublishingPackagePreferredView, setPublishingPackagePreferredView } from '../../utils/state';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import PackageItemsTree from './PackageItemsTree';
import Paper from '@mui/material/Paper';
import { fetchContentItem } from '../../services/content';
import { generateSingleItemOptions, itemActionDispatcher } from '../../utils/itemActions';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import useEnv from '../../hooks/useEnv';
import PackageItemsActions from './PackageItemsActions';
import { firstValueFrom } from 'rxjs';

export interface PackageItemsProps {
	packageId: number;
}

const maxTreeItems = 100;

export function PackageItems(props: PackageItemsProps) {
	const { packageId } = props;
	const siteId = useActiveSiteId();
	const dispatch = useDispatch();
	const [state, setState] = useSpreadState<{
		items: LightItem[];
		loading: boolean;
		error: ApiResponse;
		total: number;
		limit: number;
		offset: number;
		isNextPageLoading: boolean;
	}>({
		items: null,
		loading: false,
		error: null,
		total: null,
		limit: 20,
		offset: 0,
		isNextPageLoading: false
	});
	const { username } = useActiveUser();
	const storedPreferredView = getPublishingPackagePreferredView(username);
	const [isTreeView, setIsTreeView] = useState(nnou(storedPreferredView) ? storedPreferredView === 'tree' : true);
	const disableTreeView = state.total > maxTreeItems;
	const [expandedPaths, setExpandedPaths] = useState<string[]>();
	const { formatMessage } = useIntl();
	const { authoringBase } = useEnv();
	const [contextMenu, setContextMenu] = useState({
		item: null,
		options: null,
		anchorPosition: null
	});

	useEffect(() => {
		if (packageId) {
			setState({ items: null, loading: true, error: null });
			const firstFetchLimit = 100;
			fetchPackageItems(siteId, packageId, { limit: firstFetchLimit }).subscribe({
				next(items) {
					setState({
						items: items.map((item) => ({ ...item.itemMetadata, path: item.path })),
						loading: false,
						offset: firstFetchLimit,
						total: items.total
					});
				},
				error({ response }) {
					setState({ error: response.response, loading: false });
				}
			});
		}
	}, [packageId, siteId, setState, state.limit]);

	const loadNextPage = (startIndex: number, stopIndex: number) => {
		if (state.isNextPageLoading) return Promise.resolve();
		setState({ isNextPageLoading: true, error: null });
		const offset = startIndex;
		return firstValueFrom(fetchPackageItems(siteId, packageId, { limit: state.limit, offset }))
			.then((items) => {
				setState({
					items: [...state.items, ...items.map((item) => ({ ...item.itemMetadata, path: item.path }))],
					isNextPageLoading: false,
					offset: offset + state.limit,
					total: items.total
				});
			})
			.catch(({ response }) => {
				setState({ error: response.response, isNextPageLoading: false });
			});
	};

	const onOpenMenu = (e: React.MouseEvent<HTMLButtonElement>, packageItem: LightItem) => {
		const element = e.currentTarget;
		const anchorRect = element.getBoundingClientRect();
		const top = anchorRect.top + getOffsetTop(anchorRect, 'top');
		const left = anchorRect.left + getOffsetLeft(anchorRect, 'left');
		fetchContentItem(siteId, packageItem.path).subscribe((contentItem) => {
			const itemMenuOptions = generateSingleItemOptions(contentItem, formatMessage, {
				includeOnly: ['view', 'dependencies', 'history']
			});
			setContextMenu({ options: itemMenuOptions.flat(), item: contentItem, anchorPosition: { top, left } });
		});
	};

	const onMenuItemClicked = (option: string) => {
		itemActionDispatcher({
			site: siteId,
			item: contextMenu.item,
			option: option as AllItemActions,
			authoringBase,
			dispatch,
			formatMessage
		});
		onContextMenuClose();
	};

	const onContextMenuClose = () => {
		setContextMenu({
			item: null,
			options: null,
			anchorPosition: null
		});
	};

	const onSetIsTreeView = (isTreeView: boolean) => {
		setIsTreeView(isTreeView);
		setPublishingPackagePreferredView(username, isTreeView ? 'tree' : 'list');
	};

	return (
		<>
			<PackageItemsActions
				isTreeView={isTreeView}
				onSetIsTreeView={onSetIsTreeView}
				setExpandedPaths={setExpandedPaths}
				disableTreeView={disableTreeView}
				maxTreeItems={maxTreeItems}
			/>
			<Divider />
			<Box sx={{ p: 1, flexGrow: 1 }}>
				<Paper
					elevation={1}
					sx={{
						bgcolor: (theme) => (theme.palette.mode === 'dark' ? theme.palette.background.default : 'background.paper'),
						display: 'flex',
						flexDirection: 'column',
						minHeight: 420,
						height: 'calc(60vh)',
						maxHeight: 600,
						overflowY: 'hidden'
					}}
				>
					{state.items &&
						(state.items.length === 0 ? (
							<EmptyState
								title={
									<FormattedMessage
										id="packageDetailsDialog.emptyPackageMessage"
										defaultMessage="The package is empty"
									/>
								}
								subtitle={
									<FormattedMessage
										id="packageDetailsDialog.emptyPackageMessageSubtitle"
										defaultMessage="Fetched package id is {packageId}"
										values={{ packageId }}
									/>
								}
							/>
						) : !disableTreeView && isTreeView ? (
							<PackageItemsTree
								items={state.items}
								onOpenMenu={onOpenMenu}
								expandedPaths={expandedPaths}
								setExpandedPaths={setExpandedPaths}
							/>
						) : (
							<PackageItemsList
								items={state.items}
								totalItems={state.total}
								fetchLimit={state.limit}
								loadNextPage={loadNextPage}
								onOpenMenu={onOpenMenu}
							/>
						))}
				</Paper>
			</Box>
			<Popover
				open={Boolean(contextMenu.anchorPosition)}
				anchorReference="anchorPosition"
				anchorPosition={contextMenu.anchorPosition}
				onClose={onContextMenuClose}
			>
				<MenuList autoFocusItem>
					{contextMenu.options?.map((option) => (
						<MenuItem key={option.id} onClick={() => onMenuItemClicked(option.id)}>
							{option.label}
						</MenuItem>
					))}
				</MenuList>
			</Popover>
		</>
	);
}

export default PackageItems;
