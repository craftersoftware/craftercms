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
 * The public form-controller host does not expose load, getCached or clearCache. The helpers stay reachable
 * under the undocumented __internal key for tests and console debugging.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';

const { formsEngineFormControllersHost } = await import('./host.ts');
const { loadFormController, getCachedFormController, clearFormControllerCache } = await import('./loader.ts');

describe('formsEngineFormControllersHost', () => {
	it('does not expose load, getCached or clearCache on the public host', () => {
		for (const key of ['load', 'getCached', 'clearCache']) {
			assert.equal(key in formsEngineFormControllersHost, false, key);
		}
	});

	it('keeps the helpers under __internal', () => {
		const { __internal } = formsEngineFormControllersHost;
		assert.equal(__internal.load, loadFormController);
		assert.equal(__internal.getCached, getCachedFormController);
		assert.equal(__internal.clearCache, clearFormControllerCache);
	});

	it('clears the session cache through __internal', () => {
		const { __internal } = formsEngineFormControllersHost;
		assert.equal(__internal.getCached('editorial', 'never-loaded'), undefined);
		__internal.clearCache('editorial', 'never-loaded');
		assert.equal(__internal.getCached('editorial', 'never-loaded'), undefined);
	});
});
