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
	// FE1 identified the field by id for any type, and the save rule and the system-props writer still do.
	it('is the reserved id, whatever the stored type', () => {
		assert.equal(isInternalNameField({ id: 'internal-name' }), true);
		for (const type of ['input', 'checkbox', 'repeat', 'textarea']) {
			assert.equal(isInternalNameField({ id: 'internal-name', type } as never), true, type);
		}
	});

	it('is not another id', () => {
		assert.equal(isInternalNameField({ id: 'title_t' }), false);
		assert.equal(isInternalNameField({ id: 'internal-name-2' }), false);
		assert.equal(isInternalNameField(undefined), false);
	});
});

describe('contentTypeDefinesInternalName', () => {
	it('is true when the type has an internal-name field of any type', () => {
		const def = (fields: Record<string, { id: string; type: string }>) => contentTypeDefinesInternalName({ fields });
		assert.equal(def({ 'internal-name': { id: 'internal-name', type: 'input' } }), true);
		assert.equal(def({ 'internal-name': { id: 'internal-name', type: 'checkbox' } }), true);
		assert.equal(def({ title_t: { id: 'title_t', type: 'input' } }), false);
		assert.equal(contentTypeDefinesInternalName({}), false);
		assert.equal(contentTypeDefinesInternalName(undefined), false);
	});

	// A blank name must block save for a stored type other than input too, or the writer would save an empty element.
	it('blocks save on a blank internal name whatever the field type', () => {
		const args = { isRepeatMode: false, isEmbedded: false, fileNameValid: true, internalName: '' };
		for (const type of ['input', 'checkbox']) {
			const hasInternalNameField = contentTypeDefinesInternalName({
				fields: { 'internal-name': { id: 'internal-name', type } }
			});
			assert.deepEqual(missingMinimumSaveRequirements({ ...args, hasInternalNameField }), ['internalName'], type);
		}
		const hasInternalNameField = contentTypeDefinesInternalName({ fields: {} });
		assert.deepEqual(missingMinimumSaveRequirements({ ...args, hasInternalNameField }), []);
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

	it('is required for any type stored under the id', () => {
		assert.equal(isFieldRequired(field('internal-name', { required: false }, 'checkbox')), true);
		assert.equal(isFieldRequired(field('internal-name', { required: false }, 'textarea')), true);
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

	it('reports an empty value as required for any type stored under the id', async () => {
		const result = await validateFieldValue(field('internal-name', { required: false }, 'textarea'), '', meta);
		assert.equal(result.isValid, false);
		assert.deepEqual(texts(result.messages), ['This field is required.']);
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
