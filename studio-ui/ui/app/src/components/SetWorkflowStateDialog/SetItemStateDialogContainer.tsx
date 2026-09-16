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

import DialogHeader from '../DialogHeader/DialogHeader';
import { FormattedMessage } from 'react-intl';
import DialogBody from '../DialogBody/DialogBody';
import React from 'react';
import { SetItemStateDialogProps } from './SetItemStateDialog';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel, { formControlLabelClasses } from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import DialogFooter from '../DialogFooter/DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';

import Box from '@mui/material/Box';
import { useUnmount } from '../../hooks/useUnmount';
import { useSpreadState } from '../../hooks/useSpreadState';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';

export function SetItemStateDialogContainer(props: SetItemStateDialogProps) {
	const { onClose, onClosed, title, hasStaging } = props;
	const [update, setUpdate] = useSpreadState({
		clearSystemProcessing: false,
		clearUserLocked: false,
		clearNew: false,
		clearModified: false,
		clearLive: false,
		clearStaged: false,
		live: false,
		staged: false
	});

	useUnmount(onClosed);

	const onConfirm = (update) => {
		props.onConfirm({
			...(update.clearSystemProcessing && { clearSystemProcessing: update.clearSystemProcessing }),
			...(update.clearUserLocked && { clearUserLocked: update.clearUserLocked }),
			...((update.clearLive || update.live) && { live: update.live }),
			...((update.clearStaged || update.staged) && { staged: update.staged }),
			...(update.clearNew && { new: false }),
			...(update.clearModified && { modified: false })
		});
	};

	return (
		<>
			<DialogHeader title={title} onCloseButtonClick={onClose} />
			<DialogBody>
				<FormGroup
					sx={{
						[`& > .${formControlLabelClasses.root}`]: {
							paddingLeft: '22px'
						}
					}}
				>
					<FormControlLabel
						control={
							<Switch
								checked={update.clearSystemProcessing}
								color="primary"
								onChange={(e) => {
									setUpdate({ clearSystemProcessing: e.target.checked });
								}}
							/>
						}
						label={
							<FormattedMessage
								id="setWorkflowStateDialog.clearSystemProcessing"
								defaultMessage="Clear system processing"
							/>
						}
					/>
					<FormControlLabel
						control={
							<Switch
								checked={update.clearUserLocked}
								color="primary"
								onChange={(e) => {
									setUpdate({ clearUserLocked: e.target.checked });
								}}
							/>
						}
						label={<FormattedMessage id="setWorkflowStateDialog.clearUserLock" defaultMessage="Clear user lock" />}
					/>
					<FormControlLabel
						control={
							<Switch
								checked={update.clearNew}
								color="primary"
								onChange={(e) => {
									setUpdate({ clearNew: e.target.checked });
								}}
							/>
						}
						label={<FormattedMessage id="setWorkflowStateDialog.clearNew" defaultMessage="Clear new" />}
					/>
					<FormControlLabel
						control={
							<Switch
								checked={update.clearModified}
								color="primary"
								onChange={(e) => {
									setUpdate({ clearModified: e.target.checked });
								}}
							/>
						}
						label={<FormattedMessage id="setWorkflowStateDialog.clearModified" defaultMessage="Clear modified" />}
					/>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center'
						}}
					>
						<Bracket width="12px" height="42px" sx={{ marginRight: '10px' }} />
						<Box
							sx={{
								display: 'flex',
								flexDirection: 'column'
							}}
						>
							<FormControlLabel
								control={
									<Switch
										checked={update.live}
										color="primary"
										onChange={(e) => {
											setUpdate({ live: e.target.checked, clearLive: e.target.checked ? false : update.clearLive });
										}}
									/>
								}
								label={
									<FormattedMessage
										id="setWorkflowStateDialog.setAsPublishedLive"
										defaultMessage="Set as published live"
									/>
								}
							/>
							<FormControlLabel
								control={
									<Switch
										checked={update.clearLive}
										color="primary"
										onChange={(e) => {
											setUpdate({ clearLive: e.target.checked, live: e.target.checked ? false : update.live });
										}}
									/>
								}
								label={
									<FormattedMessage
										id="setWorkflowStateDialog.clearAsPublishedLive"
										defaultMessage="Clear as published live"
									/>
								}
							/>
						</Box>
					</Box>
					{hasStaging && (
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center'
							}}
						>
							<Bracket width="12px" height="42px" sx={{ marginRight: '10px' }} />
							<Box
								sx={{
									display: 'flex',
									flexDirection: 'column'
								}}
							>
								<FormControlLabel
									control={
										<Switch
											checked={update.staged}
											color="primary"
											onChange={(e) => {
												setUpdate({
													staged: e.target.checked,
													clearStaged: e.target.checked ? false : update.clearStaged
												});
											}}
										/>
									}
									label={
										<FormattedMessage
											id="setWorkflowStateDialog.setAsPublishedToStaging"
											defaultMessage="Set as published to staging"
										/>
									}
								/>
								<FormControlLabel
									control={
										<Switch
											checked={update.clearStaged}
											color="primary"
											onChange={(e) => {
												setUpdate({ clearStaged: e.target.checked, staged: e.target.checked ? false : update.staged });
											}}
										/>
									}
									label={
										<FormattedMessage
											id="setWorkflowStateDialog.clearAsPublishedToStaging"
											defaultMessage="Clear as published to staging"
										/>
									}
								/>
							</Box>
						</Box>
					)}
				</FormGroup>
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={() => onClose()}>
					<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton disabled={!Object.values(update).some(Boolean)} onClick={() => onConfirm(update)}>
					<FormattedMessage id="words.confirm" defaultMessage="Confirm" />
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

interface BracketProps {
	width?: string;
	height?: string;
	color?: string;
	borderWidth?: string;
	sx?: SxProps<Theme>;
}

function Bracket(props: BracketProps) {
	const { width = '20px', height = '40px', color = '#E0E0E0', borderWidth = '3px', sx } = props;
	return (
		<Box
			sx={{
				width: `${width}`,
				height: `${height}`,
				borderTopLeftRadius: '2px',
				borderBottomLeftRadius: '2px',
				borderLeft: `${borderWidth} solid ${color}`,
				borderTop: `${borderWidth} solid ${color}`,
				borderBottom: `${borderWidth} solid ${color}`,
				...sx
			}}
		/>
	);
}
