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

import React, { useState } from 'react';
import { BulkCancelPackageDialogBaseProps, BulkCancelPackageDialogProps } from './BulkCancelPackageDialog';
import { DialogBody } from '../DialogBody';
import { DialogFooter } from '../DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import ListItemText from '@mui/material/ListItemText';
import List from '@mui/material/List';
import Paper from '@mui/material/Paper';
import { Divider } from '@mui/material';
import TextFieldWithMax from '../TextFieldWithMax';
import { FormattedMessage, useIntl } from 'react-intl';
import { isBlank } from '../../utils/string';
import { useDispatch } from 'react-redux';
import { cancelPackages } from '../../services/workflow';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { showSystemNotification } from '../../state/actions/system';
import { pushErrorDialog } from '../../utils/system';
import { useEnhancedDialogContext } from '../EnhancedDialog';
import ListItemButton from '@mui/material/ListItemButton';
import IconButton from '@mui/material/IconButton';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import Tooltip from '@mui/material/Tooltip';
import { pushDialog } from '../../state/actions/dialogStack';

export interface BulkCancelPackageDialogContainerProps
	extends
		BulkCancelPackageDialogBaseProps,
		Pick<BulkCancelPackageDialogProps, 'onSuccess' | 'onClose' | 'isSubmitting'> {}

export function BulkCancelPackageDialogContainer(props: BulkCancelPackageDialogContainerProps) {
	const { packages, onSuccess, onClose, isSubmitting } = props;
	const [comment, setComment] = useState<string>();
	const siteId = useActiveSiteId();
	const submitDisabled = isBlank(comment);
	const packageIds = packages?.map((pkg) => pkg.id);
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();

	const handleSubmit = () => {
		updateSubmittingOrHasPendingChanges({ isSubmitting: true });
		cancelPackages(siteId, {
			packageIds,
			comment
		}).subscribe({
			next() {
				updateSubmittingOrHasPendingChanges({ isSubmitting: false });
				dispatch(
					showSystemNotification({ message: formatMessage({ defaultMessage: 'Packages cancelled successfully.' }) })
				);
				onSuccess?.();
			},
			error({ response }) {
				updateSubmittingOrHasPendingChanges({ isSubmitting: false });
				dispatch(pushErrorDialog({ props: { error: response.response } }));
			}
		});
	};

	const showPackageDetails = (packageId: number) => {
		dispatch(
			pushDialog({
				component: 'craftercms.components.PackageDetailsDialog',
				props: { packageId }
			})
		);
	};

	return (
		<>
			<DialogBody>
				<Paper sx={{ background: (theme) => theme.palette.background.paper }}>
					<List sx={{ p: 0 }}>
						{packages?.map((pkg) => (
							<ListItemButton key={pkg.id} onClick={() => showPackageDetails(pkg.id)}>
								<ListItemText
									primary={`${pkg.id} - ${pkg.title}`}
									secondary={pkg.submitterComment}
									slotProps={{
										secondary: {
											noWrap: true,
											title: pkg.title
										}
									}}
								/>
								<Tooltip title={<FormattedMessage defaultMessage="View package details" />}>
									<IconButton>
										<ChevronRightRoundedIcon />
									</IconButton>
								</Tooltip>
							</ListItemButton>
						))}
					</List>
				</Paper>

				<Divider />
				<TextFieldWithMax
					value={comment}
					label={<FormattedMessage defaultMessage="Cancellation comment" />}
					fullWidth
					onChange={(e) => setComment(e.target.value)}
					multiline
					required
					sx={{ mt: 2 }}
				/>
			</DialogBody>
			<DialogFooter>
				<SecondaryButton disabled={isSubmitting} onClick={(e) => onClose(e, null)}>
					<FormattedMessage defaultMessage="No" />
				</SecondaryButton>
				<PrimaryButton disabled={submitDisabled} loading={isSubmitting} onClick={handleSubmit}>
					<FormattedMessage defaultMessage="Yes" />
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

export default BulkCancelPackageDialogContainer;
