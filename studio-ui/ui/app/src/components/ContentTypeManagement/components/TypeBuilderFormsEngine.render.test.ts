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

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { TypeBuilderFormsEngine } = await import('./TypeBuilderFormsEngine.tsx');
const { createStableFormContextProps, createVirtualSection } = await import('../utils.ts');

// jsdom does not implement Element.scroll, which the panel calls whenever its type changes.
window.HTMLElement.prototype.scroll = () => {};

// The app build gives every message an id. Without that transform, use the default message as its own id.
const baseIntl = createIntl({ locale: 'en', messages: {}, onError() {} });
const intl = {
	...baseIntl,
	formatMessage: (descriptor: { id?: string; defaultMessage?: string }, values?: Record<string, unknown>) =>
		baseIntl.formatMessage(
			{ ...descriptor, id: descriptor.id ?? String(descriptor.defaultMessage) } as never,
			values as never
		)
};

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

function createType(sections: Array<{ id?: string; title: string }>) {
	return {
		id: '/component/test',
		name: 'Test',
		fields: {},
		dataSources: [],
		sections: sections.map((section) => createVirtualSection({ ...section, fields: [], expandByDefault: false }))
	} as never;
}

async function render(virtualType: ReturnType<typeof createType>) {
	const stableFormContext = createStableFormContextProps({ type: virtualType });
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	const draw = () =>
		act(async () => {
			root.render(
				React.createElement(
					RawIntlProvider,
					{ value: intl as never },
					React.createElement(TypeBuilderFormsEngine, {
						virtualType,
						type: virtualType,
						stableFormContext,
						formApiContext: {},
						onClose() {}
					} as never)
				)
			);
		});
	await draw();
	mounted.push({ unmount: () => root.unmount(), host });
	return { host, redraw: draw };
}

const summaries = (host: HTMLElement) => Array.from(host.querySelectorAll<HTMLElement>('[data-section-id]'));
const isExpanded = (summary: HTMLElement) => summary.getAttribute('aria-expanded') === 'true';

async function click(element: Element) {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
	});
}

async function withConsoleErrors<T>(run: () => Promise<T>) {
	const errors: string[] = [];
	const original = console.error;
	console.error = (...args: unknown[]) => {
		errors.push(args.map(String).join(' '));
	};
	try {
		const result = await run();
		return { result, errors };
	} finally {
		console.error = original;
	}
}

describe('TypeBuilderFormsEngine section accordions', () => {
	it('renders same-titled sections without a duplicate key warning and expands them independently', async () => {
		const type = createType([
			{ id: 'section-a', title: 'Details' },
			{ id: 'section-b', title: 'Details' }
		]);
		const { result: view, errors } = await withConsoleErrors(() => render(type));
		const keyWarnings = errors.filter((message) => /same key|unique "key"/.test(message));
		assert.deepEqual(keyWarnings, []);

		const [first, second] = summaries(view.host);
		assert.equal(summaries(view.host).length, 2);
		assert.equal(isExpanded(first), false);
		assert.equal(isExpanded(second), false);

		await click(first);
		assert.equal(isExpanded(summaries(view.host)[0]), true);
		assert.equal(isExpanded(summaries(view.host)[1]), false);

		await click(summaries(view.host)[1]);
		await click(summaries(view.host)[0]);
		assert.equal(isExpanded(summaries(view.host)[0]), false);
		assert.equal(isExpanded(summaries(view.host)[1]), true);
	});

	it('keeps a section mounted and expanded when it is renamed', async () => {
		const type = createType([
			{ id: 'section-a', title: 'Details' },
			{ id: 'section-b', title: 'Other' }
		]);
		const view = await render(type);
		await click(summaries(view.host)[0]);
		const accordionBefore = summaries(view.host)[0].closest('.MuiAccordion-root');
		assert.ok(accordionBefore);
		assert.equal(isExpanded(summaries(view.host)[0]), true);

		type.sections[0].title = 'Renamed';
		await view.redraw();

		const summary = summaries(view.host)[0];
		assert.equal(summary.textContent, 'Renamed');
		assert.ok(summary.closest('.MuiAccordion-root') === accordionBefore, 'the accordion element is reused');
		assert.equal(accordionBefore.isConnected, true);
		assert.equal(isExpanded(summary), true);
	});
});
