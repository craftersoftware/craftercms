/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import { FormattedMessage } from 'react-intl';
import React, { useEffect } from 'react';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import useSpreadState from '../../hooks/useSpreadState';
import { fetchPackage } from '../../services/publishing';
import { LoadingState } from '../LoadingState';
import ApiResponseErrorState from '../ApiResponseErrorState';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import { PublishPackageReview } from './PublishPackageReview';
import PackageItems from '../PackageItems/PackageItems';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { PACKAGE_TYPE_INITIAL_PUBLISH } from '../../utils/constants';

export interface PackageDetailsProps {
	packageId: number;
	reviewActions?: React.ReactNode;
}

export function PackageDetails(props: PackageDetailsProps) {
	const { packageId } = props;
	const site = useActiveSiteId();
	const [state, setState] = useSpreadState({
		publishPackage: null,
		isInitialPublish: false,
		loading: false,
		error: null,
		total: null
	});
	useEffect(() => {
		if (packageId) {
			setState({ loading: true, error: null });
			fetchPackage(site, packageId).subscribe({
				next(publishPackage) {
					setState({
						publishPackage,
						isInitialPublish: publishPackage.packageType === PACKAGE_TYPE_INITIAL_PUBLISH,
						loading: false,
						total: publishPackage.itemCount
					});
				},
				error({ response }) {
					setState({ error: response.response, loading: false });
				}
			});
		}
	}, [packageId, site, setState]);

	return (
        <>
            {state.loading && <LoadingState sxs={{ root: { width: 100, minHeight: 420 } }} />}
            {state.error && <ApiResponseErrorState error={state.error} />}
            {!Boolean(packageId) && !state.publishPackage && (
				<Typography sx={{
                    color: "error.main"
                }}>
					<FormattedMessage
						id="packageDetailsDialog.missingPackageId"
						defaultMessage="Unable to fetch package details as package id was not provided to this UI"
					/>
				</Typography>
			)}
            {!state.loading && state.publishPackage && (
				<Grid container spacing={2}>
					<Grid size={{ xs: 12, sm: 5 }}>
						<PublishPackageReview publishPackage={state.publishPackage} />
						{props.reviewActions}
					</Grid>
					<Grid size={{ xs: 12, sm: 7 }}>
						{state.isInitialPublish ? (
							<Box sx={{ height: '40vh' }}>
								<Alert severity="info">
									<FormattedMessage defaultMessage="The entire project was published since this is the first publish request" />
								</Alert>
							</Box>
						) : (
							<PackageItems packageId={packageId} />
						)}
					</Grid>
				</Grid>
			)}
        </>
    );
}

export default PackageDetails;
