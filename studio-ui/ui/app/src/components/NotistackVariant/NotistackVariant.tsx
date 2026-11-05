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

import React, {
	createContext,
	PropsWithChildren,
	ReactNode,
	useCallback,
	useContext,
	useLayoutEffect,
	useState
} from 'react';
import { createPortal } from 'react-dom';
import Alert, { AlertProps } from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import visuallyHidden from '@mui/utils/visuallyHidden';
import { CustomContentProps, MaterialDesignContent, SnackbarContent } from 'notistack';
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
 * A toast paints its own surface (#313131 for notistack's default content), so the theme focus ring would
 * sit on it: 2.47:1 for the light ring. Two things are needed, and neither works alone.
 * MUI's variable below reaches ButtonBase children (the action and close buttons); it supplies only the halo.
 * A native link in a toast message is not ButtonBase and draws nothing from it, so GlobalStyles rings
 * toast links from the same shared source, scoped by `TOAST_HOST_CLASS`. See styles/focusRing.ts.
 */
function useToastFocusHalo(): Record<string, string> {
	const theme = useTheme();
	return theme.focusVisible ? { '--_focusVisible-shadow': `0 0 0 4px ${theme.palette.background.paper}` } : undefined;
}

/** MUI renders the title and the message inside `.MuiAlert-message`; the action sits outside it. */
const ALERT_ANNOUNCEMENT_BLOCKS = '.MuiAlert-message';
/** notistack puts the message in `#notistack-snackbar`, with the action beside it. */
const DEFAULT_ANNOUNCEMENT_BLOCKS = '#notistack-snackbar';

/** The whitespace a rendered subtree carries collapsed. */
const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * The text of one message block. MUI renders the title as its own block at the start of the message wrapper,
 * directly against the body text, so a sentence break is inserted after it. Everything else is read whole,
 * which keeps a message that mixes text and inline elements (`Read <strong>the docs</strong>`) intact.
 */
function blockText(node: Element): string {
	const title = node.querySelector(':scope > .MuiAlertTitle-root');
	const whole = collapse(node.textContent ?? '');
	if (!title || !whole) return whole;
	const titleText = collapse(title.textContent ?? '');
	if (!titleText || !whole.startsWith(titleText)) return whole;
	const body = whole.slice(titleText.length).trim();
	return body ? `${titleText}. ${body}` : titleText;
}

/**
 * The text a toast rendered. Only the outermost matched block is read, so a title nested inside the message
 * wrapper is not announced twice.
 */
function renderedText(host: Element | null, blocks: string): string {
	if (!host) return '';
	const found = [...host.querySelectorAll(blocks)];
	return found
		.filter((node) => !found.some((other) => other !== node && other.contains(node)))
		.map(blockText)
		.filter(Boolean)
		.join('. ');
}

/**
 * The text a toast should announce, read from the DOM rather than from the message prop: a message can be a
 * component (`FormattedMessage`, a display component, a plugin element) whose text only exists once rendered.
 * `blocks` finds the message node inside `host`, the toast element.
 */
function useRenderedStatusText(host: Element | null, blocks: string, enabled: boolean): string {
	const [text, setText] = useState('');
	useLayoutEffect(() => {
		if (!enabled || !host) return undefined;
		const measure = () => {
			const next = renderedText(host, blocks);
			setText((current) => (current === next ? current : next));
		};
		measure();
		// A formatted message or a late-loading element can settle after the first layout pass.
		if (typeof MutationObserver === 'undefined') return undefined;
		const observer = new MutationObserver(measure);
		observer.observe(host, { childList: true, subtree: true, characterData: true });
		return () => observer.disconnect();
	}, [host, blocks, enabled]);
	return text;
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

/**
 * Announces `text` through the shared region. Only text is written: copying the rendered message would
 * put a second, clipped copy of its links and buttons inside the hidden region, and `visuallyHidden` does
 * not take them out of the tab order.
 */
function StatusMessage({ text }: { text: string }) {
	const region = useContext(StatusRegionContext);
	if (!region || !text) return null;
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
		const [host, setHost] = useState<HTMLDivElement | null>(null);
		const setRef = useCallback(
			(node: HTMLDivElement | null) => {
				setHost(node);
				if (typeof ref === 'function') ref(node);
				else if (ref) ref.current = node;
			},
			[ref]
		);
		// MUI renders `.MuiAlert-message` around the title and the message, and puts the action outside it in
		// `.MuiAlert-action`, so that one selector gives the whole announcement and none of the buttons.
		const announcement = useRenderedStatusText(host, ALERT_ANNOUNCEMENT_BLOCKS, isStatus);
		return (
			<SnackbarContent ref={setRef} className={TOAST_HOST_CLASS} style={halo as React.CSSProperties}>
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
		const [host, setHost] = useState<HTMLDivElement | null>(null);
		const setRef = useCallback(
			(node: HTMLDivElement | null) => {
				setHost(node);
				if (node && hasStatusRegion) node.removeAttribute('role');
				if (typeof ref === 'function') ref(node);
				else if (ref) ref.current = node;
			},
			[ref, hasStatusRegion]
		);
		// notistack puts the message in `#notistack-snackbar` and the action beside it.
		const announcement = useRenderedStatusText(host, DEFAULT_ANNOUNCEMENT_BLOCKS, hasStatusRegion);
		return (
			<>
				<MaterialDesignContent
					ref={setRef}
					{...props}
					className={[props.className, TOAST_HOST_CLASS].filter(Boolean).join(' ')}
					style={{ ...halo, ...props.style }}
				/>
				{hasStatusRegion && <StatusMessage text={announcement} />}
			</>
		);
	}
);

export default NotistackVariant;
