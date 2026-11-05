/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import React, { ReactNode, useCallback } from 'react';
import Alert, { AlertProps } from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { CustomContentProps, MaterialDesignContent, SnackbarContent } from 'notistack';

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

export const NotistackVariant = React.forwardRef<HTMLDivElement, CustomContentProps & AdditionalVariantProps>(
	function (props, ref) {
		const { id, variant, alertTitle, alertVariant, alertSx } = props;
		return (
			<SnackbarContent ref={ref}>
				<Alert
					// WCAG 4.1.3: errors and warnings interrupt, success and info are polite status messages.
					role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
					action={typeof props.action === 'function' ? props.action(id) : props.action}
					severity={variant}
					variant={alertVariant}
					sx={{ width: '100%', flexWrap: 'wrap', ...alertSx }}
				>
					{alertTitle && <AlertTitle children={alertTitle} />}
					{props.message}
				</Alert>
			</SnackbarContent>
		);
	}
);

/**
 * notistack's default content hardcodes role="alert", which would interrupt for routine Save/Publish
 * toasts. The role is corrected as the element mounts, before paint.
 */
export const DefaultStatusSnackbar = React.forwardRef<HTMLDivElement, CustomContentProps>(
	function DefaultStatusSnackbar(props, ref) {
		const setRef = useCallback(
			(node: HTMLDivElement | null) => {
				node?.setAttribute('role', 'status');
				if (typeof ref === 'function') ref(node);
				else if (ref) ref.current = node;
			},
			[ref]
		);
		return <MaterialDesignContent ref={setRef} {...props} />;
	}
);

export default NotistackVariant;
