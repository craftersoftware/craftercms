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
import { test } from 'node:test';
import { configurationReferenceId, toolbarItemSignature } from './toolbarItemSignature.ts';

test('reuses one id for the same configuration object', () => {
	const configuration = { variant: 'icon' };
	assert.equal(configurationReferenceId(configuration), configurationReferenceId(configuration));
});

test('gives different ids to equal configuration objects', () => {
	const first = configurationReferenceId({ variant: 'icon' });
	const second = configurationReferenceId({ variant: 'icon' });
	assert.notEqual(first, second);
});

test('does not throw on a circular configuration', () => {
	const configuration: { self?: unknown } = {};
	configuration.self = configuration;
	assert.equal(configurationReferenceId(configuration), configurationReferenceId(configuration));
});

test('treats primitive configuration by value and empty for null', () => {
	assert.equal(configurationReferenceId('icon'), configurationReferenceId('icon'));
	assert.notEqual(configurationReferenceId('icon'), configurationReferenceId('text'));
	assert.equal(configurationReferenceId(null), '');
	assert.equal(configurationReferenceId(undefined), '');
});

test('keeps the item signature stable while the configuration reference is unchanged', () => {
	const configuration = { embedded: true };
	const item = { key: 'search', typeName: 'Widget', id: 'search', uiKey: 'search', configuration };
	assert.equal(toolbarItemSignature(item), toolbarItemSignature(item));
	assert.notEqual(toolbarItemSignature(item), toolbarItemSignature({ ...item, id: 'other' }));
});
