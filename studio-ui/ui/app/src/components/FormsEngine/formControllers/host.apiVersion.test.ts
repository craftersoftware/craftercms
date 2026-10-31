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
 * The form-controller host publishes the contract integer, the same way the control and data-source hosts do.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';

const { FORM_CONTROLLER_API_VERSION } = await import('./types.ts');
const { formsEngineFormControllersHost } = await import('./host.ts');

describe('formsEngineFormControllersHost.apiVersion', () => {
	it('exposes the current contract', () => {
		assert.equal(FORM_CONTROLLER_API_VERSION, 1);
		assert.equal(formsEngineFormControllersHost.apiVersion, FORM_CONTROLLER_API_VERSION);
	});
});
