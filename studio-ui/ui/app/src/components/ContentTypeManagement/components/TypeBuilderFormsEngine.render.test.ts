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
import { afterEach, beforeEach, describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { TypeBuilderFormsEngine } = await import('./TypeBuilderFormsEngine.tsx');
const {
	createStableFormContextProps,
	createVirtualSection,
	createVirtualTypeForDataSource,
	createVirtualTypeForField
} = await import('../utils.ts');
const { createVirtualTypeFormContext } = await import('../utils.ts');
const { inputDescriptor } = await import('../descriptors/controls/input.ts');
const { dataSourceDescriptors } = await import('../descriptors/dataSources/index.ts');

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

const reduxStore = configureStore({
	reducer: {
		user: (state = { username: 'tester' }) => state,
		sites: (state = { active: 'test-site', byId: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state,
		content: (state = { itemsByPath: {} }) => state
	}
});

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
let consoleErrors: string[] = [];
let consoleWarnings: string[] = [];
let originalConsoleError: typeof console.error;
let originalConsoleWarn: typeof console.warn;

beforeEach(() => {
	consoleErrors = [];
	consoleWarnings = [];
	originalConsoleError = console.error;
	originalConsoleWarn = console.warn;
	console.error = (...args: unknown[]) => {
		consoleErrors.push(args.map(String).join(' '));
	};
	console.warn = (...args: unknown[]) => {
		consoleWarnings.push(args.map(String).join(' '));
	};
});

afterEach(async () => {
	console.error = originalConsoleError;
	console.warn = originalConsoleWarn;
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
	// Any error React or a control logs, such as a duplicate key or a failed render, fails the test.
	assert.deepEqual(consoleErrors, [], 'unexpected console.error output');
});

type TestType = ReturnType<typeof createType>;

function createType(sections: Array<{ id?: string; title: string }>) {
	return {
		id: '/component/test',
		name: 'Test',
		fields: {},
		dataSources: [],
		sections: sections.map((section) => createVirtualSection({ ...section, fields: [], expandByDefault: false }))
	} as never as ReturnType<typeof createVirtualTypeForField>;
}

async function render(virtualType: TestType, stableFormContext = createStableFormContextProps({ type: virtualType })) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	const draw = () =>
		act(async () => {
			root.render(
				React.createElement(
					Provider,
					{ store: reduxStore },
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
				)
			);
		});
	await draw();
	mounted.push({ unmount: () => root.unmount(), host });
	return { host, redraw: draw };
}

const summaries = (host: HTMLElement) => Array.from(host.querySelectorAll<HTMLElement>('[data-section-id]'));
const accordionOf = (summary: HTMLElement) => summary.closest('.MuiAccordion-root');
const isExpanded = (summary: HTMLElement) => summary.getAttribute('aria-expanded') === 'true';
const titles = (host: HTMLElement) => summaries(host).map((summary) => summary.textContent);

async function click(element: Element) {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
	});
}

function virtualTypeFor(kind: 'field' | 'dataSource', descriptor: Parameters<typeof createVirtualTypeForField>[0]) {
	const virtualType =
		kind === 'field'
			? createVirtualTypeForField(descriptor, intl.formatMessage as never)
			: createVirtualTypeForDataSource(descriptor, intl.formatMessage as never);
	const stableFormContext = createVirtualTypeFormContext(virtualType, {}, {}, {});
	return { virtualType, stableFormContext };
}

describe('TypeBuilderFormsEngine section accordions', () => {
	it('expands and collapses same-titled sections independently', async () => {
		const type = createType([
			{ id: 'section-a', title: 'Details' },
			{ id: 'section-b', title: 'Details' }
		]);
		const view = await render(type);
		assert.deepEqual(titles(view.host), ['Details', 'Details']);
		assert.deepEqual(summaries(view.host).map(isExpanded), [false, false]);

		await click(summaries(view.host)[0]);
		assert.deepEqual(summaries(view.host).map(isExpanded), [true, false]);

		await click(summaries(view.host)[1]);
		await click(summaries(view.host)[0]);
		assert.deepEqual(summaries(view.host).map(isExpanded), [false, true]);
	});

	it('keeps a section mounted and expanded when it is renamed', async () => {
		const type = createType([
			{ id: 'section-a', title: 'Details' },
			{ id: 'section-b', title: 'Other' }
		]);
		const view = await render(type);
		await click(summaries(view.host)[0]);
		const accordionBefore = accordionOf(summaries(view.host)[0]);
		assert.ok(accordionBefore);
		assert.equal(isExpanded(summaries(view.host)[0]), true);

		type.sections[0].title = 'Renamed';
		await view.redraw();

		const summary = summaries(view.host)[0];
		assert.equal(summary.textContent, 'Renamed');
		assert.ok(accordionOf(summary) === accordionBefore, 'the accordion element is reused');
		assert.equal(accordionBefore.isConnected, true);
		assert.equal(isExpanded(summary), true);
	});

	it('keeps the surviving sections mounted, with their expanded state, when sections are reordered', async () => {
		const type = createType([
			{ id: 'section-a', title: 'A' },
			{ id: 'section-b', title: 'B' },
			{ id: 'section-c', title: 'C' }
		]);
		const view = await render(type);
		await click(summaries(view.host)[2]);
		const before = Object.fromEntries(
			summaries(view.host).map((summary) => [summary.textContent, accordionOf(summary)])
		);

		type.sections.reverse();
		await view.redraw();

		assert.deepEqual(titles(view.host), ['C', 'B', 'A']);
		assert.deepEqual(summaries(view.host).map(isExpanded), [true, false, false]);
		for (const summary of summaries(view.host)) {
			assert.ok(accordionOf(summary) === before[summary.textContent as string], `${summary.textContent} was reused`);
		}
	});

	it('keeps the surviving sections mounted when a section is deleted', async () => {
		const type = createType([
			{ id: 'section-a', title: 'Details' },
			{ id: 'section-b', title: 'Details' },
			{ id: 'section-c', title: 'Details' }
		]);
		const view = await render(type);
		await click(summaries(view.host)[2]);
		const [first, , third] = summaries(view.host).map(accordionOf);

		type.sections.splice(1, 1);
		await view.redraw();

		const remaining = summaries(view.host);
		assert.equal(remaining.length, 2);
		assert.ok(accordionOf(remaining[0]) === first, 'the first section was reused');
		assert.ok(accordionOf(remaining[1]) === third, 'the third section was reused');
		assert.deepEqual(remaining.map(isExpanded), [false, true]);
	});

	it('renders a section without an id and warns once per type', async () => {
		const withoutId = (title: string) => {
			const type = createType([{ title }]);
			delete (type.sections[0] as { id?: string }).id;
			return type;
		};
		const first = withoutId('First');
		const view = await render(first);
		assert.equal(view.host.querySelectorAll('.MuiAccordion-root').length, 1);
		await view.redraw();
		assert.equal(consoleWarnings.length, 1);

		await render(withoutId('Second'));
		assert.equal(consoleWarnings.length, 2);
	});
});

describe('TypeBuilderFormsEngine with descriptor-derived virtual types', () => {
	it('renders one accordion per section of a field panel, each with its own expanded state', async () => {
		const { virtualType, stableFormContext } = virtualTypeFor('field', inputDescriptor);
		const view = await render(virtualType, stableFormContext);

		assert.ok(virtualType.sections.length > 1);
		assert.equal(summaries(view.host).length, virtualType.sections.length);
		assert.equal(new Set(virtualType.sections.map((section) => section.id)).size, virtualType.sections.length);
		assert.deepEqual(
			titles(view.host),
			virtualType.sections.map((section) => section.title)
		);

		const expandedBefore = summaries(view.host).map(isExpanded);
		const lastIndex = summaries(view.host).length - 1;
		await click(summaries(view.host)[lastIndex]);
		const expandedAfter = summaries(view.host).map(isExpanded);
		expandedAfter.forEach((expanded, index) => {
			assert.equal(expanded, index === lastIndex ? !expandedBefore[index] : expandedBefore[index], `section ${index}`);
		});
	});

	it('renders one accordion per section of a data source panel', async () => {
		const { virtualType, stableFormContext } = virtualTypeFor('dataSource', dataSourceDescriptors.pages);
		const view = await render(virtualType, stableFormContext);

		assert.ok(virtualType.sections.length > 1);
		assert.equal(summaries(view.host).length, virtualType.sections.length);
		assert.deepEqual(
			titles(view.host),
			virtualType.sections.map((section) => section.title)
		);
	});
});
