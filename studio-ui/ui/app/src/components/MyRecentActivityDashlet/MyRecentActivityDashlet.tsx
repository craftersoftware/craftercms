/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

import { CommonDashletProps, getCurrentPage, useSelectionOptions } from '../SiteDashboard';
import { Activity, Person } from '../../models';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { FormattedMessage, useIntl } from 'react-intl';
import useEnv from '../../hooks/useEnv';
import { useDispatch } from 'react-redux';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchActivity } from '../../services/dashboard';
import useActiveUser from '../../hooks/useActiveUser';
import { DashletCard } from '../DashletCard';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import {
	DashletEmptyMessage,
	DashletItemOptions,
	getItemSkeleton,
	ListItemIcon,
	Pager,
	PersonAvatar,
	usePackageContextMenu
} from '../DashletCard/dashletCommons';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import { renderActivity, renderActivityTimestamp } from '../ActivityDashlet';
import useLocale from '../../hooks/useLocale';
import { PREVIEW_URL_PATH, UNDEFINED } from '../../utils/constants';
import { changeCurrentUrl } from '../../state/actions/preview';
import { getSystemLink } from '../../utils/system';
import useSpreadState from '../../hooks/useSpreadState';
import ListItem from '@mui/material/ListItem';
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
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';
import ActionsBar from '../ActionsBar';
import useItemsByPath from '../../hooks/useItemsByPath';
import useFetchContentItems from '../../hooks/useFetchContentItems';
import { itemActionDispatcher } from '../../utils/itemActions';
import ListItemButton from '@mui/material/ListItemButton';
import { fetchContentItemComplete, fetchContentItems } from '../../state/actions/content';
import LoadingIconButton from '../LoadingIconButton';
import { fetchItemByPath } from '../../services/content';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import IconButton from '@mui/material/IconButton';
import { showPackageDetails } from '../ViewPackagesDialog/utils';

interface MyRecentActivityDashletProps extends CommonDashletProps {}

interface MyRecentActivityDashletState {
	feed: Activity[];
	total: number;
	loading: boolean;
	loadingSkeleton: boolean;
	limit: number;
	offset: number;
}

export function MyRecentActivityDashlet(props: MyRecentActivityDashletProps) {
	const { borderLeftColor = 'success.main', onMinimize } = props;
	const locale = useLocale();
	const site = useActiveSiteId();
	const { formatMessage } = useIntl();
	const { authoringBase } = useEnv();
	const { username, firstName, lastName } = useActiveUser();
	const person: Person = { username, firstName, lastName, avatar: null };
	const dispatch = useDispatch();
	const packageContextMenu = usePackageContextMenu();

	const [{ loading, loadingSkeleton, total, feed, limit, offset }, setState] =
		useSpreadState<MyRecentActivityDashletState>({
			feed: null,
			loading: false,
			loadingSkeleton: true,
			total: null,
			limit: 50,
			offset: 0
		});
	const currentPage = offset / limit;
	const totalPages = total ? Math.ceil(total / limit) : 0;
	const itemsByPath = useItemsByPath();
	const [selectedPaths, setSelectedPaths] = useState([]);
	useFetchContentItems(selectedPaths);
	const selectedItems = useMemo(() => {
		const items = [];
		if (selectedPaths.length > 0) {
			selectedPaths.forEach((path) => {
				if (itemsByPath[path]) {
					items.push(itemsByPath[path]);
				}
			});
		}
		return items;
	}, [itemsByPath, selectedPaths]);
	const selectedCount = selectedItems.length;
	const selectionOptions = useSelectionOptions(selectedItems, formatMessage, selectedCount);
	const siteId = useActiveSiteId();
	const [loadingActionsBar, setLoadingActionsBar] = useState(false);

	const loadPage = useCallback(
		(pageNumber: number, backgroundRefresh?: boolean) => {
			const newOffset = pageNumber * limit;
			setState({
				loading: true,
				loadingSkeleton: !backgroundRefresh
			});
			fetchActivity(site, {
				usernames: [username],
				offset: newOffset,
				limit
			}).subscribe((feed) => {
				setState({ feed, total: feed.total, offset: newOffset, loading: false });
			});
		},
		[limit, setState, site, username]
	);

	const onItemClick = (previewUrl, e) => {
		const pathname = window.location.pathname;
		if (pathname.includes(PREVIEW_URL_PATH)) {
			dispatch(changeCurrentUrl(previewUrl));
			onMinimize?.();
		} else {
			window.location.href = getSystemLink({
				page: previewUrl,
				systemLinkId: 'preview',
				site,
				authoringBase
			});
		}
	};

	const onPackageClick = (pkg) => {
		showPackageDetails({ pkg, dispatch });
	};

	const onRefresh = () => {
		loadPage(getCurrentPage(offset, limit), true);
	};

	const handleSelect = (e, path: string) => {
		e.stopPropagation();
		const isSelected = selectedPaths.includes(path);
		if (!isSelected) {
			// If item has been already fetched, re-fecth to get the latest version, if not loaded, it'll be fetched with the
			// useFetchContentItem hook
			if (itemsByPath[path]) {
				setLoadingActionsBar(true);
				fetchItemByPath(siteId, path).subscribe((item) => {
					dispatch(fetchContentItemComplete({ item }));
					setLoadingActionsBar(false);
				});
			}
			setSelectedPaths([...selectedPaths, path]);
		} else {
			let selectedItems = [...selectedPaths];
			let index = selectedItems.indexOf(path);
			selectedItems.splice(index, 1);
			setSelectedPaths(selectedItems);
		}
	};

	const onOptionClicked = (option) => {
		if (option === 'clear') {
			setSelectedPaths([]);
		} else {
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

	useEffect(() => {
		loadPage(0);
	}, [loadPage]);

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
			dispatch(fetchContentItems({ paths: selectedPaths }));
			loadPage(getCurrentPage(offset, limit), true);
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [limit, offset, loadPage, username, dispatch, selectedPaths]);
	// endregion

	return (
		<DashletCard
			{...props}
			borderLeftColor={borderLeftColor}
			title={
				<>
					{person && (
						<PersonAvatar
							person={person}
							sx={{
								display: 'inline-flex',
								mr: 1,
								width: 30,
								height: 30,
								fontSize: '1.1rem'
							}}
						/>
					)}
					<FormattedMessage defaultMessage="My Activity" />
				</>
			}
			sxs={{
				actionsBar: { padding: 0 },
				content: { padding: 0 },
				footer: { justifyContent: 'space-between' }
			}}
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
				Boolean(feed?.length) && (
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
			actionsBar={
				<ActionsBar
					disabled={loading}
					isLoading={loadingActionsBar}
					isChecked={false}
					isIndeterminate={false}
					onCheckboxChange={null}
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
					showCheckbox={false}
					sxs={{
						root: { flexGrow: 1 },
						container: {
							bgcolor: selectedCount > 0 ? 'action.selected' : UNDEFINED,
							minHeight: 33,
							paddingLeft: '5px'
						},
						checkbox: { padding: '5px', borderRadius: 0 },
						button: { minWidth: 50 }
					}}
				/>
			}
		>
			{loading && loadingSkeleton && getItemSkeleton({ numOfItems: 3, showAvatar: false, showCheckbox: true })}
			{feed && (
				<List sx={{ pb: 0 }}>
					{feed.map((activity) => {
						const isItemActivity = activity.item && activity.item.systemType;
						const ListItemComponent = isItemActivity ? ListItemButton : ListItem;
						const listItemComponentProps = isItemActivity
							? { onClick: (e) => handleSelect(e, activity.item.path) }
							: {};

						return (
							// Property 'button' is missing in type showing when conditionally rendering ListItemButton or ListItem
							// and not showing when using ListItemButton or ListItem directly.
							// @ts-ignore
							<ListItemComponent key={activity.id} sx={{ pt: 0, pb: 0 }} {...listItemComponentProps}>
								<ListItemIcon>
									{activity.item && activity.item.systemType ? (
										<Checkbox
											edge="start"
											checked={selectedPaths.includes(activity.item.path)}
											onClick={(e) => {
												handleSelect(e, activity.item.path);
											}}
										/>
									) : (
										<Box sx={{ minWidth: '30px' }} />
									)}
								</ListItemIcon>
								<ListItemText
									primary={renderActivity(activity, {
										formatMessage,
										onPackageClick,
										onItemClick
									})}
									slotProps={{
										primary: { sx: { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } }
									}}
									secondary={renderActivityTimestamp(activity.actionTimestamp, locale)}
								/>
								{isItemActivity ? (
									<DashletItemOptions path={activity.item.path} />
								) : activity.package ? (
									<IconButton
										aria-label={formatMessage({ defaultMessage: 'Package options' })}
										onClick={(e) => {
											e.stopPropagation();
											packageContextMenu?.openContextMenu(e, activity.package);
										}}
									>
										<MoreVertRoundedIcon />
									</IconButton>
								) : null}
							</ListItemComponent>
						);
					})}
				</List>
			)}
			{total === 0 && (
				<DashletEmptyMessage>
					<FormattedMessage id="activityDashlet.noEntriesFound" defaultMessage="No activity was found." />
				</DashletEmptyMessage>
			)}
			{packageContextMenu?.contextMenuElement}
		</DashletCard>
	);
}

export default MyRecentActivityDashlet;
