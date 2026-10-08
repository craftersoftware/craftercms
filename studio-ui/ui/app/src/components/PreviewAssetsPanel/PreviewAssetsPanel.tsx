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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ElasticParams, MediaItem } from '../../models/Search';
import { alpha } from '@mui/material';
import SearchBar from '../SearchBar/SearchBar';
import { useDispatch, useSelector } from 'react-redux';
import GlobalState from '../../models/GlobalState';
import { fromEvent, interval } from 'rxjs';
import { filter, map, share, switchMap, takeUntil, tap } from 'rxjs/operators';
import { getHostToGuestBus } from '../../utils/subjects';
import {
	assetDragEnded,
	assetDragStarted,
	fetchAssetsPanelItems,
	setPreviewEditMode
} from '../../state/actions/preview';
import MediaCard from '../MediaCard/MediaCard';
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded';
import EmptyState from '../EmptyState/EmptyState';
import UploadIcon from '@mui/icons-material/Publish';
import { pluckProps } from '../../utils/object';
import { uploadDataUrl } from '../../services/contentUpload';
import palette from '../../styles/palette';
import { useSelection } from '../../hooks/useSelection';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { useDebouncedInput } from '../../hooks/useDebouncedInput';
import Pagination from '../Pagination';
import { LoadingState } from '../LoadingState';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { ErrorBoundary } from '../ErrorBoundary';
import Box from '@mui/material/Box';
import { pushDialog } from '../../state/actions/dialogStack';
import { createComponentId } from '../../utils/system';
import { assetsPanelInitialState } from '../../state/reducers/preview';
import { ensureSingleSlash } from '../../utils/string';

const translations = defineMessages({
	previewAssetsPanelTitle: {
		id: 'previewAssetsPanel.title',
		defaultMessage: 'Assets'
	},
	itemsPerPage: {
		id: 'previewAssetsPanel.itemsPerPage',
		defaultMessage: 'Items per page:'
	},
	noResults: {
		id: 'previewAssetsPanel.noResults',
		defaultMessage: ' No results found.'
	},
	previousPage: {
		id: 'pagination.previousPage',
		defaultMessage: 'Previous page'
	},
	nextPage: {
		id: 'pagination.nextPage',
		defaultMessage: 'Next page'
	},
	retrieveAssets: {
		id: 'previewAssetsPanel.retrieveAssets',
		defaultMessage: 'Retrieving Project Assets'
	}
});

export interface PreviewAssetsPanelProps {
	path?: string;
	mimeTypes?: string[];
	query?: string;
}

function mimeTypesChanged(a?: string[], b?: string[]): boolean {
	const leftSet = new Set(a ?? []);
	const rightSet = new Set(b ?? []);
	if (leftSet.size !== rightSet.size) return true;
	return [...leftSet].some((type) => !rightSet.has(type));
}

export function PreviewAssetsPanel(props: PreviewAssetsPanelProps) {
	const { path, mimeTypes: mimeTypesProp, query } = props;
	const initialKeyword = useSelection((state) => state.preview.assets.query.keywords);
	const [keyword, setKeyword] = useState(initialKeyword);
	const [dragInProgress, setDragInProgress] = useState(false);
	const site = useActiveSiteId();
	const hostToGuest$ = getHostToGuestBus();
	const dispatch = useDispatch();
	const editMode = useSelection((state) => state.preview.editMode);
	const assets = useSelection((state) => state.preview.assets);

	const mimeTypes = mimeTypesProp ?? assetsPanelInitialState.query.filters['mime-type'];
	const assetsPath = path ? ensureSingleSlash(`${path}/.+`) : undefined;
	const cachedSiteRef = useRef<string | undefined>(undefined);
	const cachedPathRef = useRef<string | undefined>(undefined);
	const cachedMimeTypesRef = useRef<string[] | undefined>(undefined);
	const cachedQueryRef = useRef<string | undefined>(undefined);

	const fetchItems = useCallback(
		(params: Partial<ElasticParams> = {}) => {
			dispatch(
				fetchAssetsPanelItems({
					...params,
					path: assetsPath,
					filters: { ...params.filters, 'mime-type': mimeTypes },
					query
				})
			);
		},
		[dispatch, assetsPath, mimeTypes, query]
	);

	useEffect(() => {
		if (!site) {
			return;
		}

		const configChanged =
			cachedSiteRef.current !== site ||
			cachedPathRef.current !== assetsPath ||
			mimeTypesChanged(cachedMimeTypesRef.current, mimeTypes) ||
			cachedQueryRef.current !== query;

		if (configChanged) {
			cachedSiteRef.current = site;
			cachedPathRef.current = assetsPath;
			cachedMimeTypesRef.current = mimeTypes;
			cachedQueryRef.current = query;
			fetchItems({ offset: 0 });
		}
	}, [site, assetsPath, mimeTypes, query, fetchItems]);

	const { guestBase, xsrfArgument } = useSelector<GlobalState, GlobalState['env']>((state) => state.env);
	const { formatMessage } = useIntl();
	const elementRef = useRef(undefined);

	const onDragStart = (mediaItem: MediaItem) => {
		if (!editMode) {
			dispatch(setPreviewEditMode({ editMode: true }));
		}
		hostToGuest$.next(assetDragStarted({ asset: mediaItem }));
	};

	const onDragEnd = () => hostToGuest$.next(assetDragEnded());

	const onDragDrop = useCallback(
		(e) => {
			const file = e.dataTransfer.files[0];
			if (!file) {
				return;
			}

			const reader = new FileReader();
			reader.onloadend = function () {
				uploadDataUrl(
					site,
					{
						...pluckProps(file, 'name', 'type'),
						dataUrl: reader.result
					},
					path ? ensureSingleSlash(`${path}/`) : '/static-assets/images/',
					xsrfArgument
				).subscribe({
					complete() {
						fetchItems();
					}
				});
			};
			reader.readAsDataURL(file);
			setDragInProgress(false);
		},
		[xsrfArgument, fetchItems, site]
	);

	useEffect(() => {
		const subscription = fromEvent(elementRef.current, 'dragenter')
			.pipe(filter((e: any) => e.dataTransfer?.types.includes('Files')))
			.subscribe((e) => {
				e.preventDefault();
				e.stopPropagation();
				setDragInProgress(true);
			});
		return () => subscription.unsubscribe();
	}, []);

	useEffect(() => {
		if (dragInProgress) {
			const dragover$ = fromEvent(elementRef.current, 'dragover').pipe(
				tap((e: any) => {
					e.preventDefault();
					e.stopPropagation();
				}),
				share()
			);
			const dragoverSubscription = dragover$.subscribe();
			const dragleaveSubscription = fromEvent(elementRef.current, 'dragleave')
				.pipe(
					switchMap(() => interval(100).pipe(takeUntil(dragover$))),
					map(() => false)
				)
				.subscribe(setDragInProgress);
			const dropSubscription = fromEvent(elementRef.current, 'drop')
				.pipe(filter((e: any) => e.dataTransfer?.types.includes('Files')))
				.subscribe((e) => {
					e.preventDefault();
					e.stopPropagation();
					onDragDrop(e);
				});
			return () => {
				dragoverSubscription.unsubscribe();
				dragleaveSubscription.unsubscribe();
				dropSubscription.unsubscribe();
			};
		}
	}, [dragInProgress, onDragDrop]);

	const onSearch = useCallback((keywords: string) => fetchItems({ keywords, offset: 0 }), [fetchItems]);

	const onSearch$ = useDebouncedInput(onSearch, 400);

	function onPageChanged(newPage: number) {
		fetchItems({ offset: newPage });
	}

	function onRowsPerPageChange(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) {
		fetchItems({ offset: 0, limit: Number(e.target.value) });
	}

	function handleSearchKeyword(keyword: string) {
		setKeyword(keyword);
		onSearch$.next(keyword);
	}

	return (
		<Box
			ref={elementRef}
			sx={(theme) => {
				const toolbarHeight = typeof theme.mixins.toolbar.minHeight === 'number' ? theme.mixins.toolbar.minHeight : 64;
				const panelHeight = `calc(100dvh - ${toolbarHeight * 2}px - 1px - 50px)`;

				return {
					display: 'flex',
					flexDirection: 'column',
					height: panelHeight,
					maxHeight: panelHeight,
					minHeight: 0,
					overflow: 'hidden',
					position: 'relative',
					...(dragInProgress ? { overflow: 'hidden' } : {})
				};
			}}
		>
			<Box sx={{ padding: '15px 15px 0 15px', flexShrink: 0 }}>
				<SearchBar showActionButton={Boolean(keyword)} onChange={handleSearchKeyword} keyword={keyword} autoFocus />
			</Box>
			<ErrorBoundary>
				{assets.error ? (
					<ApiResponseErrorState error={assets.error} />
				) : assets.isFetching ? (
					<LoadingState title={formatMessage(translations.retrieveAssets)} />
				) : assets.page[assets.pageNumber] ? (
					<Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
						{dragInProgress && (
							<Box
								sx={{
									position: 'absolute',
									background: alpha(palette.black, 0.9),
									top: 0,
									bottom: 0,
									left: 0,
									right: 0,
									display: 'flex',
									justifyContent: 'center',
									alignContent: 'center',
									zIndex: 2
								}}
							>
								<UploadIcon
									style={{ pointerEvents: 'none' }}
									sx={{ fontSize: '8em', color: palette.gray.light5, margin: 'auto' }}
								/>
							</Box>
						)}
						<Box sx={{ flexShrink: 0 }}>
							<Pagination
								count={assets.count}
								rowsPerPage={assets.query.limit}
								page={assets.pageNumber}
								onPageChange={(e, page: number) => onPageChanged(page * assets.query.limit)}
								onRowsPerPageChange={onRowsPerPageChange}
							/>
						</Box>
						<Box sx={{ p: 2, flex: 1, minHeight: 0, overflowY: 'auto' }}>
							{assets.page[assets.pageNumber]?.map((id) => {
								const item = assets.byId[id];
								return (
									<MediaCard
										key={item.path}
										item={item}
										previewAppBaseUri={guestBase}
										avatar={<DragIndicatorRounded />}
										sxs={{
											root: { cursor: 'move', marginBottom: '16px' }
										}}
										onDragStart={() => onDragStart(item)}
										onDragEnd={() => onDragEnd()}
										onPreview={() =>
											dispatch(
												pushDialog({
													component: createComponentId('PreviewDialog'),
													allowMinimize: true,
													allowFullScreen: true,
													props: {
														// TODO: check if it's image or video
														type: 'image',
														title: item.name,
														url: item.path
													}
												})
											)
										}
									/>
								);
							})}
							{assets.count === 0 && (
								<EmptyState
									title={formatMessage(translations.noResults)}
									sxs={{
										image: { width: '150px' },
										title: { fontSize: 'inherit', marginTop: '10px' }
									}}
								/>
							)}
						</Box>
					</Box>
				) : (
					<></>
				)}
			</ErrorBoundary>
		</Box>
	);
}

export default PreviewAssetsPanel;
