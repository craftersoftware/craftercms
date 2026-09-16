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

import { PublishingStatus } from '../../models';
import React, { useEffect, useMemo } from 'react';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import useSpreadState from '../../hooks/useSpreadState';
import { fetchStatus } from '../../services/publishing';
import { DashletCard, DashletCardProps } from '../DashletCard';
import Skeleton from '@mui/material/Skeleton';
import { FormattedMessage, useIntl } from 'react-intl';
import Typography from '@mui/material/Typography';
import { getPublishingStatusMessage } from '../PublishingStatusDisplay';

export interface PublisherStatusDashletProps extends Omit<Partial<DashletCardProps>, 'contentHeight'> {}

interface PublisherStatusDashletState {
	publishingStatus: PublishingStatus;
	loading: boolean;
}

export function PublisherStatusDashlet(props: PublisherStatusDashletProps) {
	const { borderLeftColor = 'success.main' } = props;
	const site = useActiveSiteId();
	const [{ publishingStatus, loading }, setState] = useSpreadState<PublisherStatusDashletState>({
		publishingStatus: null,
		loading: false
	});
	const { formatMessage } = useIntl();
	const onRefresh = useMemo(
		() => () => {
			setState({ publishingStatus: null, loading: true });
			fetchStatus(site).subscribe((publishingStatus) => {
				setState({ publishingStatus, loading: false });
			});
		},
		[site, setState]
	);
	useEffect(() => {
		onRefresh();
	}, [onRefresh]);

	return (
        <DashletCard {...props} sxs={{ content: { pt: 2 }, ...props.sxs }} borderLeftColor={borderLeftColor}>
            {loading && (
				<>
					<Skeleton />
					<Skeleton />
				</>
			)}
            {publishingStatus && (
				<>
					<FormattedMessage defaultMessage="Publisher Status" />{' '}
					<Typography component="div" children={getPublishingStatusMessage(publishingStatus, formatMessage)} sx={{
                        mt: 2
                    }} />
				</>
			)}
        </DashletCard>
    );
}

export default PublisherStatusDashlet;
