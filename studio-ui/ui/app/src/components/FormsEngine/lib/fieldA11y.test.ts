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

/** The attributes a control spreads, and that their ids match the helper text the field renders. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';

const { fieldControlA11y, fieldDescriptionId, fieldErrorId } = await import('./fieldA11y.ts');

describe('field control a11y', () => {
	it('sets nothing on a valid, optional field without a description', () => {
		assert.deepEqual(fieldControlA11y({ controlId: 'c', hasDescription: false, invalid: false, required: false }), {
			'aria-describedby': undefined,
			'aria-invalid': undefined,
			'aria-required': undefined
		});
	});

	it('points at the description, then the error, with the ids the field renders', () => {
		const a11y = fieldControlA11y({ controlId: 'c', hasDescription: true, invalid: true, required: true });
		assert.equal(a11y['aria-describedby'], `${fieldDescriptionId('c')} ${fieldErrorId('c')}`);
		assert.equal(a11y['aria-invalid'], true);
		assert.equal(a11y['aria-required'], true);
	});

	it('drops the error id once the field is valid', () => {
		const a11y = fieldControlA11y({ controlId: 'c', hasDescription: true, invalid: false, required: true });
		assert.equal(a11y['aria-describedby'], fieldDescriptionId('c'));
		assert.equal(a11y['aria-invalid'], undefined);
	});
});
