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

import {
	CommonDashletProps,
	getItemsValidatedSelectionState,
	getItemViewOption,
	isPage,
	previewPage,
	useSelectionOptions,
	useSpreadStateWithSelected,
	WithSelectedState
} from '../SiteDashboard/utils';
import DashletCard from '../DashletCard/DashletCard';
import palette from '../../styles/palette';
import { FormattedMessage, useIntl } from 'react-intl';
import React, { useCallback, useEffect, useState } from 'react';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import useLocale from '../../hooks/useLocale';
import useEnv from '../../hooks/useEnv';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { fetchUnpublished } from '../../services/dashboard';
import {
	DashletEmptyMessage,
	DashletItemOptions,
	getItemSkeleton,
	List,
	ListItemIcon,
	Pager
} from '../DashletCard/dashletCommons';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { asLocalizedDateTime } from '../../utils/datetime';
import ItemDisplay from '../ItemDisplay';
import { ContentItem, LookupTable } from '../../models';
import ActionsBar from '../ActionsBar';
import { UNDEFINED } from '../../utils/constants';
import { itemActionDispatcher } from '../../utils/itemActions';
import { useDispatch } from 'react-redux';
import ListItemButton from '@mui/material/ListItemButton';
import {
	contentEvent,
	deleteContentEvent,
	publishEvent,
	workflowEventApprove,
	workflowEventCancel,
	workflowEventDirectPublish,
	workflowEventReject,
	workflowEventSubmit
} from '../../state/actions/system';
import { getHostToHostBus } from '../../utils/subjects';
import { filter } from 'rxjs/operators';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import LoadingIconButton from '../LoadingIconButton';
import DashletFilter from '../ActivityDashlet/DashletFilter';
import SystemType from '../../models/SystemType';
import useDashletFilterState from '../../hooks/useDashletFilterState';

interface UnpublishedDashletProps extends CommonDashletProps {}

interface UnpublishedDashletState extends WithSelectedState<ContentItem> {
	total: number;
	loading: boolean;
	loadingSkeleton: boolean;
	limit: number;
	offset: number;
}

export function UnpublishedDashlet(props: UnpublishedDashletProps) {
	const { borderLeftColor = palette.blue.tint, onMinimize } = props;
	const site = useActiveSiteId();
	const locale = useLocale();
	const { formatMessage } = useIntl();
	const { authoringBase } = useEnv();
	const dispatch = useDispatch();
	const [
		{ loading, loadingSkeleton, total, items, isAllSelected, hasSelected, selected, selectedCount, limit, offset },
		setState,
		onSelectItem,
		onSelectAll,
		isSelected
	] = useSpreadStateWithSelected<UnpublishedDashletState>({
		loading: false,
		loadingSkeleton: true,
		total: null,
		limit: 50,
		offset: 0
	});
	const currentPage = offset / limit;
	const totalPages = total ? Math.ceil(total / limit) : 0;
	const [itemsById, setItemsById] = useState<LookupTable<ContentItem>>({});
	const itemsByPathRef = useUpdateRefs(itemsById);
	const selectedItems = Object.values(itemsById)?.filter((item) => selected[item.id]) ?? [];
	const selectionOptions = useSelectionOptions(selectedItems, formatMessage, selectedCount);
	const isIndeterminate = hasSelected && !isAllSelected;
	const filterState = useDashletFilterState('unpublishedDashlet');
	const refs = useUpdateRefs({
		items,
		currentPage,
		filterState,
		loadPagesUntil: null as (pageNumber: number, itemTypes?: Array<SystemType>, backgroundRefresh?: boolean) => void
	});

	const loadPage = useCallback(
		(pageNumber: number, itemTypes?: Array<SystemType>, backgroundRefresh?: boolean) => {
			const newOffset = pageNumber * limit;
			setState({
				loading: true,
				loadingSkeleton: !backgroundRefresh
			});
			fetchUnpublished(site, { limit, offset: newOffset, itemType: refs.current.filterState.selectedTypes }).subscribe(
				(items) => {
					setState({ items, offset: newOffset, total: items.total, loading: false });
				}
			);
		},
		[limit, setState, site, refs]
	);

	const loadPagesUntil = useCallback(
		(pageNumber: number, itemTypes?: Array<SystemType>, backgroundRefresh?: boolean) => {
			setState({
				loading: true,
				loadingSkeleton: !backgroundRefresh,
				...(!backgroundRefresh && { items: null })
			});
			const totalLimit = pageNumber * limit;
			fetchUnpublished(site, {
				limit: totalLimit + limit,
				offset: 0,
				itemType: refs.current.filterState.selectedTypes
			}).subscribe((unpublishedItems) => {
				const validatedState = getItemsValidatedSelectionState(unpublishedItems, selected, limit);
				setItemsById(validatedState.itemsById);
				setState(validatedState.state);
			});
		},
		[limit, selected, setState, site, refs]
	);
	refs.current.loadPagesUntil = loadPagesUntil;

	const onRefresh = () => {
		loadPagesUntil(currentPage, filterState.selectedTypes, true);
	};

	const onOptionClicked = (option) => {
		// Clear selection
		setState({ selectedCount: 0, isAllSelected: false, selected: {}, hasSelected: false });
		if (option !== 'clear') {
			return itemActionDispatcher({
				site,
				authoringBase,
				dispatch,
				formatMessage,
				option,
				item: selectedItems.length > 1 ? selectedItems : selectedItems[0]
			});
		}
	};

	const onItemClick = (e, item) => {
		if (isPage(item.systemType)) {
			e.stopPropagation();
			previewPage(site, authoringBase, item, dispatch, onMinimize);
		} else if (item.availableActionsMap.view) {
			e.stopPropagation();

			itemActionDispatcher({
				site,
				authoringBase,
				dispatch,
				formatMessage,
				option: getItemViewOption(item),
				item
			});
		}
	};

	useEffect(() => {
		if (items) {
			const itemsObj = {};
			items.forEach((item) => {
				itemsObj[item.id] = item;
			});
			setItemsById({ ...itemsByPathRef.current, ...itemsObj });
		}
	}, [items, setItemsById, itemsByPathRef]);

	useEffect(() => {
		loadPage(0, refs.current.filterState.selectedTypes);
	}, [loadPage, refs]);

	useEffect(() => {
		// To avoid re-fetching when it first loads
		if (refs.current.items) {
			refs.current.loadPagesUntil(refs.current.currentPage, filterState.selectedTypes);
		}
	}, [filterState?.selectedTypes, refs]);

	// region Item Updates Propagation
	useEffect(() => {
		const events = [
			deleteContentEvent.type,
			workflowEventSubmit.type,
			workflowEventDirectPublish.type,
			workflowEventApprove.type,
			workflowEventReject.type,
			workflowEventCancel.type,
			publishEvent.type,
			contentEvent.type
		];
		const hostToHost$ = getHostToHostBus();
		const subscription = hostToHost$.pipe(filter((e) => events.includes(e.type))).subscribe(({ type, payload }) => {
			loadPagesUntil(currentPage, filterState.selectedTypes, true);
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [currentPage, loadPagesUntil, filterState?.selectedTypes]);
	// endregion

	return (
		<DashletCard
			{...props}
			borderLeftColor={borderLeftColor}
			title={<FormattedMessage id="unpublishedDashlet.widgetTitle" defaultMessage="Unpublished Work" />}
			headerAction={
				<LoadingIconButton
					onClick={onRefresh}
					loading={loading}
					aria-label={formatMessage({ defaultMessage: 'Refresh' })}
				>
					<RefreshRounded />
				</LoadingIconButton>
			}
			sxs={{
				actionsBar: { padding: 0 },
				content: { padding: 0 },
				footer: {
					justifyContent: 'space-between'
				}
			}}
			actionsBar={
				<ActionsBar
					disabled={loading}
					isChecked={isAllSelected}
					isIndeterminate={isIndeterminate}
					onCheckboxChange={onSelectAll}
					onOptionClicked={onOptionClicked}
					options={selectionOptions?.concat([
						...(selectedCount > 0
							? [
									{
										id: 'clear',
										label: formatMessage(
											{
												defaultMessage: 'Clear {count} selected'
											},
											{ count: selectedCount }
										)
									}
								]
							: [])
					])}
					noSelectionContent={<DashletFilter selectedKeys={filterState.selectedKeys} onChange={filterState.onChange} />}
					buttonProps={{ size: 'small' }}
					sxs={{
						root: { flexGrow: 1 },
						container: { bgcolor: hasSelected ? 'action.selected' : UNDEFINED },
						checkbox: { padding: '5px', borderRadius: 0 },
						button: { minWidth: 50 }
					}}
				/>
			}
			footer={
				Boolean(items?.length) && (
					<Pager
						totalPages={totalPages}
						totalItems={total}
						currentPage={currentPage}
						rowsPerPage={limit}
						onPagePickerChange={(page) => loadPage(page, filterState.selectedTypes)}
						onPageChange={(page) => loadPage(page, filterState.selectedTypes)}
						onRowsPerPageChange={(rowsPerPage) => setState({ limit: rowsPerPage })}
					/>
				)
			}
		>
			{loading && loadingSkeleton && getItemSkeleton({ numOfItems: 3, showAvatar: false, showCheckbox: true })}
			{items && (
				<List sx={{ pb: 0 }}>
					{items.map((item, index) => (
						<ListItemButton key={index} onClick={(e) => onSelectItem(e, item)} sx={{ pt: 0, pb: 0 }}>
							<ListItemIcon>
								<Checkbox edge="start" checked={isSelected(item)} onChange={(e) => onSelectItem(e, item)} />
							</ListItemIcon>
							<ListItemText
								primary={
									<ItemDisplay
										item={item}
										titleDisplayProp="path"
										showPublishingTarget={true}
										onClick={(e) =>
											isPage(item.systemType) || item.availableActionsMap.view ? onItemClick(e, item) : null
										}
										showNavigableAsLinks={isPage(item.systemType) || item.availableActionsMap.view}
									/>
								}
								secondary={
									<Typography color="text.secondary" variant="body2">
										<FormattedMessage
											id="unpublishedDashlet.entrySecondaryText"
											defaultMessage="Edited by {name} on {date}"
											values={{
												name: item.modifier.username,
												date: asLocalizedDateTime(item.dateModified, locale.localeCode, locale.dateTimeFormatOptions)
											}}
										/>
									</Typography>
								}
							/>
							<DashletItemOptions path={item.path} />
						</ListItemButton>
					))}
				</List>
			)}
			{/* TODO: remove or statement once backend is fixed (total doesn't match) */}
			{(total === 0 || (total && items?.length === 0)) && (
				<DashletEmptyMessage>
					<FormattedMessage
						id="unpublishedDashlet.noUnpublishedItems"
						defaultMessage="There are no unpublished items"
					/>
				</DashletEmptyMessage>
			)}
		</DashletCard>
	);
}

export default UnpublishedDashlet;
