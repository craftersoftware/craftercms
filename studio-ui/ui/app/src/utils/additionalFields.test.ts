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

const { parseLegacyFormDefinition } = await import('../services/contentTypes.ts');
const { buildContentTypeXml, prepareSerializeToXmlTypeObject } =
	await import('../components/ContentTypeManagement/utils.ts');
const { deserialize, entityEncodingTagValueProcessor, fromString } = await import('./xml.ts');
const { parseContentXML } = await import('./content.ts');
const { addConfiguredAdditionalFields } = await import('./contentType.ts');

function namedList<T>(value: T | T[] | null | undefined): T[] {
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

function parseFormXml(xml: string) {
	return parseLegacyFormDefinition(
		deserialize(xml, {
			parseTagValue: false,
			tagValueProcessor: entityEncodingTagValueProcessor
		}).form
	);
}

function captureConsoleErrors(run: () => void): string[] {
	const messages: string[] = [];
	const original = console.error;
	console.error = (...args: unknown[]) => {
		messages.push(args.map(String).join(' '));
	};
	try {
		run();
		return messages;
	} finally {
		console.error = original;
	}
}

function contentDoc(fieldsXml: string) {
	return fromString(`<?xml version="1.0" encoding="UTF-8"?>
<page>
	<objectId>01234567-89ab-cdef-0123-456789abcdef</objectId>
	<content-type>/page/article</content-type>
	<internal-name>Article</internal-name>
	<file-name>index.xml</file-name>
	${fieldsXml}
</page>`);
}

describe('additionalFields form-definition round trip', () => {
	it('keeps root and nested additionalFields through serialize and parse', () => {
		const parsed = parseLegacyFormDefinition({
			'content-type': '/page/article',
			title: 'Article',
			description: '',
			objectType: 'page',
			sections: {
				section: {
					title: 'Content',
					description: '',
					defaultOpen: 'true',
					fields: {
						field: [
							{
								id: 'publishDate_dt',
								title: 'Publish Date',
								description: '',
								type: 'date-time',
								additionalFields: { id: 'publishDate_dt_tz' }
							},
							{
								id: 'title_s',
								title: 'Title',
								description: '',
								type: 'backup-control',
								additionalFields: { id: ['title_s_bk', 'title_s_alt'] }
							},
							{
								id: 'items_o',
								title: 'Items',
								description: '',
								type: 'repeat',
								fields: {
									field: {
										id: 'expires_dt',
										title: 'Expires',
										description: '',
										type: 'date-time',
										additionalFields: { id: 'expires_dt_tz' }
									}
								}
							}
						]
					}
				}
			}
		} as never);

		assert.deepEqual(parsed.fields.publishDate_dt.additionalFields, ['publishDate_dt_tz']);
		assert.deepEqual(parsed.fields.title_s.additionalFields, ['title_s_bk', 'title_s_alt']);
		assert.deepEqual(parsed.fields.items_o.fields.expires_dt.additionalFields, ['expires_dt_tz']);

		const xml = buildContentTypeXml(prepareSerializeToXmlTypeObject(parsed));
		assert.match(xml, /<additionalFields>[\s\S]*<id>publishDate_dt_tz<\/id>/);
		assert.match(xml, /<additionalFields>[\s\S]*<id>title_s_bk<\/id>[\s\S]*<id>title_s_alt<\/id>/);
		assert.match(xml, /<id>expires_dt<\/id>[\s\S]*<additionalFields>[\s\S]*<id>expires_dt_tz<\/id>/);

		const roundTripped = parseFormXml(xml);
		assert.deepEqual(roundTripped.fields.publishDate_dt.additionalFields, ['publishDate_dt_tz']);
		assert.deepEqual(roundTripped.fields.title_s.additionalFields, ['title_s_bk', 'title_s_alt']);
		assert.deepEqual(roundTripped.fields.items_o.fields.expires_dt.additionalFields, ['expires_dt_tz']);

		const saved = deserialize(xml, {
			parseTagValue: false,
			tagValueProcessor: entityEncodingTagValueProcessor
		}).form;
		const rootFields = namedList(namedList(saved.sections?.section)[0]?.fields?.field);
		const nestedExpires = namedList(rootFields.find((field) => field.id === 'items_o')?.fields?.field).find(
			(field) => field.id === 'expires_dt'
		);
		assert.deepEqual(namedList(nestedExpires?.additionalFields?.id), ['expires_dt_tz']);
	});
});

describe('addConfiguredAdditionalFields', () => {
	it('expands control-descriptor macros onto fields that lack persisted additionalFields', () => {
		const contentTypes = {
			'/page/article': {
				id: '/page/article',
				fields: {
					publishDate_dt: {
						id: 'publishDate_dt',
						name: 'Publish Date',
						type: 'date-time',
						validations: {},
						properties: {},
						defaultValue: ''
					}
				}
			}
		};
		const merged = addConfiguredAdditionalFields(contentTypes as never, {
			'date-time': { metadata: { additionalFields: ['{id}_tz'] } }
		});
		assert.deepEqual(merged['/page/article'].fields.publishDate_dt.additionalFields, ['publishDate_dt_tz']);
	});
});

describe('parseContentXML additionalFields skip logic', () => {
	const path = '/site/website/articles/index.xml';

	it('does not log for a configured companion field', () => {
		const messages = captureConsoleErrors(() => {
			parseContentXML(
				contentDoc('<title_s>Hello</title_s><title_s_bk>Backup</title_s_bk>'),
				path,
				{
					'/page/article': {
						fields: {
							title_s: {
								id: 'title_s',
								type: 'input',
								additionalFields: ['title_s_bk']
							}
						}
					}
				} as never,
				{}
			);
		});
		assert.equal(
			messages.some((message) => message.includes('title_s_bk') && message.includes('was not found')),
			false
		);
	});

	it('does not log for a legacy _tz companion when additionalFields is absent', () => {
		const messages = captureConsoleErrors(() => {
			parseContentXML(
				contentDoc(
					'<publishDate_dt>2024-01-01T00:00:00.000Z</publishDate_dt><publishDate_dt_tz>UTC</publishDate_dt_tz>'
				),
				path,
				{
					'/page/article': {
						fields: {
							publishDate_dt: {
								id: 'publishDate_dt',
								type: 'date-time'
							}
						}
					}
				} as never,
				{}
			);
		});
		assert.equal(
			messages.some((message) => message.includes('publishDate_dt_tz') && message.includes('was not found')),
			false
		);
	});

	it('still logs for a genuinely missing field', () => {
		const messages = captureConsoleErrors(() => {
			parseContentXML(
				contentDoc('<title_s>Hello</title_s><stale_prop>leftover</stale_prop>'),
				path,
				{
					'/page/article': {
						fields: {
							title_s: {
								id: 'title_s',
								type: 'input'
							}
						}
					}
				} as never,
				{}
			);
		});
		assert.equal(
			messages.some(
				(message) =>
					message.includes('[parseContentXML]') &&
					message.includes('stale_prop') &&
					message.includes('was not found') &&
					message.includes('/page/article')
			),
			true
		);
	});
});
