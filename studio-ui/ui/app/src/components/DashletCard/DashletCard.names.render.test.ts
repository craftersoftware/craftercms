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

async function render(props: Record<string, unknown>, value = intl, parent: HTMLElement = document.body) {
	const host = document.createElement('div');
	parent.appendChild(host);
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

	it('keeps a numeric title, 0 included, as the name', async () => {
		for (const title of [0, 7]) {
			const host = await render({ title });
			const button = toggle(host);
			assert.ok(button);
			assert.equal(button.textContent, String(title));
			assert.equal(button.hasAttribute('aria-label'), false, `title={${title}}`);
		}
	});

	it('names the toggle when the title renders no text', async () => {
		for (const [label, title] of [
			['true', true],
			['<span />', React.createElement('span')],
			['<span>{false}</span>', React.createElement('span', null, false)],
			['empty fragment', React.createElement(React.Fragment)]
		] as const) {
			const host = await render({ title });
			const button = toggle(host);
			assert.ok(button, label);
			assert.equal(button.textContent, '', label);
			assert.equal(button.getAttribute('aria-label'), 'Toggle section', label);
		}
	});

	it('keeps a component title, which renders its own text, as the name', async () => {
		function Title() {
			return React.createElement('span', null, 'Activity');
		}
		const host = await render({ title: React.createElement(Title) });
		const button = toggle(host);
		assert.ok(button);
		assert.equal(button.textContent, 'Activity');
		assert.equal(button.hasAttribute('aria-label'), false);
	});
	it('names the toggle when a component title renders null', async () => {
		function Empty() {
			return null;
		}
		const host = await render({ title: React.createElement(Empty) });
		const button = toggle(host);
		assert.ok(button);
		assert.equal(button.textContent, '');
		assert.equal(button.getAttribute('aria-label'), 'Toggle section');
	});

	it('follows a component title that loads and clears its own text', async () => {
		let setText: (text: string | null) => void = () => {};
		function Loading() {
			const [text, set] = React.useState<string | null>(null);
			setText = set;
			return text === null ? null : React.createElement('span', null, text);
		}
		const host = await render({ title: React.createElement(Loading) });
		const button = toggle(host);
		assert.ok(button);
		assert.equal(button.getAttribute('aria-label'), 'Toggle section');
		await act(async () => setText('Activity'));
		assert.equal(button.textContent, 'Activity');
		assert.equal(button.hasAttribute('aria-label'), false);
		await act(async () => setText(null));
		assert.equal(button.getAttribute('aria-label'), 'Toggle section');
	});

	it('renders the header for title={0} without a headerAction', async () => {
		const host = await render({ title: 0, headerAction: undefined });
		const button = toggle(host);
		assert.ok(button, 'header toggle for title 0');
		assert.equal(button.textContent, '0');
		assert.equal(button.hasAttribute('aria-label'), false);
	});

	it('renders the header for a component title with false children and no headerAction', async () => {
		function Title(props: { children?: React.ReactNode }) {
			return React.createElement('span', null, 'Activity', props.children);
		}
		const host = await render({ title: React.createElement(Title, null, false), headerAction: undefined });
		const button = toggle(host);
		assert.ok(button, 'header toggle for <Title>{false}</Title>');
		assert.equal(button.textContent, 'Activity');
		assert.equal(button.hasAttribute('aria-label'), false);
	});

	it('names the toggle when the title text is display: none or visibility: hidden', async () => {
		for (const [label, style] of [
			['display: none', { display: 'none' }],
			['visibility: hidden', { visibility: 'hidden' }]
		] as const) {
			const host = await render({ title: React.createElement('span', { style }, 'Activity') });
			const button = toggle(host);
			assert.ok(button, label);
			assert.equal(button.getAttribute('aria-label'), 'Toggle section', label);
		}
	});

	it('keeps visually hidden (clipped) title text as the name', async () => {
		const clipped = {
			position: 'absolute',
			width: '1px',
			height: '1px',
			overflow: 'hidden',
			clip: 'rect(0 0 0 0)',
			whiteSpace: 'nowrap'
		};
		const host = await render({ title: React.createElement('span', { style: clipped }, 'Activity') });
		const button = toggle(host);
		assert.ok(button);
		assert.equal(button.hasAttribute('aria-label'), false);
	});

	it('follows a title whose style hides and shows it again', async () => {
		const host = await render({ title: React.createElement('span', { id: 'title' }, 'Activity') });
		const button = toggle(host);
		assert.ok(button);
		const title = host.querySelector<HTMLElement>('#title');
		assert.ok(title);
		assert.equal(button.hasAttribute('aria-label'), false);
		await act(async () => title.setAttribute('style', 'display: none'));
		assert.equal(button.getAttribute('aria-label'), 'Toggle section');
		await act(async () => title.removeAttribute('style'));
		assert.equal(button.hasAttribute('aria-label'), false);
	});

	it('keeps the title as the name while the card sits in a visibility: hidden ancestor', async () => {
		const wrapper = document.createElement('div');
		wrapper.style.visibility = 'hidden';
		document.body.appendChild(wrapper);
		try {
			const host = await render({ title: 'Activity' }, intl, wrapper);
			const button = toggle(host);
			assert.ok(button);
			assert.equal(button.hasAttribute('aria-label'), false, 'hidden ancestor');
			wrapper.style.visibility = '';
			assert.equal(button.hasAttribute('aria-label'), false, 'ancestor shown again');
		} finally {
			wrapper.remove();
		}
	});

	it('keeps a hidden label referenced through aria-labelledby as the name', async () => {
		const title = React.createElement(
			React.Fragment,
			null,
			React.createElement('span', { role: 'img', 'aria-labelledby': 'activity-label' }),
			React.createElement('span', { id: 'activity-label', style: { display: 'none' } }, 'Activity')
		);
		const host = await render({ title });
		const button = toggle(host);
		assert.ok(button);
		assert.equal(button.hasAttribute('aria-label'), false);
	});

	it('names the toggle when aria-labelledby points at nothing', async () => {
		const host = await render({
			title: React.createElement('span', { role: 'img', 'aria-labelledby': 'missing-label' })
		});
		assert.equal(toggle(host)?.getAttribute('aria-label'), 'Toggle section');
	});

	it('names the toggle when the title text is aria-hidden', async () => {
		const host = await render({ title: React.createElement('span', { 'aria-hidden': 'true' }, 'Activity') });
		const button = toggle(host);
		assert.ok(button);
		assert.equal(button.getAttribute('aria-label'), 'Toggle section');
	});

	it('follows a title that is hidden and shown again', async () => {
		const host = await render({ title: React.createElement('span', { id: 'title' }, 'Activity') });
		const button = toggle(host);
		assert.ok(button);
		const title = host.querySelector('#title');
		assert.ok(title);
		assert.equal(button.hasAttribute('aria-label'), false);
		await act(async () => title.setAttribute('aria-hidden', 'true'));
		assert.equal(button.getAttribute('aria-label'), 'Toggle section');
		await act(async () => title.removeAttribute('aria-hidden'));
		assert.equal(button.hasAttribute('aria-label'), false);
	});
});
