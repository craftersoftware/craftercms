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
import '../../../../test/registerTsLoader.mjs';
import type ContentType from '../../../models/ContentType';
import type { ContentTypeField } from '../../../models/ContentType';
import type { NodeSelectorItem } from '../controls/NodeSelector';

const { applyNodeSelectorMove, applyNodeSelectorMoveToValues, readValuesWithOpenForms, undoNodeSelectorMove } =
	await import('./applyNodeSelectorMove.ts');
const { enumerateNodeSelectorMoveTargets } = await import('./nodeSelectorMoveTargets.ts');
const { buildContentXml } = await import('./valueSerializers.ts');
const { createStore } = await import('jotai');
const { createFieldAtoms, createFormStackData } = await import('./formUtils.tsx');

function nsField(id: string, name: string, allowed: string[]): ContentTypeField {
	return {
		id,
		name,
		type: 'node-selector',
		sortable: false,
		validations: {
			allowedContentTypes: {
				id: 'allowedContentTypes',
				level: 'required',
				value: Object.fromEntries(allowed.map((typeId) => [typeId, { embedded: true, shared: true }]))
			}
		}
	};
}

function type(id: string, fields: ContentTypeField[]): ContentType {
	return {
		id,
		name: id,
		type: id.startsWith('/page') ? 'page' : 'component',
		displayTemplate: '',
		sections: [],
		fields: Object.fromEntries(fields.map((field) => [field.id, field])),
		dataSources: null,
		quickCreate: false,
		quickCreatePath: '',
		hasLegacyFormDefinitionPath: false
	};
}

const heroType = '/component/hero';
const pageType = type('/page/home', [
	nsField('left_o', 'Left Rail', [heroType]),
	nsField('right_o', 'Right Rail', [heroType])
]);
const heroContentType = type(heroType, [nsField('children_o', 'Children', [heroType])]);
const contentTypesById = {
	[pageType.id]: pageType,
	[heroType]: heroContentType
};

function embeddedHero(key: string, label: string, children: NodeSelectorItem[] = []): NodeSelectorItem {
	return {
		key,
		value: label,
		component: {
			'content-type': heroType,
			objectId: key,
			'internal-name': label,
			children_o: children
		}
	};
}

function sharedHero(path: string, label: string): NodeSelectorItem {
	return { key: path, value: label, include: path };
}

const rootModelId = 'page-1';

describe('applyNodeSelectorMoveToValues', () => {
	it('moves a shared item between root node-selectors and preserves include', () => {
		const moving = sharedHero('/site/components/hero.xml', 'Shared');
		const other = sharedHero('/site/components/other.xml', 'Other');
		const result = applyNodeSelectorMoveToValues({
			rootValues: { left_o: [moving, other], right_o: [] },
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			item: moving,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 },
			target: { modelId: rootModelId, fieldId: 'right_o' },
			targetIndex: 0
		});
		assert.ok(result);
		assert.deepEqual(
			(result.rootValues.left_o as NodeSelectorItem[]).map((item) => item.key),
			[other.key]
		);
		assert.deepEqual(result.rootValues.right_o, [moving]);
		assert.equal(moving.include, '/site/components/hero.xml');
		assert.deepEqual(result.changedRootFieldIds.sort(), ['left_o', 'right_o']);
		assert.equal(result.insertedIndex, 0);
	});

	it('moves an embedded item between root fields without losing component content', () => {
		const child = embeddedHero('child', 'Child');
		const moving = embeddedHero('h1', 'Hero', [child]);
		const result = applyNodeSelectorMoveToValues({
			rootValues: { left_o: [moving], right_o: [] },
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			item: moving,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 },
			target: { modelId: rootModelId, fieldId: 'right_o' },
			targetIndex: 0
		});
		assert.ok(result);
		assert.deepEqual(result.rootValues.left_o, []);
		const landed = (result.rootValues.right_o as NodeSelectorItem[])[0];
		assert.equal(landed.key, 'h1');
		assert.deepEqual(landed.component?.children_o, [child]);
	});

	it('moves into a nested field under an embedded owner and only dirties the root parent field', () => {
		const moving = embeddedHero('h2', 'Hero Two');
		const parent = embeddedHero('p1', 'Parent');
		const result = applyNodeSelectorMoveToValues({
			rootValues: { left_o: [parent, moving], right_o: [] },
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			item: moving,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 1 },
			target: { modelId: parent.key, fieldId: 'children_o' },
			targetIndex: 0
		});
		assert.ok(result);
		const left = result.rootValues.left_o as NodeSelectorItem[];
		assert.equal(left.length, 1);
		assert.equal(left[0].key, 'p1');
		assert.deepEqual(left[0].component?.children_o, [moving]);
		assert.deepEqual(result.changedRootFieldIds, ['left_o']);
	});

	it('moves out of a nested field up to an ancestor root field', () => {
		const child = embeddedHero('c1', 'Child');
		const parent = embeddedHero('p1', 'Parent', [child]);
		const result = applyNodeSelectorMoveToValues({
			rootValues: { left_o: [parent], right_o: [] },
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			item: child,
			source: { modelId: parent.key, fieldId: 'children_o', index: 0 },
			target: { modelId: rootModelId, fieldId: 'right_o' },
			targetIndex: 0
		});
		assert.ok(result);
		const left = result.rootValues.left_o as NodeSelectorItem[];
		assert.deepEqual(left[0].component?.children_o, []);
		assert.deepEqual(result.rootValues.right_o, [child]);
		assert.deepEqual(result.changedRootFieldIds.sort(), ['left_o', 'right_o']);
	});

	it('inserts at the requested splice index in the destination field', () => {
		const moving = embeddedHero('a', 'A');
		const b = embeddedHero('b', 'B');
		const c = embeddedHero('c', 'C');
		const result = applyNodeSelectorMoveToValues({
			rootValues: { left_o: [moving], right_o: [b, c] },
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			item: moving,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 },
			target: { modelId: rootModelId, fieldId: 'right_o' },
			targetIndex: 1
		});
		assert.ok(result);
		assert.deepEqual(result.rootValues.left_o, []);
		assert.deepEqual(
			(result.rootValues.right_o as NodeSelectorItem[]).map((item) => item.key),
			['b', 'a', 'c']
		);
		assert.equal(result.insertedIndex, 1);
	});

	it('returns null when the source index is out of range', () => {
		const moving = embeddedHero('h1', 'Hero');
		const result = applyNodeSelectorMoveToValues({
			rootValues: { left_o: [moving], right_o: [] },
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			item: moving,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 4 },
			target: { modelId: rootModelId, fieldId: 'right_o' },
			targetIndex: 0
		});
		assert.equal(result, null);
	});

	it('serializes like a normal form save: shared include and embed content land in the destination field', () => {
		const shared = sharedHero('/site/components/hero.xml', 'Shared');
		const child = embeddedHero('child', 'Child');
		const embedded = embeddedHero('h1', 'Hero', [child]);
		const sharedMove = applyNodeSelectorMoveToValues({
			rootValues: {
				'content-type': pageType.id,
				objectId: rootModelId,
				left_o: [shared],
				right_o: []
			},
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			item: shared,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 },
			target: { modelId: rootModelId, fieldId: 'right_o' },
			targetIndex: 0
		});
		assert.ok(sharedMove);
		const sharedXml = buildContentXml(sharedMove.rootValues as never, contentTypesById);
		assert.match(sharedXml, /<right_o[\s\S]*<include>\/site\/components\/hero\.xml<\/include>/);
		assert.doesNotMatch(sharedXml, /<left_o[\s\S]*hero\.xml[\s\S]*<\/left_o>/);

		const embedMove = applyNodeSelectorMoveToValues({
			rootValues: {
				'content-type': pageType.id,
				objectId: rootModelId,
				left_o: [embedded],
				right_o: []
			},
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			item: embedded,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 },
			target: { modelId: rootModelId, fieldId: 'right_o' },
			targetIndex: 0
		});
		assert.ok(embedMove);
		const embedXml = buildContentXml(embedMove.rootValues as never, contentTypesById);
		assert.match(embedXml, /<right_o[\s\S]*<objectId>h1<\/objectId>[\s\S]*<objectId>child<\/objectId>/);
		assert.doesNotMatch(embedXml, /<left_o[\s\S]*<objectId>h1<\/objectId>[\s\S]*<\/left_o>/);
	});
});

describe('applyNodeSelectorMove', () => {
	it('writes changed root atoms and tracks them as dirty', () => {
		const moving = embeddedHero('h1', 'Hero');
		const store = createStore();
		const context = createFormStackData({
			itemMeta: { path: '/site/website/index.xml', id: rootModelId } as never,
			originalValues: { left_o: [moving], right_o: [] }
		});
		context.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
		for (const field of Object.values(pageType.fields)) {
			const [valueAtom, validationAtom] = createFieldAtoms(field, context.originalValues[field.id], {
				current: context
			});
			context.atoms.valueByFieldId[field.id] = valueAtom;
			context.atoms.validationByFieldId[field.id] = validationAtom;
		}
		const emitted: string[] = [];
		context.fieldUpdates$.subscribe((update) => emitted.push(update.fieldId));

		const result = applyNodeSelectorMove({
			store,
			rootForm: context,
			item: moving,
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 },
			target: { modelId: rootModelId, fieldId: 'right_o' },
			targetIndex: 0
		});

		assert.ok(result);
		assert.deepEqual(store.get(context.atoms.valueByFieldId.left_o), []);
		assert.deepEqual(store.get(context.atoms.valueByFieldId.right_o), [moving]);
		assert.deepEqual([...store.get(context.changedFieldIds!)].sort(), ['left_o', 'right_o']);
		assert.deepEqual(emitted.sort(), ['left_o', 'right_o']);
	});

	it('syncs an open stacked form atom when the move targets that model', () => {
		const moving = embeddedHero('h2', 'Hero Two');
		const parent = embeddedHero('p1', 'Parent');
		const store = createStore();
		const rootForm = createFormStackData({
			itemMeta: { path: '/site/website/index.xml', id: rootModelId } as never,
			originalValues: { left_o: [parent, moving], right_o: [] }
		});
		rootForm.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
		for (const field of Object.values(pageType.fields)) {
			const [valueAtom, validationAtom] = createFieldAtoms(field, rootForm.originalValues[field.id], {
				current: rootForm
			});
			rootForm.atoms.valueByFieldId[field.id] = valueAtom;
			rootForm.atoms.validationByFieldId[field.id] = validationAtom;
		}

		const childForm = createFormStackData({
			itemMeta: { path: '/site/website/index.xml', id: parent.key, contentType: heroContentType } as never,
			originalValues: { children_o: [] }
		});
		childForm.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
		const childrenField = heroContentType.fields.children_o;
		const [childrenAtom, childrenValidation] = createFieldAtoms(childrenField, [], { current: childForm });
		childForm.atoms.valueByFieldId.children_o = childrenAtom;
		childForm.atoms.validationByFieldId.children_o = childrenValidation;

		const result = applyNodeSelectorMove({
			store,
			rootForm,
			item: moving,
			formsStackData: [rootForm, childForm],
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 1 },
			target: { modelId: parent.key, fieldId: 'children_o' },
			targetIndex: 0
		});

		assert.ok(result);
		assert.deepEqual(store.get(childForm.atoms.valueByFieldId.children_o), [moving]);
		const left = store.get(rootForm.atoms.valueByFieldId.left_o) as (typeof parent)[];
		assert.equal(left.length, 1);
		assert.deepEqual(left[0].component?.children_o, [moving]);
	});

	it('preserves unsaved stacked-form list items when moving into that field', () => {
		const moving = embeddedHero('h2', 'Hero Two');
		const unsaved = embeddedHero('u1', 'Unsaved Child');
		// Root still has an empty children_o; the open stacked form has an unsaved item.
		const parent = embeddedHero('p1', 'Parent');
		const store = createStore();
		const rootForm = createFormStackData({
			itemMeta: { path: '/site/website/index.xml', id: rootModelId } as never,
			originalValues: { left_o: [parent, moving], right_o: [] }
		});
		rootForm.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
		for (const field of Object.values(pageType.fields)) {
			const [valueAtom, validationAtom] = createFieldAtoms(field, rootForm.originalValues[field.id], {
				current: rootForm
			});
			rootForm.atoms.valueByFieldId[field.id] = valueAtom;
			rootForm.atoms.validationByFieldId[field.id] = validationAtom;
		}

		const childForm = createFormStackData({
			itemMeta: { path: '/site/website/index.xml', id: parent.key, contentType: heroContentType } as never,
			originalValues: { children_o: [unsaved] }
		});
		childForm.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
		const childrenField = heroContentType.fields.children_o;
		const [childrenAtom, childrenValidation] = createFieldAtoms(childrenField, [unsaved], { current: childForm });
		childForm.atoms.valueByFieldId.children_o = childrenAtom;
		childForm.atoms.validationByFieldId.children_o = childrenValidation;

		const result = applyNodeSelectorMove({
			store,
			rootForm,
			item: moving,
			formsStackData: [rootForm, childForm],
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 1 },
			target: { modelId: parent.key, fieldId: 'children_o' },
			targetIndex: 1
		});

		assert.ok(result);
		assert.deepEqual(
			(store.get(childForm.atoms.valueByFieldId.children_o) as NodeSelectorItem[]).map((item) => item.key),
			['u1', 'h2']
		);
		const left = store.get(rootForm.atoms.valueByFieldId.left_o) as NodeSelectorItem[];
		assert.equal(left.length, 1);
		assert.deepEqual(
			(left[0].component?.children_o as NodeSelectorItem[]).map((item) => item.key),
			['u1', 'h2']
		);
	});

	it('counts the open stacked-form items when enumerating destinations, not just the root copy', () => {
		const x = embeddedHero('x', 'X');
		const a = embeddedHero('a', 'A');
		const n = embeddedHero('n', 'N');
		// Root copy of the parent knows only [a]; its open form has [a, n] and maxCount is 2.
		const parent = embeddedHero('p1', 'Parent', [a]);
		const store = createStore();
		const rootForm = createFormStackData({
			itemMeta: { path: '/site/website/index.xml', id: rootModelId } as never,
			originalValues: { left_o: [parent, x], right_o: [] }
		});
		rootForm.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
		for (const field of Object.values(pageType.fields)) {
			const [valueAtom, validationAtom] = createFieldAtoms(field, rootForm.originalValues[field.id], {
				current: rootForm
			});
			rootForm.atoms.valueByFieldId[field.id] = valueAtom;
			rootForm.atoms.validationByFieldId[field.id] = validationAtom;
		}

		const cappedChildren: ContentTypeField = {
			...heroContentType.fields.children_o,
			validations: {
				...heroContentType.fields.children_o.validations,
				maxCount: { id: 'maxCount', level: 'required', value: 2 }
			}
		};
		const cappedHeroType = { ...heroContentType, fields: { children_o: cappedChildren } };
		const cappedTypes = { ...contentTypesById, [heroType]: cappedHeroType };
		const childForm = createFormStackData({
			itemMeta: { path: '/site/website/index.xml', id: parent.key, contentType: cappedHeroType } as never,
			originalValues: { children_o: [a, n] }
		});
		childForm.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
		const [childrenAtom, childrenValidation] = createFieldAtoms(cappedChildren, [a, n], { current: childForm });
		childForm.atoms.valueByFieldId.children_o = childrenAtom;
		childForm.atoms.validationByFieldId.children_o = childrenValidation;

		const targets = enumerateNodeSelectorMoveTargets({
			item: x,
			itemContentTypeId: heroType,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 1 },
			rootModelId,
			rootValues: readValuesWithOpenForms(store, [rootForm, childForm], pageType, cappedTypes),
			rootContentType: pageType,
			contentTypesById: cappedTypes
		});

		const children = targets.find((target) => target.modelId === parent.key && target.fieldId === 'children_o');
		assert.equal(children?.disabled, true);
		assert.equal(children?.reason, 'maxCount');
		assert.deepEqual(
			children?.items.map((item) => item.key),
			['a', 'n']
		);
	});

	it('removes from the open stacked-form source list, not a stale root copy', () => {
		const a = embeddedHero('a', 'A');
		const b = embeddedHero('b', 'B');
		const c = embeddedHero('c', 'C');
		// Root embed only knows about [a]; stacked form has unsaved [a, b, c].
		const parent = embeddedHero('p1', 'Parent', [a]);
		const store = createStore();
		const rootForm = createFormStackData({
			itemMeta: { path: '/site/website/index.xml', id: rootModelId } as never,
			originalValues: { left_o: [parent], right_o: [] }
		});
		rootForm.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
		for (const field of Object.values(pageType.fields)) {
			const [valueAtom, validationAtom] = createFieldAtoms(field, rootForm.originalValues[field.id], {
				current: rootForm
			});
			rootForm.atoms.valueByFieldId[field.id] = valueAtom;
			rootForm.atoms.validationByFieldId[field.id] = validationAtom;
		}

		const childForm = createFormStackData({
			itemMeta: { path: '/site/website/index.xml', id: parent.key, contentType: heroContentType } as never,
			originalValues: { children_o: [a, b, c] }
		});
		childForm.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
		const childrenField = heroContentType.fields.children_o;
		const [childrenAtom, childrenValidation] = createFieldAtoms(childrenField, [a, b, c], { current: childForm });
		childForm.atoms.valueByFieldId.children_o = childrenAtom;
		childForm.atoms.validationByFieldId.children_o = childrenValidation;

		const result = applyNodeSelectorMove({
			store,
			rootForm,
			item: b,
			formsStackData: [rootForm, childForm],
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			source: { modelId: parent.key, fieldId: 'children_o', index: 1 },
			target: { modelId: rootModelId, fieldId: 'right_o' },
			targetIndex: 0
		});

		assert.ok(result);
		assert.deepEqual(
			(store.get(childForm.atoms.valueByFieldId.children_o) as NodeSelectorItem[]).map((item) => item.key),
			['a', 'c']
		);
		assert.deepEqual(store.get(rootForm.atoms.valueByFieldId.right_o), [b]);
		const left = store.get(rootForm.atoms.valueByFieldId.left_o) as NodeSelectorItem[];
		assert.deepEqual(
			(left[0].component?.children_o as NodeSelectorItem[]).map((item) => item.key),
			['a', 'c']
		);
	});

	it('keeps the moved item when the source field is an ancestor of the target field', () => {
		// P.children = [Q, M]; M moves into Q.children. The open P form must show Q with M inside it.
		const m = embeddedHero('m', 'M');
		const q = embeddedHero('q', 'Q');
		const p = embeddedHero('p', 'P', [q, m]);
		const store = createStore();
		const rootForm = createFormStackData({
			itemMeta: { path: '/site/website/index.xml', id: rootModelId } as never,
			originalValues: { left_o: [p], right_o: [] }
		});
		rootForm.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
		for (const field of Object.values(pageType.fields)) {
			const [valueAtom, validationAtom] = createFieldAtoms(field, rootForm.originalValues[field.id], {
				current: rootForm
			});
			rootForm.atoms.valueByFieldId[field.id] = valueAtom;
			rootForm.atoms.validationByFieldId[field.id] = validationAtom;
		}

		const parentForm = createFormStackData({
			itemMeta: { path: '/site/website/index.xml', id: p.key } as never,
			originalValues: { children_o: [q, m] }
		});
		parentForm.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
		const childrenField = heroContentType.fields.children_o;
		const [childrenAtom, childrenValidation] = createFieldAtoms(childrenField, [q, m], { current: parentForm });
		parentForm.atoms.valueByFieldId.children_o = childrenAtom;
		parentForm.atoms.validationByFieldId.children_o = childrenValidation;

		const result = applyNodeSelectorMove({
			store,
			rootForm,
			item: m,
			formsStackData: [rootForm, parentForm],
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			source: { modelId: p.key, fieldId: 'children_o', index: 1 },
			target: { modelId: q.key, fieldId: 'children_o' },
			targetIndex: 0
		});

		assert.ok(result);
		const parentChildren = store.get(parentForm.atoms.valueByFieldId.children_o) as NodeSelectorItem[];
		assert.deepEqual(
			parentChildren.map((item) => item.key),
			['q']
		);
		assert.deepEqual(
			(parentChildren[0].component?.children_o as NodeSelectorItem[]).map((item) => item.key),
			['m']
		);
		const left = store.get(rootForm.atoms.valueByFieldId.left_o) as NodeSelectorItem[];
		const rootChildren = left[0].component?.children_o as NodeSelectorItem[];
		assert.deepEqual(
			rootChildren.map((item) => item.key),
			['q']
		);
		assert.deepEqual(
			(rootChildren[0].component?.children_o as NodeSelectorItem[]).map((item) => item.key),
			['m']
		);
	});
});

describe('undoNodeSelectorMove', () => {
	function pageForm(originalValues: Record<string, NodeSelectorItem[]>) {
		const store = createStore();
		const rootForm = createFormStackData({
			itemMeta: { path: '/site/website/index.xml', id: rootModelId, contentType: pageType } as never,
			originalValues
		});
		rootForm.atoms = { valueByFieldId: {}, validationByFieldId: {} } as never;
		for (const field of Object.values(pageType.fields)) {
			const [valueAtom, validationAtom] = createFieldAtoms(field, rootForm.originalValues[field.id], {
				current: rootForm
			});
			rootForm.atoms.valueByFieldId[field.id] = valueAtom;
			rootForm.atoms.validationByFieldId[field.id] = validationAtom;
		}
		return { store, rootForm };
	}

	const keys = (
		store: ReturnType<typeof createStore>,
		rootForm: ReturnType<typeof createFormStackData>,
		fieldId: string
	) => (store.get(rootForm.atoms.valueByFieldId[fieldId]) as NodeSelectorItem[]).map((item) => item.key);

	it('restores the moved item after the destination list is reordered', () => {
		const moving = embeddedHero('h1', 'Hero');
		const other = embeddedHero('h2', 'Other');
		const { store, rootForm } = pageForm({ left_o: [moving], right_o: [other] });
		const applied = applyNodeSelectorMove({
			store,
			rootForm,
			item: moving,
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 },
			target: { modelId: rootModelId, fieldId: 'right_o' },
			targetIndex: 0
		});
		assert.ok(applied);
		// The move landed at index 0. Reorder puts it last.
		store.set(rootForm.atoms.valueByFieldId.right_o, [other, moving]);

		const undone = undoNodeSelectorMove({
			store,
			documentStack: [rootForm],
			contentTypesById,
			applied: { modelId: rootModelId, fieldId: 'right_o', index: applied.insertedIndex, item: applied.item },
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 }
		});

		assert.ok(undone);
		assert.deepEqual(keys(store, rootForm, 'left_o'), ['h1']);
		assert.deepEqual(keys(store, rootForm, 'right_o'), ['h2']);
	});

	it('restores edits made to the item after the move', () => {
		const moving = embeddedHero('h1', 'Hero');
		const { store, rootForm } = pageForm({ left_o: [moving], right_o: [] });
		const applied = applyNodeSelectorMove({
			store,
			rootForm,
			item: moving,
			rootModelId,
			rootContentType: pageType,
			contentTypesById,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 },
			target: { modelId: rootModelId, fieldId: 'right_o' },
			targetIndex: 0
		});
		assert.ok(applied);
		const edited: NodeSelectorItem = {
			...moving,
			value: 'Renamed',
			component: { ...moving.component, 'internal-name': 'Renamed' }
		};
		store.set(rootForm.atoms.valueByFieldId.right_o, [edited]);

		const undone = undoNodeSelectorMove({
			store,
			documentStack: [rootForm],
			contentTypesById,
			applied: { modelId: rootModelId, fieldId: 'right_o', index: applied.insertedIndex, item: applied.item },
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 }
		});

		assert.ok(undone);
		const restored = (store.get(rootForm.atoms.valueByFieldId.left_o) as NodeSelectorItem[])[0];
		assert.equal(restored.value, 'Renamed');
		assert.equal(restored.component?.['internal-name'], 'Renamed');
		assert.deepEqual(keys(store, rootForm, 'right_o'), []);
	});
});
