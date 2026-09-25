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
	getPackagesValidatedSelectionState,
	useSpreadStateWithSelected,
	WithSelectedState
} from '../SiteDashboard/utils';
import DashletCard from '../DashletCard/DashletCard';
import palette from '../../styles/palette';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import React, { ReactNode, useCallback, useEffect } from 'react';
import {
	DashletEmptyMessage,
	getItemSkeleton,
	List,
	ListItemIcon,
	Pager,
	PersonAvatar
} from '../DashletCard/dashletCommons';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { LIVE_COLOUR, STAGING_COLOUR } from '../ItemPublishingTargetIcon/styles';
import ListItemButton from '@mui/material/ListItemButton';
import { asLocalizedDateTime } from '../../utils/datetime';
import useLocale from '../../hooks/useLocale';
import { ActionsBar, ActionsBarAction } from '../ActionsBar';
import { READY_MASK, UNDEFINED } from '../../utils/constants';
import { useDispatch } from 'react-redux';
import {
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
import { LoadingIconButton } from '../LoadingIconButton';
import Box from '@mui/material/Box';
import useDashletFilterState from '../../hooks/useDashletFilterState';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { fetchPackages, FetchPackagesResponse } from '../../services/publishing';
import { nnou, reversePluckProps } from '../../utils/object';
import IconButton from '@mui/material/IconButton';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import PackageDetailsDialog from '../PackageDetailsDialog';
import { generatePackageOptions, packageActionDispatcher } from '../../utils/packageActions';
import { PublishPackage } from '../../models';

export interface ScheduledDashletProps extends CommonDashletProps {}

interface ScheduledDashletState extends WithSelectedState<FetchPackagesResponse> {
	total: number;
	loading: boolean;
	loadingSkeleton: boolean;
	limit: number;
	offset: number;
	sort: string;
	packageDetailsDialogId: number;
}

const messages = defineMessages({
	staging: { id: 'words.staging', defaultMessage: 'Staging' },
	live: { id: 'words.live', defaultMessage: 'Live' }
});

export function ScheduledDashlet(props: ScheduledDashletProps) {
	const { borderLeftColor = palette.blue.tint, onMinimize } = props;
	const site = useActiveSiteId();
	const locale = useLocale();
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const [
		{
			items: publishingPackages,
			loading,
			loadingSkeleton,
			total,
			isAllSelected,
			hasSelected,
			selected,
			selectedCount,
			limit,
			offset,
			sort,
			packageDetailsDialogId
		},
		setState,
		onSelectItem,
		onSelectAll,
		isSelected
	] = useSpreadStateWithSelected<ScheduledDashletState>({
		loading: false,
		loadingSkeleton: true,
		total: null,
		limit: 50,
		offset: 0,
		sort: 'schedule ASC',
		packageDetailsDialogId: null
	});

	const currentPage = offset / limit;
	const totalPages = total ? Math.ceil(total / limit) : 0;
	const selectedPackages = publishingPackages?.filter((pkg) => selected[pkg.id]) ?? [];
	const selectionOptions = generatePackageOptions(selectedPackages) as ActionsBarAction[];
	const isIndeterminate = hasSelected && !isAllSelected;
	const filterState = useDashletFilterState('scheduledDashlet');
	const refs = useUpdateRefs({
		publishingPackages,
		currentPage,
		filterState,
		loadPagesUntil: null as (pageNumber: number, backgroundRefresh?: boolean) => void
	});

	const loadPage = useCallback(
		(pageNumber: number, backgroundRefresh?: boolean) => {
			const newOffset = pageNumber * limit;
			setState({
				loading: true,
				loadingSkeleton: !backgroundRefresh
			});
			fetchPackages(site, {
				limit,
				offset: newOffset,
				sort,
				isScheduled: true,
				states: READY_MASK,
				approvalStates: ['APPROVED']
			}).subscribe((packages) => {
				setState({
					items: packages,
					total: packages.total,
					offset: newOffset,
					loading: false
				});
			});
		},
		[limit, setState, site, sort]
	);

	const onOptionClicked = (option) => {
		// Clear selection
		setState({ selectedCount: 0, isAllSelected: false, selected: {}, hasSelected: false });
		if (option !== 'clear') {
			return packageActionDispatcher({
				pkg: selectedPackages.length > 1 ? selectedPackages : selectedPackages[0],
				option,
				dispatch
			});
		}
	};

	const loadPagesUntil = useCallback(
		(pageNumber: number, backgroundRefresh?: boolean) => {
			setState({
				loading: true,
				loadingSkeleton: !backgroundRefresh,
				...(!loadingSkeleton && { items: null })
			});
			const totalLimit = pageNumber * limit;
			fetchPackages(site, {
				limit: totalLimit + limit,
				offset: 0,
				sort,
				isScheduled: true,
				states: READY_MASK,
				approvalStates: ['APPROVED']
			}).subscribe((packages) => {
				const validatedState = getPackagesValidatedSelectionState(packages, limit);
				setState(validatedState);
			});
		},
		[limit, setState, site, loadingSkeleton, sort]
	);
	refs.current.loadPagesUntil = loadPagesUntil;

	const onRefresh = () => {
		loadPagesUntil(currentPage, true);
	};

	useEffect(() => {
		loadPage(0);
	}, [loadPage]);

	useEffect(() => {
		// To avoid re-fetching when it first loads
		if (refs.current.publishingPackages) {
			refs.current.loadPagesUntil(refs.current.currentPage);
		}
	}, [filterState?.selectedTypes, refs]);

	// region Item Updates Propagation
	useEffect(() => {
		const events = [
			workflowEventSubmit.type,
			workflowEventDirectPublish.type,
			workflowEventApprove.type,
			workflowEventReject.type,
			workflowEventCancel.type,
			publishEvent.type,
			deleteContentEvent.type
		];
		const hostToHost$ = getHostToHostBus();
		const subscription = hostToHost$.pipe(filter((e) => events.includes(e.type))).subscribe(() => {
			loadPagesUntil(currentPage, true);
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [currentPage, loadPagesUntil, filterState?.selectedTypes]);
	// endregion

	const onPackageDetailsClick = (packageId: number) => {
		setState({ packageDetailsDialogId: packageId });
	};

	return (
		<DashletCard
			{...props}
			borderLeftColor={borderLeftColor}
			title={<FormattedMessage id="scheduledDashlet.widgetTitle" defaultMessage="Scheduled for Publish" />}
			headerAction={
				<LoadingIconButton
					onClick={onRefresh}
					loading={loading}
					aria-label={formatMessage({ defaultMessage: 'Refresh' })}
				>
					<RefreshRounded />
				</LoadingIconButton>
			}
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
					buttonProps={{ size: 'small' }}
					sxs={{
						root: { flexGrow: 1 },
						container: { bgcolor: selectedCount > 0 ? 'action.selected' : UNDEFINED },
						checkbox: { padding: '5px', borderRadius: 0 },
						button: { minWidth: 50 }
					}}
				/>
			}
			footer={
				Boolean(publishingPackages?.length) && (
					<Pager
						totalPages={totalPages}
						totalItems={total}
						currentPage={currentPage}
						rowsPerPage={limit}
						onPagePickerChange={(page) => loadPage(page)}
						onPageChange={(page) => loadPage(page)}
						onRowsPerPageChange={(rowsPerPage) => setState({ limit: rowsPerPage })}
					/>
				)
			}
			sxs={{
				actionsBar: { padding: 0 },
				content: { padding: 0 },
				footer: {
					justifyContent: 'space-between'
				}
			}}
		>
			{loading && loadingSkeleton && getItemSkeleton({ numOfItems: 3, showAvatar: false, showCheckbox: true })}
			{Boolean(publishingPackages?.length) && (
				<List sx={{ pb: 0 }}>
					{publishingPackages.map((pkg, index) => (
						<ListItemButton key={index} onClick={(e) => onSelectItem(e, pkg as PublishPackage)} sx={{ pt: 0, pb: 0 }}>
							<ListItemIcon>
								<Checkbox
									edge="start"
									checked={isSelected(pkg)}
									onClick={(e) => onSelectItem(e, pkg as PublishPackage)}
								/>
							</ListItemIcon>
							{pkg.submitter && (
								<PersonAvatar
									person={pkg.submitter}
									sx={{
										display: 'inline-flex',
										mr: 1,
										width: 30,
										height: 30,
										fontSize: '1.1rem'
									}}
								/>
							)}
							<ListItemText
								primary={
									<FormattedMessage
										defaultMessage="<bold>{title}</bold> ({total} {total, plural, one {item} other {items}})"
										values={{
											title: pkg.title,
											total: pkg.itemCount,
											bold: (chunks: React.ReactNode) => <strong>{chunks}</strong>
										}}
									/>
								}
								secondary={
									<FormattedMessage
										defaultMessage="Approved by {name} to go {publishingTarget, select, live { <render_target>live</render_target>} other {<render_target>staging</render_target>}} on {submittedDate}"
										values={{
											// If a reviewer approved, show their name; otherwise show submitter name
											name: pkg.reviewer?.username ?? pkg.submitter?.username,
											publishingTarget: pkg.target,
											render_target(target: ReactNode[]) {
												return (
													<Box
														component="span"
														sx={{
															color: target[0] === 'live' ? LIVE_COLOUR : STAGING_COLOUR
														}}
													>
														{messages[target[0] as string]
															? formatMessage(messages[target[0] as string]).toLowerCase()
															: target[0]}
													</Box>
												);
											},
											submittedDate: asLocalizedDateTime(pkg.schedule, locale.localeCode, locale.dateTimeFormatOptions)
										}}
									/>
								}
							/>
							<IconButton
								onClick={(e) => {
									e.stopPropagation();
									onPackageDetailsClick(pkg.id);
								}}
							>
								<ChevronRightRoundedIcon />
							</IconButton>
						</ListItemButton>
					))}
				</List>
			)}
			{total === 0 && (
				<DashletEmptyMessage>
					<FormattedMessage defaultMessage="There are no items scheduled for publish" />
				</DashletEmptyMessage>
			)}
			<PackageDetailsDialog
				open={nnou(packageDetailsDialogId)}
				onClose={() => setState({ packageDetailsDialogId: null })}
				packageId={packageDetailsDialogId}
			/>
		</DashletCard>
	);
}

export default ScheduledDashlet;
