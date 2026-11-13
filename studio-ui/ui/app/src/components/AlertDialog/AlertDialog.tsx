/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

import * as React from 'react';
import { AlertDialogProps } from './types';
import useOnClose from '../../hooks/useOnClose';
import Dialog from '@mui/material/Dialog';
import AlertDialogContainer from './AlertDialogContainer';

export function AlertDialog(props: AlertDialogProps) {
	const {
		open,
		disableBackdropClick,
		disableEnforceFocus,
		hideBackdrop,
		maxWidth,
		disableEscapeKeyDown,
		onClose,
		sxs,
		...rest
	} = props;

	const id = React.useId();
	const titleId = `${id}-title`;
	const bodyId = `${id}-body`;
	const bodyTextId = `${id}-body-text`;
	// Never point at an element that is not rendered. Without a title, the body text names the dialog, and
	// with neither, the dialog stays unnamed rather than carrying a dangling reference.
	const labelledBy = rest.title ? titleId : rest.body ? bodyTextId : undefined;
	// The description is chosen the same way, and never repeats the name. The content element holds the title,
	// so it describes the dialog only when there is no body text to point at. When the body text is the
	// name, there is nothing left to describe.
	const describedBy = rest.body ? (rest.title ? bodyTextId : undefined) : bodyId;

	const onCloseHandler = useOnClose({
		onClose: onClose,
		disableBackdropClick: disableBackdropClick,
		disableEscapeKeyDown: disableEscapeKeyDown
	});

	return (
		<Dialog
			open={open}
			onClose={onCloseHandler}
			aria-labelledby={labelledBy}
			aria-describedby={describedBy}
			// MUI generates an aria-labelledby for its own DialogTitle when none is given. This dialog renders no
			// DialogTitle, so without a label the paper must drop it instead of pointing at nothing.
			slotProps={labelledBy ? undefined : { paper: { 'aria-labelledby': undefined } }}
			disableEnforceFocus={disableEnforceFocus}
			hideBackdrop={hideBackdrop}
			maxWidth={maxWidth ?? 'xs'}
			fullWidth
			sx={{
				'& .MuiPaper-root': { borderRadius: 2.5 },
				...sxs?.root
			}}
		>
			<AlertDialogContainer {...rest} titleId={titleId} bodyId={bodyId} bodyTextId={bodyTextId} sxs={sxs} />
		</Dialog>
	);
}

export default AlertDialog;
