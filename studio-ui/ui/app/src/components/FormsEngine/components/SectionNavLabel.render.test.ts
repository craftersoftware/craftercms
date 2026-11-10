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
 * A section error in the form navigation is an icon plus text, not a red star on its own.
 * The cue stays inline so the row does not grow.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { SectionNavLabel } = await import('./TableOfContents.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError() {} });

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(hasError: boolean) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl as never },
				React.createElement(SectionNavLabel, { title: 'Page Properties', hasError })
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

describe('section navigation error cue', () => {
	it('shows only the title when the section is valid', async () => {
		const host = await render(false);
		assert.equal(host.textContent?.trim(), 'Page Properties');
		assert.equal(host.querySelector('svg'), null);
	});

	it('adds an error icon and accessible text without leaving the title line', async () => {
		const host = await render(true);
		const icon = host.querySelector('svg');
		assert.ok(icon);
		assert.equal(icon.getAttribute('aria-hidden'), 'true');
		assert.match(host.textContent ?? '', /Page Properties/);
		assert.match(host.textContent ?? '', /Section has errors/);
		const text = [...host.querySelectorAll('span')].find((span) => span.textContent === 'Section has errors');
		assert.ok(text);
		assert.equal(text.getAttribute('aria-hidden'), null);
		const row = host.firstElementChild as HTMLElement;
		assert.equal(row.tagName, 'SPAN');
		const cue = icon.parentElement as HTMLElement;
		assert.equal(cue.tagName, 'SPAN');
	});
});
