/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

import React, { SyntheticEvent, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { useSpreadState } from '../../hooks/useSpreadState';
import { InternalDialogState } from '../PublishDialog';
import { PublishDialogForm } from '../PublishDialog/PublishDialogForm';
import PackageItems from '../PackageItems/PackageItems';
import { PublishingTarget } from '../../models';
import { isBlank } from '../../utils/string';
import { createAtLeastHalfHourInFutureDate } from '../../utils/datetime';
import { PACKAGE_APPROVED, PACKAGE_TYPE_INITIAL_PUBLISH } from '../../utils/constants';
import { DateTimeTimezonePickerProps } from '../DateTimeTimezonePicker';
import { useEnhancedDialogContext } from '../EnhancedDialog';
import DialogBody from '../DialogBody';
import DialogFooter from '../DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { EditPublishPackageDialogContainerProps } from './types';
import { hasApproveAction } from '../../utils/content';
import { updatePackage } from '../../services/publishing';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import useActiveUser from '../../hooks/useActiveUser';
import { useDispatch } from 'react-redux';
import { pushErrorDialog } from '../../utils/system';

/**
 * Edit form for an existing publishing package, based on `PublishDialogContainer`.
 * Only `packageTitle`, `submissionComment`, `requestApproval` (for users with publish
 * permission) and `scheduling`/`scheduledDateTime` are
 * editable: the publishing target is rendered disabled (via `disablePublishingTarget`)
 * and the package items are display-only, rendered with `PackageItems` (which fetches
 * them by package id) exactly as `PackageDetails` does.
 */
export function EditPublishPackageDialogContainer(props: EditPublishPackageDialogContainerProps) {
	const { pkg, isSubmitting, onSuccess, onClose } = props;
	const siteId = useActiveSiteId();
	const { permissionsBySite } = useActiveUser();
	const dispatch = useDispatch();
	const hasPublishPermission = permissionsBySite[siteId].includes('publish_review');
	// Gate on APPROVE only (not REJECT): with peer review on, the backend strips APPROVE from the
	// submitter (who is the only one with UPDATE) but leaves REJECT. Without APPROVE the package
	// can't be kept (self-)approved, so the update must (re)request approval.
	const canApprovePackage = hasApproveAction(pkg.availableActions);
	const [state, setState] = useSpreadState<InternalDialogState>({
		packageTitle: pkg.title ?? '',
		// Approved packages default to requesting approval again; the user can uncheck it only when they
		// can approve (no peer review). With peer review, `!canApprovePackage` forces it, since the backend
		// rejects `requestApproval: false` from the submitter of an approved package.
		requestApproval: !hasPublishPermission || !canApprovePackage || pkg.approvalState === PACKAGE_APPROVED,
		publishingTarget: pkg.target ?? '',
		submissionComment: pkg.submitterComment ?? '',
		scheduling: pkg.schedule ? 'custom' : 'now',
		scheduledDateTime: pkg.schedule ? new Date(pkg.schedule) : createAtLeastHalfHourInFutureDate(),
		error: null,
		fetchingItems: false
	});
	// Only used to know whether the (disabled) publishing targets have loaded, mirroring PublishDialog.
	const [publishingTargets, setPublishingTargets] = useState<PublishingTarget[]>(null);
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();
	const isInitialPublish = pkg.packageType === PACKAGE_TYPE_INITIAL_PUBLISH;
	const isRequestPublish = !hasPublishPermission || !canApprovePackage || state.requestApproval;
	const showRequestApproval = hasPublishPermission && canApprovePackage;

	// Submit button should be disabled when:
	const submitDisabled =
		// While submitting
		isSubmitting ||
		// If package title is blank
		isBlank(state.packageTitle) ||
		// If package comment is blank
		isBlank(state.submissionComment) ||
		// When there are no available/loaded publishing targets
		!publishingTargets?.length ||
		// When no publishing target is selected (taken from the package being edited)
		!state.publishingTarget ||
		// When there's an error
		Boolean(state.error) ||
		// The scheduled date is in the past
		(state.scheduling === 'custom' && state.scheduledDateTime < new Date());

	const onPublishingArgumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let value: unknown;
		updateSubmittingOrHasPendingChanges({ hasPendingChanges: true });
		switch (e.target.type) {
			case 'checkbox':
				value = e.target.checked;
				break;
			case 'text':
			case 'textarea':
			case 'radio':
			case 'dateTimePicker':
				value = e.target.value;
				break;
			default:
				console.error('Publishing argument change event ignored.');
				return;
		}
		// The publishing target can't be edited, so ignore any change coming from it.
		if (e.target.name === 'publishingTarget') {
			return;
		}
		setState({ [e.target.name]: value });
	};

	const handleDateTimePickerChange: DateTimeTimezonePickerProps['onChange'] = (date) => {
		onPublishingArgumentChange({
			target: {
				name: 'scheduledDateTime',
				type: 'dateTimePicker',
				// @ts-expect-error: We're formating this as a change event so ignoring "Type 'Date' is not assignable to type 'string'".
				value: date
			}
		});
	};

	const handleSubmit = (e?: SyntheticEvent) => {
		e?.preventDefault();
		if (submitDisabled) return;
		updateSubmittingOrHasPendingChanges({ hasPendingChanges: false, isSubmitting: true });

		updatePackage(siteId, pkg.id, {
			title: state.packageTitle,
			comment: state.submissionComment,
			schedule: state.scheduling === 'custom' ? state.scheduledDateTime.toISOString() : null,
			updateSchedule: true,
			requestApproval: isRequestPublish
		}).subscribe({
			next: () => {
				updateSubmittingOrHasPendingChanges({ isSubmitting: false });
				onSuccess?.({
					packageId: pkg.id,
					title: state.packageTitle,
					comment: state.submissionComment,
					schedule: state.scheduling === 'custom' ? state.scheduledDateTime.toISOString() : null,
					publishingTarget: pkg.target
				});
			},
			error: (error) => {
				updateSubmittingOrHasPendingChanges({ isSubmitting: false, hasPendingChanges: true });
				dispatch(pushErrorDialog({ props: { error: error.response?.response ?? error } }));
			}
		});
	};

	const onCloseButtonClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => onClose(e, null);

	return (
		<>
			<DialogBody sx={{ px: 4, minHeight: 'calc(100vh * 0.5)' }}>
				{state.error ? (
					<ApiResponseErrorState error={state.error} />
				) : (
					<Grid container spacing={2} sx={{ flex: 1 }}>
						<Grid size={{ xs: 12, sm: 5 }}>
							<PublishDialogForm
								formState={state}
								onSubmit={handleSubmit}
								onInputChange={onPublishingArgumentChange}
								onDateTimePickerChange={handleDateTimePickerChange}
								showRequestApproval={showRequestApproval}
								isRequestPublish={isRequestPublish}
								disabled={isSubmitting}
								disablePublishingTarget
								onFetchedPublishedTargets={({ targets }) => {
									setPublishingTargets(targets);
								}}
							/>
						</Grid>
						<Grid size={{ xs: 12, sm: 7 }}>
							{isInitialPublish ? (
								<Box sx={{ height: '40vh' }}>
									<Alert severity="info">
										<FormattedMessage defaultMessage="The entire project was published since this is the first publish request" />
									</Alert>
								</Box>
							) : (
								<PackageItems packageId={pkg.id} />
							)}
							{isRequestPublish && (
								<Alert severity="warning" sx={{ borderTopRightRadius: 0, borderTopLeftRadius: 0 }}>
									<FormattedMessage defaultMessage="If already approved, saving will resubmit this package for approval." />
								</Alert>
							)}
						</Grid>
					</Grid>
				)}
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={onCloseButtonClick} disabled={isSubmitting}>
					<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton onClick={handleSubmit} disabled={submitDisabled} loading={isSubmitting}>
					<FormattedMessage id="words.save" defaultMessage="Save" />
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

export default EditPublishPackageDialogContainer;
