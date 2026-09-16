/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import TextField from '@mui/material/TextField';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import TextFieldWithMax from '../TextFieldWithMax';
import Box from '@mui/material/Box';
import FormControlLabel, { formControlLabelClasses } from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import { HelpOutlineOutlined } from '@mui/icons-material';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import Collapse from '@mui/material/Collapse';
import DateTimeTimezonePicker from '../DateTimeTimezonePicker';
import { capitalize } from '../../utils/string';
import { InternalDialogState } from './utils';
import { PartialSxRecord, PublishingTarget } from '../../models';
import { Theme, Typography } from '@mui/material';
import { SystemStyleObject } from '@mui/system/styleFunctionSx/styleFunctionSx';
import Link from '@mui/material/Link';
import { fetchPublishingTargets, FetchPublishingTargetsResponse } from '../../services/publishing';
import useActiveSiteId from '../../hooks/useActiveSiteId';

const messages = defineMessages({
	publishingTargetLoading: {
		id: 'publishForm.publishingTargetLoading',
		defaultMessage: 'Loading...'
	},
	publishingTargetError: {
		id: 'publishForm.publishingTargetError',
		defaultMessage: 'Publishing targets load failed.'
	},
	publishingTargetSuccess: {
		id: 'publishForm.publishingTargetSuccess',
		defaultMessage: 'Success'
	},
	live: {
		id: 'words.live',
		defaultMessage: 'Live'
	},
	staging: {
		id: 'words.staging',
		defaultMessage: 'Staging'
	}
});

type PublishDialogFormSxKeys =
	| 'root'
	| 'title'
	| 'checkboxes'
	| 'formSection'
	| 'formInputs'
	| 'selectInput'
	| 'publishingTargetLoaderContainer'
	| 'publishingTargetLoader'
	| 'publishingTargetEmpty'
	| 'datePicker'
	| 'radioGroup'
	| 'radioInput'
	| 'selectIcon'
	| 'mixedDatesWarningMessage'
	| 'mixedTargetsWarningMessage';

export interface PublishDialogFormProps {
	onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
	formState: InternalDialogState;
	onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onDateTimePickerChange: (date: Date) => void;
	showRequestApproval?: boolean;
	isRequestPublish?: boolean;
	disabled?: boolean;
	isPromote?: boolean;
	onFetchedPublishedTargets?: ({ published, targets }: { published: boolean; targets: PublishingTarget[] }) => void;
	sxs?: PartialSxRecord<PublishDialogFormSxKeys>;
}

export function PublishDialogForm(props: PublishDialogFormProps) {
	const {
		onSubmit,
		formState,
		onInputChange,
		onDateTimePickerChange,
		showRequestApproval,
		isRequestPublish,
		disabled = false,
		isPromote = false,
		onFetchedPublishedTargets,
		sxs
	} = props;

	const siteId = useActiveSiteId();
	const { formatMessage } = useIntl();
	const [publishingTargets, setPublishingTargets] = useState<PublishingTarget[]>(null);
	const [publishingTargetsStatus, setPublishingTargetsStatus] = useState('Loading');
	const [published, setPublished] = useState<boolean>(null);
	const onFetchedPublishedTargetsRef = useRef(null);
	onFetchedPublishedTargetsRef.current = onFetchedPublishedTargets;

	const fetchPublishingTargetsFn = useCallback(
		(
			success?: (channels: FetchPublishingTargetsResponse['publishingTargets']) => void,
			error?: (error: unknown) => void
		) => {
			setPublishingTargetsStatus('Loading');
			return fetchPublishingTargets(siteId).subscribe({
				next({ publishingTargets: targets, published }) {
					onFetchedPublishedTargetsRef.current?.({ targets, published });
					setPublished(published);
					setPublishingTargets(targets);
					setPublishingTargetsStatus('Success');
					success?.(targets);
				},
				error(e) {
					setPublishingTargetsStatus('Error');
					error?.(e);
				}
			});
		},
		[siteId]
	);

	useEffect(() => {
		const subscription = fetchPublishingTargetsFn();
		return () => subscription.unsubscribe();
	}, [fetchPublishingTargetsFn]);

	return (
		<Box component="form" sx={{ width: 'auto', ...sxs?.root }} onSubmit={onSubmit}>
			<TextField
				autoFocus
				fullWidth
				sx={{ mb: 1 }}
				name="packageTitle"
				value={formState.packageTitle}
				onChange={onInputChange}
				label={<FormattedMessage defaultMessage="Package Title" />}
				helperText={
					<FormattedMessage defaultMessage="Dashboard and other places will use this title to display this package." />
				}
				required
			/>
			<TextFieldWithMax
				id="publishDialogFormSubmissionComment"
				name="submissionComment"
				label={<FormattedMessage id="publishForm.submissionComment" defaultMessage="Submission Comment" />}
				fullWidth
				onChange={onInputChange}
				value={formState.submissionComment}
				multiline
				disabled={disabled}
				required={true}
			/>
			<Box sx={{ mb: 1.25 }}>
				{showRequestApproval && (
					<FormControlLabel
						sx={{ display: 'block' }}
						control={
							<Checkbox
								size="small"
								checked={formState.requestApproval}
								onChange={onInputChange}
								disabled={disabled}
								name="requestApproval"
							/>
						}
						label={
							<Box
								sx={{
									display: 'inline-flex',
									alignItems: 'center'
								}}
							>
								<FormattedMessage id="publishForm.requestApproval" defaultMessage="Request approval" />
								<Tooltip
									title={
										<FormattedMessage
											id="publishDialog.requestPublishHint"
											defaultMessage="Items will be submitted for review and published upon approval"
										/>
									}
								>
									<IconButton
										aria-label="help"
										size="small"
										sx={{ ml: 1 }}
										color={isRequestPublish ? 'warning' : undefined}
									>
										{isRequestPublish ? (
											<ErrorOutlineRounded fontSize="small" />
										) : (
											<HelpOutlineOutlined fontSize="small" />
										)}
									</IconButton>
								</Tooltip>
							</Box>
						}
					/>
				)}
			</Box>
			<FormControl fullWidth sx={{ width: '100%', marginBottom: '20px', ...sxs?.formSection }}>
				<FormLabel component="legend">
					<FormattedMessage defaultMessage="Scheduling" />
				</FormLabel>
				<RadioGroup
					value={formState.scheduling}
					onChange={onInputChange}
					name="scheduling"
					sx={{ paddingTop: '10px', fontSize: '14px', ...sxs?.radioGroup }}
				>
					<FormControlLabel
						value="now"
						control={
							<Radio
								color="primary"
								sx={{ padding: '4px', marginLeft: '5px', marginRight: '5px', ...sxs?.radioInput }}
							/>
						}
						label={<FormattedMessage defaultMessage="Now" />}
						slotProps={{
							typography: {
								sx: { fontSize: '14px' }
							}
						}}
						sx={{ [`& .${formControlLabelClasses.label}`]: { fontSize: '14px', ...sxs?.formInputs } }}
						disabled={disabled}
					/>
					<FormControlLabel
						value="custom"
						control={
							<Radio
								color="primary"
								sx={{ padding: '4px', marginLeft: '5px', marginRight: '5px', ...sxs?.radioInput }}
							/>
						}
						label={
							published ? (
								<FormattedMessage defaultMessage="Later" />
							) : (
								<FormattedMessage defaultMessage="Later (disabled on first publish)" />
							)
						}
						slotProps={{
							typography: {
								sx: { fontSize: '14px', ...sxs?.formInputs }
							}
						}}
						disabled={!published || disabled}
					/>
				</RadioGroup>
				<Collapse
					mountOnEnter
					in={formState.scheduling === 'custom'}
					timeout={300}
					sx={[
						formState.scheduling === 'custom' && {
							position: 'relative',
							paddingLeft: '30px',
							'&::before': {
								content: '""',
								position: 'absolute',
								width: '5px',
								height: '100%',
								top: '0',
								left: '7px',
								backgroundColor: (theme) => theme.palette.background.paper,
								borderRadius: '5px'
							},
							...(sxs?.datePicker as SystemStyleObject<Theme>)
						}
					]}
				>
					<DateTimeTimezonePicker
						onChange={onDateTimePickerChange}
						value={formState.scheduledDateTime}
						disablePast
						disabled={disabled}
					/>
				</Collapse>
			</FormControl>
			<FormControl fullWidth sx={{ width: '100%', marginBottom: '20px', ...sxs?.formSection }}>
				<FormLabel component="legend">
					<FormattedMessage defaultMessage="Publishing Target" />
				</FormLabel>
				{publishingTargets ? (
					publishingTargets.length ? (
						<RadioGroup
							value={formState.publishingTarget}
							onChange={onInputChange}
							name="publishingTarget"
							sx={{ paddingTop: '10px', fontSize: '14px', ...sxs?.radioGroup }}
						>
							{publishingTargets.map((target) => (
								<Tooltip
									placement="bottom-start"
									title={
										isPromote && target.name === 'staging' ? (
											<FormattedMessage defaultMessage="When promoting, publishing target is 'live'" />
										) : null
									}
									key={target.name}
								>
									<Box component="span">
										<FormControlLabel
											disabled={
												disabled ||
												(target.name === 'staging' && isPromote) ||
												(target.name === 'staging' && !published)
											}
											value={target.name}
											control={
												<Radio
													color="primary"
													sx={{ padding: '4px', marginLeft: '5px', marginRight: '5px', ...sxs?.radioInput }}
												/>
											}
											label={
												messages[target.name] ? (
													target.name === 'staging' && !published ? (
														<FormattedMessage defaultMessage="Staging (disabled on first publish)" />
													) : (
														formatMessage(messages[target.name])
													)
												) : (
													capitalize(target.name)
												)
											}
											slotProps={{
												typography: {
													sx: { fontSize: '14px', ...sxs?.formInputs }
												}
											}}
										/>
									</Box>
								</Tooltip>
							))}
						</RadioGroup>
					) : (
						<Box sx={{ paddingTop: '24px', display: 'inline-flex', ...sxs?.publishingTargetLoaderContainer }}>
							<Typography
								variant="body1"
								sx={{ padding: '10px 12px', borderRadius: '4px', width: '100%', ...sxs?.publishingTargetEmpty }}
							>
								<FormattedMessage defaultMessage="No publishing channels are available." />
							</Typography>
						</Box>
					)
				) : (
					<Box sx={{ paddingTop: '24px', display: 'inline-flex', ...sxs?.publishingTargetLoaderContainer }}>
						<Typography
							variant="body1"
							component="span"
							sx={{
								border: '1px solid #ced4da',
								padding: '10px 12px',
								borderRadius: '4px',
								width: '100%',
								fontSize: '14px',
								...sxs?.formInputs
							}}
							color={publishingTargetsStatus === 'Error' ? 'error' : 'initial'}
						>
							{formatMessage(messages[`publishingTarget${publishingTargetsStatus}`])}
							{publishingTargetsStatus === 'Error' && (
								<Link href="#" onClick={() => fetchPublishingTargetsFn()}>
									<FormattedMessage defaultMessage="retry" />
								</Link>
							)}
						</Typography>
					</Box>
				)}
			</FormControl>
		</Box>
	);
}

export default PublishDialogForm;
