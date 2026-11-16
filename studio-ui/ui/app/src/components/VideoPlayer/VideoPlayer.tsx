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

import React, { CSSProperties, lazy, Suspense } from 'react';
import '@videojs/react/video/skin.css';
import { VideoPlayer as Player, VideoSkin, Video } from '@videojs/react/video';
import { resolveSourceType } from './utils';

export interface VideoPlayerProps {
	src: string;
	autoplay?: boolean;
	controls?: boolean;
	height?: number;
	width?: number;
	muted?: boolean;
	poster?: string;
	type?: string;
}

const HlsJsVideo = lazy(() => import('@videojs/react/media/hlsjs-video').then((m) => ({ default: m.HlsJsVideo })));
const DashVideo = lazy(() => import('@videojs/react/media/dash-video').then((m) => ({ default: m.DashVideo })));

const HLS_TYPES = new Set(['application/x-mpegurl', 'application/vnd.apple.mpegurl']);
const DASH_TYPES = new Set(['application/dash+xml']);

function VideoPlayer(props: VideoPlayerProps) {
	const { src, autoplay, controls, height, width, muted, poster, type } = props;
	const sourceType = resolveSourceType(src, type);
	const mediaProps = {
		src,
		autoPlay: autoplay,
		muted,
		poster,
		height,
		width,
		playsInline: true as const
	};

	let media: React.ReactElement;
	const normalizedType = sourceType?.toLowerCase();
	if (normalizedType && HLS_TYPES.has(normalizedType)) {
		media = <HlsJsVideo {...mediaProps} source={{ src, type: sourceType }} />;
	} else if (normalizedType && DASH_TYPES.has(normalizedType)) {
		media = <DashVideo {...mediaProps} />;
	} else {
		media = <Video {...mediaProps} />;
	}

	const skinStyle: CSSProperties = {
		...(width != null ? { width } : { width: '100%' }),
		...(height != null ? { height } : { aspectRatio: '16 / 9' })
	};

	const content = controls ? <VideoSkin style={skinStyle}>{media}</VideoSkin> : media;

	return (
		<Player poster={poster}>
			<Suspense fallback="">{content}</Suspense>
		</Player>
	);
}

export default VideoPlayer;
