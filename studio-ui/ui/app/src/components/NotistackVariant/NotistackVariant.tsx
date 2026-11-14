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

import React, { ReactNode } from 'react';
import Alert, { AlertProps } from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { styled, Theme } from '@mui/material/styles';
import { CustomContentProps, SnackbarContent } from 'notistack';
import { TOAST_HOST_CLASS } from '../../utils/a11y/toastHostClass';

type AdditionalVariantProps = Partial<{
	alertTitle: ReactNode;
	alertVariant: AlertProps['variant'];
	alertSx: AlertProps['sx'];
	variant: AlertProps['severity'];
}>;

declare module 'notistack' {
	interface VariantOverrides {
		warning: AdditionalVariantProps;
		error: AdditionalVariantProps;
		success: AdditionalVariantProps;
		info: AdditionalVariantProps;
	}
}

/**
 * A toast paints its own surface, so the theme focus ring would sit on it. The ring comes from the theme's
 * `focusVisible`; this adds a halo in the paper colour between the control and the ring so the ring always has
 * a known neighbour. Native links in a message are handled in GlobalStyles, scoped by `TOAST_HOST_CLASS`.
 */
const toastFocusHaloSx = (theme: Theme) => ({
	'& .Mui-focusVisible': { boxShadow: `0 0 0 4px ${theme.palette.background.paper}` }
});

/**
 * Errors and warnings interrupt (`alert`). Everything else is a polite `status`, which is what a routine
 * Save/Publish toast should be (WCAG 4.1.3).
 */
const getRole = (variant: CustomContentProps['variant']) =>
	variant === 'error' || variant === 'warning' ? 'alert' : 'status';

export const NotistackVariant = React.forwardRef<HTMLDivElement, CustomContentProps & AdditionalVariantProps>(
	function (props, ref) {
		const { id, variant, alertTitle, alertVariant, alertSx } = props;
		return (
			<SnackbarContent ref={ref} className={TOAST_HOST_CLASS}>
				<Alert
					role={getRole(variant)}
					action={typeof props.action === 'function' ? props.action(id) : props.action}
					severity={variant}
					variant={alertVariant}
					sx={[
						{ width: '100%', flexWrap: 'wrap' },
						toastFocusHaloSx,
						...(Array.isArray(alertSx) ? alertSx : [alertSx])
					]}
				>
					{alertTitle && <AlertTitle children={alertTitle} />}
					{props.message}
				</Alert>
			</SnackbarContent>
		);
	}
);

const DefaultSurface = styled(SnackbarContent)(({ theme }) => ({
	display: 'flex',
	alignItems: 'center',
	backgroundColor: '#313131',
	color: '#fff',
	padding: '6px 16px',
	borderRadius: 4,
	boxShadow: theme.shadows[6],
	...theme.typography.body2,
	...toastFocusHaloSx(theme)
}));

/**
 * Content for notistack's `default` variant, registered through the provider's `Components` prop. Built on
 * notistack's public `SnackbarContent`, with a polite `status` role instead of the `alert` role notistack's
 * own default content hardcodes.
 */
export const NotistackDefaultVariant = React.forwardRef<HTMLDivElement, CustomContentProps>(function (props, ref) {
	const { id, message, action, className, style } = props;
	return (
		<DefaultSurface
			ref={ref}
			role="status"
			className={[className, TOAST_HOST_CLASS].filter(Boolean).join(' ')}
			style={style}
		>
			<div style={{ display: 'flex', alignItems: 'center', padding: '8px 0' }}>{message}</div>
			{action && (
				<div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', paddingLeft: 16, marginRight: -8 }}>
					{typeof action === 'function' ? action(id) : action}
				</div>
			)}
		</DefaultSurface>
	);
});

export default NotistackVariant;
