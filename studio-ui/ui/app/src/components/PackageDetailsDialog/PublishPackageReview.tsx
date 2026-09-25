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

import { PublishPackage, ContentItem } from '../../models';
import { Typography } from '@mui/material';
import { FormattedMessage } from 'react-intl';
import Box from '@mui/material/Box';
import { PersonAvatar } from '../DashletCard/dashletCommons';
import { getPersonFullName } from '../../utils/object';
import ItemPublishingTargetIcon from '../ItemPublishingTargetIcon';
import React from 'react';
import Alert from '@mui/material/Alert';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import { asLocalizedDateTime } from '../../utils/datetime';
import useLocale from '../../hooks/useLocale';
import { PACKAGE_APPROVED, PACKAGE_REJECTED } from '../../utils/constants';

export interface PublishPackageReviewProps {
	publishPackage: PublishPackage;
}

const statusItems = {
	staging: { stateMap: { staged: true } },
	live: { stateMap: { live: true } }
};

export function PublishPackageReview(props: PublishPackageReviewProps) {
	const { publishPackage } = props;
	const locale = useLocale();

	/* Displaying:
		- If the package has been reviewed, show the submission date.
		- If not reviewed but scheduled, show the scheduled date.
		- If neither, show the published date or the submission date as a fallback.
	*/
	const submissionDate = publishPackage.reviewer
		? publishPackage.submittedOn
		: (publishPackage.schedule ?? publishPackage.publishedOn ?? publishPackage.submittedOn);

	return (
		<Box>
			{publishPackage.approvalState === PACKAGE_REJECTED && (
				<Alert severity="error" sx={{ mb: 2 }} icon={<BlockOutlinedIcon />}>
					<FormattedMessage defaultMessage="This package has been rejected." />
				</Alert>
			)}

			{/* region Submission details */}
			<Box sx={{ display: 'block' }}>
				<Typography variant="subtitle1" gutterBottom sx={{ mb: 1, fontWeight: 'bold' }}>
					<FormattedMessage defaultMessage="Submission details" />
				</Typography>
				<Paper sx={{ p: 1.5 }}>
					<Grid container spacing={2}>
						<Grid size={6}>
							<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
								<FormattedMessage defaultMessage="Package title" />
							</Typography>
							<Typography>{publishPackage.title}</Typography>
						</Grid>
						<Grid size={6}>
							<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
								<FormattedMessage defaultMessage="Submitter" />
							</Typography>
							<Stack
								direction="row"
								spacing={1}
								sx={{
									alignItems: 'center'
								}}
							>
								<PersonAvatar person={publishPackage.submitter} />
								<Typography variant="body1" sx={{ ml: 1 }}>
									{getPersonFullName(publishPackage.submitter)}
								</Typography>
							</Stack>
						</Grid>
						<Grid size={6}>
							<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
								<FormattedMessage defaultMessage="Publishing Target" />
							</Typography>
							<Stack
								direction="row"
								spacing={1}
								sx={{
									alignItems: 'center'
								}}
							>
								<ItemPublishingTargetIcon item={statusItems[publishPackage.target] as ContentItem} />
								{publishPackage.target === 'live' ? (
									<FormattedMessage defaultMessage="Live" />
								) : (
									<FormattedMessage defaultMessage="Staging" />
								)}
							</Stack>
						</Grid>
						<Grid size={6}>
							<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
								{publishPackage.reviewer ? (
									<FormattedMessage defaultMessage="Submitted On" />
								) : (
									<FormattedMessage defaultMessage="Scheduled For" />
								)}
							</Typography>
							<Typography>
								{asLocalizedDateTime(submissionDate, locale.localeCode, locale.dateTimeFormatOptions)}
							</Typography>
						</Grid>
						<Grid size={12}>
							<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
								<FormattedMessage defaultMessage="Comment" />
							</Typography>
							{publishPackage.submitterComment || <FormattedMessage defaultMessage="No submission comment provided" />}
						</Grid>
					</Grid>
				</Paper>
			</Box>
			{/* endregion */}

			{/* region Review details */}
			{Boolean(publishPackage.reviewer) && (
				<Box sx={{ mt: 2 }}>
					<Typography
						variant="subtitle1"
						sx={{
							fontWeight: 'bold',
							mb: 1
						}}
					>
						<FormattedMessage defaultMessage="Review details" />
					</Typography>
					<Paper sx={{ p: 1.5 }}>
						<Grid container spacing={2}>
							<Grid size={6}>
								<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
									<FormattedMessage defaultMessage="Status" />
								</Typography>
								<Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
									{publishPackage.approvalState === PACKAGE_APPROVED ? (
										<>
											<VerifiedUserOutlinedIcon color="success" fontSize="small" sx={{ mr: 1 }} />
											<FormattedMessage defaultMessage="Approved" />
										</>
									) : (
										<>
											<BlockOutlinedIcon color="error" fontSize="small" sx={{ mr: 1 }} />
											<FormattedMessage defaultMessage="Rejected" />
										</>
									)}
								</Box>
							</Grid>
							<Grid size={6}>
								<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
									<FormattedMessage defaultMessage="Reviewer" />
								</Typography>
								<Box sx={{ mb: 2 }}>
									<Typography variant="body1">{getPersonFullName(publishPackage.reviewer)}</Typography>
								</Box>
							</Grid>
							<Grid size={12}>
								{publishPackage.approvalState === PACKAGE_APPROVED ? (
									<>
										<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
											<FormattedMessage defaultMessage="Comment" />
										</Typography>
										<Typography variant="body1" sx={{ mb: 2 }}>
											{publishPackage.reviewerComment || (
												<FormattedMessage defaultMessage="No approval comment provided" />
											)}
										</Typography>
									</>
								) : (
									<>
										<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
											<FormattedMessage defaultMessage="Reason" />
										</Typography>
										<Typography variant="body1" sx={{ mb: 2 }}>
											{publishPackage.reviewerComment || <FormattedMessage defaultMessage="No reason provided" />}
										</Typography>
									</>
								)}
							</Grid>
						</Grid>
					</Paper>
				</Box>
			)}
			{/* endregion */}
		</Box>
	);
}
