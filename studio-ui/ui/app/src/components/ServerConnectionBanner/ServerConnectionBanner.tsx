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

import { Global } from '@emotion/react';
import CloseRounded from '@mui/icons-material/CloseRounded';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

/** Caps the docked bar at any browser zoom. `vh` tracks the layout viewport. */
const BANNER_MAX_HEIGHT = '22vh';

export interface ServerConnectionBannerProps {
	authoringBase: string;
	onDismiss(): void;
}

/**
 * Full-width bar docked to the viewport bottom. `#root` is `100vh` with
 * `border-box`, so padding-bottom reserves that strip inside the app shell.
 * Dialogs are portaled to `document.body`, so their paper is shortened by the
 * same height. Styles live here, not in the shell.
 */
export function ServerConnectionBanner(props: ServerConnectionBannerProps) {
	const { authoringBase, onDismiss } = props;
	const { formatMessage } = useIntl();
	const rootRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState(0);
	const closeLabel = formatMessage({ id: 'words.close', defaultMessage: 'Close' });

	useLayoutEffect(() => {
		const element = rootRef.current;
		if (!element) return undefined;
		const apply = () => {
			const next = Math.ceil(element.getBoundingClientRect().height);
			setHeight((current) => (current === next ? current : next));
		};
		apply();
		const observer = new ResizeObserver(apply);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return (
		<>
			<Global
				styles={{
					':root': {
						'--studio-connection-banner-height': `${height}px`
					},
					'#root': {
						paddingBottom: 'var(--studio-connection-banner-height, 0px)'
					},
					':where(:root, :root *)': {
						scrollPaddingBottom: 'var(--studio-connection-banner-height, 0px)'
					},
					'.MuiDialog-paper:not(.MuiDialog-paperFullScreen)': {
						maxHeight: 'calc(100% - 64px - var(--studio-connection-banner-height, 0px))',
						marginBottom: 'calc(32px + var(--studio-connection-banner-height, 0px))'
					},
					// Same specificity as MUI's own full-screen rule (a single emotion class) loses to it, so qualify the selector.
					'.MuiDialog-paper.MuiDialog-paperFullScreen': {
						maxHeight: 'calc(100% - var(--studio-connection-banner-height, 0px))',
						height: 'calc(100% - var(--studio-connection-banner-height, 0px))',
						// The container centres the paper. This keeps the shortened paper at the top.
						marginBottom: 'var(--studio-connection-banner-height, 0px)'
					}
				}}
			/>
			<Box
				ref={rootRef}
				sx={{
					position: 'fixed',
					left: 0,
					right: 0,
					bottom: 0,
					zIndex: (theme) => theme.zIndex.snackbar,
					maxHeight: BANNER_MAX_HEIGHT,
					overflow: 'auto',
					boxSizing: 'border-box'
				}}
			>
				<Alert
					role="alert"
					severity="warning"
					variant="standard"
					sx={{ borderRadius: 0, alignItems: 'center' }}
					action={
						<>
							<Button
								href={`${authoringBase}/help/socket-connection-error`}
								target="_blank"
								rel="noopener noreferrer"
								size="small"
								color="inherit"
								sx={{ '&:focus-visible': { outline: '2px solid currentColor', outlineOffset: 2 } }}
							>
								<FormattedMessage defaultMessage="Learn more" />
							</Button>
							<IconButton
								size="small"
								color="inherit"
								onClick={onDismiss}
								aria-label={closeLabel}
								sx={{ '&:focus-visible': { outline: '2px solid currentColor', outlineOffset: 2 } }}
							>
								<CloseRounded fontSize="small" />
							</IconButton>
						</>
					}
				>
					<AlertTitle>
						<FormattedMessage defaultMessage="Connection with the server interrupted" />
					</AlertTitle>
					<FormattedMessage defaultMessage="Studio will continue to retry the connection." />
				</Alert>
			</Box>
		</>
	);
}

export default ServerConnectionBanner;
