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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Theme } from '@mui/material/styles';
import { focusRingColor } from './focusRing.ts';
import {
	getOverlayBoundarySx,
	overlayBoundarySx,
	overlayBandSx,
	overlayCompanionShadow,
	overlayOutlineOffset,
	overlayStateOffset,
	overlayStateWidth
} from './overlayStroke.ts';

// WCAG 2.1 relative luminance and contrast ratio.
const expand = (hex: string) => (hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex);
const luminance = (raw: string) => {
	const hex = expand(raw);
	const [r, g, b] = [1, 3, 5].map((i) => {
		const v = parseInt(hex.slice(i, i + 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

// Literal on purpose, so this file holds on any branch whatever palette.ts is.
const WHITE = '#FFFFFF';
const BLACK = '#000000';
const theme = { palette: { common: { white: WHITE, black: BLACK } } } as unknown as Theme;

// Authored-page colours, white to black, plus the ones a single mode-dependent stroke failed on.
const PAGE_COLOURS = [
	'#FFFFFF',
	'#FAFAFA',
	'#F3F3F3',
	'#E5E5EA',
	'#C7C7CC',
	'#8E8E93',
	'#808080',
	'#545456',
	'#393939',
	'#242426',
	'#121212',
	'#000000',
	// Pages authored in a brand colour, where a single blue stroke disappeared.
	'#0068DA',
	'#54A6FF',
	'#A35F00',
	'#217F39'
];

// Every colour the guest zone and drop marker states use, in both Studio modes.
const ZONE_STATE_COLOURS = [
	'#217F39',
	'#30DB5B',
	'#0068DA',
	'#54A6FF',
	'#D12E25',
	'#FF7A73',
	'#A35F00',
	'#FFB340',
	'#8E8E93'
];

describe('overlay boundary (WCAG 2.1 SC 1.4.11, 3:1)', () => {
	it('one of the two companion bands is 3:1 or more on every page colour', () => {
		for (const page of PAGE_COLOURS) {
			const best = Math.max(ratio(WHITE, page), ratio(BLACK, page));
			assert.ok(best >= 3, `no band reaches 3:1 on ${page} (best ${best.toFixed(2)}:1)`);
		}
	});

	it('a single mode colour does not, which is why the bands exist', () => {
		// The regression this guards: the dark-mode Studio colour over a white authored page.
		assert.ok(ratio(focusRingColor.dark, WHITE) < 3);
		assert.ok(ratio('#54A6FF', WHITE) < 3);
		assert.ok(ratio('#54A6FF', '#FAFAFA') < 3);
	});

	it('every guest zone and drop marker colour is 3:1 or more on the inner black band', () => {
		for (const colour of ZONE_STATE_COLOURS) {
			const value = ratio(colour, BLACK);
			assert.ok(value >= 3, `${colour} on the black band is ${value.toFixed(2)}:1`);
		}
	});

	it('draws the bands at the edge and the state colour inside them', () => {
		const sx = overlayBoundarySx(theme, '#54A6FF');
		assert.equal(sx.boxShadow, overlayCompanionShadow(theme));
		// The white band is listed first, so it stays outermost.
		assert.ok(sx.boxShadow.indexOf(WHITE) < sx.boxShadow.indexOf(BLACK));
		assert.equal(sx.outlineWidth, overlayStateWidth);
		assert.equal(sx.outlineColor, '#54A6FF');
		assert.equal(sx.outlineOffset, `-${overlayOutlineOffset}px`);
		// An outline is painted outwards from |outlineOffset| by its own width, so its outer edge lands at
		// |outlineOffset| - width. That must be exactly where the two bands end (overlayStateOffset), or the
		// outline covers them. A pixel scan of the rendered marker caught this: with a plain -2px offset the
		// boundary collapsed to a single colour on every page background.
		assert.equal(overlayOutlineOffset - overlayStateWidth, overlayStateOffset);
	});

	it('puts the state colour inside the black band on a filled line', () => {
		const sx = overlayBandSx(theme);
		// A filled line has no outline, so the state colour is its own fill, immediately inside the black
		// border. The black band is deliberately the inner one: the light tints are only 1.78:1 to 2.54:1 on
		// white, and against the black band they are 8.28:1 or more.
		assert.equal(sx.borderColor, BLACK);
		assert.equal(sx.boxShadow, `0 0 0 ${1}px ${WHITE}`);
		for (const colour of ZONE_STATE_COLOURS) {
			const value = ratio(colour, BLACK);
			assert.ok(value >= 3, `${colour} inside the black border is ${value.toFixed(2)}:1`);
		}
	});

	it('resolves a theme callback to the same geometry', () => {
		const callback = getOverlayBoundarySx((t) => t.palette.primary.main);
		const resolved = callback({ palette: { ...theme.palette, primary: { main: '#54A6FF' } } } as unknown as Theme);
		assert.deepEqual(resolved, overlayBoundarySx(theme, '#54A6FF'));
	});
});
