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
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';
import { LogConsoleDetailsDialogProps } from './LogConsoleDetailsDialog';
import { useSelection } from '../../hooks/useSelection';
import { useUnmount } from '../../hooks/useUnmount';

export function LogConsoleDetailsDialogUI(props: LogConsoleDetailsDialogProps) {
	const { logEvent, onClose, onClosed } = props;
	const localeBranch = useSelection((state) => state.uiConfig.locale);

	useUnmount(onClosed);

	return (
		<>
			<DialogHeader
				title={<FormattedMessage id="logConsoleDetailsDialog.title" defaultMessage="Log Details" />}
				onCloseButtonClick={onClose}
			/>
			<DialogBody>
				<Box
					sx={{
						display: 'flex',
						p: '10px 0',
						alignItems: 'center'
					}}
				>
					<Typography color="textSecondary" sx={{ flexBasis: '150px' }}>
						<FormattedMessage id="words.level" defaultMessage="Level" />
					</Typography>
					<Box
						sx={{
							display: 'flex',
							width: '100%',
							alignItems: 'center'
						}}
					>
						<Typography>{logEvent.level}</Typography>
					</Box>
				</Box>
				<Box
					sx={{
						display: 'flex',
						p: '10px 0',
						alignItems: 'center'
					}}
				>
					<Typography color="textSecondary" sx={{ flexBasis: '150px' }}>
						<FormattedMessage id="words.timestamp" defaultMessage="Timestamp" />
					</Typography>
					<Box
						sx={{
							display: 'flex',
							width: '100%',
							alignItems: 'center'
						}}
					>
						<Typography>
							{new Intl.DateTimeFormat(localeBranch.localeCode, localeBranch.dateTimeFormatOptions).format(
								new Date(logEvent.timestamp)
							)}
						</Typography>
					</Box>
				</Box>
				<Box
					sx={{
						display: 'flex',
						p: '10px 0',
						alignItems: 'center'
					}}
				>
					<Typography color="textSecondary" sx={{ flexBasis: '150px' }}>
						<FormattedMessage id="words.thread" defaultMessage="Thread" />
					</Typography>
					<Box
						sx={{
							display: 'flex',
							width: '100%',
							alignItems: 'center'
						}}
					>
						<Typography>{logEvent.thread}</Typography>
					</Box>
				</Box>
				<Box
					sx={{
						display: 'flex',
						p: '10px 0',
						alignItems: 'center'
					}}
				>
					<Typography color="textSecondary" sx={{ flexBasis: '150px' }}>
						<FormattedMessage id="words.project" defaultMessage="Project" />
					</Typography>
					<Box
						sx={{
							display: 'flex',
							width: '100%',
							alignItems: 'center'
						}}
					>
						<Typography>{logEvent.site}</Typography>
					</Box>
				</Box>
				<Box
					sx={{
						display: 'flex',
						p: '10px 0',
						alignItems: 'center'
					}}
				>
					<Typography color="textSecondary" sx={{ flexBasis: '150px' }}>
						<FormattedMessage id="words.message" defaultMessage="Message" />
					</Typography>
					<Box
						sx={{
							display: 'flex',
							width: '100%',
							alignItems: 'center'
						}}
					>
						<Typography>{logEvent.message}</Typography>
					</Box>
				</Box>
			</DialogBody>
		</>
	);
}

export default LogConsoleDetailsDialogUI;
