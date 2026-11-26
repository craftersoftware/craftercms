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

import React, { lazy, Suspense, useEffect, useState } from 'react';
import type { VideoPlayerProps } from '../VideoPlayer/VideoPlayer';
import '../../styles/async-video-player.scss';
import { defineMessages, useIntl } from 'react-intl';

// video.js is large, and it's only needed once the video is known to be playable.
const VideoPlayer = lazy(() => import('../VideoPlayer/VideoPlayer'));

interface AsyncVideoPlayerProps {
	playerOptions: VideoPlayerProps;
	nonPlayableMessage?: string;
}

const messages = defineMessages({
	videoBeingProcessed: {
		id: 'asyncVideoPlayer.videoBeingProcessed',
		defaultMessage: 'Video is being processed, preview will be available when processing is complete'
	}
});

function AsyncVideoPlayer(props: AsyncVideoPlayerProps) {
	const { formatMessage } = useIntl();
	const { playerOptions, nonPlayableMessage = formatMessage(messages.videoBeingProcessed) } = props,
		[playable, setPlayable] = useState(null),
		errMessageStyle = {
			height: playerOptions.height ? playerOptions.height : 150,
			width: playerOptions.width ? playerOptions.width : 300
		};

	useEffect(() => {
		// async request to check for 404
		// if response is 200 setPlayable(true)
		fetch(playerOptions.src)
			.then(function (response) {
				if (response.status === 200) {
					setPlayable(true);
				} else {
					setPlayable(false);
				}
			})
			.catch(function () {
				setPlayable(false);
			});
	}, [playerOptions.src]);

	if (playable) {
		return (
			<section className="async-video-player">
				<Suspense
					fallback={
						<div className="async-video-player--loading" style={errMessageStyle}>
							Loading...
						</div>
					}
				>
					<VideoPlayer {...playerOptions} />
				</Suspense>
			</section>
		);
	} else {
		if (playable === null) {
			return (
				<div className="async-video-player--loading" style={errMessageStyle}>
					Loading...
				</div>
			);
		} else {
			return (
				<div className="async-video-player--unavailable-message" style={errMessageStyle}>
					{nonPlayableMessage}
				</div>
			);
		}
	}
}

export default AsyncVideoPlayer;
