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

import React, { ReactNode, useLayoutEffect, useRef } from 'react';
import Alert, { AlertProps } from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { CustomContentProps, MaterialDesignContent, SnackbarContent } from 'notistack';
import { applySnackbarLiveRole, snackbarLiveRole } from '../../utils/a11y/snackbarRole';

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

function alertSeverity(variant: string | undefined): AlertProps['severity'] {
	if (variant === 'error' || variant === 'warning' || variant === 'success' || variant === 'info') return variant;
	return 'info';
}

export const NotistackVariant = React.forwardRef<HTMLDivElement, CustomContentProps & AdditionalVariantProps>(
	function (props, ref) {
		const { id, variant, alertTitle, alertVariant, alertSx } = props;
		const role = snackbarLiveRole(variant);
		return (
			<SnackbarContent ref={ref}>
				<Alert
					role={role}
					aria-live={role === 'alert' ? 'assertive' : 'polite'}
					aria-atomic
					action={typeof props.action === 'function' ? props.action(id) : props.action}
					severity={alertSeverity(variant)}
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
 * notistack's default content hardcodes role="alert". Save/Publish toasts use that
 * default variant. The role is corrected before paint so the first announcement is polite.
 */
export const DefaultStatusSnackbar = React.forwardRef<HTMLDivElement, CustomContentProps>(
	function DefaultStatusSnackbar(props, ref) {
		const innerRef = useRef<HTMLDivElement>(null);
		const setRef = (node: HTMLDivElement | null) => {
			innerRef.current = node;
			if (typeof ref === 'function') ref(node);
			else if (ref) ref.current = node;
		};
		useLayoutEffect(() => {
			if (innerRef.current) applySnackbarLiveRole(innerRef.current, 'default');
		});
		return <MaterialDesignContent ref={setRef} {...props} />;
	}
);

export default NotistackVariant;
