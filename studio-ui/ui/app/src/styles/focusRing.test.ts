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

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Theme } from '@mui/material/styles';
import {
	focusRingColor,
	focusRingOffset,
	focusRingStyles,
	focusRingWidth,
	getFocusRingThemeOptions,
	getFocusVisible
} from './focusRing.ts';

// WCAG 2.1 relative luminance and contrast ratio.
const luminance = (hex: string) => {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const v = parseInt(hex.slice(i, i + 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

// The surfaces the ring sits on. Literal on purpose: this test must pass on any branch, whatever palette.ts holds.
const LIGHT_SURFACES = {
	'white / paper': '#FFFFFF',
	'background.default (gray.light0)': '#FAFAFA',
	'gray.light1': '#F3F3F3',
	'gray.light2': '#F2F2F7',
	'gray.light3': '#EBEBF0',
	'gray.light4': '#E5E5EA',
	'gray.light5': '#D8D8DC',
	'gray.light6': '#D1D1D6',
	'gray.light7': '#C7C7CC',
	'selected row (blue.highlight on white)': '#E6F2FF',
	'selected and hovered row': '#DDE8F5'
};

const DARK_SURFACES = {
	'background.paper': '#121212',
	'background.default (gray.dark7)': '#1C1C1E',
	'gray.dark6': '#242426',
	'gray.dark5': '#2C2C2E',
	'gray.dark3': '#3A3A3C',
	'elevated dialog paper': '#393939',
	'selected row on gray.dark7': '#253242'
};

// The primary contained button fills, before and after the 1427 palette change.
const PRIMARY_FILLS = { light: ['#007AFF', '#0068DA'], dark: ['#409CFF', '#54A6FF'] };

describe('focus ring (WCAG 2.1 SC 1.4.11, 3:1)', () => {
	it('the light ring is 3:1 or more on every light surface', () => {
		for (const [name, surface] of Object.entries(LIGHT_SURFACES)) {
			const ratio = contrast(focusRingColor.light, surface);
			assert.ok(ratio >= 3, `${focusRingColor.light} on ${name} ${surface} is ${ratio.toFixed(2)}:1`);
		}
	});

	it('the dark ring is 3:1 or more on every dark surface', () => {
		for (const [name, surface] of Object.entries(DARK_SURFACES)) {
			const ratio = contrast(focusRingColor.dark, surface);
			assert.ok(ratio >= 3, `${focusRingColor.dark} on ${name} ${surface} is ${ratio.toFixed(2)}:1`);
		}
	});

	it('is offset by at least its own width, because it does not contrast with a primary fill', () => {
		// Ring and fill are near-identical blues, so the gap (the surface behind the button) must show.
		for (const mode of ['light', 'dark'] as const) {
			for (const fill of PRIMARY_FILLS[mode]) {
				assert.ok(contrast(focusRingColor[mode], fill) < 3, `${mode} ring vs ${fill}`);
			}
		}
		assert.equal(focusRingWidth, 2);
		assert.ok(focusRingOffset >= focusRingWidth);
	});
});

describe('focus ring values', () => {
	it('builds the MUI theme value per mode', () => {
		assert.deepEqual(getFocusVisible('light'), {
			outlineStyle: 'solid',
			outlineColor: focusRingColor.light,
			outlineWidth: 2,
			outlineOffset: 2
		});
		assert.equal(getFocusRingThemeOptions('dark').focusVisible.outlineColor, focusRingColor.dark);
	});

	it('builds the plain CSS ring from theme.palette.mode', () => {
		const light = { palette: { mode: 'light', background: { paper: '#fff' } } } as unknown as Theme;
		const dark = { palette: { mode: 'dark', background: { paper: '#121212' } } } as unknown as Theme;
		assert.deepEqual(focusRingStyles(light), { outline: '2px solid #0068DA', outlineOffset: '2px' });
		assert.deepEqual(focusRingStyles(dark, { inset: true }), { outline: '2px solid #54A6FF', outlineOffset: '-2px' });
		assert.deepEqual(focusRingStyles(dark, { halo: true, important: true, shadow: 'var(--elevation)' }), {
			outline: '2px solid #54A6FF !important',
			outlineOffset: '2px !important',
			boxShadow: '0 0 0 2px #121212, var(--elevation) !important'
		});
	});

	it('matches the legacy SCSS partial', () => {
		const scss = readFileSync(new URL('../../../scss/src/_focus-ring.scss', import.meta.url), 'utf8');
		const value = (name: string) => scss.match(new RegExp(`^\\$focus-ring-${name}:\\s*([^;]+);`, 'm'))?.[1].trim();
		assert.equal(value('color-light')?.toUpperCase(), focusRingColor.light);
		assert.equal(value('color-dark')?.toUpperCase(), focusRingColor.dark);
		assert.equal(value('width'), `${focusRingWidth}px`);
		assert.equal(value('offset'), `${focusRingOffset}px`);
	});
});
