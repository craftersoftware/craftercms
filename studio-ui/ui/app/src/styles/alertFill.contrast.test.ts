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
import { getStudioPaletteOptions } from './palette.ts';

/**
 * The filled Alert pair, per severity, in both modes (WCAG 2.1 SC 1.4.3, 4.5:1).
 *
 * MUI's own filled rule fills with `palette[severity].dark` in dark mode but takes the label colour from
 * `getContrastText(palette[severity].main)`, so the two halves come from different shades: error was
 * #B25550 with a composited 87% black label, 3.96:1. The theme overrides that fill with `.main`, which is
 * the shade the label colour is derived from, and sets `contrastThreshold: 4.5`.
 *
 * This mirrors the theme's rule rather than importing the theme, because the theme is a React module and
 * this test must stay loadable on any branch.
 */

const SEVERITIES = ['error', 'warning', 'info', 'success'] as const;

// MUI's two label colours: dark.text.primary is rgba(0, 0, 0, 0.87) and light.text.primary is white.
const DARK_TEXT = { r: 0, g: 0, b: 0, a: 0.87 };
const LIGHT_TEXT = '#FFFFFF';

const parse = (colour: string) => {
	const m = colour.match(/rgba?\(([^)]+)\)/);
	if (m) {
		const p = m[1]
			.split(/[ ,/]+/)
			.filter(Boolean)
			.map(Number);
		return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
	}
	const h = colour.replace('#', '');
	const s = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
	return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16), a: 1 };
};

const over = (top: { r: number; g: number; b: number; a: number }, bottom: { r: number; g: number; b: number }) => ({
	r: top.r * top.a + bottom.r * (1 - top.a),
	g: top.g * top.a + bottom.g * (1 - top.a),
	b: top.b * top.a + bottom.b * (1 - top.a)
});

const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
	const f = (v: number) => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const ratio = (fg: string | { r: number; g: number; b: number }, bg: string) => {
	const B = parse(bg);
	const F = typeof fg === 'string' ? over(parse(fg), B) : over({ ...fg, a: 1 }, B);
	const a = luminance(F);
	const b = luminance(B);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/**
 * MUI 9.5's `getContrastText` at the contrastThreshold 4.5 the theme sets. It tests the dark (black) label
 * first and falls back to the light (white) one:
 *   getContrastRatio(background, dark.text.primary) >= contrastThreshold ? dark : light
 * So white is the check that runs on every dark-mode fill, and black is the fallback. Getting this order
 * wrong would label a mid-tone fill with black when MUI labels it white.
 */
const contrastText = (background: string) => (ratio(DARK_TEXT, background) >= 4.5 ? DARK_TEXT : LIGHT_TEXT);

describe('contrastText follows MUI getContrastText', () => {
	it('checks the dark label first, as MUI does', () => {
		// #FF7A73: black is 7.6:1, so MUI keeps the dark label rather than switching to white (4.8:1).
		assert.deepEqual(contrastText('#FF7A73'), DARK_TEXT);
		// #0068DA: black is 3.67:1, under the threshold, so MUI falls back to white (5.26:1).
		assert.equal(contrastText('#0068DA'), LIGHT_TEXT);
	});
});

describe('filled Alert label contrast (WCAG 2.1 SC 1.4.3, 4.5:1)', () => {
	for (const mode of ['light', 'dark'] as const) {
		it(`every severity reaches 4.5:1 in ${mode} mode`, () => {
			const palette = getStudioPaletteOptions(mode);
			for (const severity of SEVERITIES) {
				// The theme's override: the fill is `.main` in both modes, so it matches the label colour.
				const fill = palette[severity].main;
				const label = contrastText(fill);
				const value = ratio(label, fill);
				assert.ok(value >= 4.5, `${mode} ${severity}: label on ${fill} is ${value.toFixed(2)}:1`);
			}
		});
	}

	it('records the dark-mode pair MUI would have used without the override', () => {
		// A regression note, and the reason the override exists. MUI fills a dark Alert with
		// `palette[severity].dark` but derives the label from `.main`, so the pair mixed two shades.
		// #B25550 is `error.dark` in dark mode (MUI's darken of #FF7A73 by 0.2) and the label is the
		// composited 87% black MUI picks for #FF7A73. This is the 3.96:1 the review measured on screen.
		const muiDarkFill = '#B25550';
		const value = ratio(DARK_TEXT, muiDarkFill);
		assert.ok(value < 4.5, `MUI's own dark error fill with the .main label is ${value.toFixed(2)}:1`);
	});
});
