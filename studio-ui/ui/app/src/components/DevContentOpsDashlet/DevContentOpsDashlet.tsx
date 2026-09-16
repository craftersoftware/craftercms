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

import DashletCard, { DashletCardProps } from '../DashletCard/DashletCard';
import palette from '../../styles/palette';
import { FormattedMessage } from 'react-intl';
import React, { useEffect, useMemo, useState } from 'react';
import useSpreadState from '../../hooks/useSpreadState';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { fetchPublishingStats } from '../../services/dashboard';
import { PublishingStats } from '../../models';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
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
import { SxProps } from '@mui/system';

export interface DevContentOpsDashletProps extends Omit<Partial<DashletCardProps>, 'contentHeight'> {}

interface DevContentOpsDashletState {
	stats: PublishingStats;
	loading: boolean;
}

function DevContentOpsStats(props: { stats: PublishingStats; sx?: { root: SxProps } }) {
	const { stats, sx } = props;
	return (
		<>
			{stats && (
				<Stack direction="row" spacing={2} sx={sx?.root}>
					<Box>
						<Typography
							component="span"
							children={stats.numberOfPublishes}
							sx={{
								lineHeight: 1,
								fontWeight: (theme) => theme.typography.fontWeightMedium
							}}
						/>{' '}
						<Typography component="span" children={<FormattedMessage defaultMessage="Publishes" />} />
					</Box>
					<Box>
						<Typography
							component="span"
							children={stats.numberOfNewAndPublishedItems}
							sx={{
								lineHeight: 1,
								fontWeight: (theme) => theme.typography.fontWeightMedium
							}}
						/>{' '}
						<Typography component="span" children={<FormattedMessage defaultMessage="Created & Published" />} />
					</Box>
					<Box>
						<Typography
							component="span"
							children={stats.numberOfEditedAndPublishedItems}
							sx={{
								lineHeight: 1,
								fontWeight: (theme) => theme.typography.fontWeightMedium
							}}
						/>{' '}
						<Typography component="span" children={<FormattedMessage defaultMessage="Edited & Published" />} />
					</Box>
				</Stack>
			)}
		</>
	);
}

export function DevContentOpsDashlet(props: DevContentOpsDashletProps) {
	const { borderLeftColor = palette.teal.main } = props;
	const site = useActiveSiteId();
	const [{ stats, loading }, setState] = useSpreadState<DevContentOpsDashletState>({
		stats: null,
		loading: false
	});
	const [days, setDays] = useState(30);
	const onRefresh = useMemo(
		() => (backgroundRefresh?: boolean) => {
			if (!backgroundRefresh) {
				setState({ stats: null, loading: true });
			}
			fetchPublishingStats(site, days).subscribe((stats) => {
				setState({ stats, loading: false });
			});
		},
		[site, setState, days]
	);
	useEffect(() => {
		onRefresh();
	}, [onRefresh]);

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
			onRefresh(true);
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [onRefresh]);
	// endregion

	return (
		<DashletCard
			{...props}
			sxs={{ content: { pt: 2, pb: (theme) => `${theme.spacing(2)} !important` }, ...props.sxs }}
			borderLeftColor={borderLeftColor}
		>
			<>
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center'
					}}
				>
					<Typography variant="h6">
						<FormattedMessage id="devContentOpsDashlet.widgetTitle" defaultMessage="DevContentOps" />
					</Typography>
					<DevContentOpsStats stats={stats} sx={{ root: { ml: 2, display: { xs: 'none', lg: 'flex' } } }} />
					<Select
						variant="standard"
						disableUnderline
						value={days}
						onChange={(e) => setDays(e.target.value as number)}
						SelectDisplayProps={{ style: { paddingLeft: '8px' } }}
					>
						<MenuItem value={3}>
							<FormattedMessage defaultMessage="{days} days" values={{ days: 3 }} />
						</MenuItem>
						<MenuItem value={7}>
							<FormattedMessage defaultMessage="{days} days" values={{ days: 7 }} />
						</MenuItem>
						<MenuItem value={30}>
							<FormattedMessage
								defaultMessage="{months} {months, plural, one {month} other {months}}"
								values={{ months: 1 }}
							/>
						</MenuItem>
						<MenuItem value={90}>
							<FormattedMessage
								defaultMessage="{months} {months, plural, one {month} other {months}}"
								values={{ months: 3 }}
							/>
						</MenuItem>
						<MenuItem value={365}>
							<FormattedMessage
								defaultMessage="{years} {years, plural, one {year} other {years}}"
								values={{ years: 1 }}
							/>
						</MenuItem>
					</Select>
				</Box>
				<DevContentOpsStats stats={stats} sx={{ root: { mt: 1, display: { lg: 'none' } } }} />
			</>
			{loading && <Skeleton />}
		</DashletCard>
	);
}

export default DevContentOpsDashlet;
