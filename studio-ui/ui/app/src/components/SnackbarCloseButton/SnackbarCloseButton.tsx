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

import { useSnackbar } from 'notistack';
import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import React from 'react';
import { useIntl } from 'react-intl';

export interface SnackbarCloseButtonProps {
	id: number | string;
}

export function SnackbarCloseButton(props: SnackbarCloseButtonProps) {
	const { id } = props;
	const { closeSnackbar } = useSnackbar();
	const { formatMessage } = useIntl();
	return (
		<IconButton
			onClick={() => closeSnackbar(id)}
			size="small"
			color="secondary"
			aria-label={formatMessage({ id: 'words.close', defaultMessage: 'Close' })}
		>
			<CloseIcon fontSize="small" />
		</IconButton>
	);
}

export default SnackbarCloseButton;
