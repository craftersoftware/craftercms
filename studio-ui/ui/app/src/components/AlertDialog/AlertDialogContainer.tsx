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
import { AlertDialogContainerProps } from './types';
import questionGraphicUrl from '../../assets/question.svg';
import useUnmount from '../../hooks/useUnmount';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import DialogContentText from '@mui/material/DialogContentText';
import Box from '@mui/material/Box';
import { DialogFooter } from '../DialogFooter';
import { nnou } from '../../utils/object';

export function AlertDialogContainer(props: AlertDialogContainerProps) {
	const { onClosed, body, title, children, imageUrl = questionGraphicUrl, buttons, sxs } = props;
	const fallbackId = React.useId();
	const {
		titleId = `${fallbackId}-title`,
		bodyId = `${fallbackId}-body`,
		bodyTextId = `${fallbackId}-body-text`
	} = props;
	useUnmount(onClosed);
	return (
		<>
			<DialogContent
				id={bodyId}
				sx={{
					textAlign: 'center',
					padding: '40px 20px 25px !important',
					...sxs?.body
				}}
			>
				{imageUrl && (
					<Box
						component="img"
						src={imageUrl}
						alt=""
						sx={{
							margin: 'auto',
							display: 'block',
							paddingBottom: '35px',
							...sxs?.image
						}}
					/>
				)}
				{title && (
					<Typography
						id={titleId}
						variant="body1"
						component="h2"
						sx={{
							paddingBottom: '5px',
							...sxs?.title
						}}
					>
						{title}
					</Typography>
				)}
				{body && (
					<DialogContentText id={bodyTextId} color="textPrimary" variant="body2">
						{body}
					</DialogContentText>
				)}
				{children}
			</DialogContent>
			{nnou(buttons) && (
				<DialogFooter
					sx={{
						borderTop: 'none',
						display: 'flex',
						flexDirection: 'column',
						padding: '0 40px 35px',
						backgroundColor: null,
						'& > :not(:first-child)': {
							marginTop: '10px',
							marginLeft: 0
						},
						...sxs?.footer
					}}
				>
					{buttons}
				</DialogFooter>
			)}
		</>
	);
}

export default AlertDialogContainer;
