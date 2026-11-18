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
import { createTheme } from '@mui/material/styles';
import palette from './palette.ts';

/**
 * The two `color-contrast` pairs the theme overrides (WCAG 2.1 SC 1.4.3).
 *
 * Mirrors `CrafterThemeProvider` rather than importing it: that module renders a provider.
 * Composited channels are rounded to integers, which is what the browser and axe flatten to.
 * Axe passes only when the ratio is strictly greater than 4.5 (normal text) or 3 (large text).
 * Avatar initials are 20px regular and the toggle label is 13px, so both need more than 4.5:1.
 */

interface Rgb {
	r: number;
	g: number;
	b: number;
	a: number;
}

const parse = (colour: string): Rgb => {
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

/** Source-over, then the integer channels axe reads back from the used colour. */
const over = (top: Rgb, bottom: Rgb): Rgb => ({
	r: Math.round(top.r * top.a + bottom.r * (1 - top.a)),
	g: Math.round(top.g * top.a + bottom.g * (1 - top.a)),
	b: Math.round(top.b * top.a + bottom.b * (1 - top.a)),
	a: 1
});

const luminance = ({ r, g, b }: Rgb) => {
	const f = (v: number) => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const ratio = (fg: string, bg: string) => {
	const background = parse(bg);
	const foreground = over(parse(fg), background);
	const a = luminance(foreground);
	const b = luminance(background);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** `alpha(colour, opacity)` composited on an opaque surface, as a hex colour. */
const wash = (colour: string, opacity: number, surface: string) => {
	const top = parse(colour);
	top.a = opacity;
	const mixed = over(top, parse(surface));
	const hex = (channel: number) => channel.toString(16).padStart(2, '0');
	return `#${hex(mixed.r)}${hex(mixed.g)}${hex(mixed.b)}`;
};

const themeFor = (mode: 'light' | 'dark') =>
	createTheme({
		palette: {
			mode,
			primary: { main: mode === 'dark' ? palette.blue.tint : palette.blue.main },
			background: { default: mode === 'dark' ? palette.gray.dark7 : palette.gray.light0 }
		}
	});

describe('default avatar initials (WCAG 2.1 SC 1.4.3)', () => {
	// MUI colorDefault keeps these discs and paints the initials in background.default.
	const discs = { light: '#bdbdbd', dark: '#757575' } as const;

	for (const mode of ['light', 'dark'] as const) {
		const theme = themeFor(mode);
		const disc = discs[mode];
		// grey[400] / grey[600], the discs MUI uses when the theme has no CSS variables.
		assert.equal(theme.palette.grey[mode === 'light' ? 400 : 600], disc);

		it(`${mode} initials clear 4.5:1 on the unchanged disc`, () => {
			const before = ratio(theme.palette.background.default, disc);
			const after = ratio(theme.palette.text.primary, disc);
			assert.ok(
				before < 4.5,
				`${mode} MUI pair ${theme.palette.background.default} on ${disc} is ${before.toFixed(2)}:1`
			);
			assert.ok(after > 4.5, `${mode} text.primary on ${disc} is ${after.toFixed(2)}:1`);
		});
	}
});

describe('selected primary toggle label (WCAG 2.1 SC 1.4.3)', () => {
	const theme = themeFor('light');
	const surface = theme.palette.background.default;
	const selected = wash(theme.palette.primary.main, theme.palette.action.selectedOpacity, surface);
	const hovered = wash(
		theme.palette.primary.main,
		theme.palette.action.selectedOpacity + theme.palette.action.hoverOpacity,
		surface
	);

	it('primary.main on its own wash is under 4.5:1', () => {
		const rest = ratio(theme.palette.primary.main, selected);
		const hover = ratio(theme.palette.primary.main, hovered);
		assert.ok(rest < 4.5, `rest ${rest.toFixed(2)}:1 on ${selected}`);
		assert.ok(hover < 4.5, `hover ${hover.toFixed(2)}:1 on ${hovered}`);
	});

	it('blue.shade clears 4.5:1 on the resting wash and the hover wash', () => {
		const rest = ratio(palette.blue.shade, selected);
		const hover = ratio(palette.blue.shade, hovered);
		assert.ok(rest > 4.5, `rest ${rest.toFixed(2)}:1 on ${selected}`);
		assert.ok(hover > 4.5, `hover ${hover.toFixed(2)}:1 on ${hovered}`);
	});

	it('dark mode primary.main already clears 4.5:1 on the resting wash', () => {
		const dark = themeFor('dark');
		const darkSelected = wash(
			dark.palette.primary.main,
			dark.palette.action.selectedOpacity,
			dark.palette.background.default
		);
		const value = ratio(dark.palette.primary.main, darkSelected);
		assert.ok(value > 4.5, `dark rest ${value.toFixed(2)}:1 on ${darkSelected}`);
	});
});
