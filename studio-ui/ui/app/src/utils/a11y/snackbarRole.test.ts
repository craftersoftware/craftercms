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
import test from 'node:test';
import { applySnackbarLiveRole, snackbarLiveRole } from './snackbarRole.ts';

test('snackbarLiveRole maps urgent variants to alert and the rest to status', () => {
	assert.equal(snackbarLiveRole('error'), 'alert');
	assert.equal(snackbarLiveRole('warning'), 'alert');
	assert.equal(snackbarLiveRole('success'), 'status');
	assert.equal(snackbarLiveRole('info'), 'status');
	assert.equal(snackbarLiveRole('default'), 'status');
	assert.equal(snackbarLiveRole(undefined), 'status');
});

test('applySnackbarLiveRole writes role, live, and atomic on the element', () => {
	const element = {
		attrs: {} as Record<string, string>,
		setAttribute(name: string, value: string) {
			this.attrs[name] = value;
		}
	};
	applySnackbarLiveRole(element as unknown as HTMLElement, 'success');
	assert.deepEqual(element.attrs, { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
	applySnackbarLiveRole(element as unknown as HTMLElement, 'error');
	assert.equal(element.attrs.role, 'alert');
	assert.equal(element.attrs['aria-live'], 'assertive');
});
