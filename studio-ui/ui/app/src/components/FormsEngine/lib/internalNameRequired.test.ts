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

const meta = { siteId: 'editorial', itemMeta: { path: '/site/website/index.xml' } };

function field(id: string, validations: Record<string, unknown> = {}, type = 'input'): ContentTypeField {
	const entries = Object.entries(validations).map(([key, value]) => [key, { id: key, value, level: 'required' }]);
	return { id, name: id, type, validations: Object.fromEntries(entries) } as unknown as ContentTypeField;
}

describe('isFieldRequired for internal-name', () => {
	it('is required when the stored required constraint is false', () => {
		assert.equal(isFieldRequired(field('internal-name', { required: false })), true);
	});

	it('is required when the stored required constraint is true or absent', () => {
		assert.equal(isFieldRequired(field('internal-name', { required: true })), true);
		assert.equal(isFieldRequired(field('internal-name')), true);
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
	});

	it('accepts a filled internal name', async () => {
		const result = await validateFieldValue(field('internal-name', { required: false }), 'Home', meta);
		assert.equal(result.isValid, true);
	});

	it('does not require another empty input without the constraint', async () => {
		const result = await validateFieldValue(field('title_t', { required: false }), '', meta);
		assert.equal(result.isValid, true);
	});
});
