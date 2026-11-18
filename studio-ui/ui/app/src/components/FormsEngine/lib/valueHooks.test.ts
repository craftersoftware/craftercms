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
 * Value retriever and serializer hooks take the value first, then one context object.
 * Plugin hooks are looked up after the built-in maps. The special keys the XML builder reads are exported
 * constants, and the builder is configured from them.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';
import type { ComponentType } from 'react';
import type { AnyValue } from '../types';
import type ContentType from '../../../models/ContentType';
import type { ContentTypeField } from '../../../models/ContentType';
import type PluginDescriptor from '../../../models/PluginDescriptor';

const { registerPlugin } = await import('../../../services/plugin.ts');
const { retrieveFieldValue } = await import('./valueRetrievers.ts');
const { buildContentXml, getXmlBuilder, valueSerializersLookup } = await import('./valueSerializers.ts');
const { XML_ATTRIBUTE_PREFIX, XML_CDATA_KEY, XML_ITEM_LIST_ATTRIBUTE, XML_LIST_ITEM_KEY, XML_TEXT_KEY } =
	await import('./controlValueTypes.ts');

const source = { site: 'editorial', type: 'control', name: 'example', file: 'index.js' };
const Component = (() => null) as ComponentType<AnyValue>;

function field(id: string, type: string, extra: Partial<ContentTypeField> = {}): ContentTypeField {
	return { id, name: id, type, validations: {}, ...extra } as ContentTypeField;
}

describe('value retriever', () => {
	it('passes the plugin retriever the raw value and a context with the field', () => {
		const calls: unknown[][] = [];
		const typeKey = 'retriever-ctx-picker';
		registerPlugin(
			{
				id: 'org.example.retriever-ctx',
				controls: {
					[typeKey]: {
						Component,
						valueRetriever: (...args) => {
							calls.push(args);
							return 'retrieved';
						}
					}
				}
			} as PluginDescriptor,
			source
		);
		const f = field('thing_s', typeKey);
		assert.equal(retrieveFieldValue(f, 'raw'), 'retrieved');
		assert.equal(calls.length, 1);
		assert.equal(calls[0][0], 'raw');
		assert.deepEqual(Object.keys(calls[0][1] as object), ['field']);
		assert.equal((calls[0][1] as { field: ContentTypeField }).field, f);
		assert.equal(calls[0].length, 2);
	});

	it('keeps default-value handling and text unescaping through the context', () => {
		const plain = field('title_s', 'input');
		assert.equal(retrieveFieldValue(plain, undefined), '');
		assert.equal(retrieveFieldValue(field('title_s', 'input', { defaultValue: 'x' }), undefined), 'x');
		const escaped = field('title_s', 'input', {
			properties: { escapeContent: { id: 'escapeContent', value: true } } as ContentTypeField['properties']
		});
		assert.equal(retrieveFieldValue(escaped, '&lt;b&gt;'), '<b>');
	});
});

describe('value serializer', () => {
	const contentTypesById = {} as Record<string, ContentType>;

	it('passes the plugin serializer the value and a context with field and contentTypesById', async () => {
		const calls: unknown[][] = [];
		const typeKey = 'serializer-ctx-picker';
		registerPlugin(
			{
				id: 'org.example.serializer-ctx',
				controls: {
					[typeKey]: {
						Component,
						valueSerializer: (...args) => {
							calls.push(args);
							return 'serialized';
						}
					}
				}
			} as PluginDescriptor,
			source
		);
		const f = field('thing_s', typeKey);
		const type = {
			id: '/component/thing',
			type: 'component',
			fields: { thing_s: f }
		} as unknown as ContentType;
		const lookup = { [type.id]: type };
		const xml = buildContentXml({ 'content-type': type.id, objectId: 'abc', thing_s: 'value' }, lookup);
		assert.match(xml, /<thing_s>serialized<\/thing_s>/);
		assert.equal(calls.length, 1);
		assert.equal(calls[0][0], 'value');
		const ctx = calls[0][1] as { field: ContentTypeField; contentTypesById: unknown };
		assert.deepEqual(Object.keys(ctx).sort(), ['contentTypesById', 'field']);
		assert.equal(ctx.field, f);
		assert.equal(ctx.contentTypesById, lookup);
	});

	it('serializes built-ins from the value alone', () => {
		const ctx = (f: ContentTypeField) => ({ field: f, contentTypesById });
		const lookup = valueSerializersLookup;
		assert.deepEqual(lookup['checkbox-group'](['a'], ctx(field('x', 'checkbox-group'))), { item: ['a'] });
		assert.deepEqual(lookup.rte('<p/>', ctx(field('x', 'rte'))), { __cdata__: '<p/>' });
		assert.equal(lookup['datasource:image'](['a', 'b'], ctx(field('x', 'datasource:image'))), 'a,b');
		assert.equal(lookup.range({ min: 1 }, ctx(field('x', 'range'))), '{"min":1}');
		assert.equal(lookup['aws-file-upload']({ a: 1 }, ctx(field('x', 'aws-file-upload'))).item.a, 1);
		assert.equal(lookup['transcoded-video-picker'](null, ctx(field('x', 'transcoded-video-picker'))), undefined);
		const escaping = field('x', 'input', {
			properties: { escapeContent: { id: 'escapeContent', value: true } } as ContentTypeField['properties']
		});
		assert.equal(lookup.input('<', ctx(escaping)), '&lt;');
	});

	it('serializes a repeat with item-list shape using the context lookup and field', () => {
		const inner = field('name_s', 'input');
		const repeat = field('rows_o', 'repeat', { fields: { name_s: inner } as ContentTypeField['fields'] });
		const result = valueSerializersLookup.repeat([{ name_s: 'a' }], { field: repeat, contentTypesById }) as Record<
			string,
			unknown
		>;
		assert.equal(result[XML_ITEM_LIST_ATTRIBUTE], true);
		assert.deepEqual(result[XML_LIST_ITEM_KEY], [{ name_s: 'a' }]);
	});
});

describe('XML builder keys', () => {
	it('exports the documented key names', () => {
		assert.equal(XML_ATTRIBUTE_PREFIX, '@:');
		assert.equal(XML_CDATA_KEY, '__cdata__');
		assert.equal(XML_TEXT_KEY, '#text');
		assert.equal(XML_LIST_ITEM_KEY, 'item');
		assert.equal(XML_ITEM_LIST_ATTRIBUTE, '@:item-list');
	});

	it('renders attributes, CDATA, text nodes and item lists from those keys', () => {
		const xml = getXmlBuilder({ format: false }).build({
			root: {
				a: { [`${XML_ATTRIBUTE_PREFIX}flag`]: true, [XML_TEXT_KEY]: 'hi' },
				b: { [XML_CDATA_KEY]: '<p>x</p>' },
				c: { [XML_ITEM_LIST_ATTRIBUTE]: true, [XML_LIST_ITEM_KEY]: ['1', '2'] }
			}
		}) as string;
		assert.equal(
			xml,
			'<root><a flag="true">hi</a><b><![CDATA[<p>x</p>]]></b><c item-list="true"><item>1</item><item>2</item></c></root>'
		);
	});
});
