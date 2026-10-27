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

import LookupTable from '../../models/LookupTable';
import { ContentItem, LightItem } from '../../models';
import { buildPathTrees, PathTreeNode } from '../PublishDialog/buildPathTrees';
import React, { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { treeItemClasses } from '@mui/x-tree-view/TreeItem';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { renderTreeNode } from './utils';
import Box from '@mui/material/Box';

export interface PackageItemsTreeProps {
	items: LightItem[];
	expandedPaths: string[];
	setExpandedPaths(paths: string[]): void;
	onOpenMenu(e: React.MouseEvent<HTMLButtonElement>, item: LightItem): void;
}

export function PackageItemsTree(props: PackageItemsTreeProps) {
	const { items, expandedPaths, setExpandedPaths, onOpenMenu } = props;
	const { formatMessage } = useIntl();
	const { itemMap, itemPaths } = useMemo(() => {
		const itemPaths = [];
		const itemMap: Record<string, LightItem> = {};

		items.forEach((item) => {
			itemMap[item.path] = item;
			itemPaths.push(item.path);
		});

		return {
			itemMap,
			itemPaths
		};
	}, [items]);
	const [trees, parentTreeNodePaths] = useMemo(() => {
		const treeItemPaths = itemPaths;
		const treeBuilderResult = buildPathTrees(treeItemPaths);
		return [...treeBuilderResult, treeItemPaths] as [PathTreeNode[], string[], string[]];
	}, [itemPaths]);

	return (
		<Box sx={{ height: '100%', overflowY: 'auto' }}>
			<SimpleTreeView
				expandedItems={expandedPaths ?? parentTreeNodePaths}
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
						itemMap: itemMap,
						node,
						dependencyTypeMap: {},
						formatMessage,
						onMenuClick: (e, path) => onOpenMenu(e, itemMap[path]),
						showItemTarget: false
					})
				)}
			</SimpleTreeView>
		</Box>
	);
}

export default PackageItemsTree;
