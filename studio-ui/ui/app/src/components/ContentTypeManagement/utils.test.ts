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
import { describe, it, mock } from 'node:test';
import '../../../test/registerTsLoader.mjs';

const { parseLegacyFormDefinition } = await import('../../services/contentTypes.ts');
const {
	buildContentTypeXml,
	createTypeFieldValuesObject,
	createVirtualTypeForField,
	createVirtualTypeFormContext,
	prepareSerializeToXmlTypeObject,
	reverseTypeFieldValuesObject
} = await import('./utils.ts');
const { deserialize, entityEncodingTagValueProcessor } = await import('../../utils/xml.ts');
const { inputDescriptor } = await import('./descriptors/controls/input.ts');
const { extractAtomValues } = await import('../FormsEngine/lib/formUtils.tsx');
const { createStore } = await import('jotai');
const { Subject } = await import('rxjs');

// The descriptor's own properties are always written, with their defaults when the field didn't store them.
const descriptorProperties = ['maxlength', 'readonly', 'tokenize', 'escapeContent'];
const consoleLevels = ['log', 'warn', 'error', 'info', 'debug'] as const;

function namedList<T>(value: T | T[] | null | undefined): T[] {
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

function property(name: string, value: string, type = 'string') {
	return `<property><name>${name}</name><label>${name}</label><value>${value}</value><type>${type}</type></property>`;
}

function parseInputType(properties: string[]) {
	const xml = `<form>
		<title>Article</title>
		<content-type>/component/article</content-type>
		<objectType>component</objectType>
		<sections>
			<section>
				<title>Main</title>
				<defaultOpen>true</defaultOpen>
				<fields>
					<field>
						<type>input</type>
						<id>title_t</id>
						<title>Title</title>
						<properties>${properties.join('')}</properties>
					</field>
				</fields>
			</section>
		</sections>
	</form>`;
	return parseLegacyFormDefinition(
		deserialize(xml, { parseTagValue: false, tagValueProcessor: entityEncodingTagValueProcessor }).form
	);
}

// Opens the field's properties form as EditTypeView does (virtual type, form context, atom values) and commits it
// unchanged, recording any console output on the way.
function openAndCommit(properties: string[]) {
	const spies = consoleLevels.map((level) => mock.method(console, level, () => undefined));
	try {
		const parsed = parseInputType(properties);
		const field = parsed.fields.title_t;
		const virtualType = createVirtualTypeForField(inputDescriptor, ({ defaultMessage }) => String(defaultMessage));
		const formContext = createVirtualTypeFormContext(
			virtualType,
			createTypeFieldValuesObject(field),
			{},
			{
				fieldUpdates$: new Subject()
			}
		);
		const values = extractAtomValues(createStore(), formContext.atoms.valueByFieldId);
		const edited = reverseTypeFieldValuesObject(field, values, inputDescriptor);
		const type = { ...parsed, fields: { ...parsed.fields, title_t: edited } };
		const sectionXml = prepareSerializeToXmlTypeObject(type).sections.section;
		const xmlField = namedList(namedList(sectionXml)[0].fields.field)[0];
		return {
			values,
			edited,
			savedProperties: namedList(xmlField.properties?.property),
			xml: buildContentTypeXml(prepareSerializeToXmlTypeObject(type)),
			consoleCalls: spies.reduce((total, spy) => total + spy.mock.callCount(), 0)
		};
	} finally {
		spies.forEach((spy) => spy.mock.restore());
	}
}

describe('reverseTypeFieldValuesObject dropping properties the descriptor does not define', () => {
	// Given a stored description property (a name that survives into the form values but is not in the descriptor), committing the form drops it from the saved properties and writes nothing to the console.
	// The value still shows up as the field's own description element: that collision is the known lossy case tracked under #9288, and is not pinned here.
	it('drops a stored property that reaches the form values but not the descriptor, silently', () => {
		const result = openAndCommit([property('maxlength', '50', 'int'), property('description', 'PROP_DESC_VALUE')]);
		assert.equal(Object.hasOwn(result.values, 'description'), true);
		assert.equal(Object.hasOwn(inputDescriptor.fields, 'description'), false);
		assert.equal(Object.hasOwn(result.edited.properties, 'description'), false);
		assert.deepEqual(
			result.savedProperties.map((item) => item.name),
			descriptorProperties
		);
		assert.equal(result.xml.includes('<name>description</name>'), false);
		assert.equal(result.consoleCalls, 0);
	});

	// Given a genuinely obsolete property, it is not a field of the virtual type, so it never reaches the form values and the first guard drops it.
	it('drops an obsolete property that never reaches the form values, silently', () => {
		const result = openAndCommit([property('maxlength', '50', 'int'), property('size', '40', 'int')]);
		assert.equal(Object.hasOwn(result.values, 'size'), false);
		assert.equal(Object.hasOwn(inputDescriptor.fields, 'size'), false);
		assert.equal(Object.hasOwn(result.edited.properties, 'size'), false);
		assert.deepEqual(
			result.savedProperties.map((item) => item.name),
			descriptorProperties
		);
		assert.equal(result.xml.includes('<name>size</name>'), false);
		assert.equal(result.consoleCalls, 0);
	});
});

describe('createVirtualTypeFormContext', () => {
	it('creates its own fieldUpdates$ Subject when mixin is omitted', () => {
		const virtualType = createVirtualTypeForField(inputDescriptor, ({ defaultMessage }) => String(defaultMessage));
		const context = createVirtualTypeFormContext(virtualType, {}, {});
		assert.ok(context.fieldUpdates$ instanceof Subject);
	});
});
