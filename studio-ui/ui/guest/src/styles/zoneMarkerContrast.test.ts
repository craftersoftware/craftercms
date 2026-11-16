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
 * Zone marker labels sit on the state's .light chip, not on .main. .contrastText is the colour for
 * .main, so a label that uses it is measured against the wrong background.
 */

import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Theme } from '@mui/material/styles';

const appSrc = fileURLToPath(new URL('../../../app/src/', import.meta.url));
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier.startsWith('@craftercms/studio-ui/')) {
			const rest = specifier.slice('@craftercms/studio-ui/'.length);
			return nextResolve(pathToFileURL(path.join(appSrc, `${rest}.ts`)).href, context);
		}
		return nextResolve(specifier, context);
	}
});

const { createGuestTheme, styleSxDefaults } = await import('./styles.ts');

const states = [
	'selectModeHighlight',
	'moveModeHighlight',
	'errorHighlight',
	'warnHighlight',
	'disabledHighlight'
] as const;

type Slot = {
	paper?: { bgcolor?: unknown; color?: unknown };
	icon?: { color?: unknown };
};

function parseColor(input: string): [number, number, number, number] {
	const hex = input.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex) {
		const value = hex[1].length === 3 ? [...hex[1]].map((char) => char + char).join('') : hex[1];
		return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16), 1];
	}
	const rgb = input.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
	if (!rgb) throw new Error(`Cannot read colour ${input}`);
	return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] == null ? 1 : Number(rgb[4])];
}

/** WCAG 2.1 contrast after compositing translucent text onto its background. */
function contrast(foreground: string, background: string): number {
	const [fr, fg, fb, fa] = parseColor(foreground);
	const [br, bg, bb, ba] = parseColor(background);
	const alpha = fa + ba * (1 - fa);
	const channel = (front: number, back: number) => Math.round((front * fa + back * ba * (1 - fa)) / alpha);
	const luminance = (r: number, g: number, b: number) => {
		const linear = [r, g, b].map((value) => {
			const channelValue = value / 255;
			return channelValue <= 0.03928 ? channelValue / 12.92 : ((channelValue + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
	};
	const [hi, lo] = [luminance(channel(fr, br), channel(fg, bg), channel(fb, bb)), luminance(br, bg, bb)].sort(
		(left, right) => right - left
	);
	return (hi + 0.05) / (lo + 0.05);
}

function resolveColor(value: unknown, theme: Theme): string {
	const resolved = typeof value === 'function' ? value(theme) : value;
	if (typeof resolved === 'string' && resolved.includes('.')) {
		const fromPalette = resolved.split('.').reduce<unknown>((current, key) => {
			if (current == null || typeof current !== 'object') return undefined;
			return (current as Record<string, unknown>)[key];
		}, theme.palette);
		if (typeof fromPalette === 'string') return fromPalette;
	}
	if (typeof resolved === 'string') return resolved;
	throw new Error(`Unresolved colour ${String(value)}`);
}

/** A .light chip painted with the .main contrast colour. getContrastText does not count. */
function usesContrastTextOnLight(background: unknown, color: unknown): boolean {
	const backgroundSource = typeof background === 'string' ? background : '';
	const colorSource = typeof color === 'function' ? color.toString() : String(color);
	return backgroundSource.endsWith('.light') && /\.contrastText\b/.test(colorSource);
}

describe('zone marker label contrast', () => {
	for (const mode of ['light', 'dark'] as const) {
		it(`picks getContrastText for each ${mode} fill and clears 4.5:1`, () => {
			const theme = createGuestTheme(mode);
			const markers = styleSxDefaults.zoneMarker;
			for (const state of states) {
				const slot = markers[state] as Slot;
				const background = resolveColor(slot.paper?.bgcolor, theme);
				const text = resolveColor(slot.paper?.color, theme);
				const ratio = contrast(text, background);
				assert.equal(usesContrastTextOnLight(slot.paper?.bgcolor, slot.paper?.color), false, state);
				assert.equal(text, theme.palette.getContrastText(background), `${mode} ${state} text`);
				assert.ok(ratio >= 4.5, `${mode} ${state} text is ${ratio.toFixed(2)}:1 on ${background}`);
				const icon = slot.icon?.color;
				if (icon != null) {
					const iconColor = resolveColor(icon, theme);
					assert.equal(usesContrastTextOnLight(slot.paper?.bgcolor, icon), false, `${state} icon`);
					assert.equal(iconColor, theme.palette.getContrastText(background), `${mode} ${state} icon`);
					const iconRatio = contrast(iconColor, background);
					assert.ok(iconRatio >= 4.5, `${mode} ${state} icon is ${iconRatio.toFixed(2)}:1`);
				}
			}
		});
	}
});
