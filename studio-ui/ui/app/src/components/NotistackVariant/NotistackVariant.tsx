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

import React, { createContext, PropsWithChildren, ReactNode, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import Alert, { AlertProps } from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import visuallyHidden from '@mui/utils/visuallyHidden';
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

const StatusRegionContext = createContext<HTMLElement | null>(null);

/**
 * Persistent polite live region (WCAG 4.1.3) for toasts. A snackbar mounts with its message already inside, and a
 * `role="status"` node inserted with its text is generally not announced. Status toasts render their message into
 * this region instead, so it is announced as added content. Mount it around the SnackbarProvider.
 */
export function SnackbarStatusRegion({ children }: PropsWithChildren) {
	const [region, setRegion] = useState<HTMLElement | null>(null);
	return (
		<StatusRegionContext.Provider value={region}>
			{/* aria-atomic="false" so a second toast doesn't re-read the ones still showing. */}
			<Box ref={setRegion} role="status" aria-atomic="false" sx={visuallyHidden} />
			{children}
		</StatusRegionContext.Provider>
	);
}

function StatusMessage({ title, message }: { title?: ReactNode; message: ReactNode }) {
	const region = useContext(StatusRegionContext);
	if (!region) return null;
	return createPortal(
		<>
			{title && <div>{title}</div>}
			<div>{message}</div>
		</>,
		region
	);
}

export const NotistackVariant = React.forwardRef<HTMLDivElement, CustomContentProps & AdditionalVariantProps>(
	function (props, ref) {
		const { id, variant, alertTitle, alertVariant, alertSx } = props;
		const hasStatusRegion = useContext(StatusRegionContext) !== null;
		// Errors and warnings interrupt. Success and info are announced through the status region, without a live role
		// of their own. Without a region (e.g. a host that does not mount one) every toast keeps the Alert's default.
		const isStatus = hasStatusRegion && variant !== 'error' && variant !== 'warning';
		return (
			<SnackbarContent ref={ref}>
				<Alert
					role={isStatus ? 'none' : 'alert'}
					action={typeof props.action === 'function' ? props.action(id) : props.action}
					severity={variant}
					variant={alertVariant}
					sx={{ width: '100%', flexWrap: 'wrap', ...alertSx }}
				>
					{alertTitle && <AlertTitle children={alertTitle} />}
					{props.message}
				</Alert>
				{isStatus && <StatusMessage title={alertTitle} message={props.message} />}
			</SnackbarContent>
		);
	}
);

/**
 * notistack's default content hardcodes role="alert", which would interrupt for routine Save/Publish toasts.
 * Its message is announced through the status region instead.
 */
export const DefaultStatusSnackbar = React.forwardRef<HTMLDivElement, CustomContentProps>(
	function DefaultStatusSnackbar(props, ref) {
		const hasStatusRegion = useContext(StatusRegionContext) !== null;
		const setRef = useCallback(
			(node: HTMLDivElement | null) => {
				if (hasStatusRegion) node?.removeAttribute('role');
				if (typeof ref === 'function') ref(node);
				else if (ref) ref.current = node;
			},
			[ref, hasStatusRegion]
		);
		return (
			<>
				<MaterialDesignContent ref={setRef} {...props} />
				{hasStatusRegion && <StatusMessage message={props.message} />}
			</>
		);
	}
);

export default NotistackVariant;
