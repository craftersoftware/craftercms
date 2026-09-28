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

import DialogFooter from '../DialogFooter';
import React from 'react';
import SecondaryButton from '../SecondaryButton';
import { FormattedMessage, useIntl } from 'react-intl';
import PrimaryButton from '../PrimaryButton';
import { CancelPackageDialogBaseProps, CancelPackageDialogProps } from './CancelPackageDialog';
import { DialogBody } from '../DialogBody';
import PackageDetails from '../PackageDetailsDialog/PackageDetails';
import TextFieldWithMax from '../TextFieldWithMax';
import { cancelPackages } from '../../services/workflow';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { isBlank } from '../../utils/string';
import useSpreadState from '../../hooks/useSpreadState';
import { useDispatch } from 'react-redux';
import { Divider } from '@mui/material';
import { showSystemNotification } from '../../state/actions/system';
import { pushErrorDialog } from '../../utils/system';
import { useEnhancedDialogContext } from '../EnhancedDialog';

export interface CancelPackageDialogContainerProps
	extends CancelPackageDialogBaseProps, Pick<CancelPackageDialogProps, 'onSuccess' | 'onClose' | 'isSubmitting'> {}

export function CancelPackageDialogContainer(props: CancelPackageDialogContainerProps) {
	const { packageId, onSuccess, onClose, isSubmitting } = props;
	const [state, setState] = useSpreadState({
		comment: '',
		error: null
	});
	const dispatch = useDispatch();
	const siteId = useActiveSiteId();
	const submitDisabled = isBlank(state.comment);
	const { formatMessage } = useIntl();
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();

	const handleSubmit = () => {
		updateSubmittingOrHasPendingChanges({ isSubmitting: true });
		cancelPackages(siteId, {
			packageIds: [packageId],
			comment: state.comment
		}).subscribe({
			next() {
				updateSubmittingOrHasPendingChanges({ isSubmitting: false });
				dispatch(
					showSystemNotification({ message: formatMessage({ defaultMessage: 'Package cancelled successfully.' }) })
				);
				onSuccess?.();
			},
			error({ response }) {
				updateSubmittingOrHasPendingChanges({ isSubmitting: false });
				dispatch(pushErrorDialog({ props: { error: response.response } }));
			}
		});
	};

	return (
		<>
			<DialogBody sx={{ px: 4 }}>
				<PackageDetails
					packageId={packageId}
					reviewActions={
						<>
							<Divider />
							<TextFieldWithMax
								value={state.comment}
								label={<FormattedMessage defaultMessage="Comment" />}
								fullWidth
								onChange={(e) => setState({ comment: e.target.value })}
								multiline
								required
								sx={{ mt: 2 }}
							/>
						</>
					}
				/>
			</DialogBody>
			<DialogFooter>
				<SecondaryButton disabled={isSubmitting} onClick={(e) => onClose(e, null)}>
					<FormattedMessage defaultMessage="Close" />
				</SecondaryButton>
				<PrimaryButton disabled={submitDisabled} loading={isSubmitting} onClick={() => handleSubmit()}>
					<FormattedMessage defaultMessage="Confirm" />
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

export default CancelPackageDialogContainer;
