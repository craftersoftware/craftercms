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

import React, { ElementRef, useEffect, useRef, useState } from 'react';
import { getGuestToHostBus, getHostToGuestBus, getHostToHostBus } from '../../utils/subjects';
import { StandardAction } from '../../models/StandardAction';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { usePreviewState } from '../../hooks/usePreviewState';
import { usePreviewNavigation } from '../../hooks/usePreviewNavigation';
import { useEnv } from '../../hooks/useEnv';
import Box from '@mui/material/Box';
import { filter, map } from 'rxjs/operators';
import { fromEvent } from 'rxjs';
import { reloadRequest } from '../../state/actions/preview';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { mainLandmarkSx, STUDIO_MAIN_CONTENT_ID } from '../SkipToMainContent';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';

export interface HostProps {
	heading?: string;
}

export function Host(props: HostProps) {
	const { heading } = props;
	const site = useActiveSiteId();
	const { guestBase, previewLandingBase } = useEnv();
	const {
		hostSize,
		showToolsPanel: leftSideBarOpen,
		toolsPanelWidth: leftSideBarWidth,
		icePanelWidth: rightSideBarWidth,
		editMode: rightSideBarOpen,
		guest
	} = usePreviewState();
	const { currentUrlPath } = usePreviewNavigation();
	const [iframeKeyAppend, setIframeKeyAppend] = useState(0);
	const iframeRef = useRef<ElementRef<'iframe'>>(null);
	const url = currentUrlPath === '' ? previewLandingBase : `${guestBase}${currentUrlPath}`;
	const eitherSideBarOpen = leftSideBarOpen || rightSideBarOpen;
	const refs = useUpdateRefs({ guest, iframeKeyAppend, url });

	useEffect(() => {
		const g2h = fromEvent<MessageEvent>(window, 'message')
			.pipe(
				filter((e) => Boolean(e.data?.meta?.craftercms)),
				map(({ data }) =>
					data.type
						? data
						: {
								type: data.topic,
								payload: data.message
							}
				)
			)
			.subscribe((action: StandardAction) => getGuestToHostBus().next(action));

		const h2g = getHostToGuestBus()
			.asObservable()
			.pipe(map((action) => ({ ...action, meta: { craftercms: true, source: 'host' } })))
			.subscribe((action) => {
				const contentWindow = iframeRef.current.contentWindow;
				contentWindow.postMessage(action, '*');
			});

		const hth = getHostToHostBus().subscribe(({ type }) => {
			// Attempt a refresh only if the preview application hasn't checked in.
			// This is an alternative mechanism to the primary refresh mechanism
			// (i.e. the message posted to the preview application to refresh its window).
			if (type === reloadRequest.type && !refs.current.guest) {
				setIframeKeyAppend(refs.current.iframeKeyAppend + 1);
				setTimeout(() => {
					iframeRef.current.src = refs.current.url;
				});
			}
		});

		return () => {
			g2h.unsubscribe();
			h2g.unsubscribe();
			hth.unsubscribe();
		};
	}, [refs]);

	useEffect(() => {
		try {
			if (iframeRef.current.contentDocument.location.href !== url) {
				iframeRef.current.src = url;
			}
		} catch {
			iframeRef.current.src = url;
		}
	}, [url, site]);

	return (
		<Box
			component="main"
			id={STUDIO_MAIN_CONTENT_ID}
			tabIndex={-1}
			sx={(theme) => ({
				...mainLandmarkSx,
				flexGrow: 1,
				display: 'flex',
				justifyContent: 'center',
				maxHeight: 'calc(100% - 64px)',
				marginBottom: '5px',
				zIndex: theme.zIndex.drawer + 1,
				background: theme.palette.background.default,
				height: '100%',
				// Want to leave 5px margin on the sides where the sidebar is hidden for the shadows to show appreciably.
				marginLeft: leftSideBarOpen ? `${leftSideBarWidth}px` : '5px',
				marginRight: rightSideBarOpen ? `${rightSideBarWidth}px` : '5px',
				transition: eitherSideBarOpen
					? theme.transitions.create('margin', {
							easing: theme.transitions.easing.easeOut,
							duration: theme.transitions.duration.enteringScreen
						})
					: theme.transitions.create('margin', {
							easing: theme.transitions.easing.sharp,
							duration: theme.transitions.duration.leavingScreen
						})
			})}
		>
			{heading ? (
				<Typography component="h1" sx={visuallyHidden}>
					{heading}
				</Typography>
			) : null}
			<Box
				key={`${site}_${iframeKeyAppend}`}
				ref={iframeRef}
				component="iframe"
				id="crafterCMSPreviewIframe"
				title={heading || 'Preview'}
				sx={{
					width: hostSize.width ?? '100%',
					height: hostSize.height ?? '100%',
					transition: 'width .25s ease, height .25s ease',
					maxWidth: '100%',
					border: 'none',
					margin: 'auto',
					boxShadow: 3,
					borderRadius: 3
				}}
			/>
		</Box>
	);
}

export default Host;
