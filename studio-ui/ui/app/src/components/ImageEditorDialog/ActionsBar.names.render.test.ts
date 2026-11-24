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
 * The image tools are icon-only. Each button's accessible name is the same text as its tooltip.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { ActionsBar } = await import('./ActionsBar.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

describe('image editor action names', () => {
	it('names each tool from its tooltip', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const root = createRoot(host);
		mounted.push({ unmount: () => root.unmount(), host });
		await act(async () => {
			root.render(
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(ActionsBar, {
						tools: ['crop', 'rotate', 'flip', 'adjustments'],
						currentMode: null,
						setMode() {},
						onRotate() {},
						onFlip() {}
					})
				)
			);
		});
		const labels = Array.from(host.querySelectorAll('button'), (button) => button.getAttribute('aria-label'));
		assert.deepEqual(labels, [
			'Crop',
			'Rotate left',
			'Rotate right',
			'Flip horizontal',
			'Flip vertical',
			'Saturation',
			'Brightness',
			'Contrast'
		]);
	});
});
