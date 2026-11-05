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

import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import React, { ChangeEvent, ReactNode, useRef } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import '../../styles/animations.scss';
import PrimaryButton from '../PrimaryButton';
import Box from '@mui/material/Box';
import { typographyClasses } from '@mui/material';
import { ApiResponse, PublishPackage } from '../../models';
import { getPackageStateLabel, isReady } from '../PublishPackageReviewDialog/utils';
import Button from '@mui/material/Button';
import { CancelPackageDialog } from '../CancelPackageDialog';
import useEnhancedDialogState from '../../hooks/useEnhancedDialogState';
import { PackageDetailsDialog } from '../PackageDetailsDialog';

const translations = defineMessages({
	cancelText: {
		id: 'publishingDashboard.cancelItemButtonText',
		defaultMessage: 'Cancel'
	},
	cancel: {
		id: 'publishingDashboard.no',
		defaultMessage: 'No'
	},
	confirm: {
		id: 'publishingDashboard.yes',
		defaultMessage: 'Yes'
	},
	confirmHelperText: {
		id: 'publishingDashboard.confirmHelperText',
		defaultMessage: 'Set item state to "Cancelled"?'
	},
	status: {
		id: 'publishingDashboard.status',
		defaultMessage: 'Status is {state} for {environment} target'
	},
	comment: {
		id: 'publishingDashboard.comment',
		defaultMessage: 'Comment'
	},
	commentNotProvided: {
		id: 'publishingDashboard.commentNotProvided',
		defaultMessage: '(submission comment not provided)'
	},
	filesList: {
		id: 'publishingDashboard.filesList',
		defaultMessage: 'files list'
	},
	path: {
		id: 'words.path',
		defaultMessage: 'Path'
	},
	type: {
		id: 'words.type',
		defaultMessage: 'Type'
	},
	item: {
		id: 'words.item',
		defaultMessage: 'Item'
	},
	asset: {
		id: 'words.asset',
		defaultMessage: 'Asset'
	},
	script: {
		id: 'words.script',
		defaultMessage: 'Script'
	},
	page: {
		id: 'words.page',
		defaultMessage: 'Page'
	},
	renderingTemplate: {
		id: 'words.template',
		defaultMessage: 'Template'
	},
	component: {
		id: 'words.component',
		defaultMessage: 'Component'
	},
	unknown: {
		id: 'words.unknown',
		defaultMessage: 'Unknown'
	}
});

interface PublishingPackageProps {
	siteId: string;
	pkg: PublishPackage;
	selected: Record<string, boolean>;
	pending: Record<string, boolean>;
	readOnly?: boolean;

	setSelected(selected: Record<string, boolean>): void;

	setApiState(state: { error: boolean; errorResponse: ApiResponse }): void;

	setPending(pending: Record<string, boolean>): void;

	getPackages(siteId: string, filters?: string): void;
}

export function PublishingPackage(props: PublishingPackageProps) {
	const { formatMessage } = useIntl();
	const { pkg, siteId, selected, setSelected, pending, setPending, getPackages, readOnly } = props;
	const { id, title, packageState: state, target, submitter, submittedOn, submitterComment } = pkg;
	const username = submitter.username;
	const comment = submitterComment;
	const schedule = submittedOn;
	const cancelPackageDialogState = useEnhancedDialogState();
	const packageDetailsDialogState = useEnhancedDialogState();

	const { current: ref } = useRef<any>({});

	function onSelect(event: ChangeEvent, id: number, checked: boolean) {
		if (checked) {
			setSelected({ ...selected, [id]: false });
		} else {
			setSelected({ ...selected, [id]: true });
		}
	}

	function onCancel(packageId: number) {
		setPending({ ...pending, [packageId]: true });
		cancelPackageDialogState.onOpen();
	}

	const onCancelDialogSuccess = () => {
		cancelPackageDialogState.onClose();
		getPackages(siteId);
	};

	ref.onCancelDialogClosed = (packageId: string) => {
		setPending({ ...pending, [packageId]: false });
	};

	function onShowPackageDetails() {
		packageDetailsDialogState.onOpen();
	}

	const checked = selected[id] ? selected[id] : false;
	return (
		<Box
			sx={[
				{
					padding: '20px 8px 20px 0',
					'& .loading-header': {
						display: 'flex',
						alignItems: 'center',
						height: '42px'
					},
					'& .name': {
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						marginBottom: '10px'
					},
					'& .status': {
						display: 'flex',
						justifyContent: 'space-between',
						marginBottom: '10px'
					},
					'& .comment': {
						display: 'flex',
						'& p:first-child': {
							marginRight: '20px',
							marginBottom: '10px'
						},
						'& span': {
							color: (theme) => theme.palette.text.secondary
						}
					},
					'& .files': {
						marginTop: '10px'
					}
				},
				pending[id] && {
					WebkitAnimation: 'pulse 3s infinite ease-in-out',
					animation: 'pulse 3s infinite ease-in-out',
					pointerEvents: 'none'
				}
			]}
		>
			<section className="name">
				{pending[id] ? (
					<header className={'loading-header'}>
						<CircularProgress
							size={15}
							sx={{
								marginRight: '10px',
								color: (theme) => theme.palette.text.secondary
							}}
							color={'inherit'}
						/>
						<Typography variant="body1">
							<strong>{id}</strong>
						</Typography>
					</header>
				) : isReady(state) ? (
					<FormGroup sx={{ marginRight: 'auto' }}>
						<FormControlLabel
							control={
								<Checkbox
									color="primary"
									checked={checked}
									onChange={(event) => onSelect(event, id, checked)}
									disabled={readOnly}
								/>
							}
							label={
								<strong>
									{id} - {title}
								</strong>
							}
						/>
					</FormGroup>
				) : (
					<Typography variant="body1">
						<strong>
							{id} - {title}
						</strong>
					</Typography>
				)}
				{isReady(state) && (
					<Button variant="outlined" color="warning" onClick={() => onCancel(id)} disabled={readOnly}>
						<FormattedMessage defaultMessage="Cancel" />
					</Button>
				)}
			</section>
			<div className="status">
				<Typography variant="body2">
					<FormattedMessage
						id="publishingDashboard.scheduled"
						defaultMessage="Scheduled for <b>{schedule, date, medium} {schedule, time, short}</b> by <b>{username}</b>"
						values={{
							schedule: new Date(schedule),
							username,
							b: (content: ReactNode[]) => (
								<Box
									component="strong"
									key={content[0] as string}
									sx={{
										maxWidth: '390px',
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										display: 'inline-block',
										marginBottom: '-5px'
									}}
								>
									{content[0]}
								</Box>
							)
						}}
					/>
				</Typography>
				<Typography variant="body2">
					{formatMessage(translations.status, {
						state: <strong>{getPackageStateLabel(state)}</strong>,
						environment: <strong key={target}>{target}</strong>
					})}
				</Typography>
			</div>
			<div className="comment">
				<Typography variant="body2">{formatMessage(translations.comment)}</Typography>
				<Typography variant="body2">
					{comment ? comment : <span>{formatMessage(translations.commentNotProvided)}</span>}
				</Typography>
			</div>
			<div className="files">
				<PrimaryButton variant="outlined" onClick={() => onShowPackageDetails()}>
					<FormattedMessage defaultMessage="Show Package Details" />
				</PrimaryButton>
			</div>
			<CancelPackageDialog
				open={cancelPackageDialogState.open}
				onSuccess={onCancelDialogSuccess}
				onClose={cancelPackageDialogState.onClose}
				onClosed={() => ref.onCancelDialogClosed(id)}
				isSubmitting={cancelPackageDialogState.isSubmitting}
				packageId={id}
			/>
			<PackageDetailsDialog
				open={packageDetailsDialogState.open}
				onClose={packageDetailsDialogState.onClose}
				packageId={id}
			/>
		</Box>
	);
}

export default PublishingPackage;
