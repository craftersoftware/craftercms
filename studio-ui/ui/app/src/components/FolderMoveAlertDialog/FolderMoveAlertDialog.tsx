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

import React, { createElement, useState } from 'react';
import EnhancedDialog, { EnhancedDialogProps } from '../EnhancedDialog/EnhancedDialog';
import FolderMoveAlert from '../FolderMoveAlert/FolderMoveAlert';
import { batchActions } from '../../state/actions/misc';
import { setClipboard } from '../../state/actions/content';
import { emitSystemEvent, itemCut, showCutItemSuccessNotification } from '../../state/actions/system';
import { ContentItem } from '../../models';
import { FormattedMessage } from 'react-intl';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import DialogFooter from '../DialogFooter';
import type { EnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import type StandardAction from '../../models/StandardAction';
import { useDispatch } from 'react-redux';
import Tooltip from '@mui/material/Tooltip';

export interface FolderMoveAlertDialogProps extends EnhancedDialogProps {
	item: ContentItem;
}

export interface FolderMoveAlertDialogStateProps extends EnhancedDialogState {
	item: ContentItem;
	onClose?: StandardAction;
	onClosed?: StandardAction;
}

export function FolderMoveAlertDialog(props: FolderMoveAlertDialogProps) {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Need `item` removed to pass down props to EnhancedDialog
	const { item, ...rest } = props;
	return (
		<EnhancedDialog maxWidth="sm" title={<FormattedMessage defaultMessage="Warning" />} {...rest}>
			{createElement(Body, props)}
		</EnhancedDialog>
	);
}

function Body({ item, onClose }: FolderMoveAlertDialogProps) {
	const [moveAck, setMoveAck] = useState(false);
	const dispatch = useDispatch();
	const onContinue = () => {
		dispatch(
			batchActions([
				setClipboard({ type: 'CUT', sourcePath: item.path }),
				emitSystemEvent(itemCut({ target: item.path })),
				showCutItemSuccessNotification()
			])
		);
		onClose?.(null, null);
	};
	return (
		<>
			<FolderMoveAlert
				autoFocus
				initialExpanded
				checked={moveAck}
				action="move"
				onChange={(e) => setMoveAck(e.target.checked)}
				sx={{ border: 'none', borderRadius: 0 }}
			/>
			<DialogFooter>
				<SecondaryButton onClick={(e) => onClose?.(e, null)}>
					<FormattedMessage defaultMessage="Cancel" />
				</SecondaryButton>
				<Tooltip
					describeChild
					title={
						moveAck ? (
							''
						) : (
							<FormattedMessage defaultMessage="Please click the warning checkbox above to confirm and continue." />
						)
					}
				>
					<span>
						<PrimaryButton onClick={onContinue} disabled={!moveAck}>
							<FormattedMessage defaultMessage="Continue" />
						</PrimaryButton>
					</span>
				</Tooltip>
			</DialogFooter>
		</>
	);
}

export default FolderMoveAlertDialog;
