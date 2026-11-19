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
 * A collapsible dashlet with headerAction and no title still renders a toggle. The visible title names
 * that button when there is one. Without a title the button needs its own accessible name.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it } from 'node:test';
import { createTestIntl } from '../../../test/createTestIntl.mjs';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { DashletCard } = await import('./DashletCard.tsx');

const intl = createTestIntl();
const esMessages = JSON.parse(readFileSync(new URL('../../translations/es.json', import.meta.url), 'utf8'));
const esIntl = createTestIntl({ locale: 'es', messages: esMessages });

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function render(props: Record<string, unknown>, value = intl) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value },
				React.createElement(
					DashletCard,
					{ headerAction: React.createElement('span', null, 'Refresh'), ...props },
					'Body'
				)
			)
		);
	});
	return host;
}

function toggle(host: HTMLElement) {
	return host.querySelector<HTMLButtonElement>('button[aria-expanded]');
}

describe('dashlet header toggle name', () => {
	it('names a title-less toggle and keeps that name when collapsed', async () => {
		const host = await render({});
		const button = toggle(host);
		assert.ok(button, 'title-less toggle');
		assert.equal(button.getAttribute('aria-label'), 'Toggle section');
		assert.equal(button.textContent, '');
		assert.equal(button.getAttribute('aria-expanded'), 'true');
		await act(async () => {
			button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		});
		assert.equal(button.getAttribute('aria-expanded'), 'false');
		assert.equal(button.getAttribute('aria-label'), 'Toggle section');
	});

	it('uses the Spanish catalog for the title-less toggle', async () => {
		const host = await render({}, esIntl);
		assert.equal(toggle(host)?.getAttribute('aria-label'), 'Alternar sección');
	});

	it('names a whitespace title with the toggle label', async () => {
		const host = await render({ title: '   ' });
		const button = toggle(host);
		assert.equal(button?.getAttribute('aria-label'), 'Toggle section');
		assert.equal(button?.textContent?.trim(), '');
	});

	it('keeps the visible string title as the name', async () => {
		const host = await render({ title: 'Activity' });
		const button = toggle(host);
		assert.ok(button);
		assert.equal(button.textContent, 'Activity');
		assert.equal(button.hasAttribute('aria-label'), false);
	});

	it('keeps a visible element title as the name', async () => {
		const host = await render({ title: React.createElement('span', null, 'Activity') });
		const button = toggle(host);
		assert.ok(button);
		assert.equal(button.textContent, 'Activity');
		assert.equal(button.hasAttribute('aria-label'), false);
	});
});
