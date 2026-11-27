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

const SourceTypes: Record<string, string> = {
	mp4: 'video/mp4',
	m3u8: 'application/x-mpegURL',
	mpd: 'application/dash+xml'
};

const extensionRegex = /(?:\.([^.]+))?$/;

/** Prefer an explicit MIME type; otherwise map a known file extension from the URL path. */
export function resolveSourceType(src: string, type?: string): string | undefined {
	if (type) {
		return type;
	}
	const path = src.split(/[?#]/, 1)[0];
	const extension = extensionRegex.exec(path)?.[1]?.toLowerCase();
	return extension ? SourceTypes[extension] : undefined;
}
