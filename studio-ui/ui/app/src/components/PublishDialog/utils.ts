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

import { ContentItem, LightItem } from '../../models/Item';
import { ApiResponse } from '../../models/ApiResponse';
import StandardAction from '../../models/StandardAction';
import { GoLiveResponse } from '../../services/publishing';
import { EnhancedDialogProps } from '../EnhancedDialog';
import { EnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import { PublishingTarget } from '../../models/Publishing';
import { useMemo, useState } from 'react';
import { DependencyDataState } from './PublishDialogContainer';
import LookupTable from '../../models/LookupTable';
import { buildPathTrees, PathTreeNode } from './buildPathTrees';

export interface ExtendedGoLiveResponse extends GoLiveResponse {
	schedule: 'now' | 'custom';
	publishingTarget: string;
	type: 'submit' | 'publish';
	items: LightItem[];
}

export interface PublishDialogBaseProps {
	items?: ContentItem[];
	// if null it means the dialog should determinate which one to use
	scheduling?: 'now' | 'custom';
}

export interface PublishDialogProps extends PublishDialogBaseProps, EnhancedDialogProps {
	onSuccess?(response?: ExtendedGoLiveResponse): void;
}

export interface PublishDialogStateProps extends PublishDialogBaseProps, EnhancedDialogState {
	onClose?: StandardAction;
	onClosed?: StandardAction;
	onSuccess?: StandardAction;
}

export interface PublishDialogContainerProps
	extends PublishDialogBaseProps, Pick<PublishDialogProps, 'isSubmitting' | 'onSuccess' | 'onClose'> {}

export interface InternalDialogState {
	packageTitle: string;
	requestApproval: boolean;
	publishingTarget: PublishingTarget['name'] | '';
	submissionComment: string;
	scheduling: 'now' | 'custom';
	scheduledDateTime: Date;
	error: ApiResponse;
	fetchingItems: boolean;
}

interface usePublishStateProps {
	mainItems: LightItem[];
	childrenItems?: LightItem[];
}

interface usePublishStateReturn {
	itemsDataSummary: {
		itemMap: Record<string, LightItem>;
		itemPaths: string[];
	};
	dependencyData: DependencyDataState;
	setDependencyData: (data: DependencyDataState) => void;
	selectedDependenciesMap: LookupTable<boolean>;
	setSelectedDependenciesMap: (map: LookupTable<boolean>) => void;
	selectedDependenciesPaths: string[];
	dependencyPaths: string[];
	trees: PathTreeNode[];
	parentTreeNodePaths: string[];
	itemsAndDependenciesPaths: string[];
	dependencyItemMap: Record<string, LightItem>;
	itemsAndDependenciesMap: Record<string, LightItem>;
}

export const usePublishState = ({ mainItems, childrenItems }: usePublishStateProps): usePublishStateReturn => {
	const [dependencyData, setDependencyData] = useState<DependencyDataState>(null);
	const [selectedDependenciesMap, setSelectedDependenciesMap] = useState<LookupTable<boolean>>({});
	const selectedDependenciesPaths = Object.keys(selectedDependenciesMap).filter(
		(path) => selectedDependenciesMap[path]
	);
	const itemsDataSummary = useMemo(() => {
		const itemPaths = [];
		const itemMap: Record<string, LightItem> = {};
		[...mainItems, ...(childrenItems ?? [])].forEach((item) => {
			if (!itemMap[item.path]) {
				itemMap[item.path] = item;
				itemPaths.push(item.path);
			}
		});
		return {
			itemMap,
			itemPaths
		};
	}, [mainItems, childrenItems]);
	const dependencyPaths = dependencyData?.paths;
	const [trees, parentTreeNodePaths, itemsAndDependenciesPaths] = useMemo(() => {
		const treeItemPaths = itemsDataSummary.itemPaths.concat(dependencyPaths ?? []);
		const treeBuilderResult = buildPathTrees(treeItemPaths);
		return [...treeBuilderResult, treeItemPaths] as [PathTreeNode[], string[], string[]];
	}, [dependencyPaths, itemsDataSummary.itemPaths]);
	const dependencyItemMap = dependencyData?.itemsByPath;
	const itemsAndDependenciesMap = useMemo(
		() => ({ ...itemsDataSummary.itemMap, ...dependencyItemMap }),
		[itemsDataSummary.itemMap, dependencyItemMap]
	);

	return {
		itemsDataSummary,
		dependencyData,
		setDependencyData,
		selectedDependenciesMap,
		setSelectedDependenciesMap,
		selectedDependenciesPaths,
		dependencyPaths,
		trees,
		parentTreeNodePaths,
		itemsAndDependenciesPaths,
		dependencyItemMap,
		itemsAndDependenciesMap
	};
};

export const itemsArrayChanged = (prevItems: LightItem[], nextItems: LightItem[]): boolean => {
	if (prevItems.length !== nextItems.length) {
		return true;
	}

	const prevPaths = prevItems.map((item) => item.path).sort();
	const nextPaths = nextItems.map((item) => item.path).sort();

	for (let i = 0; i < prevPaths.length; i++) {
		if (prevPaths[i] !== nextPaths[i]) {
			return true;
		}
	}
	return false;
};
