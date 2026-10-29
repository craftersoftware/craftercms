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
 * Covers the label the field information dialog shows for a control type.
 * It uses the name already stored on the control descriptor, and the raw type
 * id when that name is missing. It does not render the dialog.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { controlTypeLabel } from './controlTypeLabel.ts';

const inputName = { id: 'control.input', defaultMessage: 'Input' };

describe('controlTypeLabel', () => {
	// A built-in control's descriptor name is what Type Builder shows, so the dialog should use that same value.
	it('uses the descriptor name for a known control', () => {
		assert.deepEqual(controlTypeLabel('input', { input: { name: inputName } }), inputName);
	});

	// A plugin or unknown type has no descriptor. The dialog shows the type id rather than a guessed name.
	it('falls back to the type id when no descriptor exists', () => {
		assert.equal(controlTypeLabel('my-plugin-control', { input: { name: inputName } }), 'my-plugin-control');
	});

	// An empty name is not a label. The type id is still the thing the author can recognise.
	it('falls back to the type id when the descriptor name is empty', () => {
		assert.equal(controlTypeLabel('input', { input: { name: '' } }), 'input');
	});
});
