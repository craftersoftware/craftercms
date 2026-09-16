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

import { Activity } from '../../models/Activity';
import React, {
	type DetailedHTMLProps,
	type HTMLAttributes,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import { PREVIEW_URL_PATH, UNDEFINED } from '../../utils/constants';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import useEnv from '../../hooks/useEnv';
import useLocale from '../../hooks/useLocale';
import useSpreadState from '../../hooks/useSpreadState';
import { fetchActivity } from '../../services/dashboard';
import IconButton from '@mui/material/IconButton';
import { FormattedMessage, useIntl } from 'react-intl';
import MuiTimeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineConnector from '@mui/lab/TimelineConnector';
import Typography from '@mui/material/Typography';
import DropDownMenu from '../DropDownMenuButton/DropDownMenuButton';
import {
	ActivitiesAndAll,
	activityNameLookup,
	renderActivity,
	renderActivityTimestamp,
	useSelectionLookupState
} from './utils';
import Skeleton from '@mui/material/Skeleton';
import { styled } from '@mui/material/styles';
import { RangePickerModal } from './RangePickerModal';
import Tooltip from '@mui/material/Tooltip';
import DashletCard, { DashletCardProps } from '../DashletCard/DashletCard';
import { asLocalizedDateTime } from '../../utils/datetime';
import {
	DashletAvatar,
	DashletEmptyMessage,
	DashletItemOptions,
	PersonAvatar,
	PersonFullName,
	usePackageContextMenu
} from '../DashletCard/dashletCommons';
import { getSystemLink } from '../../utils/system';
import { useDispatch } from 'react-redux';
import { changeCurrentUrl } from '../../state/actions/preview';
import PackageDetailsDialog from '../PackageDetailsDialog/PackageDetailsDialog';
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
import LoadingIconButton from '../LoadingIconButton';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { AjaxError } from 'rxjs/ajax';
import Button from '@mui/material/Button';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import ReplyRounded from '@mui/icons-material/ReplyRounded';
import ClearRounded from '@mui/icons-material/ClearRounded';
import useEnhancedDialogContext from '../EnhancedDialog/useEnhancedDialogContext';
import { List, type RowComponentProps } from 'react-window';
import Box from '@mui/material/Box';
import { firstValueFrom } from 'rxjs';
import { useInfiniteLoader } from 'react-window-infinite-loader';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';

export interface ActivityDashletProps extends Partial<DashletCardProps> {}

interface ActivityDashletState {
	openRangePicker: boolean;
	openPackageDetailsDialog: boolean;
	selectedPackageId: number;
	feed: Activity[];
	usernames: string[];
	feedType: FeedTypes;
	dateFrom: string;
	dateTo: string;
	limit: number;
	offset: number;
	total: number;
	loadingFeed: boolean;
	loadingChunk: boolean;
	error: AjaxError;
}

type FeedTypes = 'timeline' | 'range';

const Timeline = styled(MuiTimeline)({ margin: 0, padding: 0 });

const CustomTimelineItem = styled(TimelineItem)({
	minHeight: 0,
	'&.MuiTimelineItem-missingOppositeContent::before': {
		display: 'none',
		content: 'none'
	}
});

const TimelineDotWithAvatar = styled(TimelineDot)({ padding: 0, border: 'none', alignSelf: 'auto' });

const TimelineDotWithoutAvatar = styled(TimelineDot)({ alignSelf: 'auto' });

const SizedTimelineSeparator = styled(TimelineSeparator)({
	width: 40,
	minWidth: 40,
	textAlign: 'center',
	alignItems: 'center',
	alignContent: 'center',
	justifyContent: 'center'
});

const emptyTimelineContentSx = { pt: 0, pb: 0 };

const getSkeletonTimelineItems = ({ items = 1 }: { items?: number }) =>
	new Array(items).fill(null).map((nothing, index) => (
		<CustomTimelineItem key={index}>
			<SizedTimelineSeparator>
				<TimelineConnector />
				<TimelineDotWithAvatar>
					<DashletAvatar />
				</TimelineDotWithAvatar>
				<TimelineConnector />
			</SizedTimelineSeparator>
			<TimelineContent sx={{ py: '12px', px: 2 }}>
				<Typography variant="h6">
					<Skeleton variant="text" />
				</Typography>
				<Typography variant="body1">
					<Skeleton variant="text" />
				</Typography>
				<Typography variant="body1">
					<Skeleton variant="text" />
				</Typography>
			</TimelineContent>
		</CustomTimelineItem>
	));

export function ActivityDashlet(props: ActivityDashletProps) {
	const { borderLeftColor = 'success.main' } = props;
	const locale = useLocale();
	const site = useActiveSiteId();
	const { authoringBase } = useEnv();
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const widgetDialogContext = useEnhancedDialogContext();
	// region const { ... } = state
	const [
		{
			feed,
			feedType,
			usernames,
			dateFrom,
			dateTo,
			limit,
			offset,
			total,
			openRangePicker,
			loadingFeed,
			loadingChunk,
			selectedPackageId,
			openPackageDetailsDialog,
			error
		},
		// endregion
		setState
	] = useSpreadState<ActivityDashletState>({
		loadingChunk: false,
		loadingFeed: false,
		openRangePicker: false,
		openPackageDetailsDialog: false,
		selectedPackageId: null,
		feed: null,
		usernames: null,
		feedType: 'timeline',
		dateFrom: null,
		dateTo: null,
		limit: 50,
		offset: 0,
		total: null,
		error: null
	});
	const [selectedActivities, setSelectedActivities, activities] = useSelectionLookupState<ActivitiesAndAll>({
		ALL: true
	});
	// region activityFilterOptions = ...
	const activityFilterOptions = useMemo(
		() =>
			Object.keys(activityNameLookup).map((key) => ({
				id: key,
				primaryText: activityNameLookup[key],
				selected: selectedActivities[key]
			})),
		[selectedActivities]
	);
	// endregion
	// region feedTypeOptions
	const feedTypeOptions = useMemo(
		() => [
			{
				id: 'timeline',
				primaryText: <FormattedMessage id="words.timeline" defaultMessage="Timeline" />,
				selected: feedType === 'timeline',
				secondaryText: (
					<FormattedMessage id="activityDashlet.timelineOptionTip" defaultMessage="All activity, most recent first" />
				)
			},
			{
				id: 'range',
				primaryText: <FormattedMessage id="words.range" defaultMessage="Range" />,
				selected: feedType === 'range',
				secondaryText: (
					<FormattedMessage id="activityDashlet.rangeOptionTip" defaultMessage="Specify a range of dates" />
				)
			}
		],
		[feedType]
	);
	// endregion
	// region onRefresh
	const fetchFeed = useCallback(() => {
		setState({ feed: null, total: null, offset: 0, loadingFeed: true, error: null });
		return fetchActivity(site, {
			actions: activities.filter((key) => key !== 'ALL'),
			usernames,
			dateTo,
			dateFrom,
			limit
		}).subscribe({
			next: (feed) => {
				setState({
					feed,
					total: feed.total,
					loadingFeed: false,
					loadingChunk: false,
					error: null
				});
			},
			error(error) {
				setState({ loadingFeed: false, loadingChunk: false, error: error });
			}
		});
	}, [activities, dateFrom, dateTo, limit, setState, site, usernames]);
	// endregion
	const listRef = useRef(undefined);
	const loadNextPage = () => {
		if (loadingChunk || loadingFeed) return;
		const newOffset = offset + limit;
		setState({ loadingChunk: true });

		return firstValueFrom(
			fetchActivity(site, {
				actions: activities.filter((key) => key !== 'ALL'),
				usernames,
				dateTo,
				dateFrom,
				limit,
				offset: newOffset
			})
		)
			.then((nextFeedChunk) => {
				setState({
					feed: feed.concat(nextFeedChunk),
					total: nextFeedChunk.total,
					offset: newOffset,
					loadingChunk: false
				});
			})
			.catch((error) => {
				setState({ loadingFeed: false, loadingChunk: false, error: error });
			});
	};
	const onRefresh = useCallback(() => {
		setState({
			loadingChunk: true
		});
		fetchActivity(site, {
			actions: activities.filter((key) => key !== 'ALL'),
			usernames,
			dateTo,
			dateFrom,
			offset: 0,
			limit: offset + limit
		}).subscribe({
			next: (feed) => {
				setState({ feed, total: feed.total, loadingChunk: false });
			},
			error(error) {
				setState({ loadingFeed: false, loadingChunk: false, error: error });
			}
		});
	}, [activities, dateFrom, dateTo, limit, offset, setState, site, usernames]);
	const onItemClick = (previewUrl, e) => {
		const pathname = window.location.pathname;
		if (pathname.includes(PREVIEW_URL_PATH)) {
			dispatch(changeCurrentUrl(previewUrl));
			widgetDialogContext?.onClose(e, null);
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
		setState({ openPackageDetailsDialog: true, selectedPackageId: pkg.id });
	};
	const [hoveredActivity, setHoveredActivity] = useState<Activity | null>(null);
	const packageContextMenu = usePackageContextMenu();

	const currentPage = offset / limit;
	const totalPages = total ? Math.ceil(total / limit) : 0;
	const hasNextPage = currentPage + 1 < totalPages;
	// If there are more items to be loaded then add an extra row to hold a loading indicator.
	const currentItemsCount = feed ? (hasNextPage ? feed.length + 1 : feed.length) : 0;
	// Every row is loaded except for our loading indicator row.
	const isItemLoaded = (index) => !hasNextPage || index < feed?.length;

	const onActivityMouseOver = (activity: Activity) => {
		setHoveredActivity(activity);
		packageContextMenu.setContextMenu({ package: activity.package });
	};

	const onActivityMouseLeave = () => {
		setHoveredActivity(null);
	};

	const hasMoreItemsToLoad = total > 0 && limit + offset < total;
	const isFetching = loadingChunk || loadingFeed;
	useEffect(() => {
		fetchFeed();
	}, [fetchFeed, setState]);

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
			onRefresh();
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [onRefresh]);
	// endregion

	// region author filter
	const [authorFilterOpen, setAuthorFilterOpen] = useState(false);
	const [authorFilterValue, setAuthorFilterValue] = useState('');
	const authorFilterButtonRef = useRef<HTMLButtonElement>(undefined);
	const authorFilterInputRef = useRef<HTMLInputElement>(undefined);

	const onAuthorFilterChange = (users) => {
		if (users.length === 0 && (usernames === null || usernames.length === 0)) return;
		setState({ usernames: users.map(({ username }) => username) });
	};

	const submitAuthorFilterChanges = () => {
		const usernames = authorFilterValue
			.split(',')
			.filter(Boolean)
			.map((username) => ({ username: username.trim() }));
		onAuthorFilterChange(usernames);
	};

	const clearAuthorFilterValue = () => {
		setAuthorFilterOpen(false);
		setAuthorFilterValue('');
		onAuthorFilterChange([]);
	};

	const handleAuthorFilterInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setAuthorFilterValue(e.target.value);
	};

	const handleAuthorFilterKeyUp = (e) => {
		if (e.key === 'Enter') {
			submitAuthorFilterChanges();
		}
	};

	useEffect(() => {
		if (authorFilterOpen && !isFetching && authorFilterInputRef.current) {
			setTimeout(() => {
				authorFilterInputRef.current.focus();
			});
		}
	}, [authorFilterOpen, isFetching]);

	const onRowsRendered = useInfiniteLoader({
		isRowLoaded: isItemLoaded,
		rowCount: currentItemsCount,
		loadMoreRows: loadNextPage
	});

	// endregion
	return (
		<DashletCard
			{...props}
			borderLeftColor={borderLeftColor}
			title={<FormattedMessage id="words.activity" defaultMessage="Activity" />}
			headerAction={
				<LoadingIconButton
					onClick={() => onRefresh()}
					loading={isFetching}
					aria-label={formatMessage({ defaultMessage: 'Refresh' })}
				>
					<RefreshRounded />
				</LoadingIconButton>
			}
			actionsBar={
				<>
					<DropDownMenu
						size="small"
						variant="text"
						onMenuItemClick={(e, id: ActivitiesAndAll) => setSelectedActivities(id)}
						options={activityFilterOptions}
						closeOnSelection={false}
						menuProps={{ sx: { minWidth: 180 } }}
					>
						{selectedActivities.ALL ? (
							<FormattedMessage id="activityDashlet.showActivityByEveryone" defaultMessage="All activities" />
						) : (
							<FormattedMessage
								id="activityDashlet.showSelectedActivities"
								defaultMessage="Selected activities ({count})"
								values={{ count: activities.length }}
							/>
						)}
					</DropDownMenu>
					<Button
						ref={authorFilterButtonRef}
						variant="text"
						size="small"
						endIcon={<KeyboardArrowDownRounded />}
						onClick={(e) => {
							setAuthorFilterOpen(true);
						}}
					>
						<FormattedMessage id="words.author" defaultMessage="Author" />
					</Button>
					<Popover
						open={authorFilterOpen}
						anchorEl={authorFilterButtonRef.current}
						onClose={() => setAuthorFilterOpen(false)}
						slotProps={{ paper: { sx: { width: 350, p: 1 } } }}
						anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
					>
						<TextField
							fullWidth
							autoFocus
							value={authorFilterValue}
							disabled={isFetching}
							onChange={handleAuthorFilterInputChange}
							placeholder={formatMessage(
								{ defaultMessage: 'e.g. "{examples}"' },
								{
									examples: 'jon.doe, jdoe, jane@example.com'
								}
							)}
							onKeyUp={handleAuthorFilterKeyUp}
							slotProps={{
								input: {
									inputRef: authorFilterInputRef,
									endAdornment: (
										<InputAdornment position="end">
											<IconButton
												disabled={isFetching}
												title={formatMessage({ defaultMessage: 'Submit' })}
												edge="end"
												onClick={submitAuthorFilterChanges}
												size="small"
												aria-label={formatMessage({ defaultMessage: 'Submit' })}
											>
												<ReplyRounded sx={{ transform: 'scaleX(-1)' }} />
											</IconButton>
											<IconButton
												disabled={isFetching}
												title={formatMessage({ defaultMessage: 'Clear & close' })}
												edge="end"
												onClick={clearAuthorFilterValue}
												size="small"
												aria-label={formatMessage({ defaultMessage: 'Clear & close' })}
											>
												<ClearRounded />
											</IconButton>
										</InputAdornment>
									)
								}
							}}
						/>
					</Popover>
					<DropDownMenu
						size="small"
						variant="text"
						onMenuItemClick={(e, feedType: FeedTypes) => {
							const state = { feedType, dateTo, dateFrom, openRangePicker: feedType === 'range' };
							if (feedType === 'timeline') {
								state.dateTo = null;
								state.dateFrom = null;
							}
							setState(state);
						}}
						options={feedTypeOptions}
						menuProps={{ sx: { minWidth: 200 } }}
						onClick={() => {
							if (feedType === 'range') {
								setState({ openRangePicker: true });
							}
						}}
					>
						<FormattedMessage id="words.timeline" defaultMessage="Timeline" />
					</DropDownMenu>
				</>
			}
			cardContentProps={{ ref: listRef }}
		>
			{error && (
				<ApiResponseErrorState
					error={error.response?.response}
					validationErrors={error.response?.validationErrors?.map((error) => {
						// `error.field` looks like getActivitiesForUsers.usernames[1].<list element>
						const match = error.field.match(/usernames\[(\d)]/);
						if (match) {
							error.message = formatMessage(
								{ defaultMessage: '"{value}" is not a valid username.' },
								{ value: usernames[match[1]] }
							);
						}
						return error;
					})}
				/>
			)}
			{loadingFeed && (
				<Timeline position="right">
					<CustomTimelineItem>
						<SizedTimelineSeparator>
							<TimelineDotWithoutAvatar />
						</SizedTimelineSeparator>
						<TimelineContent sx={emptyTimelineContentSx} />
					</CustomTimelineItem>
					{getSkeletonTimelineItems({ items: 3 })}
					<CustomTimelineItem>
						<SizedTimelineSeparator>
							{hasMoreItemsToLoad ? (
								<TimelineDotWithAvatar sx={{ bgcolor: 'unset' }}>
									<Tooltip
										title={
											<FormattedMessage
												id="activityDashlet.loadMore"
												defaultMessage="Load {limit} more"
												values={{ limit }}
											/>
										}
									>
										<IconButton
											color="primary"
											size="small"
											onClick={loadNextPage}
											aria-label={formatMessage(
												{ id: 'activityDashlet.loadMore', defaultMessage: 'Load {limit} more' },
												{ limit }
											)}
										>
											<MoreVertRounded />
										</IconButton>
									</Tooltip>
								</TimelineDotWithAvatar>
							) : (
								<TimelineDotWithoutAvatar />
							)}
						</SizedTimelineSeparator>
						<TimelineContent sx={emptyTimelineContentSx} />
					</CustomTimelineItem>
				</Timeline>
			)}
			{Boolean(feed?.length) && (
				<Timeline position="right" sx={{ flex: 1 }}>
					<CustomTimelineItem>
						<SizedTimelineSeparator>
							<TimelineDotWithoutAvatar />
						</SizedTimelineSeparator>
						<TimelineContent sx={emptyTimelineContentSx} />
					</CustomTimelineItem>
					<Box sx={{ flex: 1 }}>
						<List
							className="List"
							rowCount={currentItemsCount}
							rowHeight={104}
							onRowsRendered={onRowsRendered}
							rowProps={{}}
							rowComponent={({ index, style }: RowComponentProps) => {
								let content;
								if (!isItemLoaded(index)) {
									content = <FormattedMessage defaultMessage="Loading..." />;
								} else {
									const activity = feed[index];
									content = (
										<CustomTimelineItem key={activity.id}>
											<SizedTimelineSeparator>
												<TimelineConnector />
												<TimelineDotWithAvatar>
													<PersonAvatar person={activity.person} />
												</TimelineDotWithAvatar>
												<TimelineConnector />
											</SizedTimelineSeparator>
											<TimelineContent
												sx={{ py: '12px', px: 2, width: 'calc(100% - 40px)' }} // Considering size of the Timeline Separator
												onMouseEnter={() => onActivityMouseOver(activity)}
												onMouseLeave={() => onActivityMouseLeave()}
											>
												<Box
													sx={{
														display: 'flex',
														flexDirection: 'row',
														gap: 1,
														justifyContent: 'space-between',
														alignContent: 'center'
													}}
												>
													<Box sx={{ flex: 1, minWidth: 0 }}>
														<PersonFullName person={activity.person} />
														<Typography sx={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
															{renderActivity(activity, { formatMessage, onPackageClick, onItemClick })}
														</Typography>
														<Typography
															variant="caption"
															title={asLocalizedDateTime(
																activity.actionTimestamp,
																locale.localeCode,
																locale.dateTimeFormatOptions
															)}
														>
															{renderActivityTimestamp(activity.actionTimestamp, locale)}
														</Typography>
													</Box>
													<Box
														sx={{
															alignSelf: 'center',
															visibility: hoveredActivity?.id === activity.id ? 'visible' : 'hidden'
														}}
													>
														{activity.package ? (
															<IconButton
																aria-label={formatMessage({ defaultMessage: 'Package options' })}
																onClick={(e) => {
																	e.stopPropagation();
																	packageContextMenu?.openContextMenu(e, activity.package);
																}}
															>
																<MoreVertRoundedIcon />
															</IconButton>
														) : (
															activity.actionType !== 'DELETE' &&
															activity.item && <DashletItemOptions path={activity.item.path} />
														)}
													</Box>
												</Box>
											</TimelineContent>
										</CustomTimelineItem>
									);
								}
								return <div style={style}>{content}</div>;
							}}
						/>
					</Box>
					{!hasMoreItemsToLoad && (
						<CustomTimelineItem>
							<SizedTimelineSeparator>
								<TimelineDotWithoutAvatar />
							</SizedTimelineSeparator>
						</CustomTimelineItem>
					)}
				</Timeline>
			)}
			{total === 0 && (
				<DashletEmptyMessage>
					<FormattedMessage id="activityDashlet.noEntriesFound" defaultMessage="No activity was found." />
				</DashletEmptyMessage>
			)}
			<RangePickerModal
				open={openRangePicker}
				onClose={() => setState({ openRangePicker: false })}
				onAccept={(dateFrom, dateTo) =>
					setState({ dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString(), openRangePicker: false })
				}
				onSwitchToTimelineClick={
					feedType === 'range'
						? () => {
								setState({ feedType: 'timeline', dateTo: null, dateFrom: null, openRangePicker: false });
							}
						: UNDEFINED
				}
			/>
			<PackageDetailsDialog
				open={openPackageDetailsDialog}
				onClose={() => setState({ openPackageDetailsDialog: false })}
				onClosed={() => setState({ selectedPackageId: null })}
				packageId={selectedPackageId}
			/>
			{packageContextMenu?.contextMenuElement}
		</DashletCard>
	);
}

export default ActivityDashlet;
