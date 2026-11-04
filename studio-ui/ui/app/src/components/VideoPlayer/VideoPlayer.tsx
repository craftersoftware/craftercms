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

import React, { CSSProperties } from 'react';
import '@videojs/react/video/skin.css';
import { VideoPlayer as Player, VideoSkin, Video } from '@videojs/react/video';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { DashVideo } from '@videojs/react/media/dash-video';

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

const SourceTypes = {
	mp4: 'video/mp4',
	m3u8: 'application/x-mpegURL',
	mpd: 'application/dash+xml'
};

const HLS_TYPES = new Set(['application/x-mpegurl', 'application/vnd.apple.mpegurl']);
const DASH_TYPES = new Set(['application/dash+xml']);

const extensionRegex = /(?:\.([^.]+))?$/;

function resolveSourceType(src: string, type?: string): string | undefined {
	if (type) {
		return type;
	}
	const extension = extensionRegex.exec(src)?.[1];
	return extension ? SourceTypes[extension] : undefined;
}

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
		media = <HlsJsVideo {...mediaProps} />;
	} else if (normalizedType && DASH_TYPES.has(normalizedType)) {
		media = <DashVideo {...mediaProps} />;
	} else {
		media = <Video {...mediaProps} />;
	}

	const skinStyle: CSSProperties = {
		...(width != null ? { width } : { width: '100%' }),
		...(height != null ? { height } : { aspectRatio: '16 / 9' })
	};

	return <Player poster={poster}>{controls ? <VideoSkin style={skinStyle}>{media}</VideoSkin> : media}</Player>;
}

export default VideoPlayer;
