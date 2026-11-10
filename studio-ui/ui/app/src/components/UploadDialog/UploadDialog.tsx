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

import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import Dialog from '@mui/material/Dialog';
import { useDispatch } from 'react-redux';

import 'uppy/dist/uppy.css';
import { UploadDialogProps } from './util';
import { translations } from './translations';
import { UploadDialogContainer } from './UploadDialogContainer';
import MinimizedBar from '../MinimizedBar';
import { useEnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import { popDialog } from '../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { pushConfirmDialog } from '../../utils/system';

export function UploadDialog(props: UploadDialogProps) {
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const { isMinimized, onMaximize, onMinimize, hasPendingChanges, onSubmittingAndOrPendingChange } =
		useEnhancedDialogState();
	const { open } = props;

	const preventWrongDrop = (e: React.DragEvent) => {
		e.stopPropagation();
		e.preventDefault();
	};

	const setPendingChanges = (value: boolean) => {
		onSubmittingAndOrPendingChange({
			hasPendingChanges: value
		});
	};

	const onClose = () => {
		if (hasPendingChanges) {
			const dialogId = nanoid();
			dispatch(
				pushConfirmDialog({
					id: dialogId,
					props: {
						body: formatMessage(translations.uploadInProgressConfirmation),
						onOk: () => {
							dispatch(popDialog({ id: dialogId }));
							props.onClose();
						},
						onCancel: () => dispatch(popDialog({ id: dialogId }))
					}
				})
			);
		} else {
			props.onClose();
		}
	};

	return (
		<>
			<Dialog
				open={open && !isMinimized}
				keepMounted={isMinimized}
				onDrop={preventWrongDrop}
				onDragOver={preventWrongDrop}
				onClose={onClose}
				fullWidth
				maxWidth="md"
			>
				<UploadDialogContainer
					{...props}
					onClose={onClose}
					onMinimized={onMinimize}
					hasPendingChanges={hasPendingChanges}
					setPendingChanges={setPendingChanges}
				/>
			</Dialog>
			<MinimizedBar
				open={isMinimized}
				onMaximize={onMaximize}
				title={<FormattedMessage id="words.upload" defaultMessage="Upload" />}
			/>
		</>
	);
}

export default UploadDialog;
