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

import React, { createContext, PropsWithChildren, ReactNode, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import Alert, { AlertProps } from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
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

/**
 * Marks every toast surface, whichever content component drew it: notistack's default
 * (`MaterialDesignContent`, which adds `notistack-MuiContent`) and the Alert-based variants used for
 * error, warning, success and info (which add no such class). Styling that must reach all toasts, such
 * as the focus ring for native anchors in a message, keys on this instead of a notistack class.
 */
export const TOAST_HOST_CLASS = 'crafter-toast';

/**
 * A toast paints its own surface (#313131 for notistack's default content), so the theme focus ring would
 * sit on it: 2.47:1 for the light ring. Two things are needed, and neither works alone.
 * MUI's variable below reaches ButtonBase children (the action and close buttons); it supplies only the halo.
 * A native anchor in a toast message is not ButtonBase and draws nothing from it, so GlobalStyles rings
 * toast anchors from the same shared source, scoped by `TOAST_HOST_CLASS`. See styles/focusRing.ts.
 */
function useToastFocusHalo(): Record<string, string> {
	const theme = useTheme();
	return theme.focusVisible ? { '--_focusVisible-shadow': `0 0 0 4px ${theme.palette.background.paper}` } : undefined;
}

const StatusRegionContext = createContext<HTMLElement | null>(null);

/**
 * Persistent polite live region (WCAG 4.1.3) for toasts. A snackbar mounts with its message already inside, and a
 * `role="status"` node inserted with its text is generally not announced. Status toasts write their text into
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

/** The text of a message that may contain markup, without any of its elements. */
function messageText(message: ReactNode): string {
	if (message == null || typeof message === 'boolean') return '';
	if (typeof message === 'string' || typeof message === 'number') return String(message);
	if (Array.isArray(message)) return message.map(messageText).join('');
	if (React.isValidElement<{ children?: ReactNode }>(message)) return messageText(message.props.children);
	return '';
}

/**
 * Announces `text` through the shared region. Only text is written: copying the rendered message would
 * put a second, clipped copy of its links and buttons inside the hidden region, and `visuallyHidden` does
 * not take them out of the tab order.
 */
function StatusMessage({ text }: { text: string }) {
	const region = useContext(StatusRegionContext);
	if (!region) return null;
	return createPortal(<div>{text}</div>, region);
}

export const NotistackVariant = React.forwardRef<HTMLDivElement, CustomContentProps & AdditionalVariantProps>(
	function (props, ref) {
		const { id, variant, alertTitle, alertVariant, alertSx } = props;
		const hasStatusRegion = useContext(StatusRegionContext) !== null;
		// Errors and warnings interrupt. Success and info are announced through the status region, without a live role
		// of their own. Without a region (e.g. a host that does not mount one) every toast keeps the Alert's default.
		const isStatus = hasStatusRegion && variant !== 'error' && variant !== 'warning';
		const halo = useToastFocusHalo();
		// The title is part of the same message, so it is announced once with it rather than twice.
		const announcement = [messageText(alertTitle), messageText(props.message)].filter(Boolean).join('. ');
		return (
			<SnackbarContent ref={ref} className={TOAST_HOST_CLASS} style={halo as React.CSSProperties}>
				<Alert
					role={isStatus ? 'none' : 'alert'}
					action={typeof props.action === 'function' ? props.action(id) : props.action}
					severity={variant}
					variant={alertVariant}
					sx={{ width: '100%', flexWrap: 'wrap', ...halo, ...(alertSx as object) }}
				>
					{alertTitle && <AlertTitle children={alertTitle} />}
					{props.message}
				</Alert>
				{isStatus && <StatusMessage text={announcement} />}
			</SnackbarContent>
		);
	}
);

/**
 * notistack's default content hardcodes role="alert", which would interrupt for routine Save/Publish toasts.
 * Its text is announced through the status region instead.
 */
export const DefaultStatusSnackbar = React.forwardRef<HTMLDivElement, CustomContentProps>(
	function DefaultStatusSnackbar(props, ref) {
		const hasStatusRegion = useContext(StatusRegionContext) !== null;
		const halo = useToastFocusHalo();
		const setRef = useCallback(
			(node: HTMLDivElement | null) => {
				if (!node) {
					if (typeof ref === 'function') ref(null);
					else if (ref) ref.current = null;
					return;
				}
				node.classList.add(TOAST_HOST_CLASS);
				if (hasStatusRegion) node.removeAttribute('role');
				if (typeof ref === 'function') ref(node);
				else if (ref) ref.current = node;
			},
			[ref, hasStatusRegion]
		);
		return (
			<>
				<MaterialDesignContent ref={setRef} {...props} style={{ ...halo, ...props.style }} />
				{hasStatusRegion && <StatusMessage text={messageText(props.message)} />}
			</>
		);
	}
);

export default NotistackVariant;
