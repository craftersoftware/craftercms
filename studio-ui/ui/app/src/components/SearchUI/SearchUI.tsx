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

import SiteSearchToolBar from '../SiteSearchToolbar';
import React, { ReactNode, useRef } from 'react';
import Drawer from '@mui/material/Drawer';
import SiteSearchFilters from '../SiteSearchFilters';
import { ElasticParams, Filter, MediaItem } from '../../models/Search';
import { CheckedFilter, drawerWidth, SearchProps, UseSearchStateReturn } from '../Search/utils';
import LookupTable from '../../models/LookupTable';
import Checkbox from '@mui/material/Checkbox';
import { translations } from '../Search/translations';
import TablePagination, { tablePaginationClasses } from '@mui/material/TablePagination';
import ApiResponseErrorState from '../ApiResponseErrorState';
import Grid from '@mui/material/Grid';
import MediaCard from '../MediaCard/MediaCard';
import EmptyState from '../EmptyState/EmptyState';
import ItemActionsSnackbar from '../ItemActionsSnackbar';
import Button from '@mui/material/Button';
import ListItemText from '@mui/material/ListItemText';
import { FormattedMessage, useIntl } from 'react-intl';
import ApiResponse from '../../models/ApiResponse';
import IconButton from '@mui/material/IconButton';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import { UNDEFINED } from '../../utils/constants';
import { LoadingState } from '../LoadingState';
import Box from '@mui/material/Box';
import { drawerClasses } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';

export interface SearchUIProps
	extends
		Required<Pick<SearchProps, 'mode' | 'embedded' | 'onClose' | 'onAcceptSelection'>>,
		Pick<
			UseSearchStateReturn,
			| 'currentView'
			| 'drawerOpen'
			| 'guestBase'
			| 'handleSelect'
			| 'handleChangeView'
			| 'handleSelectAll'
			| 'handleClearSelected'
			| 'isFetching'
			| 'onHeaderButtonClick'
			| 'onPreview'
			| 'onActionClicked'
			| 'onSelectedPathChanges'
			| 'toggleDrawer'
			| 'selectedPath'
			| 'selectionOptions'
			| 'searchResults'
			| 'selected'
		> {
	sortBy?: string;
	sortOrder?: string;
	keyword: string;
	desktopScreen: boolean;
	areAllSelected: boolean;
	checkedFilters: LookupTable<CheckedFilter>;
	searchParameters: ElasticParams;
	error: ApiResponse;
	preselectedLookup?: LookupTable<boolean>;
	disableChangePreselected?: SearchProps['disableChangePreselected'];
	onCheckedFiltersChanges(checkedFilters: LookupTable<CheckedFilter>): void;
	clearFilter(facet: string): void;
	clearFilters(): void;
	handleSearchKeyword(keyword: string): void;
	handleFilterChange(filter: Filter, isFilter?: boolean): void;
	handleChangePage(event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null, newPage: number): void;
	handleChangeRowsPerPage(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void;
}

export function SearchUI(props: SearchUIProps) {
	// region const { ... } = props
	const {
		areAllSelected,
		error,
		isFetching,
		sortBy,
		sortOrder,
		searchParameters,
		mode,
		currentView,
		desktopScreen,
		embedded,
		keyword,
		handleSearchKeyword,
		checkedFilters,
		drawerOpen,
		searchResults,
		toggleDrawer,
		handleChangeView,
		handleFilterChange,
		clearFilter,
		clearFilters,
		selectedPath,
		onSelectedPathChanges,
		onCheckedFiltersChanges,
		handleSelectAll,
		handleChangePage,
		handleChangeRowsPerPage,
		onPreview,
		handleSelect,
		selected,
		guestBase,
		selectionOptions,
		onHeaderButtonClick,
		onActionClicked,
		handleClearSelected,
		onClose,
		onAcceptSelection,
		preselectedLookup = {},
		disableChangePreselected = true
	} = props;
	// endregion

	const { formatMessage } = useIntl();

	const container = useRef(undefined);

	return (
		<Box
			component="section"
			ref={container}
			sx={{ height: '100%', position: 'relative', background: (theme) => theme.palette.background.default }}
		>
			<SiteSearchToolBar
				onChange={handleSearchKeyword}
				onMenuIconClick={toggleDrawer}
				handleChangeView={handleChangeView}
				currentView={currentView}
				keyword={keyword}
				showActionButton={Boolean(keyword)}
				showTitle={mode === 'select' || (mode === 'default' && !embedded)}
				embedded={embedded}
			/>
			<Drawer
				variant={desktopScreen ? 'persistent' : 'temporary'}
				container={container.current}
				anchor="left"
				open={drawerOpen}
				sx={{
					flexShrink: 0,
					[`& .${drawerClasses.paper}`]: {
						top: 65,
						bottom: mode === 'select' ? '71px' : 0,
						width: drawerWidth,
						zIndex: (theme) => theme.zIndex.appBar - 1,
						height: 'auto',
						position: 'absolute'
					},
					[`& .${drawerClasses.modal}`]: {
						position: 'absolute',
						'& .MuiBackdrop-root': {
							background: 'transparent'
						}
					}
				}}
				ModalProps={{
					...(!desktopScreen && {
						onClose: () => toggleDrawer()
					})
				}}
			>
				{searchResults && searchResults.facets && (
					<SiteSearchFilters
						mode={mode}
						sx={{ marginRight: '7px' }}
						facets={searchResults.facets}
						handleFilterChange={handleFilterChange}
						sortBy={sortBy}
						sortOrder={sortOrder}
						checkedFilters={checkedFilters}
						setCheckedFilters={onCheckedFiltersChanges}
						clearFilters={clearFilters}
						handleClearClick={clearFilter}
						selectedPath={selectedPath}
						setSelectedPath={onSelectedPathChanges}
					/>
				)}
			</Drawer>
			<Box
				component="section"
				sx={[
					(theme) => ({
						height: 'calc(100% - 65px)', // 100% - toolbar height
						margin: 'auto',
						display: 'flex',
						flexDirection: 'column',
						background: theme.palette.background.default,
						transition: drawerOpen
							? theme.transitions.create('margin', {
									easing: theme.transitions.easing.easeOut,
									duration: theme.transitions.duration.enteringScreen
								})
							: theme.transitions.create('margin', {
									easing: theme.transitions.easing.sharp,
									duration: theme.transitions.duration.leavingScreen
								}),
						'&.hasContent': {
							height: 'inherit'
						},
						'&.select': {}
					}),
					mode === 'select' && { height: 'calc(100% - 136px)' }
				]}
				style={
					drawerOpen && desktopScreen
						? { width: `calc(100% - ${drawerWidth}px`, marginLeft: drawerWidth }
						: { marginLeft: 0 }
				}
			>
				<Box
					sx={(theme) => ({
						display: 'flex',
						padding: '0 6px',
						alignItems: 'center',
						background: theme.palette.background.paper,
						borderBottom: `1px solid ${theme.palette.divider}`
					})}
				>
					<Tooltip title={<FormattedMessage id="search.selectAll" defaultMessage="Select all on this page" />}>
						<Checkbox checked={areAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} />
					</Tooltip>
					<TablePagination
						rowsPerPageOptions={[9, 15, 21]}
						sx={{
							marginLeft: 'auto',
							'& p': {
								padding: 0
							},
							'& svg': {
								top: 'inherit'
							},
							[`& .${tablePaginationClasses.selectRoot}`]: { mr: 0 },
							[`& .${tablePaginationClasses.select}`]: { border: 'none' }
						}}
						component="div"
						labelRowsPerPage={null}
						labelDisplayedRows={({ from, to, count }) => (
							<>
								<FormattedMessage
									id="search.resultsCaption"
									defaultMessage="{from}-{to} of {count} results {keywordLength, plural, =0 {}other{ for <b>“{keyword}”</b>}}"
									values={{
										from,
										to,
										count,
										keyword: keyword.length > 18 ? keyword.substring(0, 15).trim() + '...' : keyword,
										keywordLength: keyword.length,
										b: (content: ReactNode[]) => <strong key={content[0] as string}>{content[0]}</strong>
									}}
								/>
								{(Object.keys(checkedFilters).length > 0 || Boolean(selectedPath)) && (
									<strong>
										<FormattedMessage
											id="search.filtersActive"
											defaultMessage=" • <span>Filters Active</span>"
											values={{
												span: (content: ReactNode[]) => (
													<Box
														component="span"
														key={content[0] as string}
														sx={{
															color: '#FFB400',
															marginLeft: '2px'
														}}
													>
														{content[0]}
													</Box>
												)
											}}
										/>
									</strong>
								)}
							</>
						)}
						count={searchResults?.total ?? 0}
						rowsPerPage={searchParameters.limit}
						page={Math.ceil(searchParameters.offset / searchParameters.limit)}
						slotProps={{
							actions: {
								previousButton: {
									'aria-label': formatMessage(translations.previousPage),
									title: formatMessage(translations.previousPage)
								},
								nextButton: {
									'aria-label': formatMessage(translations.nextPage),
									title: formatMessage(translations.nextPage)
								}
							}
						}}
						onPageChange={handleChangePage}
						onRowsPerPageChange={handleChangeRowsPerPage}
					/>
				</Box>
				<Box component="section" sx={{ flexGrow: 1, padding: '25px 30px', overflowY: 'scroll', position: 'relative' }}>
					{error ? (
						<ApiResponseErrorState error={error} />
					) : (
						<Grid
							container
							spacing={3}
							sx={[
								{
									minHeight: '100%',
									alignContent: isFetching || searchResults === null ? 'center' : 'start'
								},
								searchResults?.items.length === 0 && { height: '100%', justifyContent: 'center' }
							]}
						>
							{isFetching || searchResults === null ? (
								<LoadingState />
							) : (
								<>
									{searchResults.items.length > 0 ? (
										searchResults.items.map((item: MediaItem, i) => (
											<Grid
												key={i}
												size={{ xs: 12, ...(currentView === 'grid' ? { sm: 6, md: 4, lg: 4, xl: 3 } : {}) }}
											>
												<MediaCard
													sxs={{
														root: {
															cursor:
																disableChangePreselected && preselectedLookup[item.path] ? 'not-allowed' : 'pointer',
															display: currentView === 'list' ? 'flex' : 'block'
														},
														...(currentView === 'list'
															? {
																	checkbox: {
																		justifyContent: 'center',
																		order: -2,
																		marginRight: '5px',
																		marginLeft: '16px'
																	},
																	media: {
																		paddingTop: 0,
																		height: '80px',
																		width: '80px',
																		order: -1
																	},
																	mediaIcon: {
																		height: '80px',
																		width: '80px',
																		paddingTop: 0,
																		order: -1
																	},
																	cardActionArea: {
																		width: 'auto',
																		display: 'flex'
																	},
																	cardHeader: { flexGrow: 1 }
																}
															: {})
													}}
													item={item}
													onPreview={mode === 'default' ? () => onPreview(item) : UNDEFINED}
													onClick={
														!(disableChangePreselected && preselectedLookup[item.path]) && mode === 'select'
															? () => handleSelect(item.path, !selected.includes(item.path))
															: UNDEFINED
													}
													onSelect={handleSelect}
													disableSelection={disableChangePreselected && preselectedLookup[item.path]}
													selected={selected}
													previewAppBaseUri={guestBase}
													action={
														mode === 'default' ? (
															<IconButton
																onClick={(e) => onHeaderButtonClick(e, item)}
																size="small"
																aria-label={formatMessage({ defaultMessage: 'Options' })}
															>
																<MoreVertRounded />
															</IconButton>
														) : null
													}
												/>
											</Grid>
										))
									) : (
										<EmptyState
											title={formatMessage(translations.noResults)}
											subtitle={formatMessage(translations.changeQuery)}
										/>
									)}
								</>
							)}
						</Grid>
					)}
				</Box>
			</Box>
			{mode === 'default' && (
				<ItemActionsSnackbar
					open={selected.length > 0}
					options={selectionOptions}
					onActionClicked={onActionClicked}
					append={
						<Button size="small" color="primary" variant="text" onClick={handleClearSelected}>
							<ListItemText
								primary={formatMessage(translations.clearSelected, {
									count: selected.length
								})}
							/>
						</Button>
					}
				/>
			)}
			{mode === 'select' && (
				<Box
					component="section"
					sx={{
						flex: '0 0 auto',
						display: 'flex',
						padding: '14px 20px',
						justifyContent: 'flex-end',
						borderTop: (theme) => `1px solid ${theme.palette.divider}`,
						'& > :not(:first-child)': {
							marginLeft: '12px'
						}
					}}
				>
					{onClose && (
						<Button variant="outlined" onClick={onClose}>
							{formatMessage(translations.cancel)}
						</Button>
					)}
					{onAcceptSelection && (
						<Button
							variant="contained"
							color="primary"
							disabled={selected.length === 0}
							onClick={() =>
								onAcceptSelection(
									selected,
									selected.flatMap((path) => searchResults.items?.find((item) => item.path === path) ?? [])
								)
							}
						>
							{formatMessage(translations.acceptSelection)}
						</Button>
					)}
				</Box>
			)}
		</Box>
	);
}

export default SearchUI;
