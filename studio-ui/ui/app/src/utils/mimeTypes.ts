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

import { defineMessages, IntlShape } from 'react-intl';

const messages = defineMessages({
	'application/pdf': {
		id: 'mimeTypes.application/pdf',
		defaultMessage: 'Adobe Portable Document Format (PDF)'
	},
	'application/vnd.ms-powerpoint': {
		id: 'mimeTypes.application/vnd.ms-powerpoint',
		defaultMessage: 'Microsoft Power Point'
	},
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
		id: 'mimeTypes.application/vnd.openxmlformats-officedocument.presentationml.presentation',
		defaultMessage: 'Microsoft Power Point (OpenXML)'
	},
	'application/vnd.ms-excel': {
		id: 'mimeTypes.application/vnd.ms-excel',
		defaultMessage: 'Microsoft Excel'
	},
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
		id: 'mimeTypes.application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		defaultMessage: 'Microsoft Excel (OpenXML)'
	},
	'application/msword': {
		id: 'mimeTypes.application/msword',
		defaultMessage: 'Microsoft Word'
	},
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
		id: 'mimeTypes.application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		defaultMessage: 'Microsoft Word (Open XML)'
	},
	'application/vnd.oasis.opendocument.presentation': {
		id: 'mimeTypes.application/vnd.oasis.opendocument.presentation',
		defaultMessage: 'OpenDocument presentation document'
	},
	'application/vnd.oasis.opendocument.spreadsheet': {
		id: 'mimeTypes.application/vnd.oasis.opendocument.spreadsheet',
		defaultMessage: 'OpenDocument spreadsheet document'
	},
	'application/vnd.oasis.opendocument.text': {
		id: 'mimeTypes.application/vnd.oasis.opendocument.text',
		defaultMessage: 'OpenDocument text document'
	},
	'image/gif': {
		id: 'mimeTypes.image/gif',
		defaultMessage: 'GIF images'
	},
	'image/vnd.microsoft.icon': {
		id: 'mimeTypes.image/vnd.microsoft.icon',
		defaultMessage: 'Icon format'
	},
	'image/jpeg': {
		id: 'mimeTypes.image/jpeg',
		defaultMessage: 'JPEG images'
	},
	'image/png': {
		id: 'mimeTypes.image/png',
		defaultMessage: 'PNG images'
	},
	'image/svg+xml': {
		id: 'mimeTypes.image/svg+xml',
		defaultMessage: 'SVG images'
	},
	'image/webp': {
		id: 'mimeTypes.image/webp',
		defaultMessage: 'WEBP image'
	},
	'text/javascript': {
		id: 'mimeTypes.text/javascript',
		defaultMessage: 'JavaScript'
	},
	'application/javascript': {
		id: 'mimeTypes.application/javascript',
		defaultMessage: 'JavaScript'
	},
	'text/texmacs': {
		id: 'mimeTypes.text/texmacs',
		defaultMessage: 'TeXmacs'
	},
	'application/typescript': {
		id: 'mimeTypes.application/typescript',
		defaultMessage: 'TypeScript'
	},
	'text/css': {
		id: 'mimeTypes.text/css',
		defaultMessage: 'CSS stylesheet'
	},
	'text/x-sass': {
		id: 'mimeTypes.text/x-sass',
		defaultMessage: 'SASS stylesheet'
	},
	'text/x-scss': {
		id: 'mimeTypes.text/x-scss',
		defaultMessage: 'SCSS stylesheet'
	},
	'text/x-groovy': {
		id: 'mimeTypes.text/x-groovy',
		defaultMessage: 'Groovy'
	},
	'text/x-freemarker': {
		id: 'mimeTypes.text/x-freemarker',
		defaultMessage: 'Freemarker'
	},
	'audio/aac': {
		id: 'mimeTypes.audio/aac',
		defaultMessage: 'AAC audio'
	},
	'audio/midi audio/x-midi': {
		id: 'mimeTypes.audio/midi audio/x-midi',
		defaultMessage: 'Musical Instrument Digital Interface (MIDI)'
	},
	'audio/mpeg': {
		id: 'mimeTypes.audio/mpeg',
		defaultMessage: 'MP3 audio'
	},
	'audio/wav': {
		id: 'mimeTypes.audio/wav',
		defaultMessage: 'Waveform Audio Format'
	},
	'video/x-msvideo': {
		id: 'mimeTypes.video/x-msvideo',
		defaultMessage: 'AVI: Audio Video Interleave'
	},
	'video/mp4': {
		id: 'mimeTypes.video/mp4',
		defaultMessage: 'MP4 video'
	},
	'video/mpeg': {
		id: 'mimeTypes.video/mpeg',
		defaultMessage: 'MPEG Video'
	},
	'application/xml': {
		id: 'mimeTypes.application/xml',
		defaultMessage: 'XML'
	},
	'text/html': {
		id: 'mimeTypes.text/html',
		defaultMessage: 'HyperText Markup Language (HTML)'
	},
	'text/plain': {
		id: 'mimeTypes.text/plain',
		defaultMessage: 'Text'
	},
	'application/vnd.ms-fontobject': {
		id: 'mimeTypes.application/vnd.ms-fontobject',
		defaultMessage: 'MS Embedded OpenType fonts'
	},
	'font/otf': {
		id: 'mimeTypes.font/otf',
		defaultMessage: 'OpenType font'
	},
	'font/ttf': {
		id: 'mimeTypes.font/ttf',
		defaultMessage: 'TrueType Font'
	},
	'font/woff': {
		id: 'mimeTypes.font/woff',
		defaultMessage: 'Web Open Font Format (WOFF)'
	},
	'font/woff2': {
		id: 'mimeTypes.font/woff2',
		defaultMessage: 'Web Open Font Format (WOFF)'
	},
	'application/gzip': {
		id: 'mimeTypes.application/gzip',
		defaultMessage: 'GZip Compressed Archive'
	},
	'application/x-7z-compressed': {
		id: 'mimeTypes.application/x-7z-compressed',
		defaultMessage: '7-zip archive'
	},
	'application/x-bzip': {
		id: 'mimeTypes.application/x-bzip',
		defaultMessage: 'BZip archive'
	},
	'application/x-bzip2': {
		id: 'mimeTypes.application/x-bzip2',
		defaultMessage: 'BZip2 archive'
	},
	'application/zip': {
		id: 'mimeTypes.application/zip',
		defaultMessage: 'ZIP archive'
	},
	'application/vnd.rar': {
		id: 'mimeTypes.application/vnd.rar',
		defaultMessage: 'RAR archive'
	},
	'application/x-tar': {
		id: 'mimeTypes.application/x-tar',
		defaultMessage: 'Tape Archive (TAR)'
	}
});

export function getMimeTypeTranslation(mimeType: string, formatMessage: IntlShape['formatMessage']): string {
	let translation = mimeType;
	if (messages[mimeType]) {
		translation = formatMessage(messages[mimeType]);
	}
	return translation;
}
