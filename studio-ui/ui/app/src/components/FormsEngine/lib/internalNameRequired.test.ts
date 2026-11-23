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
 * Internal Name is always required when the type defines it, whatever its stored required constraint says.
 * The marker (asterisk, aria-required) and the field-level error must match the save rule. See craftersoftware/craftercms#9505.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';
import type { ContentTypeField } from '../../../models/ContentType';

const { isFieldRequired, validateFieldValue } = await import('./validators.ts');
const { contentTypeDefinesInternalName, isInternalNameField, missingMinimumSaveRequirements } =
	await import('./minimumSaveRequirements.ts');
const { messageSource } = await import('../../../../test/messageSource.mjs');

function texts(messages: Awaited<ReturnType<typeof validateFieldValue>>['messages']): Array<string | undefined> {
	return messages.map((message) => {
		const descriptor = Array.isArray(message) ? message[0] : message;
		return typeof descriptor === 'string' ? descriptor : messageSource(descriptor.defaultMessage);
	});
}

const meta = { siteId: 'editorial', itemMeta: { path: '/site/website/index.xml' } };

function field(id: string, validations: Record<string, unknown> = {}, type = 'input'): ContentTypeField {
	const entries = Object.entries(validations).map(([key, value]) => [key, { id: key, value, level: 'required' }]);
	return { id, name: id, type, validations: Object.fromEntries(entries) } as unknown as ContentTypeField;
}

describe('isInternalNameField', () => {
	it('is the reserved id stored as input', () => {
		assert.equal(isInternalNameField({ id: 'internal-name', type: 'input' }), true);
	});

	it('is not another type that happens to use the id, or another id', () => {
		assert.equal(isInternalNameField({ id: 'internal-name', type: 'checkbox' }), false);
		assert.equal(isInternalNameField({ id: 'internal-name', type: 'repeat' }), false);
		assert.equal(isInternalNameField({ id: 'title_t', type: 'input' }), false);
		assert.equal(isInternalNameField(undefined), false);
	});
});

describe('contentTypeDefinesInternalName', () => {
	// The save rule and the field-level rule must agree on what the system field is.
	it('follows the same definition as the field-level rule', () => {
		const def = (fields: Record<string, { id: string; type: string }>) => contentTypeDefinesInternalName({ fields });
		assert.equal(def({ 'internal-name': { id: 'internal-name', type: 'input' } }), true);
		assert.equal(def({ 'internal-name': { id: 'internal-name', type: 'checkbox' } }), false);
		assert.equal(def({ title_t: { id: 'title_t', type: 'input' } }), false);
		assert.equal(contentTypeDefinesInternalName(undefined), false);
	});

	it('blocks save on a blank internal name only when the type defines the system field', () => {
		const args = { isRepeatMode: false, isEmbedded: false, fileNameValid: true, internalName: '' };
		const defines = contentTypeDefinesInternalName({
			fields: { 'internal-name': { id: 'internal-name', type: 'input' } }
		});
		const other = contentTypeDefinesInternalName({
			fields: { 'internal-name': { id: 'internal-name', type: 'checkbox' } }
		});
		assert.deepEqual(missingMinimumSaveRequirements({ ...args, hasInternalNameField: defines }), ['internalName']);
		assert.deepEqual(missingMinimumSaveRequirements({ ...args, hasInternalNameField: other }), []);
	});
});

describe('isFieldRequired for internal-name', () => {
	it('is required when the stored required constraint is false', () => {
		assert.equal(isFieldRequired(field('internal-name', { required: false })), true);
	});

	it('is required when the stored required constraint is true or absent', () => {
		assert.equal(isFieldRequired(field('internal-name', { required: true })), true);
		assert.equal(isFieldRequired(field('internal-name')), true);
	});

	it('is not forced for another type that uses the id', () => {
		assert.equal(isFieldRequired(field('internal-name', { required: false }, 'checkbox')), false);
		assert.equal(isFieldRequired(field('internal-name', { required: true }, 'checkbox')), true);
	});

	it('still follows the stored constraint for other fields', () => {
		assert.equal(isFieldRequired(field('title_t', { required: false })), false);
		assert.equal(isFieldRequired(field('title_t')), false);
		assert.equal(isFieldRequired(field('title_t', { required: true })), true);
	});
});

describe('validateFieldValue for internal-name', () => {
	it('reports an empty internal name as required when the stored required constraint is false', async () => {
		const result = await validateFieldValue(field('internal-name', { required: false }), '', meta);
		assert.equal(result.isValid, false);
		assert.deepEqual(texts(result.messages), ['This field is required.']);
	});

	it('does not force required on another type that uses the id', async () => {
		const result = await validateFieldValue(field('internal-name', { required: false }, 'textarea'), '', meta);
		assert.equal(result.isValid, true);
		assert.deepEqual(texts(result.messages), []);
	});

	it('accepts a filled internal name', async () => {
		const result = await validateFieldValue(field('internal-name', { required: false }), 'Home', meta);
		assert.equal(result.isValid, true);
		assert.deepEqual(texts(result.messages), []);
	});

	it('does not require another empty input without the constraint', async () => {
		const result = await validateFieldValue(field('title_t', { required: false }), '', meta);
		assert.equal(result.isValid, true);
		assert.deepEqual(texts(result.messages), []);
	});
});
