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
import '../../test/registerTsLoader.mjs';
import type { ContentTypeField } from '../models/ContentType';

const { parseLegacyFormDefinition } = await import('./contentTypes.ts');

/**
 * Parser remapping of legacy system-field control types onto FE2 built-ins.
 * Existing 4.x form-definitions may still store `<type>disabled</type>` / `<type>internal-name</type>`;
 * `legacyTypeRemap` maps those to `checkbox` / `input` once at load so FE2 only sees built-ins.
 */

function property(name: string, value: string, type = 'string') {
	return { name, value, type };
}

function parsedField(field: Record<string, unknown>): ContentTypeField {
	const parsed = parseLegacyFormDefinition({
		'content-type': '/page/article',
		title: 'Article',
		description: '',
		objectType: 'page',
		sections: {
			section: {
				title: 'Main',
				description: '',
				defaultOpen: 'true',
				fields: { field }
			}
		}
	} as never);
	return parsed.fields[field.id as string];
}

describe('legacyTypeRemap', () => {
	// Given a 4.x disabled field, the stored type becomes checkbox while the field id stays disabled.
	it('remaps disabled to checkbox', () => {
		const field = parsedField({
			id: 'disabled',
			title: 'Disable Page',
			description: '',
			type: 'disabled'
		});
		assert.equal(field.id, 'disabled');
		assert.equal(field.type, 'checkbox');
		assert.equal(field.sortable, false);
	});

	// Given a 4.x internal-name field, the stored type becomes input while the field id stays internal-name.
	it('remaps internal-name to input', () => {
		const field = parsedField({
			id: 'internal-name',
			title: 'Internal Name',
			description: '',
			type: 'internal-name'
		});
		assert.equal(field.id, 'internal-name');
		assert.equal(field.type, 'input');
		assert.equal(field.sortable, false);
	});

	// Given maxlength on a legacy internal-name field, the remapped input type takes the input validation path.
	it('applies input validations after remapping internal-name', () => {
		const field = parsedField({
			id: 'internal-name',
			title: 'Internal Name',
			description: '',
			type: 'internal-name',
			properties: { property: [property('maxlength', '50', 'int')] }
		});
		assert.equal(field.type, 'input');
		assert.equal(field.validations.maxLength?.value, 50);
		assert.equal(field.properties.maxlength.value, 50);
	});

	// Given already-modern types, the remap table leaves them alone.
	it('leaves non-legacy types unchanged', () => {
		assert.equal(parsedField({ id: 'title_s', title: 'Title', description: '', type: 'input' }).type, 'input');
		assert.equal(
			parsedField({ id: 'disabled', title: 'Disable Page', description: '', type: 'checkbox' }).type,
			'checkbox'
		);
		assert.equal(
			parsedField({ id: 'file-name', title: 'File Name', description: '', type: 'file-name' }).type,
			'file-name'
		);
	});

	// Given nested legacy types inside a repeat, each nested field is remapped the same way.
	it('remaps nested legacy types inside a repeat', () => {
		const field = parsedField({
			id: 'items_o',
			title: 'Items',
			description: '',
			type: 'repeat',
			fields: {
				field: [
					{ id: 'disabled', title: 'Disable', description: '', type: 'disabled' },
					{ id: 'internal-name', title: 'Name', description: '', type: 'internal-name' },
					{ id: 'title_s', title: 'Title', description: '', type: 'input' }
				]
			}
		});
		assert.equal(field.type, 'repeat');
		assert.equal(field.fields.disabled.type, 'checkbox');
		assert.equal(field.fields['internal-name'].type, 'input');
		assert.equal(field.fields.title_s.type, 'input');
	});
});
