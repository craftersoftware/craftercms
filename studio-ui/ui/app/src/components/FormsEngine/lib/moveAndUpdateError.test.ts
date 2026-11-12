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
import { isMoveAndUpdateForbidden, moveAndUpdateForbiddenDescriptor } from './moveAndUpdateError.ts';

describe('move_and_update 403', () => {
	it('names the target path instead of the generic Unauthorized message', () => {
		const denied = moveAndUpdateForbiddenDescriptor('/site/website/hello/index.xml');
		assert.equal(denied.values.path, '/site/website/hello/index.xml');
		assert.match(denied.descriptor.defaultMessage, /\{path\}/);
		assert.doesNotMatch(denied.descriptor.defaultMessage, /Unauthorized/);
	});

	it('matches only an AjaxError 403', () => {
		assert.equal(isMoveAndUpdateForbidden({ name: 'AjaxError', status: 403 }), true);
		assert.equal(isMoveAndUpdateForbidden({ name: 'AjaxError', status: 401 }), false);
		assert.equal(isMoveAndUpdateForbidden({ name: 'AjaxError', status: 500 }), false);
		assert.equal(isMoveAndUpdateForbidden(new Error('Unauthorized')), false);
		assert.equal(isMoveAndUpdateForbidden(null), false);
	});
});
