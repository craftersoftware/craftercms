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

import { useEffect, useState } from 'react';
import useSpreadState from './useSpreadState';

interface VideoInfo {
	width: number | null;
	height: number | null;
	duration: number | null;
	contentType?: string | null;
	size?: number | null; // size in KB
}
const videoInfoInitialState: VideoInfo = {
	width: null,
	height: null,
	duration: null,
	contentType: null,
	size: null
};

/** Retrieves video dimensions, duration, and metadata (content type and size in KB) from a given URL
 *
 * @param url Video URL
 * @returns Object containing video info, loading states, and error states
 */
export function useVideoInfo(url: string): {
	videoInfo: VideoInfo;
	isFetchingDimensions: boolean;
	isFetchingMetadata: boolean;
	errorDimensions: Error | null;
	errorMetadata: Error | null;
} {
	const [videoInfo, setVideoInfo] = useSpreadState<VideoInfo>(videoInfoInitialState);
	const [isFetchingDimensions, setIsFetchingDimensions] = useState<boolean>(false);
	const [isFetchingMetadata, setIsFetchingMetadata] = useState<boolean>(false);
	const [errorDimensions, setErrorDimensions] = useState<Error | null>(null);
	const [errorMetadata, setErrorMetadata] = useState<Error | null>(null);

	useEffect(() => {
		if (url) {
			// Reset previous info
			setVideoInfo(videoInfoInitialState);
			setIsFetchingDimensions(true);
			setErrorDimensions(null);

			let dimensionsCancelled = false;
			const video = document.createElement('video');
			video.preload = 'metadata';
			video.onloadedmetadata = () => {
				if (dimensionsCancelled) return;
				setVideoInfo({
					width: video.videoWidth,
					height: video.videoHeight,
					duration: video.duration
				});
				setIsFetchingDimensions(false);
			};
			video.onerror = () => {
				if (dimensionsCancelled) return;
				setErrorDimensions(new Error('Video failed to load'));
				setIsFetchingDimensions(false);
			};
			video.src = url;

			setIsFetchingMetadata(true);
			setErrorMetadata(null);
			const abortController = new AbortController();
			(async () => {
				try {
					const response = await fetch(url, { method: 'HEAD', signal: abortController.signal });
					if (!response.ok) {
						throw new Error(`Metadata request failed (${response.status})`);
					}
					const contentType = response.headers.get('Content-Type');
					const contentLength = response.headers.get('Content-Length');
					const sizeKb =
						contentLength && !Number.isNaN(Number(contentLength)) ? Math.round(Number(contentLength) / 1024) : null;
					setVideoInfo({ contentType, size: sizeKb });
					setIsFetchingMetadata(false);
				} catch (error) {
					if (abortController.signal.aborted) return;
					setErrorMetadata(error instanceof Error ? error : new Error('Metadata request failed'));
					setIsFetchingMetadata(false);
				}
			})();

			return () => {
				dimensionsCancelled = true;
				video.onloadedmetadata = null;
				video.onerror = null;
				video.src = '';
				abortController.abort();
			};
		} else {
			setVideoInfo(videoInfoInitialState);
			setIsFetchingDimensions(false);
			setIsFetchingMetadata(false);
			setErrorDimensions(null);
			setErrorMetadata(null);
		}
	}, [url, setVideoInfo]);

	return { videoInfo, isFetchingDimensions, isFetchingMetadata, errorDimensions, errorMetadata };
}

export default useVideoInfo;
