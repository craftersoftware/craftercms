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
import type ContentType from '../../../models/ContentType';
import type { ContentTypeField } from '../../../models/ContentType';
import '../../../../test/registerTsLoader.mjs';

const { window } = new JSDOM('<!doctype html><html><body></body></html>');
Object.assign(globalThis, {
	DOMParser: window.DOMParser,
	XMLSerializer: window.XMLSerializer,
	Element: window.Element,
	document: window.document
});

const { createStore } = await import('jotai');
const { embeddedComponentFromParentField, getFormContextPath, prepareEmbeddedItemForm } =
	await import('./formUtils.tsx');
const { buildContentXml } = await import('./valueSerializers.ts');
const { processPathMacros } = await import('../../../utils/path.ts');

const OID = 'nested-oid';
const itemsField = { id: 'items_o', name: 'Items', type: 'node-selector', validations: {} } as ContentTypeField;
const pageType = {
	id: '/page/p',
	type: 'page',
	fields: { items_o: itemsField },
	sections: []
} as unknown as ContentType;
const compType = {
	id: '/component/c',
	type: 'component',
	fields: {},
	sections: []
} as unknown as ContentType;
const types = { [pageType.id]: pageType, [compType.id]: compType };

describe('embeddedComponentFromParentField', () => {
	it('reads XML-deserialized { item: [...] } shape', () => {
		const nested = { objectId: 'nested-1', 'internal-name': 'Child' };
		const fieldValue = { item: [{ component: nested }] };
		assert.equal(embeddedComponentFromParentField(fieldValue, 0), nested);
	});

	it('reads a single XML item object (not an array)', () => {
		const nested = { objectId: 'nested-1' };
		const fieldValue = { item: { component: nested } };
		assert.equal(embeddedComponentFromParentField(fieldValue, 0), nested);
	});

	it('reads in-session NodeSelectorItem[] form values', () => {
		const nested = { objectId: 'nested-2', 'internal-name': 'Child' };
		const fieldValue = [{ key: 'nested-2', value: 'Child', component: nested }];
		assert.equal(embeddedComponentFromParentField(fieldValue, 0), nested);
	});

	it('returns undefined for missing or unmatched shapes', () => {
		assert.equal(embeddedComponentFromParentField(undefined, 0), undefined);
		assert.equal(embeddedComponentFromParentField({ item: [] }, 0), undefined);
		assert.equal(embeddedComponentFromParentField([], 0), undefined);
		assert.equal(embeddedComponentFromParentField('x', 0), undefined);
	});
});

describe('prepareEmbeddedItemForm', () => {
	it('prepareEmbeddedItemForm reads the component from an in-session (form-shaped) parent', () => {
		const component = { 'content-type': '/component/c', objectId: OID, 'internal-name': 'Comp' };
		const parentValues = {
			'content-type': '/page/p',
			objectId: 'p1',
			items_o: [{ key: OID, value: 'Comp', component }]
		};
		const req = prepareEmbeddedItemForm({
			username: 'u',
			contentType: compType,
			locked: true,
			lockError: null,
			affectedPackages: null,
			update: { path: undefined, modelId: OID, values: component },
			parentStackData: {
				itemMeta: { contentXml: buildContentXml(parentValues, types), contentObject: parentValues }
			},
			stableFormContextRef: { current: { store: createStore() } },
			parentPathInSite: '/site/website/about/index.xml',
			siteId: 's',
			contentTypesById: types
		} as never);
		assert.equal(req.itemMeta.contentObject, component);
	});
});

describe('getFormContextPath', () => {
	it('prefers item.path, then updatePath, then pathInSite', () => {
		assert.equal(getFormContextPath({ item: { path: '/a' }, updatePath: '/b', pathInSite: '/c' }), '/a');
		assert.equal(getFormContextPath({ item: null, updatePath: '/b', pathInSite: '/c' }), '/b');
		assert.equal(getFormContextPath({ item: null, updatePath: undefined, pathInSite: '/c' }), '/c');
		assert.equal(getFormContextPath({ item: null, updatePath: undefined, pathInSite: undefined }), undefined);
	});

	it('two levels of embedded create resolve {parentPath[0]} from the root item path', () => {
		const rootPath = '/site/website/articles/foo/index.xml';
		// L1/L2 embedded creates have no ContentItem and no update.path; prepareEmbeddedItemForm
		// keeps pathInSite as the root physical path down the stack.
		const l1Path = getFormContextPath({ item: null, updatePath: undefined, pathInSite: rootPath });
		const l2Path = getFormContextPath({ item: null, updatePath: undefined, pathInSite: l1Path });
		assert.equal(
			processPathMacros({
				path: '/site/components/{parentPath[0]}',
				objectId: 'nested',
				fullParentPath: l2Path
			}),
			'/site/components/articles'
		);
	});
});
