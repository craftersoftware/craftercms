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

import React, { useCallback, useEffect } from 'react';
import {
	CommonDashletProps,
	getPackagesValidatedSelectionState,
	useSpreadStateWithSelected,
	WithSelectedState
} from '../SiteDashboard/utils';
import DashletCard from '../DashletCard/DashletCard';
import {
	DashletEmptyMessage,
	getItemSkeleton,
	List,
	ListItemIcon,
	Pager,
	PersonAvatar,
	SubmittedPackageDetail
} from '../DashletCard/dashletCommons';
import { FormattedMessage, useIntl } from 'react-intl';
import palette from '../../styles/palette';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import { ActionsBar, ActionsBarAction } from '../ActionsBar';
import { READY_MASK, UNDEFINED } from '../../utils/constants';
import { useDispatch } from 'react-redux';
import ListItemButton from '@mui/material/ListItemButton';
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
import useLocale from '../../hooks/useLocale';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { fetchPackages, FetchPackagesResponse, PackageApprovalState } from '../../services/publishing';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import IconButton from '@mui/material/IconButton';
import { generatePackageOptions, packageActionDispatcher } from '../../utils/packageActions';
import { PublishPackage } from '../../models';
import { showPackageDetails } from '../ViewPackagesDialog/utils';

interface PendingApprovalDashletProps extends CommonDashletProps {}

interface PendingApprovalDashletState extends WithSelectedState<FetchPackagesResponse> {
	total: number;
	loading: boolean;
	loadingSkeleton: boolean;
	limit: number;
	offset: number;
}

const pendingApprovalState: PackageApprovalState[] = ['SUBMITTED'];

export function PendingApprovalDashlet(props: PendingApprovalDashletProps) {
	const { borderLeftColor = palette.purple.tint } = props;
	const [
		{
			items: publishingPackages,
			total,
			loading,
			loadingSkeleton,
			isAllSelected,
			hasSelected,
			selected,
			selectedCount,
			limit,
			offset
		},
		setState,
		onSelectItem,
		onSelectAll,
		isSelected
	] = useSpreadStateWithSelected<PendingApprovalDashletState>({
		loading: false,
		loadingSkeleton: true,
		total: null,
		limit: 50,
		offset: 0
	});
	const { formatMessage } = useIntl();
	const currentPage = offset / limit;
	const totalPages = total ? Math.ceil(total / limit) : 0;
	const selectedPackages = publishingPackages?.filter((pkg) => selected[pkg.id]) ?? [];
	const selectionOptions = generatePackageOptions(selectedPackages) as ActionsBarAction[];
	const isIndeterminate = hasSelected && !isAllSelected;
	const site = useActiveSiteId();
	const locale = useLocale();
	const dispatch = useDispatch();
	const refs = useUpdateRefs({
		publishingPackages,
		currentPage,
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
				states: READY_MASK,
				approvalStates: pendingApprovalState
			}).subscribe((packages) => {
				setState({
					items: packages,
					total: packages.total,
					offset: newOffset,
					loading: false
				});
			});
		},
		[limit, setState, site]
	);

	const loadPagesUntil = useCallback(
		(pageNumber: number, backgroundRefresh?: boolean) => {
			setState({
				loading: true,
				loadingSkeleton: !backgroundRefresh,
				...(!backgroundRefresh && { items: null })
			});
			const totalLimit = pageNumber * limit;
			fetchPackages(site, {
				limit: totalLimit + limit,
				offset: 0,
				states: READY_MASK,
				approvalStates: pendingApprovalState
			}).subscribe((packages) => {
				const validatedState = getPackagesValidatedSelectionState(packages, limit);
				setState(validatedState);
			});
		},
		[limit, setState, site]
	);
	refs.current.loadPagesUntil = loadPagesUntil;

	const onRefresh = () => {
		loadPagesUntil(currentPage, true);
	};

	useEffect(() => {
		loadPage(0);
	}, [loadPage, refs]);

	useEffect(() => {
		// To avoid re-fetching when it first loads
		if (refs.current.publishingPackages) {
			refs.current.loadPagesUntil(refs.current.currentPage);
		}
	}, [refs]);

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

	const onPackageDetailsClick = (pkg: PublishPackage) => {
		showPackageDetails({ pkg, dispatch });
	};

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
	}, [currentPage, loadPagesUntil]);
	// endregion

	return (
		<DashletCard
			{...props}
			borderLeftColor={borderLeftColor}
			title={
				<FormattedMessage
					id="pendingApprovalDashlet.widgetTitle"
					defaultMessage="Pending Approval <render_total>{total}</render_total>"
					values={{
						total,
						render_total(total) {
							return total ? `(${total})` : '';
						}
					}}
				/>
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
					buttonProps={{ size: 'small' }}
					sxs={{
						root: { flexGrow: 1 },
						container: { bgcolor: selectedCount > 0 ? 'action.selected' : UNDEFINED },
						checkbox: { padding: '5px', borderRadius: 0 },
						button: { minWidth: 50 }
					}}
				/>
			}
			headerAction={
				<LoadingIconButton
					onClick={onRefresh}
					loading={loading}
					aria-label={formatMessage({ defaultMessage: 'Refresh' })}
				>
					<RefreshRounded />
				</LoadingIconButton>
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
										defaultMessage="<bold>{title}</bold> awaiting approval ({total} {total, plural, one {item} other {items}})"
										values={{
											title: pkg.title,
											total: pkg.itemCount,
											bold: (chunks: React.ReactNode) => <strong>{chunks}</strong>
										}}
									/>
								}
								secondary={<SubmittedPackageDetail pkg={pkg} />}
							/>
							<IconButton
								onClick={(e) => {
									e.stopPropagation();
									onPackageDetailsClick(pkg);
								}}
								aria-label={formatMessage({ defaultMessage: 'Package details' })}
							>
								<ChevronRightRoundedIcon />
							</IconButton>
						</ListItemButton>
					))}
				</List>
			)}
			{total === 0 && (
				<DashletEmptyMessage>
					<FormattedMessage
						id="pendingApprovalDashlet.noPendingItems"
						defaultMessage="There are no items pending approval"
					/>
				</DashletEmptyMessage>
			)}
		</DashletCard>
	);
}

export default PendingApprovalDashlet;
