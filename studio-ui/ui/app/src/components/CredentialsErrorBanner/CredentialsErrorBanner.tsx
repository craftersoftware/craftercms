/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

import React, { PropsWithChildren } from 'react';
import Typography from '@mui/material/Typography';
import WarningRounded from '@mui/icons-material/WarningRounded';
import { getContrastRatio, SxProps, Theme } from '@mui/material/styles';

export type CredentialsErrorBannerProps = PropsWithChildren<{
	id?: string;
	className?: string;
	sx?: SxProps<Theme>;
}>;

/**
 * Credential-failure banner shared by the login dialog and the session re-login dialog.
 * The fill is `theme.palette.error.main`. Text is black when that is at least 4.5:1, otherwise white.
 * `getContrastText` only requires 3:1, which would pick black on a red that fails 4.5:1.
 * There is no border. A border in the text colour is white in light mode and disappears on the fill.
 */
export function CredentialsErrorBanner(props: CredentialsErrorBannerProps) {
	const { id, className, sx, children } = props;
	return (
		<Typography
			id={id}
			role="alert"
			variant="body2"
			className={className}
			sx={[
				(theme) => {
					const backgroundColor = theme.palette.error.main;
					const color = getContrastRatio(backgroundColor, '#000') >= 4.5 ? '#000' : '#fff';
					return {
						backgroundColor,
						color,
						padding: theme.spacing(1),
						borderRadius: theme.spacing(1),
						display: 'flex',
						placeContent: 'center',
						lineHeight: 1.7,
						'& .MuiSvgIcon-root': {
							marginRight: theme.spacing(0.5),
							color
						}
					};
				},
				...(Array.isArray(sx) ? sx : [sx])
			]}
		>
			<WarningRounded /> {children}
		</Typography>
	);
}

export default CredentialsErrorBanner;
