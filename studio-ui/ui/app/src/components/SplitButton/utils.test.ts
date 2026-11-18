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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../test/registerTsLoader.mjs';

const { indexOfOption, optionColor, planMenuPick, resolveSelectedIndex } = await import('./utils.ts');

// The shape every call site had before icons, colours and the controlled mode: MultiChoiceSaveButton
// (and CodeEditorDialog through it) and plugins using the public export.
const legacyOptions = [
	{ id: 'save', label: 'Save', callback: () => undefined },
	{ id: 'saveAndClose', label: 'Save & Close', callback: () => undefined },
	{ id: 'saveAndMinimize', label: 'Save & Minimize', callback: () => undefined }
];

describe('SplitButton selection', () => {
	it('starts on defaultSelected, or the first option when it is absent or unknown', () => {
		assert.equal(indexOfOption(legacyOptions, 'saveAndClose'), 1);
		assert.equal(indexOfOption(legacyOptions, undefined), 0);
		assert.equal(indexOfOption(legacyOptions, 'gone'), 0);
	});

	it('uses its own state when the parent passes no selectedId', () => {
		assert.equal(resolveSelectedIndex({ options: legacyOptions, stateIndex: 2 }), 2);
		assert.equal(resolveSelectedIndex({ options: legacyOptions, selectedId: undefined, stateIndex: 1 }), 1);
	});

	it('follows selectedId when the parent owns the selection, whatever the state says', () => {
		assert.equal(resolveSelectedIndex({ options: legacyOptions, selectedId: 'saveAndMinimize', stateIndex: 0 }), 2);
		assert.equal(resolveSelectedIndex({ options: legacyOptions, selectedId: 'gone', stateIndex: 2 }), 0);
	});
});

describe('SplitButton menu pick', () => {
	it('keeps the pick and persists it for an uncontrolled button with a storageKey, as before', () => {
		assert.deepEqual(planMenuPick({ controlled: false, storageKey: 'editor' }), {
			ignore: false,
			remember: true,
			persist: true
		});
	});

	it('keeps the pick but does not persist without a storageKey, as before', () => {
		assert.deepEqual(planMenuPick({ controlled: false }), { ignore: false, remember: true, persist: false });
	});

	it('leaves state and storage to the parent when controlled', () => {
		assert.deepEqual(planMenuPick({ controlled: true, storageKey: 'editor' }), {
			ignore: false,
			remember: false,
			persist: false
		});
	});

	it('ignores a pick that lands while the button is disabled or loading', () => {
		const ignored = { ignore: true, remember: false, persist: false };
		assert.deepEqual(planMenuPick({ controlled: false, storageKey: 'editor', loading: true }), ignored);
		assert.deepEqual(planMenuPick({ controlled: true, disabled: true }), ignored);
	});
});

describe('SplitButton option colour', () => {
	it('keeps the primary look for options without a colour', () => {
		for (const option of legacyOptions) assert.equal(optionColor(option), 'primary');
		assert.equal(optionColor(undefined), 'primary');
	});

	it('uses the option colour when it has one', () => {
		assert.equal(optionColor({ color: 'warning' }), 'warning');
	});
});
