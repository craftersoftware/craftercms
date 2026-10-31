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
import { JSDOM } from 'jsdom';
import '../../test/registerTsLoader.mjs';

const { window } = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.DOMParser = window.DOMParser;
globalThis.XMLSerializer = window.XMLSerializer;
globalThis.document = window.document;

const { deserialize, fromString, getParsedField } = await import('./xml.ts');
const { deserializeContentDoc } = await import('../components/FormsEngine/lib/valueRetrievers.ts');

describe('parsed field keys', () => {
	it('reads renamed prototype names from the parser key and leaves other fields alone', () => {
		const page = deserialize(
			'<page><toString>a</toString><valueOf>b</valueOf><hasOwnProperty>c</hasOwnProperty><title>d</title></page>'
		).page;

		assert.equal(Object.hasOwn(page, 'toString'), false);
		assert.equal(Object.hasOwn(page, '__toString'), true);
		assert.equal(getParsedField(page, 'toString'), 'a');
		assert.equal(getParsedField(page, 'valueOf'), 'b');
		assert.equal(getParsedField(page, 'hasOwnProperty'), 'c');
		assert.equal(getParsedField(page, 'title'), 'd');
		assert.equal(getParsedField(page, 'missing'), undefined);
		assert.throws(() => deserialize('<page><constructor>x</constructor></page>'), /\[SECURITY\] Invalid name/);
	});

	it('reads a toString repeat item without using Object.prototype.toString', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<page>
	<toString>
		<item><component><objectId>abc</objectId></component></item>
	</toString>
</page>`;
		const contentObject = deserializeContentDoc(fromString(xml));
		const fieldId = 'toString';
		const index = 0;

		assert.equal(typeof contentObject[fieldId], 'function');
		const component = (getParsedField(contentObject, fieldId) as { item: Array<{ component: { objectId: string } }> })
			.item[index].component;
		assert.equal(component.objectId, 'abc');
	});
});
