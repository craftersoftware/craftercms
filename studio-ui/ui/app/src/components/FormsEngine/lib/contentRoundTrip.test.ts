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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import type ContentInstance from '../../../models/ContentInstance';
import type ContentType from '../../../models/ContentType';
import type { FormsEngineAtoms, StableFormContextProps } from './formsEngineContext';
import '../../../../test/registerTsLoader.mjs';

const { window } = new JSDOM('');
Object.assign(globalThis, {
	DOMParser: window.DOMParser,
	XMLSerializer: window.XMLSerializer,
	Element: window.Element
});

const { createStore } = await import('jotai');
const { getItemDataSourceId, parseLegacyFormDefinition } = await import('../../../services/contentTypes.ts');
const { deserialize, entityEncodingTagValueProcessor, fromString } = await import('../../../utils/xml.ts');
const { createParsedValuesObject, deserializeContentDoc } = await import('./valueRetrievers.ts');
const { buildContentXml } = await import('./valueSerializers.ts');
const { complementValuesWithSystemProps, createObjectWithSystemProps, extractAtomValues, setFieldAtoms } =
	await import('./formUtils.tsx');
const { XmlKeys, xmlDataSourceAttribute } = await import('./formConsts.ts');
const { itemsFromTaxonomyDoc } = await import('../dataSources/modules/simpleTaxonomy.ts');
const { parseConfiguredListItems } = await import('../dataSources/modules/configuredList.ts');

const blueprintsDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../../../../../../studio/src/main/webapp/repo-bootstrap/global/blueprints'
);

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const file = path.join(dir, name);
		if (statSync(file).isDirectory()) {
			walk(file, out);
		} else {
			out.push(file);
		}
	}
	return out;
}

function parseType(xml: string) {
	return parseLegacyFormDefinition(
		deserialize(xml, { parseTagValue: false, tagValueProcessor: entityEncodingTagValueProcessor }).form
	);
}

/** Open the item for edit and save it without changes, as FormsEngine and useSaveForm do. */
function saveWithoutChanges(xml: string, contentTypesById: Record<string, ContentType>): Document {
	const contentObject = deserializeContentDoc(fromString(xml));
	const contentType = contentTypesById[contentObject[XmlKeys.contentTypeId] as string];
	const atoms = { valueByFieldId: {}, validationByFieldId: {} } as FormsEngineAtoms;
	const values = createParsedValuesObject(
		contentType.fields,
		contentObject,
		contentTypesById,
		(fieldId, value, isAdditional) =>
			setFieldAtoms(
				{ current: {} as StableFormContextProps },
				contentType,
				contentType.fields,
				fieldId,
				atoms,
				value,
				undefined,
				isAdditional
			)
	);
	const saved = extractAtomValues(createStore(), atoms.valueByFieldId);
	complementValuesWithSystemProps(values[XmlKeys.modelId] as string, saved, contentObject, contentType, false);
	const withoutFileName = { ...saved };
	delete withoutFileName[XmlKeys.fileName];
	return fromString(buildContentXml(withoutFileName, contentTypesById));
}

/** Element path => text, and element path@attribute => value. Item paths carry their index. */
function flatten(element: Element, prefix = '', out = new Map<string, string>()) {
	const counts: Record<string, number> = {};
	Array.from(element.attributes).forEach((attr) => out.set(`${prefix}@${attr.name}`, attr.value));
	if (!element.children.length) out.set(prefix, element.textContent.trim());
	Array.from(element.children).forEach((child) => {
		const index = (counts[child.tagName] = (counts[child.tagName] ?? -1) + 1);
		flatten(child, `${prefix}/${child.tagName}${child.tagName === 'item' ? `[${index}]` : ''}`, out);
	});
	return out;
}

const blueprints = existsSync(blueprintsDir) ? readdirSync(blueprintsDir) : [];

describe('no-edit save of blueprint content', { skip: !blueprints.length && 'blueprints not found' }, () => {
	for (const blueprint of blueprints) {
		const typesDir = path.join(blueprintsDir, blueprint, 'config/studio/content-types');
		if (!existsSync(typesDir)) continue;
		const contentTypesById = {};
		walk(typesDir)
			.filter((file) => file.endsWith('form-definition.xml'))
			.forEach((file) => {
				const type = parseType(readFileSync(file, 'utf8'));
				contentTypesById[type.id] = type;
			});
		for (const file of walk(path.join(blueprintsDir, blueprint, 'site')).filter((f) => f.endsWith('.xml'))) {
			const xml = readFileSync(file, 'utf8');
			const doc = fromString(xml);
			if (!contentTypesById[doc.querySelector(':scope > content-type')?.textContent.trim()]) continue;
			it(`${blueprint}${file.split('/site')[1]} keeps preserved elements, item attributes and text`, () => {
				const before = flatten(doc.documentElement);
				const after = flatten(saveWithoutChanges(xml, contentTypesById).documentElement);
				for (const [key, value] of before) {
					const kept =
						/\/(objectGroupId|orderDefault_f|placeInNav)$/.test(key) ||
						/\/item\[\d+\]@/.test(key) ||
						/\/item\[\d+\]\/[^/]+$/.test(key);
					if (kept) assert.equal(after.get(key), value, key);
				}
				const root = saveWithoutChanges(xml, contentTypesById).documentElement;
				const firstObjectId = root.getElementsByTagName(XmlKeys.modelId)[0];
				assert.equal(firstObjectId?.parentElement, root, 'the root objectId comes before any embedded one');
			});
		}
	}
});

const field = (id: string, type: string, extra = '') =>
	`<field><type>${type}</type><id>${id}</id><title>${id}</title><properties></properties><constraints></constraints>${extra}</field>`;
const typedType = parseType(`<form><title>T</title><content-type>/page/t</content-type><objectType>page</objectType>
	<properties></properties><sections><section><title>S</title><fields>
	${field('file-name', 'file-name')}${field('internal-name', 'input')}${field('code_s', 'input')}${field('notes_t', 'textarea')}
	${field('choice_s', 'dropdown')}${field('count_i', 'numeric-input')}${field('empty_i', 'numeric-input')}
	${field('flag_b', 'checkbox')}${field('placeInNav', 'page-nav-order')}${field('links_o', 'node-selector')}
	</fields></section></sections></form>`);
const typedXml = (body: string) =>
	`<page><content-type>/page/t</content-type><objectId>0123abcd-0000-0000-0000-000000000000</objectId>${body}</page>`;

describe('no-edit save of typed values', () => {
	const saved = saveWithoutChanges(
		typedXml(`<internal-name>2021</internal-name><code_s>007</code_s><notes_t>1e3</notes_t><choice_s>01</choice_s>
		<count_i>05</count_i><empty_i></empty_i><flag_b>true</flag_b><placeInNav>true</placeInNav><orderDefault_f>-1</orderDefault_f>
		<links_o item-list="true"><item datasource="ds"><key>/site/x.xml</key><value>1.50</value><include>/site/x.xml</include></item></links_o>`),
		{ [typedType.id]: typedType }
	).documentElement;
	const text = (selector: string) => saved.querySelector(selector)?.textContent;
	it('keeps numeric-looking text as written', () => {
		assert.equal(text('internal-name'), '2021');
		assert.equal(text('code_s'), '007');
		assert.equal(text('notes_t'), '1e3');
		assert.equal(text('choice_s'), '01');
		assert.equal(text('links_o > item > value'), '1.50');
	});
	it('keeps typed fields working', () => {
		assert.equal(text('count_i'), '5');
		assert.equal(text('empty_i'), '');
		assert.equal(text('flag_b'), 'true');
		assert.equal(text('placeInNav'), 'true');
		assert.equal(text('orderDefault_f'), '-1');
	});
	it('keeps item attributes', () => {
		assert.equal(saved.querySelector('links_o > item').getAttribute('datasource'), 'ds');
	});
});

describe('objectGroupId', () => {
	it('is created from the objectId', () => {
		const props = createObjectWithSystemProps(typedType);
		assert.equal(props[XmlKeys.groupId], (props[XmlKeys.modelId] as string).substring(0, 4));
	});
	it('is added on save when the stored item has none', () => {
		const saved = saveWithoutChanges(typedXml('<internal-name>A</internal-name>'), { [typedType.id]: typedType });
		assert.equal(saved.documentElement.querySelector(':scope > objectGroupId').textContent, '0123');
	});
});

describe('datasource option keys', () => {
	it('stay as written, so they match content values', () => {
		const items = '<item><key>01</key><value>A</value></item><item><key>1.50</key><value>B</value></item>';
		const keys = (list: Array<{ key: string }>) => list.map((item) => item.key);
		assert.deepEqual(keys(itemsFromTaxonomyDoc(fromString(`<component><items>${items}</items></component>`))), [
			'01',
			'1.50'
		]);
		assert.deepEqual(keys(parseConfiguredListItems(fromString(`<list><values>${items}</values></list>`))), [
			'01',
			'1.50'
		]);
	});
});

describe('XB item datasource', () => {
	const prop = (name: string, value: string, type = 'boolean') =>
		`<property><name>${name}</name><value>${value}</value><type>${type}</type></property>`;
	const dataSource = (id: string, contentTypes: string, props: string) =>
		`<datasource><type>components</type><id>${id}</id><title>${id}</title><interface>item</interface><properties>${prop('contentTypes', contentTypes, 'contentTypes')}${props}</properties></datasource>`;
	const type = parseType(`<form><title>T</title><content-type>/page/t</content-type><objectType>page</objectType>
		<properties></properties><sections><section><title>S</title><fields><field><type>node-selector</type><id>items_o</id>
		<title>Items</title><properties>${prop('itemManager', 'a,b', 'datasource:item')}</properties><constraints></constraints></field>
		</fields></section></sections><datasources>${dataSource('a', '/component/x,/component/y', prop('allowEmbedded', 'true'))}
		${dataSource('b', '/component/y', prop('allowEmbedded', 'true') + prop('enableBrowse', 'true'))}</datasources></form>`);
	const id = (itemType: string, mode: 'embedded' | 'shared' | 'sharedExisting') =>
		getItemDataSourceId(type, type.fields.items_o, itemType, mode);
	it('is the only data source that allows the item', () => {
		assert.equal(id('/component/x', 'embedded'), 'a');
		assert.equal(id('/component/y', 'sharedExisting'), 'b');
	});
	it('is unknown when none or several data sources allow the item', () => {
		assert.equal(id('/component/x', 'shared'), undefined);
		assert.equal(id('/component/y', 'embedded'), undefined);
	});
	it('is written by XB inserts only when known', async (t) => {
		const { insertComponent, insertInstance } = await import('../../../services/content.ts');
		const { getCurrentIntl } = await import('../../../utils/i18n.ts');
		// Messages get their ids at build time, so the version comment is stubbed.
		const intl = getCurrentIntl();
		const { formatMessage } = intl;
		const { XMLHttpRequest } = globalThis;
		t.after(() => {
			Object.assign(intl, { formatMessage });
			Object.assign(globalThis, { XMLHttpRequest });
		});
		Object.assign(intl, { formatMessage: () => '' });
		// XB inserts read the parent document and write it back through the API, so XHR is faked here.
		const written: string[] = [];
		class FakeXhr extends EventTarget {
			status = 0;
			response: unknown = null;
			responseType = '';
			upload = new EventTarget();
			#method = '';
			open(method: string) {
				this.#method = method;
			}
			setRequestHeader() {}
			abort() {}
			getResponseHeader() {
				return 'application/xml';
			}
			getAllResponseHeaders() {
				return 'content-type: application/xml';
			}
			send(body: string) {
				const isGet = this.#method === 'GET';
				if (!isGet && body.includes('"content"')) written.push(JSON.parse(body).content);
				this.status = 200;
				this.response = isGet
					? new Blob(['<page><objectId>p</objectId><items_o item-list="true"></items_o></page>'])
					: {};
				queueMicrotask(() => this.dispatchEvent(new Event('load')));
			}
		}
		Object.assign(globalThis, { XMLHttpRequest: FakeXhr });
		const item = (contentTypeId: string) => ({
			craftercms: { id: 'abcd1234', label: 'L', path: '/site/c.xml', contentTypeId }
		});
		const lastItem = () => fromString(written.at(-1)).querySelector('items_o > item');
		const run = (observable) =>
			new Promise((resolve, reject) => observable.subscribe({ complete: resolve, error: reject }));
		await run(insertInstance('s', '/site/p.xml', 'p', 'items_o', 0, type, item('/component/y') as ContentInstance));
		assert.equal(lastItem().getAttribute('datasource'), 'b');
		await run(insertInstance('s', '/site/p.xml', 'p', 'items_o', 0, type, item('/component/x') as ContentInstance));
		assert.equal(lastItem().hasAttribute('datasource'), false);
		await run(
			insertComponent(
				's',
				'/site/p.xml',
				'p',
				'items_o',
				0,
				type,
				item('/component/y') as ContentInstance,
				{ id: '/component/y' } as ContentType
			)
		);
		assert.equal(lastItem().hasAttribute('datasource'), false);
		assert.equal(lastItem().querySelector('component > objectGroupId').textContent, 'abcd');
	});
});

describe('node selector datasource', () => {
	it('stamps a known data source id and leaves items unchanged when it is unknown', async () => {
		const { withDataSourceId } = await import('../controls/NodeSelector.tsx');
		const item = { key: '/site/x.xml', value: 'X', include: '/site/x.xml' };
		const [stamped] = withDataSourceId([item], 'ds');
		assert.equal(stamped[xmlDataSourceAttribute], 'ds');
		assert.equal(stamped.key, item.key);
		assert.equal(stamped.value, item.value);
		assert.equal(stamped.include, item.include);
		assert.equal(item[xmlDataSourceAttribute], undefined);
		const items = [item];
		assert.equal(withDataSourceId(items, undefined), items);
		assert.equal(withDataSourceId(items, '')[0][xmlDataSourceAttribute], undefined);
	});
});

describe('XB duplicate', () => {
	it('gives a component new ids, even without file-name or objectGroupId', async () => {
		const { updateComponentId } = await import('../../../services/content.ts');
		const component = fromString(
			'<component><internal-name>A</internal-name><objectId>old</objectId></component>'
		).documentElement;
		updateComponentId(component, 'ef01aaaa-0000');
		assert.equal(component.querySelector(':scope > objectId').textContent, 'ef01aaaa-0000');
		assert.equal(component.querySelector(':scope > objectId').previousElementSibling.tagName, 'objectGroupId');
		assert.equal(component.querySelector(':scope > objectGroupId').textContent, 'ef01');
		updateComponentId(component, '2345bbbb-0000');
		assert.equal(component.querySelectorAll(':scope > objectGroupId').length, 1);
		assert.equal(component.querySelector(':scope > objectGroupId').textContent, '2345');
	});
});
