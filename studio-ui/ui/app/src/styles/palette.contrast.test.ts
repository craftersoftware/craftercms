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
import palette from './palette.ts';

const luminance = (hex: string) => {
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

const LIGHT_SURFACES = ['#FFFFFF', '#FAFAFA'];
// Dark paper (#121212) plus the 16.5% MUI elevation overlay used by dialogs and menus.
const DARK_SURFACES = ['#121212', '#1C1C1E', '#393939'];
const colours = ['blue', 'green', 'orange', 'teal'] as const;

describe('palette contrast (WCAG 2.1 AA)', () => {
	it('light-mode main colours are 4.5:1 as text on light surfaces', () => {
		for (const name of colours) {
			for (const surface of LIGHT_SURFACES) {
				assert.ok(ratio(palette[name].main, surface) >= 4.5, `${name}.main on ${surface}`);
			}
		}
	});

	it('light-mode main colours carry white label text at 4.5:1', () => {
		for (const name of ['blue', 'green', 'orange', 'teal'] as const) {
			assert.ok(ratio(palette[name].main, '#FFFFFF') >= 4.5, `white on ${name}.main`);
		}
	});

	it('dark-mode tints are 4.5:1 as text on every dark surface', () => {
		for (const name of [...colours, 'red', 'indigo'] as const) {
			for (const surface of DARK_SURFACES) {
				assert.ok(ratio(palette[name].tint, surface) >= 4.5, `${name}.tint on ${surface}`);
			}
		}
	});

	it('yellow.main is only used for icons (3:1) and yellow.tint is 4.5:1 on dark surfaces', () => {
		for (const surface of LIGHT_SURFACES) {
			assert.ok(ratio(palette.yellow.main, surface) >= 3, `yellow.main on ${surface}`);
		}
		for (const surface of DARK_SURFACES) {
			assert.ok(ratio(palette.yellow.tint, surface) >= 4.5, `yellow.tint on ${surface}`);
		}
	});

	it('the shared form boundary grey is 3:1 on every surface', () => {
		for (const surface of [...LIGHT_SURFACES, ...DARK_SURFACES]) {
			assert.ok(ratio(palette.gray.medium3, surface) >= 3, `gray.medium3 on ${surface}`);
		}
	});

	it('light-mode error #D12E25 is 4.5:1 on light surfaces and a #F3F3F3 panel', () => {
		for (const surface of [...LIGHT_SURFACES, '#F3F3F3']) {
			assert.ok(ratio('#D12E25', surface) >= 4.5, `error on ${surface}`);
		}
	});
});
