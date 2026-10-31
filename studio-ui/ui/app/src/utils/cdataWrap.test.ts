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

// node --test has no DOMParser or XMLSerializer. jsdom supplies both; fromString uses DOMParser.
const { window } = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.DOMParser = window.DOMParser;
globalThis.XMLSerializer = window.XMLSerializer;

globalThis.document = window.document;

const { cdataWrap, deserialize, fromString, getInnerHtml } = await import('./xml.ts');
const { buildContentXml, getXmlBuilder } = await import('../components/FormsEngine/lib/valueSerializers.ts');
const { deserializeContentDoc } = await import('../components/FormsEngine/lib/valueRetrievers.ts');
const { parseContentXML } = await import('./content.ts');

const cdataPropName = '__cdata__';
// Several terminators, including the a]]>b case, in one value.
const value = 'a]]>b]]>c';

function cdataData(xml: string): string {
	const doc = fromString(xml);
	assert.equal(doc.querySelector('parsererror'), null);
	return [...doc.documentElement.childNodes]
		.filter((node) => node.nodeType === doc.CDATA_SECTION_NODE)
		.map((node) => node.nodeValue)
		.join('');
}

describe('CDATA terminators', () => {
	it('writes the same CDATA from the FE2 builder and cdataWrap, and both read back', () => {
		const wrapped = cdataWrap(value);
		const built = getXmlBuilder({ cdataPropName, format: false }).build({
			field: { [cdataPropName]: value }
		});
		const formatted = getXmlBuilder({ cdataPropName }).build({
			field: { [cdataPropName]: value }
		});

		assert.equal(built, `<field>${wrapped}</field>`);
		assert.equal(formatted.includes(wrapped), true);
		assert.equal(getXmlBuilder().build({ field: { [cdataPropName]: value } }), formatted);

		assert.equal(deserialize(built).field, value);
		assert.equal(deserialize(formatted).field, value);
		assert.equal(deserialize(`<field>${wrapped}</field>`).field, value);

		assert.equal(cdataData(built), value);
		assert.equal(cdataData(formatted), value);
		assert.equal(cdataData(`<field>${wrapped}</field>`), value);
		assert.equal(fromString(`<field>${wrapped}</field>`).documentElement.textContent, value);
	});

	it('reads a split CDATA value back through parseContentXML', () => {
		const rteValue = 'a]]>b]]>c';
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<page>
	<objectId>01234567-89ab-cdef-0123-456789abcdef</objectId>
	<content-type>/page/article</content-type>
	<internal-name>${cdataWrap(rteValue)}</internal-name>
	<file-name>index.xml</file-name>
	<body_html>${cdataWrap(rteValue)}</body_html>
</page>`;
		const doc = fromString(xml);
		assert.equal(doc.querySelector('parsererror'), null);
		assert.equal(getInnerHtml(doc.querySelector('body_html')), rteValue);
		assert.equal(getInnerHtml(doc.querySelector('internal-name'), { applyLegacyUnescaping: true }), rteValue);
		assert.equal(getInnerHtml(fromString('<field><![CDATA[  plain  ]]></field>').documentElement), 'plain');

		const parsed = parseContentXML(
			doc,
			'/site/website/articles/index.xml',
			{
				'/page/article': {
					fields: {
						body_html: { id: 'body_html', type: 'rte' }
					}
				}
			} as never,
			{}
		);
		assert.equal(parsed.body_html, rteValue);
		assert.equal(parsed.craftercms.label, rteValue);
	});

	it('wraps null, undefined, and "" in an empty CDATA section', () => {
		const emptySection = '<![CDATA[]]>';
		assert.equal(cdataWrap(null as unknown as string), emptySection);
		assert.equal(cdataWrap(undefined as unknown as string), emptySection);
		assert.equal(cdataWrap(''), emptySection);
	});

	it('stringifies array and object values before wrapping them', () => {
		assert.equal(cdataWrap(['a', 'b'] as unknown as string), '<![CDATA[a,b]]>');
		assert.equal(cdataWrap({ x: 1 } as unknown as string), '<![CDATA[[object Object]]]>');
	});

	it('saves an rte value containing ]]> and reads it back unchanged', () => {
		const contentTypeId = '/page/article';
		const xml = buildContentXml(
			{
				'content-type': contentTypeId,
				body_html: value
			},
			{
				[contentTypeId]: {
					type: 'page',
					fields: {
						body_html: { id: 'body_html', type: 'rte' }
					}
				}
			} as never
		);
		const doc = fromString(xml);
		assert.equal(doc.querySelector('parsererror'), null);
		assert.equal(deserializeContentDoc(doc).body_html, value);
	});
});
