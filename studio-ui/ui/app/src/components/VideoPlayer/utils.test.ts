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

/**
 * Covers MIME type resolution for the video player: explicit types win, otherwise the URL
 * extension is mapped. Query/hash suffixes must not affect the extension.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSourceType } from './utils.ts';

describe('resolveSourceType', () => {
	it('returns the explicit type when provided', () => {
		assert.equal(resolveSourceType('clip.mp4', 'video/webm'), 'video/webm');
		assert.equal(resolveSourceType('clip.unknown', 'application/x-mpegURL'), 'application/x-mpegURL');
	});

	it('maps known extensions to MIME types', () => {
		assert.equal(resolveSourceType('clip.mp4'), 'video/mp4');
		assert.equal(resolveSourceType('stream.m3u8'), 'application/x-mpegURL');
		assert.equal(resolveSourceType('manifest.mpd'), 'application/dash+xml');
	});

	it('matches extensions case-insensitively', () => {
		assert.equal(resolveSourceType('CLIP.MP4'), 'video/mp4');
		assert.equal(resolveSourceType('Stream.M3U8'), 'application/x-mpegURL');
		assert.equal(resolveSourceType('Manifest.MPD'), 'application/dash+xml');
	});

	it('ignores query strings and fragments when reading the extension', () => {
		assert.equal(resolveSourceType('clip.mp4?token=abc'), 'video/mp4');
		assert.equal(resolveSourceType('stream.m3u8#program'), 'application/x-mpegURL');
		assert.equal(resolveSourceType('manifest.mpd?x=1#y'), 'application/dash+xml');
	});

	it('uses the final extension when the path has multiple dots', () => {
		assert.equal(resolveSourceType('/media/clip.final.mp4'), 'video/mp4');
	});

	it('returns undefined when the extension is unknown or missing', () => {
		assert.equal(resolveSourceType('clip.webm'), undefined);
		assert.equal(resolveSourceType('clip'), undefined);
		assert.equal(resolveSourceType('/media/clip.'), undefined);
		assert.equal(resolveSourceType(''), undefined);
	});
});
