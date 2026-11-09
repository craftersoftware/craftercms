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
const { createLookupTable } = await import('./object.ts');

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

	it('expands a custom plugin descriptor through serialize and parse at root and inside a repeat', () => {
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
								id: 'title_s',
								title: 'Title',
								description: '',
								type: 'backup-control'
							},
							{
								id: 'items_o',
								title: 'Items',
								description: '',
								type: 'repeat',
								fields: {
									field: {
										id: 'note_s',
										title: 'Note',
										description: '',
										type: 'backup-control'
									}
								}
							}
						]
					}
				}
			}
		} as never);

		assert.equal(parsed.fields.title_s.additionalFields, undefined);
		assert.equal(parsed.fields.items_o.fields.note_s.additionalFields, undefined);

		const xml = buildContentTypeXml(
			prepareSerializeToXmlTypeObject(parsed, {
				controlDescriptors: {
					'backup-control': {
						id: 'backup-control',
						name: 'Backup',
						description: '',
						sections: [],
						fields: {},
						metadata: { additionalFields: ['{id}_bk'] }
					}
				} as never,
				dataSourceDescriptors: {}
			})
		);
		assert.match(xml, /<id>title_s<\/id>[\s\S]*<additionalFields>[\s\S]*<id>title_s_bk<\/id>/);
		assert.match(xml, /<id>note_s<\/id>[\s\S]*<additionalFields>[\s\S]*<id>note_s_bk<\/id>/);

		const roundTripped = parseFormXml(xml);
		assert.deepEqual(roundTripped.fields.title_s.additionalFields, ['title_s_bk']);
		assert.deepEqual(roundTripped.fields.items_o.fields.note_s.additionalFields, ['note_s_bk']);
	});
});

const pluginControls = {
	'backup-control': { metadata: { additionalFields: ['{id}_bk'] } }
};

const articleWithoutPersistedAdditionalFields = {
	id: '/page/article',
	fields: {
		title_s: {
			id: 'title_s',
			name: 'Title',
			type: 'backup-control',
			validations: {},
			properties: {},
			defaultValue: ''
		},
		publishDate_dt: {
			id: 'publishDate_dt',
			name: 'Publish Date',
			type: 'date-time',
			validations: {},
			properties: {},
			defaultValue: ''
		}
	}
};

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

	it('keeps existing persisted ids and does not duplicate an expanded descriptor id', () => {
		const title = {
			id: 'title_s',
			name: 'Title',
			type: 'backup-control',
			validations: {},
			properties: {},
			defaultValue: '',
			additionalFields: ['title_s_bk', 'title_s_alt']
		};
		const contentTypes = {
			'/page/article': {
				id: '/page/article',
				fields: { title_s: title }
			}
		};
		const merged = addConfiguredAdditionalFields(contentTypes as never, pluginControls);
		assert.equal(merged, contentTypes);
		assert.equal(merged['/page/article'].fields.title_s, title);
		assert.deepEqual(title.additionalFields, ['title_s_bk', 'title_s_alt']);
	});

	it('keeps a conflicting persisted id and backfills only the expanded id that is missing', () => {
		const contentTypes = {
			'/page/article': {
				id: '/page/article',
				fields: {
					title_s: {
						id: 'title_s',
						name: 'Title',
						type: 'backup-control',
						validations: {},
						properties: {},
						defaultValue: '',
						additionalFields: ['title_s_custom', 'title_s_bk']
					}
				}
			}
		};
		const merged = addConfiguredAdditionalFields(contentTypes as never, {
			'backup-control': { metadata: { additionalFields: ['{id}_bk', '{id}_alt'] } }
		});
		assert.deepEqual(merged['/page/article'].fields.title_s.additionalFields, [
			'title_s_custom',
			'title_s_bk',
			'title_s_alt'
		]);
	});
});

describe('fetchContentInstanceDescriptor lookup paths', () => {
	const path = '/site/website/articles/index.xml';
	const companionXml = '<title_s>Hello</title_s><title_s_bk>Backup</title_s_bk>';

	it('supplied lookup: merge from controls quiets plugin companions on old form defs', () => {
		const supplied = { '/page/article': articleWithoutPersistedAdditionalFields };
		const merged = addConfiguredAdditionalFields(supplied as never, pluginControls);
		const messages = captureConsoleErrors(() => {
			parseContentXML(contentDoc(companionXml), path, merged as never, {});
		});
		assert.equal(
			messages.some((message) => message.includes('title_s_bk') && message.includes('was not found')),
			false
		);
		assert.deepEqual(merged['/page/article'].fields.title_s.additionalFields, ['title_s_bk']);
	});

	it('internally fetched lookup: merge after createLookupTable quiets plugin companions', () => {
		// Mirrors fetchContentInstanceDescriptor's internal branch:
		// fetchContentTypes(site) -> createLookupTable(types) -> addConfiguredAdditionalFields(..., controls)
		const fetchedTypes = [articleWithoutPersistedAdditionalFields];
		const lookup = createLookupTable(fetchedTypes as never);
		const merged = addConfiguredAdditionalFields(lookup as never, pluginControls);
		const messages = captureConsoleErrors(() => {
			parseContentXML(contentDoc(companionXml), path, merged as never, {});
		});
		assert.equal(
			messages.some((message) => message.includes('title_s_bk') && message.includes('was not found')),
			false
		);
		assert.deepEqual(merged['/page/article'].fields.title_s.additionalFields, ['title_s_bk']);
	});
});

describe('Preview additionalFields loading race', () => {
	const path = '/site/website/articles/index.xml';
	const companionXml = '<title_s>Hello</title_s><title_s_bk>Backup</title_s_bk>';

	it('unmerged lookup (content types before UI config) logs; merged re-parse stays quiet', () => {
		const unmerged = { '/page/article': articleWithoutPersistedAdditionalFields };
		const before = captureConsoleErrors(() => {
			parseContentXML(contentDoc(companionXml), path, unmerged as never, {});
		});
		assert.equal(
			before.some((message) => message.includes('title_s_bk') && message.includes('was not found')),
			true
		);

		// Preview must not delay guest load for this log; when useContentTypes later merges, re-issue parses quietly.
		const merged = addConfiguredAdditionalFields(unmerged as never, pluginControls);
		const after = captureConsoleErrors(() => {
			parseContentXML(contentDoc(companionXml), path, merged as never, {});
		});
		assert.equal(
			after.some((message) => message.includes('title_s_bk') && message.includes('was not found')),
			false
		);
	});

	it('does not require UI config merge for legacy _tz (hardcoded fallback covers cold start)', () => {
		const messages = captureConsoleErrors(() => {
			parseContentXML(
				contentDoc(
					'<publishDate_dt>2024-01-01T00:00:00.000Z</publishDate_dt><publishDate_dt_tz>UTC</publishDate_dt_tz>'
				),
				path,
				{ '/page/article': articleWithoutPersistedAdditionalFields } as never,
				{}
			);
		});
		assert.equal(
			messages.some((message) => message.includes('publishDate_dt_tz') && message.includes('was not found')),
			false
		);
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

	it('parses a nested plugin companion value and still logs an unrelated root field', () => {
		let instance: { items_o?: Array<{ note_s?: string; note_s_bk?: string }>; note_s_bk?: string };
		const messages = captureConsoleErrors(() => {
			instance = parseContentXML(
				contentDoc(`<note_s_bk>Root leftover</note_s_bk>
	<items_o>
		<item>
			<note_s>Hello</note_s>
			<note_s_bk>Backup</note_s_bk>
		</item>
	</items_o>`),
				path,
				{
					'/page/article': {
						fields: {
							items_o: {
								id: 'items_o',
								type: 'repeat',
								fields: {
									note_s: {
										id: 'note_s',
										type: 'backup-control',
										additionalFields: ['note_s_bk']
									}
								}
							}
						}
					}
				} as never,
				{}
			) as never;
		});
		assert.equal(instance.items_o?.[0]?.note_s, 'Hello');
		assert.equal(instance.items_o?.[0]?.note_s_bk, 'Backup');
		// Nested companions are not root fields; do not silence a same-named root tag via a recursive scan.
		assert.equal(
			messages.some(
				(message) =>
					message.includes('[parseContentXML]') &&
					message.includes('note_s_bk') &&
					message.includes('was not found') &&
					message.includes('/page/article')
			),
			true
		);
	});
});
