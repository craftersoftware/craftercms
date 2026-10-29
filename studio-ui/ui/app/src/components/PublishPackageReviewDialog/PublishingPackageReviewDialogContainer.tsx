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

import { PublishingPackageReviewDialogContainerProps } from './types';
import React, { useEffect, useMemo, useState } from 'react';
import { fetchPackage } from '../../services/publishing';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { DialogBody } from '../DialogBody';
import { ApiResponse, PublishingPackageApproveParams, PublishPackage } from '../../models';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { LoadingState } from '../LoadingState';
import { Typography } from '@mui/material';
import { FormattedMessage, useIntl } from 'react-intl';
import Box from '@mui/material/Box';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import FormControlLabel from '@mui/material/FormControlLabel';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import TextFieldWithMax from '../TextFieldWithMax';
import { DialogFooter } from '../DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import useSpreadState from '../../hooks/useSpreadState';
import { CannedMessage, fetchCannedMessages } from '../../services/configuration';
import useEnv from '../../hooks/useEnv';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Collapse from '@mui/material/Collapse';
import DateTimeTimezonePicker, { DateTimeTimezonePickerProps } from '../DateTimeTimezonePicker';
import { createAtLeastHalfHourInFutureDate } from '../../utils/datetime';
import { approvePackage, rejectPackage } from '../../services/workflow';
import { useDispatch } from 'react-redux';
import { AsDayMonthDateTime } from '../VersionList';
import PackageDetails from '../PackageDetailsDialog/PackageDetails';
import { showSystemNotification } from '../../state/actions/system';
import { hasApproveAction, hasRejectAction } from '../../utils/content';
import { pushErrorDialog } from '../../utils/system';
import { useEnhancedDialogContext } from '../EnhancedDialog';
import { isBlank } from '../../utils/string';
import { PACKAGE_APPROVED, PACKAGE_REJECTED } from '../../utils/constants';

export type PackageReviewAction = 'approve' | 'reject';
interface InternalDialogState {
	action: PackageReviewAction;
	scheduling: 'keep' | 'now' | 'custom';
	schedule: Date;
	approverComment: string;
	rejectReason: string;
	rejectComment: string;
}

export function PublishingPackageReviewDialogContainer(props: PublishingPackageReviewDialogContainerProps) {
	const { packageId, isSubmitting, onSuccess, onClose } = props;
	const { activeEnvironment } = useEnv();
	const [publishingPackage, setPublishingPackage] = useState<PublishPackage>();
	const [cannedMessages, setCannedMessages] = useState<CannedMessage[]>([]);
	const [isFetchingPackage, setIsFetchingPackage] = useState(false);
	const [state, setState] = useSpreadState<InternalDialogState>({
		action: null,
		scheduling: null,
		schedule: null,
		approverComment: '',
		rejectReason: 'custom',
		rejectComment: ''
	});
	const [error, setError] = useState<ApiResponse>();
	const siteId = useActiveSiteId();
	const submitLabel =
		state.action === 'reject' ? (
			<FormattedMessage defaultMessage="Reject" />
		) : (
			<FormattedMessage defaultMessage="Approve" />
		);
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();
	const { hasApprovePermission, hasRejectPermission } = useMemo(() => {
		let hasApprovePermission = false;
		let hasRejectPermission = false;
		if (publishingPackage) {
			hasApprovePermission = hasApproveAction(publishingPackage.availableActions);
			hasRejectPermission = hasRejectAction(publishingPackage.availableActions);
		}
		return { hasApprovePermission, hasRejectPermission };
	}, [publishingPackage]);

	// Submit button should be disabled when:
	const submitDisabled =
		// Detailed items haven't loaded
		isFetchingPackage ||
		// While submitting
		isSubmitting ||
		// No action has been selected
		!state.action ||
		// If the action is reject and the reject comment is empty
		(state.action === 'reject' && !state.rejectComment);

	useEffect(() => {
		setIsFetchingPackage(true);
		fetchPackage(siteId, packageId).subscribe({
			next: (publishPackage) => {
				setPublishingPackage(publishPackage);
				setIsFetchingPackage(false);
			},
			error: ({ response }) => {
				setError(response.response);
				setIsFetchingPackage(false);
			}
		});
	}, [siteId, packageId]);

	useEffect(() => {
		// If the package already has a review, pre-fill the corresponding comment field
		// (and pre-select the matching action) with the previous reviewer comment.
		let previousReview: Partial<InternalDialogState> = {};
		if (publishingPackage?.reviewer && !isBlank(publishingPackage.reviewerComment ?? '')) {
			if (publishingPackage.approvalState === PACKAGE_APPROVED) {
				previousReview = { action: 'approve', approverComment: publishingPackage.reviewerComment };
			} else if (publishingPackage.approvalState === PACKAGE_REJECTED) {
				previousReview = { action: 'reject', rejectComment: publishingPackage.reviewerComment };
			}
		}
		setState({
			scheduling: publishingPackage?.schedule ? 'keep' : 'now',
			schedule: publishingPackage?.schedule
				? new Date(publishingPackage.schedule)
				: createAtLeastHalfHourInFutureDate(),
			...previousReview
		});
	}, [publishingPackage, setState]);

	useEffect(() => {
		if (siteId && activeEnvironment) {
			fetchCannedMessages(siteId, activeEnvironment).subscribe({
				next: (cannedMessages) => {
					setCannedMessages(cannedMessages);
				},
				error: ({ response }) => {
					setError(response);
				}
			});
		}
	}, [siteId, activeEnvironment]);

	useEffect(() => {
		if (hasApprovePermission && !hasRejectPermission) {
			setState({ action: 'approve' });
		}
		if (hasRejectPermission && !hasApprovePermission) {
			setState({ action: 'reject' });
		}
	}, [hasApprovePermission, hasRejectPermission, setState]);

	const onArgumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let value: unknown;
		updateSubmittingOrHasPendingChanges({ hasPendingChanges: true });
		switch (e.target.type) {
			case 'textarea':
			case 'radio':
			case 'dateTimePicker':
				value = e.target.value;
				break;
			case 'select': {
				value = e.target.value;
				if (e.target.name === 'rejectReason') {
					setState({ rejectComment: cannedMessages.find((message) => message.key === value)?.message ?? '' });
				}
				break;
			}
			default:
				console.error('Publishing argument change event ignored.');
				return;
		}
		setState({ [e.target.name]: value });
	};

	const handleDateTimePickerChange: DateTimeTimezonePickerProps['onChange'] = (date) => {
		onArgumentChange({
			target: {
				name: 'schedule',
				type: 'dateTimePicker',
				// @ts-expect-error: We're formating this as a change event so ignoring "Type 'Date' is not assignable to type 'string'".
				value: date
			}
		});
	};

	const handleSubmit = () => {
		updateSubmittingOrHasPendingChanges({ isSubmitting: true });
		if (state.action === 'approve') {
			const data: PublishingPackageApproveParams = {
				comment: isBlank(state.approverComment)
					? formatMessage({ defaultMessage: 'Approved with no comment' })
					: state.approverComment.trim(),
				schedule:
					state.scheduling === 'custom'
						? state.schedule.toISOString()
						: state.scheduling === 'keep'
							? new Date(publishingPackage.schedule).toISOString()
							: null,
				updateSchedule: true
			};

			approvePackage(siteId, packageId, data).subscribe({
				next() {
					updateSubmittingOrHasPendingChanges({ isSubmitting: false, hasPendingChanges: false });
					dispatch(
						showSystemNotification({ message: formatMessage({ defaultMessage: 'Package approved successfully.' }) })
					);
					onSuccess?.();
				},
				error({ response }) {
					updateSubmittingOrHasPendingChanges({ isSubmitting: false });
					dispatch(pushErrorDialog({ props: { error: response.response } }));
				}
			});
		} else {
			rejectPackage(siteId, packageId, state.rejectComment).subscribe({
				next() {
					updateSubmittingOrHasPendingChanges({ isSubmitting: false, hasPendingChanges: false });
					dispatch(
						showSystemNotification({ message: formatMessage({ defaultMessage: 'Package rejected successfully.' }) })
					);
					onSuccess?.();
				},
				error({ response }) {
					updateSubmittingOrHasPendingChanges({ isSubmitting: false });
					dispatch(pushErrorDialog({ props: { error: response.response } }));
				}
			});
		}
	};

	const onCloseButtonClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => onClose(e, null);

	return (
		<>
			<DialogBody sx={{ px: 4, minHeight: 'calc(100vh * 0.5)' }}>
				{error ? (
					<ApiResponseErrorState error={error} />
				) : isFetchingPackage ? (
					<LoadingState sx={{ flexGrow: 1 }} />
				) : publishingPackage ? (
					<PackageDetails
						packageId={packageId}
						reviewActions={
							<Box component="form" sx={{ my: 2 }}>
								<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
									<FormattedMessage defaultMessage="Action" />
								</Typography>
								{(hasApprovePermission || hasRejectPermission) && (
									<RadioGroup sx={{ mb: 2 }} value={state.action} name="action" onChange={onArgumentChange}>
										{hasApprovePermission && (
											<FormControlLabel
												value="approve"
												control={<Radio color="primary" />}
												label={
													<Box sx={{ display: 'flex', alignItems: 'center' }}>
														<VerifiedUserOutlinedIcon color="success" sx={{ mr: 1, fontSize: 18 }} />
														<FormattedMessage defaultMessage="Approve" />
													</Box>
												}
											/>
										)}
										{hasRejectPermission && (
											<FormControlLabel
												value="reject"
												control={<Radio color="primary" />}
												label={
													<Box sx={{ display: 'flex', alignItems: 'center' }}>
														<BlockOutlinedIcon color="error" sx={{ mr: 1, fontSize: 18 }} />
														<FormattedMessage defaultMessage="Reject" />
													</Box>
												}
											/>
										)}
									</RadioGroup>
								)}

								{state.action === 'approve' ? (
									<>
										<Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
											<FormattedMessage defaultMessage="Scheduling" />
										</Typography>
										<RadioGroup sx={{ mb: 1 }} onChange={onArgumentChange} name="scheduling" value={state.scheduling}>
											{publishingPackage?.schedule && (
												<FormControlLabel
													value="keep"
													control={<Radio color="primary" />}
													label={
														<FormattedMessage
															defaultMessage="Keep “{date}”"
															values={{
																date: <AsDayMonthDateTime date={publishingPackage.schedule} />
															}}
														/>
													}
												/>
											)}
											<FormControlLabel
												value="now"
												control={<Radio color="primary" />}
												label={<FormattedMessage defaultMessage="Now" />}
											/>
											<FormControlLabel
												value="custom"
												control={<Radio color="primary" />}
												label={<FormattedMessage defaultMessage="Later" />}
											/>
										</RadioGroup>
										<Collapse mountOnEnter in={state.scheduling === 'custom'} sx={{ mb: 2 }}>
											<DateTimeTimezonePicker
												onChange={handleDateTimePickerChange}
												value={state.schedule}
												disablePast
											/>
										</Collapse>
										<TextFieldWithMax
											value={state.approverComment}
											label={<FormattedMessage defaultMessage="Approver Comment" />}
											fullWidth
											onChange={onArgumentChange}
											multiline
											name="approverComment"
										/>
									</>
								) : (
									state.action === 'reject' && (
										<FormControl fullWidth>
											<InputLabel>
												<FormattedMessage defaultMessage="Canned Comments" />
											</InputLabel>
											<Select
												fullWidth
												label={<FormattedMessage defaultMessage="Canned Comments" />}
												autoFocus
												value={state.rejectReason}
												onChange={(e) =>
													onArgumentChange({
														...e,
														target: { ...e.target, name: 'rejectReason', type: 'select' }
													} as React.ChangeEvent<HTMLInputElement>)
												}
												name="rejectReason"
												sx={{ mb: 1 }}
											>
												<MenuItem value="custom">
													<FormattedMessage id="rejectDialog.typeMyOwnComment" defaultMessage="Type my own comment" />
												</MenuItem>
												{cannedMessages?.map((message) => (
													<MenuItem value={message.key} key={message.key}>
														<Typography>{message.title}</Typography>
													</MenuItem>
												))}
											</Select>
											<TextFieldWithMax
												value={state.rejectComment}
												label={<FormattedMessage defaultMessage="Reject Comment" />}
												fullWidth
												onChange={onArgumentChange}
												multiline
												name="rejectComment"
												required
											/>
										</FormControl>
									)
								)}
							</Box>
						}
					/>
				) : (
					<></>
				)}
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={onCloseButtonClick} disabled={isSubmitting}>
					<FormattedMessage defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton disabled={submitDisabled} onClick={handleSubmit}>
					{submitLabel}
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

export default PublishingPackageReviewDialogContainer;
