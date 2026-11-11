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

async function render(hasError: boolean, expanded = false) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl as never },
				React.createElement(SectionNavLabel, { title: 'Page Properties', hasError, expanded })
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

function hiddenWords(host: HTMLElement) {
	return [...host.querySelectorAll('span')].find((span) => span.textContent === 'Section has errors') ?? null;
}

describe('section navigation error cue', () => {
	it('shows neither the icon nor the hidden words when the section is valid', async () => {
		for (const expanded of [false, true]) {
			const host = await render(false, expanded);
			assert.equal(host.textContent?.trim(), 'Page Properties');
			assert.equal(host.querySelector('svg'), null);
			assert.equal(hiddenWords(host), null);
		}
	});

	it('collapsed and invalid: icon on the right of a flex row and the hidden words after the title', async () => {
		const host = await render(true, false);
		const icon = host.querySelector('svg');
		assert.ok(icon);
		assert.equal(icon.getAttribute('aria-hidden'), 'true');
		const text = hiddenWords(host);
		assert.ok(text);
		assert.equal(text.getAttribute('aria-hidden'), null);
		const row = host.firstElementChild as HTMLElement;
		assert.equal(row.tagName, 'DIV');
		const title = row.firstElementChild as HTMLElement;
		assert.match(title.textContent ?? '', /^Page Properties\s+Section has errors$/);
		assert.equal(title.contains(text), true);
		const cue = icon.parentElement as HTMLElement;
		assert.equal(cue.tagName, 'SPAN');
		assert.equal(row.lastElementChild, cue);
		assert.equal(cue.textContent, '');
	});

	it('expanded and invalid: the hidden words stay, the icon goes, and no wrapper is left on the right', async () => {
		const host = await render(true, true);
		assert.equal(host.querySelector('svg'), null);
		const text = hiddenWords(host);
		assert.ok(text);
		const row = host.firstElementChild as HTMLElement;
		assert.equal(row.children.length, 1);
		assert.equal(row.firstElementChild?.contains(text), true);
	});
});
