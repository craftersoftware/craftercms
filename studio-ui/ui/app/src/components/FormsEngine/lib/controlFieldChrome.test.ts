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
 * Plugin controls are wrapped in FormsEngineField by default. A contribution opts out with fieldChrome: false.
 * The load-error placeholder never gets the host wrapper because it wraps itself.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';
import type { ComponentType } from 'react';
import type { AnyValue } from '../types';
import type PluginDescriptor from '../../../models/PluginDescriptor';

const { registerPlugin } = await import('../../../services/plugin.ts');
const { getRegisteredControlContribution } = await import('../controls/registry.ts');
const { toLoadedControlPlugin } = await import('./controlPluginLoader.ts');

const source = { site: 'editorial', type: 'control', name: 'example', file: 'index.js' };
const Control = (() => null) as ComponentType<AnyValue>;
const ErrorPlaceholder = (() => null) as ComponentType<AnyValue>;
const url = '/studio/api/2/plugin/file?type=control&name=example&filename=index.js';

function register(id: string, typeKey: string, entry: Record<string, unknown> = {}) {
	registerPlugin({ id, controls: { [typeKey]: { Component: Control, ...entry } } } as PluginDescriptor, source);
	return getRegisteredControlContribution(typeKey);
}

describe('control contribution fieldChrome', () => {
	it('stores fieldChrome and fieldSx from the contribution', () => {
		const fieldSx = { mt: 2 };
		const registered = register('org.example.chrome-opt-out', 'chrome-opt-out', { fieldChrome: false, fieldSx });
		assert.equal(registered?.fieldChrome, false);
		assert.equal(registered?.fieldSx, fieldSx);
	});

	it('leaves fieldChrome unset when omitted', () => {
		assert.equal(register('org.example.chrome-default', 'chrome-default')?.fieldChrome, undefined);
	});

	it('refuses a fieldChrome that is not a boolean, before any registry write', () => {
		assert.throws(
			() => register('org.example.chrome-bad', 'chrome-bad', { fieldChrome: 'no' }),
			(error: unknown) => {
				assert.ok(error instanceof TypeError);
				assert.match((error as Error).message, /org\.example\.chrome-bad/);
				assert.match((error as Error).message, /chrome-bad/);
				assert.match((error as Error).message, /fieldChrome must be a boolean/);
				return true;
			}
		);
		assert.equal(getRegisteredControlContribution('chrome-bad'), undefined);
	});
});

describe('loaded control plugin', () => {
	it('wraps by default and carries the wrapper sx', () => {
		const fieldSx = { mt: 1 };
		const contribution = register('org.example.loaded-default', 'loaded-default', { fieldSx });
		const loaded = toLoadedControlPlugin(
			{ id: 'org.example.loaded-default' },
			contribution,
			'loaded-default',
			url,
			ErrorPlaceholder
		);
		assert.equal(loaded.Component, Control);
		assert.equal(loaded.fieldChrome, true);
		assert.equal(loaded.fieldSx, fieldSx);
	});

	it('does not wrap when the contribution opts out', () => {
		const contribution = register('org.example.loaded-bare', 'loaded-bare', { fieldChrome: false });
		const loaded = toLoadedControlPlugin(
			{ id: 'org.example.loaded-bare' },
			contribution,
			'loaded-bare',
			url,
			ErrorPlaceholder
		);
		assert.equal(loaded.Component, Control);
		assert.equal(loaded.fieldChrome, false);
	});

	it('never wraps the load-error placeholder', () => {
		const quiet = () => undefined;
		const originalError = console.error;
		console.error = quiet;
		try {
			const missing = toLoadedControlPlugin({ id: 'org.example.none' }, undefined, 'none', url, ErrorPlaceholder);
			assert.equal(missing.Component, ErrorPlaceholder);
			assert.equal(missing.fieldChrome, false);
			const contribution = register('org.example.loaded-owner', 'loaded-owner');
			const mismatch = toLoadedControlPlugin(
				{ id: 'org.example.other' },
				contribution,
				'loaded-owner',
				url,
				ErrorPlaceholder
			);
			assert.equal(mismatch.Component, ErrorPlaceholder);
			assert.equal(mismatch.fieldChrome, false);
		} finally {
			console.error = originalError;
		}
	});
});
