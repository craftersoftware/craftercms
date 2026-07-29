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

import React, { useCallback, useEffect, useState } from 'react';
import { search } from '../../services/search';
import { MediaItem, SearchItem } from '../../models/Search';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { useEnv } from '../../hooks/useEnv';
import { useDebouncedInput } from '../../hooks/useDebouncedInput';
import { useSpreadState } from '../../hooks/useSpreadState';
import { useDispatch } from 'react-redux';
import LookupTable from '../../models/LookupTable';
import { BrowseFilesDialogUI, viewModes } from '.';
import { BrowseFilesDialogContainerProps, contentItemToMediaItem, initialParameters } from './utils';
import { checkPathExistence } from '../../services/content';
import { FormattedMessage } from 'react-intl';
import EmptyState from '../EmptyState';
import BrowseFilesDialogContainerSkeleton from './BrowseFilesDialogContainerSkeleton';
import { getStoredBrowseDialogViewMode, setStoredBrowseDialogViewMode } from '../../utils/state';
import useActiveUser from '../../hooks/useActiveUser';
import { withIndex, withoutIndex, isPagePath } from '../../utils/path';
import { ContentItem } from '../../models/Item';
import { MediaCardViewModes } from '../MediaCard';
import { createPresenceTable } from '../../utils/array';
import { createLookupTable } from '../../utils/object';
import { prepareSearchParams } from '../Search/utils';
import { popDialog, pushDialog } from '../../state/actions/dialogStack';
import { nanoid } from 'nanoid';

import { createComponentId } from '../../utils/system';
import { useItemsByPath } from '../../hooks/useItemsByPath';

const defaultPreselectedPaths = [];

export function BrowseFilesDialogContainer(props: BrowseFilesDialogContainerProps) {
	const {
		path,
		onClose,
		onSuccess,
		multiSelect = false,
		mimeTypes,
		contentTypes,
		numOfLoaderItems,
		allowUpload = true,
		initialParameters: initialParametersProp,
		preselectedPaths = defaultPreselectedPaths,
		disableChangePreselected = true
	} = props;
	const [items, setItems] = useState<SearchItem[]>();
	const site = useActiveSiteId();
	const { guestBase } = useEnv();
	const dispatch = useDispatch();
	const [keyword, setKeyword] = useState(initialParametersProp?.keywords ?? '');
	const [selectedCard, setSelectedCard] = useState<MediaItem>();
	const [searchParameters, setSearchParameters] = useSpreadState({
		...initialParameters,
		...initialParametersProp,
		filters: {
			...initialParameters.filters,
			...initialParametersProp?.filters,
			...(mimeTypes && { 'mime-type': mimeTypes }),
			...(contentTypes && { 'content-type': contentTypes })
		}
	});
	const [total, setTotal] = useState<number>();
	const [selectedLookup, setSelectedLookup] = useSpreadState<LookupTable<MediaItem>>({});
	const selectedArray = Object.keys(selectedLookup).filter((key) => selectedLookup[key]);
	const selectedInCurrentPage = items?.filter((item) => selectedArray.includes(item.path));
	const allSelectedInCurrentPage = items?.length > 0 && selectedInCurrentPage.length === items.length;
	const someSelectedInCurrentPage =
		(items?.length > 0 && selectedInCurrentPage.length > 0 && selectedInCurrentPage.length < items?.length) ?? false;
	const browsePath = path.replace(/\/+$/, '');
	const [currentPath, setCurrentPath] = useState(browsePath);
	const [treeSelectedPath, setTreeSelectedPath] = useState<string>();
	const [fetchingBrowsePathExists, setFetchingBrowsePathExists] = useState(false);
	const [browsePathExists, setBrowsePathExists] = useState(false);
	const [sortKeys, setSortKeys] = useState([]);
	const { username } = useActiveUser();
	const [viewMode, setViewMode] = useState<MediaCardViewModes>(getStoredBrowseDialogViewMode(username));
	const [fetchingPreselectedItems, setFetchingPreselectedItems] = useState(false);
	const disableSubmission = fetchingPreselectedItems || (!selectedArray.length && !selectedCard);
	const preselectedLookup = createPresenceTable(preselectedPaths);
	const itemsByPath = useItemsByPath();

	const fetchItems = useCallback(() => {
		// Since lookahead regex is not supported by opensearch, we are excluding the current path from the search using a
		// negative filter in a query. This scenario only happens with pages, hence the `withIndex` function wrapping the
		// current path.
		search(site, {
			...prepareSearchParams(searchParameters),
			path: `${currentPath}/[^/]+(/index\\.xml)?`,
			query: `-localId:"${withIndex(currentPath)}"`
		}).subscribe((response) => {
			setTotal(response.total);
			setItems(response.items);
			setSortKeys(response.facets.map((facet) => facet.name));
		});
	}, [searchParameters, currentPath, site]);

	useEffect(() => {
		const query = preselectedPaths?.map((path) => `localId:"${path}"`).join(' ');
		if (query) {
			setFetchingPreselectedItems(true);
			search(site, { query }).subscribe({
				next: ({ items }) => {
					if (multiSelect) {
						setSelectedLookup(createLookupTable(items, 'path'));
					} else if (items.length) {
						setSelectedCard(items[0]);
					}
					setFetchingPreselectedItems(false);
				},
				error: () => {
					setFetchingPreselectedItems(false);
				}
			});
		}
	}, [site, preselectedPaths, multiSelect, setSelectedLookup]);

	useEffect(() => {
		let subscription;
		if (!browsePathExists) {
			setFetchingBrowsePathExists(true);
			subscription = checkPathExistence(site, browsePath).subscribe((exists) => {
				if (exists) {
					fetchItems();
					setBrowsePathExists(true);
				}
				setFetchingBrowsePathExists(false);
			});
		} else {
			fetchItems();
		}

		return () => {
			subscription?.unsubscribe();
		};
	}, [fetchItems, site, browsePath, browsePathExists]);

	const onCardSelected = (item: MediaItem) => {
		if (multiSelect) {
			setSelectedLookup({ [item.path]: selectedLookup[item.path] ? null : item });
		} else {
			setSelectedCard(selectedCard?.path === item.path ? null : item);
		}
	};

	const onSelectAll = () => {
		if (multiSelect) {
			const newSelectedLookup = { ...selectedLookup };
			items.forEach((item) => {
				newSelectedLookup[item.path] = allSelectedInCurrentPage ? null : item;
			});
			setSelectedLookup(newSelectedLookup);
		}
	};

	const onSearch = useCallback(
		(keywords) => {
			setSearchParameters({ keywords });
		},
		[setSearchParameters]
	);

	const onSearch$ = useDebouncedInput(onSearch, 400);

	function handleSearchKeyword(keyword: string) {
		setKeyword(keyword);
		onSearch$.next(keyword);
	}

	const onSelectButtonClick = () => {
		onSuccess?.(multiSelect ? selectedArray.map((path) => selectedLookup[path]) : selectedCard);
	};

	const onChangePage = (page: number) => {
		setSearchParameters({ offset: page * searchParameters.limit });
	};

	const onChangeRowsPerPage = (e) => {
		setSearchParameters({ offset: 0, limit: e.target.value });
	};

	const onCheckboxChecked = (path: string, selected: boolean) => {
		setSelectedLookup({ [path]: selected ? items.find((item) => item.path === path) : null });
	};

	const onPathSelected = (path: string) => {
		const item = itemsByPath[path];
		const nextPath = withoutIndex(path);
		setCurrentPath(nextPath);

		if (item?.systemType === 'page' && item.childrenCount === 0) {
			const mediaItem = items?.find((searchItem) => searchItem.path === item.path) ?? contentItemToMediaItem(item);
			multiSelect ? setSelectedLookup({ [mediaItem.path]: mediaItem }) : setSelectedCard(mediaItem);
			setTreeSelectedPath(withoutIndex(mediaItem.path));
		} else {
			multiSelect ? clearSelectedLookup() : setSelectedCard(null);
			setTreeSelectedPath(null);
		}
	};

	const clearSelectedLookup = () => {
		setSelectedLookup(Object.fromEntries(Object.keys(selectedLookup).map((key) => [key, null])));
	};

	const onCloseButtonClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => onClose(e, null);

	const onUpload = () => {
		const dialogId = nanoid();
		dispatch(
			pushDialog({
				id: dialogId,
				component: createComponentId('SingleFileUploadDialog'),
				props: {
					site,
					path: currentPath,
					fileTypes: mimeTypes,
					onClose: () => dispatch(popDialog({ id: dialogId })),
					onUploadComplete: () => {
						dispatch(popDialog({ id: dialogId }));
						setTimeout(() => {
							fetchItems();
						}, 2000);
					}
				}
			})
		);
	};

	const onRefresh = () => {
		fetchItems();
	};

	const switchViewMode = () => {
		let currentIndex = viewModes.indexOf(viewMode);
		let nextIndex;

		if (currentIndex === viewModes.length - 1) {
			nextIndex = 0;
		} else {
			nextIndex = currentIndex + 1;
		}
		setStoredBrowseDialogViewMode(username, viewModes[nextIndex]);
		setViewMode(viewModes[nextIndex]);
	};

	return fetchingBrowsePathExists ? (
		<BrowseFilesDialogContainerSkeleton />
	) : browsePathExists ? (
		<BrowseFilesDialogUI
			viewMode={viewMode}
			onToggleViewMode={switchViewMode}
			currentPath={currentPath}
			items={items}
			path={browsePath}
			guestBase={guestBase}
			keyword={keyword}
			selectedCard={selectedCard}
			selectedArray={selectedArray}
			multiSelect={multiSelect}
			searchParameters={searchParameters}
			setSearchParameters={setSearchParameters}
			limit={searchParameters.limit}
			offset={searchParameters.offset}
			total={total}
			sortKeys={sortKeys}
			onCardSelected={onCardSelected}
			onChangePage={onChangePage}
			onChangeRowsPerPage={onChangeRowsPerPage}
			onCheckboxChecked={onCheckboxChecked}
			handleSearchKeyword={handleSearchKeyword}
			onCloseButtonClick={onCloseButtonClick}
			onPathSelected={onPathSelected}
			treeSelectedPath={treeSelectedPath}
			onSelectButtonClick={onSelectButtonClick}
			numOfLoaderItems={numOfLoaderItems}
			onRefresh={onRefresh}
			onUpload={onUpload}
			allowUpload={allowUpload}
			preselectedLookup={preselectedLookup}
			disableChangePreselected={disableChangePreselected}
			disableSubmission={disableSubmission}
			onSelectAll={onSelectAll}
			allSelected={allSelectedInCurrentPage}
			someSelected={someSelectedInCurrentPage}
		/>
	) : (
		<EmptyState
			sxs={{ root: { height: '60vh' } }}
			title={
				<FormattedMessage
					id="browseFilesDialog.emptyStateMessage"
					defaultMessage="Path `{path}` doesn't exist."
					values={{ path: currentPath }}
				/>
			}
		/>
	);
}

export default BrowseFilesDialogContainer;
