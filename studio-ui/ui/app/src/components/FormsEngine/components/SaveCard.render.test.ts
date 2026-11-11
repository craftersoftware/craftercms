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
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { default: SaveCard } = await import('./SaveCard.tsx');

// jsdom has no font loading API. SaveCard listens to it to re-measure the pills.
Object.defineProperty(document, 'fonts', {
	configurable: true,
	value: { addEventListener() {}, removeEventListener() {}, ready: Promise.resolve() }
});

const intl = createTestIntl();

const reduxStore = configureStore({ reducer: { user: (state = { username: 'tester' }) => state } });

const notice = { copy: 'both', fileName: 'File Name', internalName: 'Internal Name' };
const internalOnly = { copy: 'internalName', fileName: 'File Name', internalName: 'Internal Name' };

function createAtoms(overrides: Record<string, unknown> = {}) {
	const values = {
		isSubmitting: false,
		versionComment: 'Updated',
		hasPendingChanges: true,
		closeAfterSave: false,
		minimizeAfterSave: false,
		saveAsDraft: false,
		...overrides
	};
	return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, atom(value)]));
}

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(props: Record<string, unknown> = {}, atomValues: Record<string, unknown> = {}) {
	const atoms = createAtoms(atomValues);
	const store = createStore();
	const onSave = [] as unknown[][];
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store: reduxStore },
				React.createElement(
					RawIntlProvider,
					{ value: intl as never },
					React.createElement(
						JotaiProvider,
						{ store },
						React.createElement(SaveCard, {
							isEmbedded: false,
							isStackedForm: false,
							isRepeatMode: false,
							atoms,
							onSave: async (...args: unknown[]) => {
								onSave.push(args.slice(1));
								return 'saved';
							},
							...props
						} as never)
					)
				)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return { host, store, atoms, onSave };
}

const mainButton = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('[aria-label="split button"] button');
const arrowButton = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[aria-label="select option"]');
/** The span that carries the tooltip. A disabled button emits no hover or focus, so the span does. */
const tipWrapper = (host: HTMLElement) => host.querySelector<HTMLElement>('[aria-label="split button"]')?.parentElement;
const pills = (host: HTMLElement) => Array.from(host.querySelectorAll<HTMLButtonElement>('button[value]'));

async function click(element: Element | null | undefined) {
	assert.ok(element, 'element to click');
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
	});
}

describe('SaveCard saving', () => {
	it('is enabled and shows Save for a valid form with a comment', async () => {
		const { host } = await render();
		assert.equal(mainButton(host)?.disabled, false);
		assert.match(mainButton(host)?.textContent ?? '', /^Save$/);
		assert.equal(tipWrapper(host)?.hasAttribute('tabindex'), false);
	});

	it('is disabled by an empty comment, with no tip while changes are pending', async () => {
		const { host } = await render({}, { versionComment: '' });
		assert.equal(mainButton(host)?.disabled, true);
		assert.equal(tipWrapper(host)?.getAttribute('title') ?? '', '');
		assert.equal(tipWrapper(host)?.hasAttribute('tabindex'), false);
	});

	it('says no changes only when the idle form is disabled, and makes the wrapper focusable', async () => {
		const { host } = await render({}, { versionComment: '', hasPendingChanges: false });
		assert.equal(mainButton(host)?.disabled, true);
		assert.equal(tipWrapper(host)?.getAttribute('title'), 'No changes detected');
		assert.equal(tipWrapper(host)?.getAttribute('tabindex'), '0');
	});

	it('main click asks for an automatic draft decision', async () => {
		const { host, onSave } = await render();
		await click(mainButton(host));
		assert.deepEqual(onSave, [['auto']]);
	});
});

describe('SaveCard minimum requirements', () => {
	it('disables the main button and the draft menu, and names the missing fields', async () => {
		const { host } = await render({ minimumRequirements: notice });
		assert.equal(mainButton(host)?.disabled, true);
		assert.equal(arrowButton(host)?.disabled, true);
		assert.equal(tipWrapper(host)?.getAttribute('title'), 'File Name and Internal Name are required to save');
		assert.equal(tipWrapper(host)?.getAttribute('tabindex'), '0');
	});

	it('names only the internal name when that is all that is missing', async () => {
		const { host } = await render({ minimumRequirements: internalOnly, isEmbedded: true, isStackedForm: true });
		assert.equal(mainButton(host)?.disabled, true);
		assert.equal(tipWrapper(host)?.getAttribute('title'), 'Internal Name is required to save');
	});

	it('uses the content type names, whatever they are called', async () => {
		const { host } = await render({
			minimumRequirements: { copy: 'fileName', fileName: 'Apple', internalName: 'Orange' }
		});
		assert.equal(tipWrapper(host)?.getAttribute('title'), 'Apple is required to save');
	});

	it('explains the minimum requirements ahead of "No changes detected"', async () => {
		const { host } = await render({ minimumRequirements: notice }, { versionComment: '', hasPendingChanges: false });
		assert.equal(tipWrapper(host)?.getAttribute('title'), 'File Name and Internal Name are required to save');
	});

	it('explains the minimum requirements for an edited form that has a comment', async () => {
		const { host } = await render({ minimumRequirements: notice });
		assert.equal(tipWrapper(host)?.getAttribute('title'), 'File Name and Internal Name are required to save');
	});

	it('stays quiet while a save is running', async () => {
		const { host } = await render({ minimumRequirements: notice }, { isSubmitting: true });
		assert.equal(tipWrapper(host)?.getAttribute('title') ?? '', '');
	});

	it('does not block anything for a repeat item, which gets no requirements', async () => {
		const { host } = await render({ isRepeatMode: true });
		assert.equal(mainButton(host)?.disabled, false);
		assert.match(mainButton(host)?.textContent ?? '', /^Done$/);
	});
});

describe('SaveCard Save and… options', () => {
	it('shows Stay, Minimize and Close with Stay selected', async () => {
		const { host } = await render();
		assert.deepEqual(
			pills(host).map((pill) => [pill.value, pill.getAttribute('aria-pressed')]),
			[
				['stay', 'true'],
				['minimize', 'false'],
				['close', 'false']
			]
		);
		assert.match(host.textContent ?? '', /Save and…/);
	});

	it('records the pick as one choice at a time', async () => {
		const { host, store, atoms } = await render();
		await click(pills(host).find((pill) => pill.value === 'close'));
		assert.equal(store.get(atoms.closeAfterSave as never), true);
		assert.equal(store.get(atoms.minimizeAfterSave as never), false);
		await click(pills(host).find((pill) => pill.value === 'minimize'));
		assert.equal(store.get(atoms.closeAfterSave as never), false);
		assert.equal(store.get(atoms.minimizeAfterSave as never), true);
	});

	it('keeps the current choice when the active pill is clicked again', async () => {
		const { host, store, atoms } = await render({}, { closeAfterSave: true });
		await click(pills(host).find((pill) => pill.value === 'close'));
		assert.equal(store.get(atoms.closeAfterSave as never), true);
	});

	it('stays available while the minimum requirements are missing, since the choice changes nothing yet', async () => {
		const { host, store, atoms } = await render({ minimumRequirements: notice });
		assert.equal(pills(host).length, 3);
		assert.ok(pills(host).every((pill) => !pill.disabled));
		await click(pills(host).find((pill) => pill.value === 'minimize'));
		assert.equal(store.get(atoms.minimizeAfterSave as never), true);
	});

	it('is not offered for embedded forms or repeat items', async () => {
		assert.equal(pills((await render({ isEmbedded: true })).host).length, 0);
		assert.equal(pills((await render({ isRepeatMode: true })).host).length, 0);
	});
});

describe('SaveCard draft option', () => {
	it('shows Save Draft when the form has validation errors', async () => {
		const { host } = await render({ validationErrorCount: 2 });
		assert.match(mainButton(host)?.textContent ?? '', /Save Draft/);
	});

	it('shows the remembered choice when the form is valid', async () => {
		assert.match(
			(await render({}, { saveAsDraft: true })).host.querySelector('[aria-label="split button"] button')?.textContent ??
				'',
			/Save Draft/
		);
		assert.match(
			(await render()).host.querySelector('[aria-label="split button"] button')?.textContent ?? '',
			/^Save$/
		);
	});

	it('uses the Done wording for repeat and stacked embedded forms', async () => {
		const repeat = await render({ isRepeatMode: true, validationErrorCount: 1 });
		assert.match(mainButton(repeat.host)?.textContent ?? '', /Done \(Draft\)/);
		const stacked = await render({ isEmbedded: true, isStackedForm: true });
		assert.match(mainButton(stacked.host)?.textContent ?? '', /^Done$/);
	});

	it('remembers a menu pick and saves with it', async () => {
		const { host, store, atoms, onSave } = await render();
		await click(arrowButton(host));
		const items = Array.from(host.querySelectorAll<HTMLElement>('[role="menuitem"]'));
		assert.deepEqual(
			items.map((item) => item.textContent),
			['Save', 'Save Draft']
		);
		await click(items[1]);
		assert.equal(store.get(atoms.saveAsDraft as never), true);
		assert.deepEqual(onSave, [[true]]);
		assert.match(mainButton(host)?.textContent ?? '', /Save Draft/);
	});

	it('remembers an explicit Save pick as not a draft', async () => {
		const { host, store, atoms, onSave } = await render({}, { saveAsDraft: true });
		await click(arrowButton(host));
		const items = Array.from(host.querySelectorAll<HTMLElement>('[role="menuitem"]'));
		await click(items[0]);
		assert.equal(store.get(atoms.saveAsDraft as never), false);
		assert.deepEqual(onSave, [[false]]);
	});
});
