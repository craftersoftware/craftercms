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
 * The shown-types options paint a radio, but the option text is the name and aria-selected is the state.
 * A real radio inside the option is an unnamed nested control.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { DependenciesDialogUI } = await import('./DependenciesDialogUI.tsx');
const { accessibleName } = await import('../../../test/accessibleName.ts');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const store = configureStore({
	reducer: {
		sites: (state = { active: 'editorial' }) => state
	}
});

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function render() {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(DependenciesDialogUI, {
						dependencies: [],
						item: {
							path: '/site/website/index.xml',
							label: 'Home',
							systemType: 'page',
							stateMap: { live: false, staged: false }
						},
						rootPath: '/site/website',
						setItem() {},
						compactView: false,
						setCompactView() {},
						showTypes: 'all-deps',
						setShowTypes() {},
						dependenciesShown: 'depends-on',
						setDependenciesShown() {},
						isEditableItem() {
							return false;
						},
						handleEditorDisplay() {},
						handleHistoryDisplay() {},
						contextMenu: null,
						error: null,
						handleContextMenuClick() {},
						handleContextMenuClose() {}
					})
				)
			)
		);
	});
	return host;
}

describe('dependencies type filter options', () => {
	it('names the listbox and keeps each option radio presentational, with aria-selected on the option', async () => {
		const host = await render();
		const combobox = [...host.querySelectorAll<HTMLElement>('[role="combobox"]')].find(
			(node) => accessibleName(node) === 'Reference type'
		);
		assert.ok(combobox, 'the reference type combobox is missing');
		await act(async () => {
			combobox.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
		});
		const listbox = document.querySelector<HTMLElement>('[role="listbox"]');
		assert.ok(listbox, 'the reference type listbox did not open');
		assert.equal(accessibleName(listbox), 'Reference type');
		const radios = [...listbox.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
		assert.equal(radios.length, 4, 'each type option still paints a radio');
		for (const radio of radios) {
			assert.ok(radio.closest('[aria-hidden="true"]'), 'a type option radio is exposed inside the listbox');
			assert.equal(radio.tabIndex, -1);
		}
		const options = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')];
		const selected = options.filter((option) => option.getAttribute('aria-selected') === 'true');
		assert.equal(selected.length, 1, 'one option is selected');
		assert.match(selected[0].textContent ?? '', /Show all references/);
		assert.equal(
			options.filter((option) => option.getAttribute('aria-selected') === 'false').length,
			options.length - 1
		);
	});
});
