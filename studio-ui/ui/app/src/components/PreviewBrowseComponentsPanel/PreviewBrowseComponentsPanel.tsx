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

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { nnou, nou } from '../../utils/object';
import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary';
import LoadingState from '../LoadingState/LoadingState';
import ContentInstance from '../../models/ContentInstance';
import {
	componentInstanceDragEnded,
	componentInstanceDragStarted,
	fetchComponentsByContentType,
	setContentTypeFilter,
	setPreviewEditMode
} from '../../state/actions/preview';
import { useDispatch } from 'react-redux';
import SearchBar from '../SearchBar/SearchBar';
import { getHostToGuestBus } from '../../utils/subjects';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import ContentType from '../../models/ContentType';
import { useSelection } from '../../hooks/useSelection';
import { useDebouncedInput } from '../../hooks/useDebouncedInput';
import translations from './translations';
import PreviewBrowseComponentsPanelUI from './PreviewBrowseComponentsPanelUI';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import ListSubheader from '@mui/material/ListSubheader';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';

export function PreviewBrowseComponentsPanel() {
	const dispatch = useDispatch();
	const siteId = useActiveSiteId();
	const allowedTypesData = useSelection((state) => state.preview.guest?.allowedContentTypes);
	const awaitingGuestCheckIn = nou(allowedTypesData);
	const contentTypesUpdated = useSelection((state) => state.preview.guest?.contentTypesUpdated);
	const componentsState = useSelection((state) => state.preview.components);
	const [keyword, setKeyword] = useState(componentsState.query.keywords);
	const contentTypesBranch = useSelection((state) => state.contentTypes);
	const editMode = useSelection((state) => state.preview.editMode);
	const contentTypes = contentTypesBranch.byId
		? Object.values(contentTypesBranch.byId).filter(
				(contentType) => contentType.type === 'component' && !contentType.id.includes('/level-descriptor')
			)
		: null;
	const items = useMemo(() => {
		let items = componentsState.page[componentsState.pageNumber]?.map((id: string) => componentsState.byId[id]) ?? [];
		if (componentsState.contentTypeFilter !== 'compatible') {
			items = items.filter(
				(item: ContentInstance) => item.craftercms.contentTypeId === componentsState.contentTypeFilter
			);
		}
		return items;
	}, [componentsState]);
	const contentTypeData = useMemo(() => {
		const allowedTypes: ContentType[] = [];
		const otherTypes: ContentType[] = [];
		const result = { allowedTypes, otherTypes };
		if (!contentTypes || !allowedTypesData) return result;
		contentTypes.forEach((contentType) => {
			// When selecting 'Allow any component' in the content type editor, there will be a key '*' in the allowedTypesData
			if (allowedTypesData[contentType.id]?.sharedExisting || allowedTypesData['*']?.sharedExisting) {
				allowedTypes.push(contentType);
			} else {
				otherTypes.push(contentType);
			}
			const sorter = (a: ContentType, b: ContentType) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
			allowedTypes.sort(sorter);
			otherTypes.sort(sorter);
		});
		return result;
	}, [allowedTypesData, contentTypes]);

	useEffect(() => {
		// We want guest to check in, so we can retrieve the compatible types when fetching the items.
		if (siteId && contentTypesBranch.isFetching === false && !awaitingGuestCheckIn) {
			dispatch(fetchComponentsByContentType({ sortBy: 'internalName', sortOrder: 'asc' }));
		}
	}, [siteId, contentTypesBranch, dispatch, awaitingGuestCheckIn]);

	const { formatMessage } = useIntl();
	const contentTypeLabelId = useId();
	const contentTypeLabel = formatMessage(translations.contentType);
	const hostToGuest$ = getHostToGuestBus();

	const onDragStart = (item: ContentInstance) => {
		if (!editMode) {
			dispatch(setPreviewEditMode({ editMode: true }));
		}
		hostToGuest$.next(
			componentInstanceDragStarted({
				instance: item,
				contentType: contentTypesBranch.byId[item.craftercms.contentTypeId]
			})
		);
	};

	const onDragEnd = () => hostToGuest$.next({ type: componentInstanceDragEnded.type });

	const onSearch = useCallback(
		(keywords: string) =>
			dispatch(fetchComponentsByContentType({ keywords, offset: 0, sortBy: 'internalName', sortOrder: 'asc' })),
		[dispatch]
	);

	const onSearch$ = useDebouncedInput(onSearch, 600);

	function onPageChanged(newPage: number) {
		dispatch(fetchComponentsByContentType({ offset: newPage, sortBy: 'internalName', sortOrder: 'asc' }));
	}

	function onRowsPerPageChange(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) {
		dispatch(
			fetchComponentsByContentType({ offset: 0, limit: e.target.value, sortBy: 'internalName', sortOrder: 'asc' })
		);
	}

	function handleSearchKeyword(keyword: string) {
		setKeyword(keyword);
		onSearch$.next(keyword);
	}

	function handleSelectChange(value: string) {
		dispatch(setContentTypeFilter(value));
	}

	return (
		<>
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
						onChange={handleSearchKeyword}
						keyword={keyword}
						autoFocus
					/>
					{contentTypes && (
						<FormControl size="small" fullWidth sx={{ marginTop: (theme) => theme.spacing(1) }}>
							<InputLabel id={contentTypeLabelId}>{contentTypeLabel}</InputLabel>
							<Select
								labelId={contentTypeLabelId}
								label={contentTypeLabel}
								size="small"
								value={componentsState.contentTypeFilter}
								displayEmpty
								onChange={(event: any) => handleSelectChange(event.target.value)}
							>
								<MenuItem value="compatible">
									<FormattedMessage defaultMessage="Compatible Types" />
								</MenuItem>
								<ListSubheader>
									<FormattedMessage defaultMessage="Compatible" />
								</ListSubheader>
								{contentTypeData.allowedTypes.length === 0 ? (
									<MenuItem disabled>
										<FormattedMessage defaultMessage="No compatible types were found." />
									</MenuItem>
								) : (
									contentTypeData.allowedTypes.map((contentType: ContentType, i: number) => (
										<MenuItem value={contentType.id} key={i}>
											{contentType.name}
										</MenuItem>
									))
								)}
								<ListSubheader>
									<FormattedMessage defaultMessage="Other" />
								</ListSubheader>
								{contentTypeData.otherTypes.map((contentType: ContentType, i: number) => (
									<MenuItem value={contentType.id} key={i}>
										{contentType.name}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					)}
				</Box>
				{componentsState.error ? (
					<ApiResponseErrorState error={componentsState.error} />
				) : componentsState.isFetching ? (
					<LoadingState title={formatMessage(translations.loading)} />
				) : (
					((nnou(componentsState.pageNumber) && nnou(componentsState.page[componentsState.pageNumber])) ||
						!componentsState.contentTypeFilter) && (
						<PreviewBrowseComponentsPanelUI
							awaitingGuestCheckIn={awaitingGuestCheckIn}
							items={items}
							count={componentsState.count}
							pageNumber={componentsState.pageNumber}
							limit={componentsState.query.limit}
							onPageChanged={onPageChanged}
							onRowsPerPageChange={onRowsPerPageChange}
							onDragStart={onDragStart}
							onDragEnd={onDragEnd}
						/>
					)
				)}
			</ErrorBoundary>
		</>
	);
}

export default PreviewBrowseComponentsPanel;
