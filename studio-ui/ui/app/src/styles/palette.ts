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

import type { PaletteOptions } from '@mui/material/styles';

const palette = {
	white: '#fff',
	black: '#000',
	// Text and icons that sit on a `.light` variant chip, which is a mid-tone in both modes.
	// #121212 is 4.87:1 on error.light (#DA5750), the darkest chip.
	highlightText: '#121212',
	blue: {
		tint: '#54A6FF',
		main: '#0068DA',
		shade: '#0040DD',
		highlight: 'rgba(0, 122, 255, .1)',
		highlightHex: '#E6F2FF'
	},
	green: { tint: '#30DB5B', main: '#217F39', shade: '#248A3D', highlight: '#EBFAEF' },
	indigo: { tint: '#9A98FF', main: '#5856D6', shade: '#3634A3' },
	orange: { tint: '#FFB340', main: '#A35F00', shade: '#C93400' },
	pink: { tint: '#FF6482', main: '#FF2D55', shade: '#D30F45' },
	purple: { tint: '#DA8FFF', main: '#AF52DE', shade: '#8944AB' },
	red: { tint: '#FF7A73', main: '#D12E25', shade: '#D70015', highlight: '#FFEBEA' },
	teal: { tint: '#70D7FF', main: '#357694', shade: '#0071A4' },
	yellow: { tint: '#FFD426', main: '#A88700', shade: '#A05A00', highlight: '#FFFAE6' },
	gray: {
		light0: '#FAFAFA',
		light1: '#F3F3F3',
		light2: '#F2F2F7',
		light3: '#EBEBF0',
		light4: '#E5E5EA',
		light5: '#D8D8DC',
		light6: '#D1D1D6',
		light7: '#C7C7CC',
		medium1: '#BCBCC0',
		medium2: '#AEAEB2',
		medium3: '#8E8E93',
		medium4: '#7C7C80',
		medium5: '#6C6C70',
		medium6: '#636366',
		medium7: '#545456',
		dark1: '#48484A',
		dark2: '#444446',
		dark3: '#3A3A3C',
		dark4: '#363638',
		dark5: '#2C2C2E',
		dark6: '#242426',
		dark7: '#1C1C1E'
	}
};

export type StudioPaletteMode = 'light' | 'dark';

/** A palette colour with no MUI slot of its own. `main` already follows the mode. */
export interface StudioPaletteColor {
	main: string;
}

declare module '@mui/material/styles' {
	interface Palette {
		yellow: StudioPaletteColor;
		indigo: StudioPaletteColor;
		purple: StudioPaletteColor;
		pink: StudioPaletteColor;
		border: { control: string };
		icon: { muted: string };
	}
	interface PaletteOptions {
		yellow?: StudioPaletteColor;
		indigo?: StudioPaletteColor;
		purple?: StudioPaletteColor;
		pink?: StudioPaletteColor;
		border?: { control: string };
		icon?: { muted: string };
	}
}

/**
 * The one place that maps the palette to a mode: light mode uses the `main` shade (4.5:1 or more on the
 * light surfaces), dark mode the `tint` (4.5:1 or more on the dark ones). The Studio theme
 * (CrafterThemeProvider) and the guest theme (useGuestTheme) both spread this, so there is one mapping.
 */
export function getStudioPaletteOptions(mode: StudioPaletteMode): PaletteOptions {
	const pick = (colour: { main: string; tint: string }) => (mode === 'dark' ? colour.tint : colour.main);
	return {
		primary: { main: pick(palette.blue) },
		secondary: { main: mode === 'dark' ? palette.indigo.tint : palette.purple.shade },
		error: { main: pick(palette.red) },
		warning: { main: pick(palette.orange) },
		info: { main: pick(palette.teal) },
		success: { main: pick(palette.green) },
		yellow: { main: pick(palette.yellow) },
		indigo: { main: pick(palette.indigo) },
		purple: { main: pick(palette.purple) },
		// pink.tint is 2.84:1 on white, so the disabled-item icon keeps pink.main in both modes
		// (3.49:1 on the light surfaces and 3.17:1 on the darkest dialog surface).
		pink: { main: palette.pink.main },
		// 3.26:1 on paper and 3.12:1 on background.default: the boundary of a control (1.4.11).
		border: { control: palette.gray.medium3 },
		// The same value, named for the other job it does: a muted icon that has no state of its own
		// (folder, not in workflow, no publishing target). An alias, not a second colour.
		icon: { muted: palette.gray.medium3 }
	};
}

export default palette;
