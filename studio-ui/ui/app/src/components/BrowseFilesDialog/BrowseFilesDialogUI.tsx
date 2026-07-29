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
import DialogBody from '../DialogBody/DialogBody';
import DialogFooter from '../DialogFooter/DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import { FormattedMessage, useIntl } from 'react-intl';
import { SearchItem } from '../../models';
import MediaCard from '../MediaCard/MediaCard';
import SearchBar from '../SearchBar/SearchBar';
import MediaSkeletonCard from './MediaSkeletonCard';
import EmptyState from '../EmptyState/EmptyState';
import Pagination from '../Pagination';
import FolderBrowserTreeView from '../FolderBrowserTreeView';
import Box from '@mui/material/Box';
import { BrowseFilesDialogUIProps } from './utils';
import Divider from '@mui/material/Divider';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { filtersMessages } from '../SiteSearchSortBy';
import { camelize } from '../../utils/string';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import FilterListIcon from '@mui/icons-material/FilterList';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { inputBaseClasses } from '@mui/material/InputBase';
import ListViewIcon from '@mui/icons-material/ViewStreamRounded';
import GridViewIcon from '@mui/icons-material/GridOnRounded';
import ReorderRoundedIcon from '@mui/icons-material/ReorderRounded';
import { SORT_AUTO } from '../Search/utils';
import Checkbox from '@mui/material/Checkbox';
import palette from '../../styles/palette';

const TREE_PANEL_DEFAULT_WIDTH = 270;
const TREE_PANEL_MIN_WIDTH = 240;
const TREE_PANEL_MAX_WIDTH = 480;

export function BrowseFilesDialogUI(props: BrowseFilesDialogUIProps) {
	// region const { ... } = props;
	const {
		items,
		guestBase,
		selectedCard,
		selectedArray,
		multiSelect = false,
		path,
		currentPath,
		searchParameters,
		setSearchParameters,
		limit,
		offset,
		keyword,
		total,
		numOfLoaderItems = 12,
		sortKeys,
		onCardSelected,
		onPreviewImage,
		onCheckboxChecked,
		handleSearchKeyword,
		onPathSelected,
		treeSelectedPath,
		onSelectButtonClick,
		onChangePage,
		onChangeRowsPerPage,
		onCloseButtonClick,
		onRefresh,
		onUpload,
		allowUpload = true,
		viewMode = 'card',
		onToggleViewMode,
		preselectedLookup = {},
		disableChangePreselected = true,
		disableSubmission,
		allSelected,
		someSelected,
		onSelectAll,
		isCurrentPathLeaf
	} = props;
	// endregion
	const { formatMessage } = useIntl();
	const [sortMenuOpen, setSortMenuOpen] = useState(false);
	const buttonRef = useRef(undefined);
	const [treePanelWidth, setTreePanelWidth] = useState(TREE_PANEL_DEFAULT_WIDTH);
	const [treePanelResizeActive, setTreePanelResizeActive] = useState(false);
	const treePanelRef = useRef<HTMLDivElement>(null);
	const treePanelResizeListenersRef = useRef<{ mouseUp: () => void; blur: () => void } | null>(null);

	const handleTreePanelMouseMove = useCallback((e: MouseEvent) => {
		e.preventDefault();
		if (!treePanelRef.current) {
			return;
		}
		const left = treePanelRef.current.getBoundingClientRect().left;
		let newWidth = e.clientX - left + 5;
		newWidth = Math.min(TREE_PANEL_MAX_WIDTH, Math.max(TREE_PANEL_MIN_WIDTH, newWidth));
		setTreePanelWidth(newWidth);
	}, []);

	const cleanupTreePanelResize = useCallback(() => {
		const listeners = treePanelResizeListenersRef.current;
		if (!listeners) {
			return;
		}
		treePanelResizeListenersRef.current = null;
		setTreePanelResizeActive(false);
		document.removeEventListener('mouseup', listeners.mouseUp, true);
		document.removeEventListener('mousemove', handleTreePanelMouseMove, true);
		window.removeEventListener('blur', listeners.blur);
	}, [handleTreePanelMouseMove]);

	useEffect(() => {
		return () => {
			cleanupTreePanelResize();
		};
	}, [cleanupTreePanelResize]);

	const handleTreePanelResizeMouseDown = useCallback(() => {
		if (treePanelResizeListenersRef.current) {
			return;
		}
		setTreePanelResizeActive(true);
		const handleMouseUp = () => {
			cleanupTreePanelResize();
		};
		const handleBlur = () => {
			cleanupTreePanelResize();
		};
		treePanelResizeListenersRef.current = { mouseUp: handleMouseUp, blur: handleBlur };
		document.addEventListener('mouseup', handleMouseUp, true);
		document.addEventListener('mousemove', handleTreePanelMouseMove, true);
		window.addEventListener('blur', handleBlur);
	}, [cleanupTreePanelResize, handleTreePanelMouseMove]);

	const handleTreePanelResizeKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
			return;
		}
		e.preventDefault();
		const delta = e.key === 'ArrowRight' ? 10 : -10;
		setTreePanelWidth((prev) => Math.min(TREE_PANEL_MAX_WIDTH, Math.max(TREE_PANEL_MIN_WIDTH, prev + delta)));
	}, []);

	return (
		<>
			<DialogBody sx={{ minHeight: '60vh', padding: 0 }}>
				<Box display="flex" sx={{ flex: 1, minHeight: '60vh', overflow: 'hidden' }}>
					<Box
						ref={treePanelRef}
						sx={{
							width: treePanelWidth,
							minWidth: treePanelWidth,
							flexShrink: 0,
							position: 'relative',
							display: 'flex',
							flexDirection: 'column'
						}}
					>
						<Box
							display="flex"
							flexDirection="column"
							sx={{
								flex: 1,
								minHeight: 0,
								padding: '16px',
								overflow: 'auto',
								rowGap: '20px'
							}}
						>
							<FolderBrowserTreeView
								rootPath={path}
								onPathSelected={onPathSelected}
								selectedPath={currentPath}
								highlightedPath={treeSelectedPath}
							/>
						</Box>
						<Box
							onMouseDown={handleTreePanelResizeMouseDown}
							onKeyDown={handleTreePanelResizeKeyDown}
							role="separator"
							tabIndex={0}
							aria-orientation="vertical"
							aria-label={formatMessage({ defaultMessage: 'Resize folder panel' })}
							aria-valuemin={TREE_PANEL_MIN_WIDTH}
							aria-valuemax={TREE_PANEL_MAX_WIDTH}
							aria-valuenow={Math.round(treePanelWidth)}
							sx={{
								position: 'absolute',
								top: 0,
								bottom: 0,
								right: 0,
								width: '10px',
								marginRight: '-5px',
								cursor: 'ew-resize',
								zIndex: 2,
								display: 'flex',
								justifyContent: 'center',
								alignItems: 'stretch',
								'&::before': {
									content: '""',
									display: 'block',
									width: treePanelResizeActive ? '4px' : '2px',
									backgroundColor: (theme) => (treePanelResizeActive ? palette.blue.tint : theme.palette.divider),
									transition: 'width 200ms, background-color 200ms'
								},
								'&:hover::before': {
									width: '4px',
									backgroundColor: palette.blue.tint
								}
							}}
						/>
					</Box>
					<Box component="section" sx={{ flexGrow: 1, minWidth: 0, padding: '16px', overflow: 'auto' }}>
						<Paper
							sx={{
								paddingLeft: (theme) => theme.spacing(1),
								marginBottom: (theme) => theme.spacing(3),
								borderRadius: 4
							}}
						>
							<Toolbar disableGutters variant="dense">
								<Box sx={{ flexGrow: 1, display: 'flex' }}>
									{multiSelect && (
										<>
											<Tooltip title={<FormattedMessage defaultMessage="Select All on this page" />}>
												<Checkbox checked={allSelected} indeterminate={someSelected} onChange={onSelectAll} />
											</Tooltip>
											<Divider orientation="vertical" flexItem sx={{ marginTop: '-3px', marginBottom: '-3px' }} />
										</>
									)}
									<Tooltip title={<FormattedMessage id="word.refresh" defaultMessage="Refresh" />}>
										<IconButton
											onClick={onRefresh}
											aria-label={formatMessage({ id: 'word.refresh', defaultMessage: 'Refresh' })}
										>
											<RefreshIcon />
										</IconButton>
									</Tooltip>
									{allowUpload && (
										<Tooltip title={<FormattedMessage id="word.upload" defaultMessage="Upload" />}>
											<IconButton
												onClick={onUpload}
												sx={{ mr: 1 }}
												aria-label={formatMessage({ id: 'word.upload', defaultMessage: 'Upload' })}
											>
												<UploadFileIcon />
											</IconButton>
										</Tooltip>
									)}
									<Divider orientation="vertical" flexItem sx={{ marginTop: '-3px', marginBottom: '-3px' }} />
									<SearchBar
										keyword={keyword}
										onChange={handleSearchKeyword}
										showDecoratorIcon
										showActionButton={Boolean(keyword)}
										sxs={{
											root: {
												maxWidth: '200px',
												background: 'none !important',
												border: 'none !important',
												borderRadius: 0,
												boxShadow: 'none'
											},
											inputInput: { padding: '8px 5px' }
										}}
									/>
									<Divider orientation="vertical" flexItem sx={{ marginTop: '-3px', marginBottom: '-3px' }} />
									<Button
										id="sort-button"
										aria-haspopup="true"
										aria-controls={sortMenuOpen ? 'sort-menu' : undefined}
										aria-expanded={sortMenuOpen ? 'true' : undefined}
										onClick={() => setSortMenuOpen(!sortMenuOpen)}
										ref={buttonRef}
										sx={{ ml: 1, mr: 1 }}
										startIcon={<FilterListIcon />}
									>
										<FormattedMessage id="words.sorting" defaultMessage="Sorting" />
									</Button>
									<Menu
										id="sort-menu"
										anchorEl={buttonRef.current}
										open={sortMenuOpen}
										onClose={() => setSortMenuOpen(false)}
										MenuListProps={{
											'aria-labelledby': 'sort-button'
										}}
									>
										<MenuItem>
											<FormControl fullWidth>
												<InputLabel>
													<FormattedMessage id="BrowseFilesDialog.sortBy" defaultMessage="Sort By" />
												</InputLabel>
												<Select
													fullWidth
													value={searchParameters.sortBy}
													onChange={({ target }) => {
														setSearchParameters({
															sortBy: target.value
														});
													}}
													size="small"
													sx={{ minWidth: '180px' }}
													label={<FormattedMessage id="BrowseFilesDialog.sortBy" defaultMessage="Sort By" />}
												>
													<MenuItem value={SORT_AUTO}>
														<FormattedMessage defaultMessage="Auto" />
													</MenuItem>
													<MenuItem value={'_score'}>
														<FormattedMessage id="words.relevance" defaultMessage="Relevance" />
													</MenuItem>
													<MenuItem value={'internalName'}>
														<FormattedMessage id="words.name" defaultMessage="Name" />
													</MenuItem>
													{sortKeys.map((name, i) => {
														const camelizedName = camelize(name);
														return (
															<MenuItem value={name} key={i}>
																{camelizedName in filtersMessages
																	? formatMessage(filtersMessages[camelizedName])
																	: name}
															</MenuItem>
														);
													})}
												</Select>
											</FormControl>
										</MenuItem>
										{searchParameters.sortBy && SORT_AUTO !== searchParameters.sortBy && (
											<MenuItem>
												<FormControl fullWidth>
													<InputLabel>
														<FormattedMessage id="words.order" defaultMessage="Order" />
													</InputLabel>
													<Select
														fullWidth
														value={searchParameters.sortOrder}
														onChange={({ target }) => {
															setSearchParameters({
																sortOrder: target.value
															});
														}}
														size="small"
														sx={{ minWidth: '180px' }}
														label={<FormattedMessage id="words.order" defaultMessage="Order" />}
													>
														<MenuItem value={'asc'}>
															{searchParameters.sortBy === '_score' ? (
																<FormattedMessage
																	id="browseFilesDialog.lessRelevantFirst"
																	defaultMessage="Less relevant first"
																/>
															) : (
																<FormattedMessage id="words.ascending" defaultMessage="Ascending" />
															)}
														</MenuItem>
														<MenuItem value={'desc'}>
															{searchParameters.sortBy === '_score' ? (
																<FormattedMessage
																	id="browseFilesDialog.mostRelevantFirst"
																	defaultMessage="Most relevant first"
																/>
															) : (
																<FormattedMessage id="words.descending" defaultMessage="Descending" />
															)}
														</MenuItem>
													</Select>
												</FormControl>
											</MenuItem>
										)}
									</Menu>
									<Divider orientation="vertical" flexItem sx={{ marginTop: '-3px', marginBottom: '-3px' }} />
								</Box>
								<Box sx={{ display: 'flex', flexGrow: 0 }}>
									<Tooltip title={<FormattedMessage defaultMessage="Switch view mode" />}>
										<IconButton
											onClick={onToggleViewMode}
											sx={{ mr: 1 }}
											aria-label={formatMessage({ defaultMessage: 'Switch view mode' })}
										>
											{viewMode === 'card' ? (
												<ListViewIcon />
											) : viewMode === 'compact' ? (
												<ReorderRoundedIcon />
											) : (
												<GridViewIcon />
											)}
										</IconButton>
									</Tooltip>
									<Divider orientation="vertical" flexItem sx={{ marginTop: '-3px', marginBottom: '-3px' }} />
									{items && (
										<Pagination
											sxs={{
												toolbar: { pl: 0 },
												root: {
													[`.${inputBaseClasses.root}`]: {
														marginRight: (theme) => theme.spacing(1),
														backgroundColor: (theme) =>
															theme.palette.background[theme.palette.mode === 'dark' ? 'default' : 'paper']
													}
												}
											}}
											count={total}
											rowsPerPage={limit}
											page={Math.ceil(offset / limit)}
											onPageChange={(e, page: number) => onChangePage(page)}
											onRowsPerPageChange={onChangeRowsPerPage}
										/>
									)}
								</Box>
							</Toolbar>
						</Paper>
						<Box
							sx={[
								{
									display: 'grid',
									gridTemplateColumns: 'repeat(auto-fit, minmax(200px, max-content))',
									gridGap: '16px',
									padding: 'initial'
								},
								viewMode === 'row' && { display: 'flex !important', flexFlow: 'wrap' }
							]}
						>
							{items
								? items.map((item: SearchItem) => {
										const isPreselected = preselectedLookup[item.path];
										const onSelect = disableChangePreselected && isPreselected ? () => null : onCheckboxChecked;

										return (
											<MediaCard
												viewMode={viewMode}
												sxs={{
													root: {
														cursor: disableChangePreselected && isPreselected ? 'not-allowed' : 'pointer',
														boxShadow: (theme) =>
															item.path === selectedCard?.path
																? `0px 0px 4px 4px ${theme.palette.primary.main}`
																: 'none'
													}
												}}
												key={item.path}
												item={item}
												disableSelection={disableChangePreselected && isPreselected}
												selected={multiSelect ? [...selectedArray] : []}
												onSelect={multiSelect ? onSelect : null}
												onPreview={onPreviewImage ? () => onPreviewImage(item) : null}
												previewAppBaseUri={guestBase}
												onClick={() => !(disableChangePreselected && isPreselected) && onCardSelected(item)}
												showPath={true}
											/>
										);
									})
								: new Array(numOfLoaderItems).fill(null).map((x, i) => <MediaSkeletonCard key={i} />)}
						</Box>
						{items &&
							items.length === 0 &&
							(isCurrentPathLeaf ? (
								<EmptyState
									sxs={{ root: { flexGrow: 1 } }}
									title={<FormattedMessage defaultMessage="This item has no children." />}
								/>
							) : (
								<EmptyState
									sxs={{ root: { flexGrow: 1 } }}
									title={<FormattedMessage id="browseFilesDialog.noResults" defaultMessage="No items found." />}
								/>
							))}
					</Box>
				</Box>
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={onCloseButtonClick}>
					<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton disabled={disableSubmission} onClick={onSelectButtonClick}>
					<FormattedMessage id="words.select" defaultMessage="Select" />
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

export default BrowseFilesDialogUI;
