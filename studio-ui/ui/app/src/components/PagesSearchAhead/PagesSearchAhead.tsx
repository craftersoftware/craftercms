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

import InputBase from '@mui/material/InputBase';
import React, { useEffect, useState } from 'react';
import { catchError, debounceTime, switchMap, tap } from 'rxjs/operators';
import { search } from '../../services/search';
import useAutocomplete from '@mui/material/useAutocomplete';
import { SearchItem } from '../../models/Search';
import { CircularProgress, IconButton, List, ListItemIcon, ListItemText, Paper } from '@mui/material';
import LoadingState from '../LoadingState/LoadingState';
import EmptyState from '../EmptyState/EmptyState';
import Page from '../../icons/Page';
import CloseIcon from '@mui/icons-material/Close';
import { getPreviewURLFromPath } from '../../utils/path';
import { FormattedMessage, useIntl } from 'react-intl';
import parse from 'autosuggest-highlight/parse';
import match from 'autosuggest-highlight/match';
import palette from '../../styles/palette';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { useContentTypeList } from '../../hooks/useContentTypeList';
import { useSubject } from '../../hooks/useSubject';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { of } from 'rxjs';
import ListItemButton from '@mui/material/ListItemButton';
import { PartialSxRecord } from '../../models';
import Box from '@mui/material/Box';

export interface PagesSearchAheadProps {
	value: string;
	placeholder?: string;
	disabled?: boolean;
	onEnter(url: string): void;
	onFocus?(): void;
	onBlur?(): void;
	classes?: Partial<Record<'input', string>>;
	sxs?: PartialSxRecord<
		'container' | 'closeIcon' | 'progress' | 'inputRoot' | 'input' | 'paper' | 'listBox' | 'listItemIcon'
	>;
	autoFocus?: boolean;
}

export function PagesSearchAhead(props: PagesSearchAheadProps) {
	const { value, placeholder = '', disabled = false, onEnter, onFocus, onBlur, autoFocus = true, sxs } = props;
	const onSearch$ = useSubject<string>();
	const site = useActiveSiteId();
	const contentTypes = useContentTypeList((contentType) => contentType.id?.startsWith('/page'));
	const [keyword, setKeyword] = useState('');
	const [isFetching, setIsFetching] = useState(false);
	const [items, setItems] = useState(null);
	const [dirty, setDirty] = useState(false);
	const [error, setError] = useState(null);
	const { formatMessage } = useIntl();

	const { getRootProps, getInputProps, getListboxProps, getOptionProps, groupedOptions, popupOpen } = useAutocomplete({
		freeSolo: true,
		inputValue: keyword,
		disableCloseOnSelect: true,
		onInputChange: (e, value, reason) => {
			if (reason === 'reset' || reason === 'selectOption') {
				const previewUrl = getPreviewURLFromPath(value);
				setKeyword(previewUrl);
				onEnter(previewUrl);
				setDirty(false);
			} else {
				setKeyword(value);
				if (value) {
					onSearch$.next(value);
				} else {
					setDirty(true);
				}
			}
		},
		options: keyword && items ? items : [],
		filterOptions: (options: SearchItem[], state) => options,
		getOptionLabel: (item: SearchItem | string) => {
			return typeof item === 'string' ? item : item.path;
		},
		isOptionEqualToValue: (option, value) => option.path === (value as SearchItem).path
	});

	useEffect(() => {
		setKeyword(value);
	}, [value]);

	useEffect(() => {
		const subscription = onSearch$
			.pipe(
				tap(() => {
					setIsFetching(true);
					setError(null);
					setDirty(true);
				}),
				debounceTime(400),
				switchMap((keywords) => {
					return search(site, {
						// Cleaning of searchKeywords due to security validations for characters like '?', '#' in the back.
						keywords: keywords.replace(/(\?|#).*/, ''),
						filters: {
							'content-type': contentTypes.map((contentType) => contentType.id)
						}
					}).pipe(
						catchError(({ response }) => {
							setIsFetching(false);
							setError(response.response);
							setItems(null);
							return of({ items: null });
						})
					);
				})
			)
			.subscribe((response) => {
				setIsFetching(false);
				setItems(response.items);
			});
		return () => subscription.unsubscribe();
	}, [contentTypes, onSearch$, site]);

	const onClean = () => {
		setItems(null);
		setKeyword(value);
		setDirty(false);
	};

	const inputProps: { [key: string]: any } = getInputProps();

	return (
		<Box sx={{ width: '100%', position: 'relative', ...sxs.container }}>
			<div {...getRootProps()}>
				<InputBase
					onKeyUp={(e) => {
						if (e.key === 'Enter') {
							if (keyword.startsWith('/')) {
								onEnter(keyword);
							} else if (groupedOptions.length > 0) {
								// TODO:
								//   1. Fix typing so cast is not required
								const previewUrl = getPreviewURLFromPath((groupedOptions[0] as SearchItem).path);
								onEnter(previewUrl);
								setKeyword(previewUrl);
							}
							setItems(null);
							setDirty(false);
						}
					}}
					onFocus={(e) => {
						onFocus?.();
						inputProps.onFocus(e);
						e.target.select();
					}}
					onBlur={(e) => {
						onBlur?.();
						inputProps.onFocus(e);
						onClean();
					}}
					autoFocus={autoFocus}
					placeholder={placeholder}
					disabled={disabled}
					classes={{ input: props.classes?.input }}
					sx={{ width: '100%', background: 'none', ...sxs?.inputRoot }}
					slotProps={{
						input: { sx: sxs?.input }
					}}
					endAdornment={
						isFetching ? (
							<CircularProgress
								sx={{
									position: 'absolute',
									right: 0,
									...sxs?.progress
								}}
								size={15}
							/>
						) : keyword && keyword !== value ? (
							<IconButton
								sx={{ padding: '3px', ...sxs?.closeIcon }}
								onClick={onClean}
								size="large"
								aria-label={formatMessage({ defaultMessage: 'Clean' })}
							>
								<CloseIcon fontSize="small" />
							</IconButton>
						) : null
					}
					inputProps={inputProps}
				/>
			</div>
			{popupOpen && dirty && (
				<Paper
					sx={{
						width: 400,
						position: 'absolute',
						right: '-52px',
						top: '50px',
						zIndex: (theme) => theme.zIndex.drawer + 2,
						...sxs?.paper
					}}
				>
					{isFetching && <LoadingState />}
					{!isFetching && error && <ApiResponseErrorState error={error} imageUrl={null} />}
					{!isFetching && groupedOptions.length > 0 && (
						<List
							dense
							sx={{
								overflow: 'auto',
								maxHeight: 600,
								margin: 0,
								padding: 0,
								listStyle: 'none',
								'& li[data-focus="true"]': {
									backgroundColor: 'rgba(0, 0, 0, 0.04)'
								},
								'& li:active': {
									backgroundColor: 'rgba(0, 0, 0, 0.04)',
									color: 'white'
								},
								...sxs?.listBox
							}}
							{...getListboxProps()}
						>
							{(groupedOptions as SearchItem[]).map((option, index) => (
								<ListItemButton dense component="li" {...getOptionProps({ option, index })}>
									<ListItemIcon sx={{ minWidth: 'auto', paddingRight: '16px', ...sxs?.listItemIcon }}>
										<Page />
									</ListItemIcon>
									<Option
										name={option.name}
										path={getPreviewURLFromPath(option.path)}
										keyword={keyword}
										sxs={{
											highlighted: {
												display: 'inline-block',
												background: 'yellow',
												color: (theme) =>
													theme.palette.mode === 'dark' ? palette.gray.medium6 : theme.palette.text.secondary
											}
										}}
									/>
								</ListItemButton>
							))}
						</List>
					)}
					{!isFetching && !error && groupedOptions.length === 0 && (
						<EmptyState
							title={<FormattedMessage id="searchAhead.noResults" defaultMessage="No Results." />}
							sxs={{
								image: {
									width: 100
								}
							}}
						/>
					)}
				</Paper>
			)}
		</Box>
	);
}

function Option(props: { name: string; path: string; keyword: string; sxs?: PartialSxRecord<'highlighted'> }) {
	const { name, path, keyword, sxs } = props;
	const nameMatches = match(name, keyword);
	const pathMatches = match(path, keyword);
	const nameParts = parse(name, nameMatches);
	const pathParts = parse(path, pathMatches);

	return (
		<ListItemText
			primary={
				<>
					{nameParts.map((part, i) =>
						part.highlight ? (
							<Box component="span" key={i} sx={sxs?.highlighted}>
								{' '}
								{part.text}{' '}
							</Box>
						) : (
							part.text
						)
					)}
				</>
			}
			secondary={
				<>
					{pathParts.map((part, i) =>
						part.highlight ? (
							<Box component="span" key={i} sx={sxs?.highlighted}>
								{' '}
								{part.text}{' '}
							</Box>
						) : (
							part.text
						)
					)}
				</>
			}
		/>
	);
}

export default PagesSearchAhead;
