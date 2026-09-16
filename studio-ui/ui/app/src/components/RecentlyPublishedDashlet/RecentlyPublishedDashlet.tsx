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

import { CommonDashletProps, getCurrentPage } from '../SiteDashboard/utils';
import DashletCard from '../DashletCard/DashletCard';
import palette from '../../styles/palette';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import {
	DashletEmptyMessage,
	getItemSkeleton,
	List,
	Pager,
	PersonAvatar,
	usePackageContextMenu
} from '../DashletCard/dashletCommons';
import ListItemText from '@mui/material/ListItemText';
import { LIVE_COLOUR, STAGING_COLOUR } from '../ItemPublishingTargetIcon/styles';
import useSpreadState from '../../hooks/useSpreadState';
import useLocale from '../../hooks/useLocale';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { PagedArray } from '../../models';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import { PackageDetailsDialog } from '../PackageDetailsDialog';
import { publishEvent } from '../../state/actions/system';
import { getHostToHostBus } from '../../utils/subjects';
import { filter } from 'rxjs/operators';
import LoadingIconButton from '../LoadingIconButton';
import { fetchPackages, FetchPackagesResponse } from '../../services/publishing';
import Box from '@mui/material/Box';
import { asLocalizedDateTime } from '../../utils/datetime';
import { nnou, reversePluckProps } from '../../utils/object';
import IconButton from '@mui/material/IconButton';
import { COMPLETED_MASK, PACKAGE_TYPE_INITIAL_PUBLISH } from '../../utils/constants';
import ListItemButton from '@mui/material/ListItemButton';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';

interface RecentlyPublishedDashletProps extends CommonDashletProps {}

interface RecentlyPublishedDashletState {
	publishingPackages: PagedArray<FetchPackagesResponse>;
	loading: boolean;
	loadingSkeleton: boolean;
	total: number;
	limit: number;
	offset: number;
	packageDetailsDialogId: number;
}

const messages = defineMessages({
	staging: { id: 'words.staging', defaultMessage: 'Staging' },
	live: { id: 'words.live', defaultMessage: 'Live' }
});

export function RecentlyPublishedDashlet(props: RecentlyPublishedDashletProps) {
	const { borderLeftColor = palette.blue.tint } = props;
	const [{ publishingPackages, total, loading, loadingSkeleton, limit, offset, packageDetailsDialogId }, setState] =
		useSpreadState<RecentlyPublishedDashletState>({
			publishingPackages: null,
			total: null,
			loading: false,
			loadingSkeleton: true,
			limit: 50,
			offset: 0,
			packageDetailsDialogId: null
		});
	const currentPage = offset / limit;
	const totalPages = total ? Math.ceil(total / limit) : 0;
	const locale = useLocale();
	const site = useActiveSiteId();
	const { formatMessage } = useIntl();
	const [hoveredPackage, setHoveredPackage] = useState<number>(null);
	const contextMenu = usePackageContextMenu();

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
				states: COMPLETED_MASK,
				sort: 'publishedOn DESC'
			}).subscribe((packages) => {
				setState({
					publishingPackages: packages,
					total: packages.total,
					offset: newOffset,
					loading: false
				});
			});
		},
		[limit, setState, site]
	);

	const onRefresh = () => {
		loadPage(getCurrentPage(offset, limit), true);
	};

	const onPackageClick = (packageId: number) => {
		setState({
			packageDetailsDialogId: packageId
		});
	};

	const onPackageMouseOver = (packageId: number) => {
		setHoveredPackage(packageId);
	};

	const onPackageMouseLeave = () => {
		setHoveredPackage(null);
	};

	useEffect(() => {
		loadPage(0);
	}, [loadPage]);

	// region Item Updates Propagation
	useEffect(() => {
		const events: string[] = [publishEvent.type];
		const hostToHost$ = getHostToHostBus();
		const subscription = hostToHost$.pipe(filter((e) => events.includes(e.type))).subscribe(({ type, payload }) => {
			loadPage(getCurrentPage(offset, limit), true);
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [limit, offset, loadPage]);
	// endregion

	return (
		<DashletCard
			{...props}
			borderLeftColor={borderLeftColor}
			title={<FormattedMessage id="recentlyPublishedDashlet.widgetTitle" defaultMessage="Recently Published" />}
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
			sxs={{
				content: { p: 0 },
				footer: {
					justifyContent: 'space-between'
				}
			}}
		>
			{/*
      TODO: Stats bar not possible to implement under current API
      <Stack direction="row" spacing={2}>
        <Box>
          <Typography variant="h2" component="p" children="2" lineHeight={1} />
          <Typography component="span" children="Pending" />
        </Box>
        <Box>
          <div>
            <Typography variant="h2" component="span" children="14" lineHeight={1} />
            <Typography component="span" children="days" />
          </div>
          <Typography component="span" children="Oldest request" />
        </Box>
      </Stack>
      */}
			{loading && loadingSkeleton && getItemSkeleton({ numOfItems: 3, showAvatar: true })}
			{Boolean(publishingPackages?.length) && (
				<List sx={{ pb: 0 }}>
					{publishingPackages.map((pkg, index) => (
						<ListItemButton
							key={index}
							sx={{ pt: 0, pb: 0 }}
							onMouseEnter={() => onPackageMouseOver(pkg.id)}
							onMouseLeave={onPackageMouseLeave}
							onClick={() => onPackageClick(pkg.id)}
						>
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
										defaultMessage="<bold>{title}</bold> ({initialPublish, select, 1 {Initial publish} other {{total} {total, plural, one {item} other {items}}}})"
										values={{
											title: pkg.title,
											total: pkg.itemCount,
											initialPublish: pkg.packageType === PACKAGE_TYPE_INITIAL_PUBLISH ? 1 : 0,
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
											submittedDate: asLocalizedDateTime(
												pkg.submittedOn,
												locale.localeCode,
												locale.dateTimeFormatOptions
											)
										}}
									/>
								}
							/>
							<IconButton
								onClick={(e) => {
									e.stopPropagation();
									contextMenu?.openContextMenu(e, pkg);
								}}
								sx={{ visibility: hoveredPackage === pkg.id ? 'visible' : 'hidden' }}
							>
								<MoreVertRoundedIcon />
							</IconButton>
						</ListItemButton>
					))}
				</List>
			)}
			{total === 0 && (
				<DashletEmptyMessage>
					<FormattedMessage
						id="recentlyPublishedDashlet.noRecentlyPublishedItems"
						defaultMessage="There are no items have been published recently"
					/>
				</DashletEmptyMessage>
			)}
			<PackageDetailsDialog
				open={nnou(packageDetailsDialogId)}
				onClose={() => setState({ packageDetailsDialogId: null })}
				packageId={packageDetailsDialogId}
			/>
			{contextMenu?.contextMenuElement}
		</DashletCard>
	);
}

export default RecentlyPublishedDashlet;
