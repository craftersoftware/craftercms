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
 * Built-in validators keep their behaviour on the (value, ctx) signature: which messages, in which order, and the
 * host-owned required short-circuit. The file-name validator owns its required message.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';
import type { ContentTypeField } from '../../../models/ContentType';
import type ContentType from '../../../models/ContentType';
import type { FieldValidityMessage } from './validators.ts';

const { validateFieldValue } = await import('./validators.ts');

const meta = { siteId: 'editorial', fileName: 'index.xml', itemMeta: { path: '/site/website/index.xml' } };

function field(type: string, id: string, validations: Record<string, unknown> = {}): ContentTypeField {
	const entries = Object.entries(validations).map(([key, value]) => [key, { id: key, value, level: 'required' }]);
	return { id, name: id, type, validations: Object.fromEntries(entries) } as unknown as ContentTypeField;
}

function texts(messages: FieldValidityMessage[]): Array<string | undefined> {
	return messages.map((message) => {
		const descriptor = Array.isArray(message) ? message[0] : message;
		return typeof descriptor === 'string' ? descriptor : descriptor.defaultMessage;
	});
}

describe('built-in validators on the new signature', () => {
	it('input: pattern message comes before the max length message', async () => {
		const result = await validateFieldValue(field('input', 'a_s', { pattern: '^x', maxlength: 2 }), 'abcd', meta);
		assert.equal(result.isValid, false);
		assert.deepEqual(texts(result.messages), [
			'The value does not match the required pattern.',
			'The value is greater than the allowed maximum ({maxLength}).'
		]);
		assert.equal((await validateFieldValue(field('input', 'a_s', { pattern: '^x' }), 'xa', meta)).isValid, true);
		assert.equal((await validateFieldValue(field('input', 'a_s', { pattern: '^x' }), '', meta)).isValid, true);
	});

	it('email, link and phone use their own pattern message', async () => {
		const pattern = { pattern: '^never$' };
		assert.deepEqual(texts((await validateFieldValue(field('input-email', 'a_s', pattern), 'a', meta)).messages), [
			'Please enter a valid email address.'
		]);
		assert.deepEqual(texts((await validateFieldValue(field('input-link', 'a_s', pattern), 'a', meta)).messages), [
			'Please enter a valid URL.'
		]);
		assert.deepEqual(texts((await validateFieldValue(field('input-phone', 'a_s', pattern), 'a', meta)).messages), [
			'Please enter a valid phone number.'
		]);
	});

	it('numeric input: type, pattern, max, then min', async () => {
		const result = await validateFieldValue(
			field('numeric-input', 'n_i', { pattern: '^9', maxValue: 3, minValue: 8 }),
			5.5,
			meta
		);
		assert.deepEqual(texts(result.messages), [
			"Decimals aren't allowed on this input.",
			'The value does not match the required pattern.',
			'The value is greater than the allowed maximum ({maxValue}).',
			'The value is less than the minimum ({minValue}).'
		]);
		const small = await validateFieldValue(field('numeric-input', 'n_i', { minValue: 8 }), 2, meta);
		assert.deepEqual(texts(small.messages), ['The value is less than the minimum ({minValue}).']);
		const nan = await validateFieldValue(field('numeric-input', 'n_i'), 'abc', meta);
		assert.deepEqual(texts(nan.messages), ['Please enter a valid number.']);
		assert.equal((await validateFieldValue(field('numeric-input', 'n_f'), 1.5, meta)).isValid, true);
	});

	it('checkbox: required means checked, and the host required message does not apply', async () => {
		const required = field('checkbox', 'c_b', { required: true });
		const result = await validateFieldValue(required, false, meta);
		assert.deepEqual(texts(result.messages), ['This checkbox must be checked.']);
		assert.equal((await validateFieldValue(required, true, meta)).isValid, true);
	});

	it('required with an empty value short-circuits before the type validator', async () => {
		const result = await validateFieldValue(field('input', 'a_s', { required: true, pattern: '^x' }), '', meta);
		assert.deepEqual(texts(result.messages), ['This field is required.']);
	});

	it('date-time rejects a past date unless allowed', async () => {
		const past = field('date-time', 'd_dt');
		assert.deepEqual(texts((await validateFieldValue(past, '2000-01-01T00:00:00Z', meta)).messages), [
			'The date cannot be in the past.'
		]);
		const allowed = { ...past, properties: { allowPastDate: { id: 'allowPastDate', value: true } } };
		assert.equal(
			(await validateFieldValue(allowed as unknown as ContentTypeField, '2000-01-01T00:00:00Z', meta)).isValid,
			true
		);
	});

	it('date-time-expression-input and path-with-macro-creator report their messages', async () => {
		const expression = await validateFieldValue(field('date-time-expression-input', 'e_s'), 'nonsense', meta);
		assert.deepEqual(texts(expression.messages), ['The expression is not valid.']);
		const path = await validateFieldValue(field('path-with-macro-creator', 'p_s'), '/a/{nope}', meta);
		assert.deepEqual(texts(path.messages), ['The following are invalid macros: {invalidMacros}.']);
	});

	it('variable: a duplicate sibling id is invalid, the field own ids are not', async () => {
		const variable = field('variable', 'v_s');
		const taken = await validateFieldValue(variable, 'name', { ...meta, siblingIds: ['name'], currentIds: [] });
		assert.deepEqual(texts(taken.messages), ['That variable name is already in use.']);
		const own = await validateFieldValue(variable, 'name', { ...meta, siblingIds: ['name'], currentIds: ['name'] });
		assert.equal(own.isValid, true);
	});

	it('file-name owns its required message and does not get the host one', async () => {
		const result = await validateFieldValue(field('file-name', 'file-name', { required: true }), '', {
			...meta,
			fileName: ''
		});
		assert.equal(result.isValid, false);
		assert.deepEqual(texts(result.messages), ['This field is required.']);
	});

	it('node-selector: occurrence messages first, the embedded message last', async () => {
		const embedded = {
			id: 'embedded',
			type: 'component',
			fields: { title_s: field('input', 'title_s', { required: true }) }
		} as unknown as ContentType;
		const selector = field('node-selector', 'items_o', { minCount: 3 });
		const result = await validateFieldValue(
			selector,
			[{ component: { 'content-type': 'embedded', objectId: 'o1', title_s: '' } }],
			{ ...meta, contentTypesById: { embedded } }
		);
		assert.equal(result.isValid, false);
		assert.deepEqual(texts(result.messages), [
			'At least {minCount, plural, one {# item is} other {# items are}} required.',
			'One or more embedded content items are invalid.'
		]);
	});
});
