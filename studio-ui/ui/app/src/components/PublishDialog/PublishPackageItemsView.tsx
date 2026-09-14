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

import Box from '@mui/material/Box';
import { listItemSecondaryActionClasses } from '@mui/material';
import { FormattedMessage, useIntl } from 'react-intl';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { treeItemClasses } from '@mui/x-tree-view/TreeItem';
import ListItem, { listItemClasses } from '@mui/material/ListItem';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import ItemDisplay from '../ItemDisplay';
import React, { type DetailedHTMLProps, type HTMLAttributes, useCallback, useState } from 'react';
import { DependencyChip, DependencyDataState } from './PublishDialogContainer';
import { AllItemActions, ContentItem, LightItem } from '../../models';
import { PathTreeNode } from './buildPathTrees';
import { getPublishingPackagePreferredView, setPublishingPackagePreferredView } from '../../utils/state';
import { nnou } from '../../utils/object';
import useActiveUser from '../../hooks/useActiveUser';
import MenuItem from '@mui/material/MenuItem';
import { generateSingleItemOptions, itemActionDispatcher } from '../../utils/itemActions';
import useEnv from '../../hooks/useEnv';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { useDispatch } from 'react-redux';
import { renderTreeNode } from '../PackageItems/utils';
import Popover, { getOffsetLeft, getOffsetTop } from '@mui/material/Popover';
import PackageItemsActions from '../PackageItems/PackageItemsActions';
import useItemsByPath from '../../hooks/useItemsByPath';
import { fetchContentItem } from '../../services/content';
import { List, type RowComponentProps } from 'react-window';
import DraftChip from '../DraftChip';
import Tooltip from '@mui/material/Tooltip';

export interface PublishItemsProps {
	itemMap: Record<string, LightItem>;
	defaultExpandedPaths?: string[];
	itemsAndDependenciesPaths: string[];
	dependencyTypeMap?: DependencyDataState['typeByPath'];
	selectedDependenciesPaths?: string[];
	selectedDependenciesMap?: Record<string, boolean>;
	trees: PathTreeNode[];
	onCheckboxChange?: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean, path: string) => void;
	includeChildren?: boolean;
	setIncludeChildren?: (value: boolean) => void;
}

const maxTreeItems = 100;

export function PublishPackageItemsView(props: PublishItemsProps) {
	const {
		itemMap,
		defaultExpandedPaths = [],
		itemsAndDependenciesPaths,
		dependencyTypeMap = {},
		selectedDependenciesPaths = [],
		selectedDependenciesMap = {},
		trees,
		onCheckboxChange,
		includeChildren,
		setIncludeChildren
	} = props;
	const { username } = useActiveUser();
	const storedPreferredView = getPublishingPackagePreferredView(username);
	const [isTreeView, setIsTreeView] = useState(nnou(storedPreferredView) ? storedPreferredView === 'tree' : true);
	const [expandedPaths, setExpandedPaths] = useState<string[]>();
	const siteId = useActiveSiteId();
	const { authoringBase } = useEnv();
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const [contextMenu, setContextMenu] = useState({
		item: null,
		options: null,
		anchorPosition: null
	});
	const totalItems = itemsAndDependenciesPaths.length;
	const disableTreeView = totalItems > maxTreeItems;
	const itemsByPath = useItemsByPath();

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

	const onContextMenuOpen = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>, path: string) => {
			const item = itemMap[path];
			const element = e.currentTarget;
			const anchorRect = element.getBoundingClientRect();
			const top = anchorRect.top + getOffsetTop(anchorRect, 'top');
			const left = anchorRect.left + getOffsetLeft(anchorRect, 'left');

			const menuOptionsCb = (contentItem: ContentItem) => {
				const itemMenuOptions = generateSingleItemOptions(contentItem, formatMessage, {
					includeOnly: ['view', 'dependencies', 'history']
				});
				setContextMenu({ anchorPosition: { top, left }, options: itemMenuOptions.flat(), item: contentItem });
			};

			if (itemsByPath?.[item.path]) {
				menuOptionsCb(itemsByPath[item.path]);
			} else {
				fetchContentItem(siteId, item.path).subscribe(menuOptionsCb);
			}
		},
		[formatMessage, itemMap, itemsByPath, siteId]
	);

	return (
		<>
			<PackageItemsActions
				isTreeView={isTreeView}
				onSetIsTreeView={onSetIsTreeView}
				setExpandedPaths={setExpandedPaths}
				disableTreeView={disableTreeView}
				maxTreeItems={maxTreeItems}
				includeChildren={includeChildren}
				setIncludeChildren={setIncludeChildren}
			/>
			<Divider />
			<Box sx={{ p: 1, flexGrow: 1, overflowY: 'auto', maxHeight: '70vh' }}>
				{!disableTreeView && isTreeView ? (
					<SimpleTreeView
						expandedItems={expandedPaths ?? defaultExpandedPaths}
						onExpandedItemsChange={(event, itemIds) => setExpandedPaths(itemIds)}
						disableSelection
						sx={{
							'.tree-item-more-section': { display: 'none' },
							[`.${treeItemClasses.content}:hover`]: {
								'.tree-item-more-section': { display: 'flex' }
							},
							[`[data-is-item="false"] > .${treeItemClasses.content} > .${treeItemClasses.checkbox}`]: {
								display: 'none'
							}
						}}
					>
						{trees.map((node) =>
							renderTreeNode({
								itemMap,
								itemsByPath,
								node,
								dependencyTypeMap,
								onMenuClick: onContextMenuOpen,
								onCheckboxChange,
								selectedDependencies: selectedDependenciesPaths,
								showItemTarget: false
							})
						)}
					</SimpleTreeView>
				) : (
					<List
						rowCount={totalItems}
						rowHeight={72}
						rowProps={{}}
						rowComponent={({ index, style }: RowComponentProps) => {
							const path = itemsAndDependenciesPaths[index];
							return (
								<Box
									style={style as DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>}
									sx={{
										[`.${listItemSecondaryActionClasses.root}`]: { right: (theme) => theme.spacing(1) },
										[`.${listItemClasses.root} .item-menu-button`]: { display: 'none' },
										[`.${listItemClasses.root}:hover`]: { bgcolor: 'action.hover' },
										[`.${listItemClasses.root}:hover .item-menu-button`]: { display: 'flex' }
									}}
								>
									<ListItem
										key={path}
										secondaryAction={
											<Box display="flex" alignItems="center">
												<IconButton
													className="item-menu-button"
													size="small"
													onClick={(e) => {
														e.stopPropagation();
														onContextMenuOpen?.(e, path);
													}}
													aria-label={formatMessage({ defaultMessage: 'Options' })}
												>
													<MoreVertRounded />
												</IconButton>
												{dependencyTypeMap?.[path] === 'soft' && (
													<Tooltip
														title={
															!itemMap[path].canRequestPublish ? (
																<FormattedMessage defaultMessage="This reference can't be selected because you don't have permission to publish it." />
															) : (
																''
															)
														}
													>
														<span>
															<Checkbox
																size="small"
																disabled={!itemMap[path].canRequestPublish}
																checked={selectedDependenciesMap[path]}
																onChange={(e, checked) => onCheckboxChange?.(e, checked, path)}
															/>
														</span>
													</Tooltip>
												)}
											</Box>
										}
									>
										<ListItemText
											primary={
												<Box display="flex" gap={1}>
													<ItemDisplay
														item={itemMap[path]}
														showNavigableAsLinks={false}
														showWorkflowState={false}
														sx={{ mr: 1 }}
														showPublishingTarget={false}
													/>
													{itemsByPath?.[path]?.savedAsDraft && <DraftChip size="small" />}
													<DependencyChip type={dependencyTypeMap?.[path]} />
												</Box>
											}
											secondary={path}
										/>
									</ListItem>
								</Box>
							);
						}}
					/>
				)}
			</Box>
			<Popover
				open={Boolean(contextMenu.anchorPosition)}
				anchorReference="anchorPosition"
				anchorPosition={contextMenu.anchorPosition}
				onClose={onContextMenuClose}
			>
				{contextMenu.options?.map((option) => (
					<MenuItem key={option.id} onClick={() => onMenuItemClicked(option.id)}>
						{option.label}
					</MenuItem>
				))}
			</Popover>
		</>
	);
}

export default PublishPackageItemsView;
