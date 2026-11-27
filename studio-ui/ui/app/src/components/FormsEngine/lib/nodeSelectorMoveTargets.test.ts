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

const {
	collectEmbeddedSelfAndDescendantIds,
	documentFormStack,
	embeddedItemContentTypeId,
	enumerateNodeSelectorMoveTargets
} = await import('./nodeSelectorMoveTargets.ts');

function nsField(
	id: string,
	name: string,
	options: {
		allowed?: string[];
		maxCount?: number;
		allowDuplicates?: boolean;
		readonly?: boolean;
	} = {}
): ContentTypeField {
	const allowed = options.allowed ?? ['/component/hero'];
	const validations: ContentTypeField['validations'] = {
		allowedContentTypes: {
			id: 'allowedContentTypes',
			level: 'required',
			value: Object.fromEntries(allowed.map((typeId) => [typeId, { embedded: true, shared: true }]))
		}
	};
	if (options.maxCount != null) {
		validations.maxCount = { id: 'maxCount', level: 'required', value: options.maxCount };
	}
	if (options.allowDuplicates != null) {
		validations.allowDuplicates = { id: 'allowDuplicates', level: 'required', value: options.allowDuplicates };
	}
	return {
		id,
		name,
		type: 'node-selector',
		sortable: false,
		validations,
		properties: options.readonly ? { readonly: { name: 'readonly', type: 'boolean', value: true } } : undefined
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
const featureType = '/component/feature';

const pageType = type('/page/home', [
	nsField('left_o', 'Left Rail', { allowed: [heroType, featureType] }),
	nsField('right_o', 'Right Rail', { allowed: [heroType], maxCount: 1 }),
	nsField('footer_o', 'Footer', { allowed: [featureType] }),
	nsField('locked_o', 'Locked', { allowed: [heroType], readonly: true })
]);

const heroContentType = type(heroType, [nsField('children_o', 'Children', { allowed: [heroType, featureType] })]);

const featureContentType = type(featureType, []);

const contentTypesById = {
	[pageType.id]: pageType,
	[heroType]: heroContentType,
	[featureType]: featureContentType
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

describe('embeddedItemContentTypeId', () => {
	it('reads content-type from the embedded component', () => {
		assert.equal(embeddedItemContentTypeId(embeddedHero('h1', 'Hero')), heroType);
		assert.equal(embeddedItemContentTypeId(sharedHero('/site/components/h.xml', 'Hero')), undefined);
	});
});

describe('collectEmbeddedSelfAndDescendantIds', () => {
	it('collects the item and nested embedded keys', () => {
		const nested = embeddedHero('child', 'Child');
		const parent = embeddedHero('parent', 'Parent', [nested]);
		assert.deepEqual([...collectEmbeddedSelfAndDescendantIds(parent, contentTypesById)].sort(), ['child', 'parent']);
	});

	it('returns an empty set for shared items', () => {
		assert.equal(collectEmbeddedSelfAndDescendantIds(sharedHero('/site/x.xml', 'X'), contentTypesById).size, 0);
	});
});

describe('enumerateNodeSelectorMoveTargets', () => {
	const rootModelId = 'page-1';

	it('lists type-compatible fields, skips the source, and disables full/readonly/duplicate targets', () => {
		const moving = embeddedHero('h1', 'Hero One');
		const alreadyThere = embeddedHero('h1', 'Hero One');
		const targets = enumerateNodeSelectorMoveTargets({
			item: moving,
			itemContentTypeId: heroType,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 },
			rootModelId,
			rootValues: {
				left_o: [moving],
				right_o: [alreadyThere],
				footer_o: [],
				locked_o: []
			},
			rootContentType: pageType,
			contentTypesById
		});

		const byField = Object.fromEntries(targets.map((target) => [target.fieldId, target]));
		assert.equal(byField.left_o, undefined, 'source field omitted');
		assert.equal(byField.footer_o, undefined, 'type-incompatible omitted');
		assert.equal(byField.right_o.disabled, true);
		assert.equal(byField.right_o.reason, 'duplicate');
		assert.equal(byField.locked_o.disabled, true);
		assert.equal(byField.locked_o.reason, 'readonly');
		assert.equal(byField.right_o.labelPath, 'Right Rail');
	});

	it('disables a destination that is at maxCount', () => {
		const moving = embeddedHero('h2', 'Hero Two');
		const occupant = embeddedHero('h0', 'Occupant');
		const targets = enumerateNodeSelectorMoveTargets({
			item: moving,
			itemContentTypeId: heroType,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 },
			rootModelId,
			rootValues: {
				left_o: [moving],
				right_o: [occupant],
				footer_o: [],
				locked_o: []
			},
			rootContentType: pageType,
			contentTypesById
		});
		const right = targets.find((target) => target.fieldId === 'right_o');
		assert.equal(right?.disabled, true);
		assert.equal(right?.reason, 'maxCount');
	});

	it('includes ancestor fields and nested fields, and omits self/descendant owners', () => {
		const grandchild = embeddedHero('g1', 'Grandchild');
		const child = embeddedHero('c1', 'Child', [grandchild]);
		const parent = embeddedHero('p1', 'Parent', [child]);
		const targets = enumerateNodeSelectorMoveTargets({
			item: child,
			itemContentTypeId: heroType,
			source: { modelId: parent.key, fieldId: 'children_o', index: 0 },
			rootModelId,
			rootValues: {
				left_o: [parent],
				right_o: [],
				footer_o: [],
				locked_o: []
			},
			rootContentType: pageType,
			contentTypesById
		});

		const ids = targets.map((target) => `${target.modelId}:${target.fieldId}`);
		assert.ok(ids.includes(`${rootModelId}:left_o`), 'ancestor field listed');
		assert.ok(ids.includes(`${rootModelId}:right_o`), 'sibling root field listed');
		assert.equal(ids.includes(`${child.key}:children_o`), false, 'field on the moved item itself omitted');
		assert.equal(ids.includes(`${grandchild.key}:children_o`), false, 'field on a descendant omitted');
		assert.equal(ids.includes(`${parent.key}:children_o`), false, 'source field omitted');

		const left = targets.find((target) => target.fieldId === 'left_o');
		assert.equal(left?.labelPath, 'Left Rail');
	});

	it('disables destinations under a readonly field but keeps writable fields enabled', () => {
		const moving = embeddedHero('h1', 'Hero One');
		const lockedParent = embeddedHero('h9', 'Locked Parent');
		const writableParent = embeddedHero('h8', 'Writable Parent');
		const targets = enumerateNodeSelectorMoveTargets({
			item: moving,
			itemContentTypeId: heroType,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 },
			rootModelId,
			rootValues: {
				left_o: [moving, writableParent],
				right_o: [],
				footer_o: [],
				locked_o: [lockedParent]
			},
			rootContentType: pageType,
			contentTypesById
		});

		const lockedChild = targets.find((target) => target.modelId === lockedParent.key);
		assert.equal(lockedChild?.fieldId, 'children_o');
		assert.equal(lockedChild?.disabled, true);
		assert.equal(lockedChild?.reason, 'readonly');

		const writableChild = targets.find((target) => target.modelId === writableParent.key);
		assert.equal(writableChild?.fieldId, 'children_o');
		assert.equal(writableChild?.disabled, false);
		assert.equal(targets.find((target) => target.fieldId === 'right_o')?.disabled, false);
	});

	it('accepts shared items by the provided content type id', () => {
		const moving = sharedHero('/site/components/hero.xml', 'Shared Hero');
		const targets = enumerateNodeSelectorMoveTargets({
			item: moving,
			itemContentTypeId: heroType,
			source: { modelId: rootModelId, fieldId: 'left_o', index: 0 },
			rootModelId,
			rootValues: {
				left_o: [moving],
				right_o: [],
				footer_o: [],
				locked_o: []
			},
			rootContentType: pageType,
			contentTypesById
		});
		assert.ok(targets.some((target) => target.fieldId === 'right_o' && !target.disabled));
		assert.equal(
			targets.some((target) => target.fieldId === 'footer_o'),
			false
		);
	});
});

describe('documentFormStack', () => {
	// page > embedded A > shared S > embedded X. Embedded forms belong to their parent's document; a shared item does not.
	const page = { props: { update: { path: '/site/website/index.xml' } } };
	const embeddedA = { props: { update: { path: '/site/website/index.xml', modelId: 'a' } } };
	const shared = { props: { update: { path: '/site/components/s.xml' } } };
	const embeddedX = { props: { update: { path: '/site/components/s.xml', modelId: 'x' } } };
	const stack = [page, embeddedA, shared, embeddedX] as never[];

	it('starts at the nearest shared (non-embedded) form below an embedded one', () => {
		assert.deepEqual(documentFormStack(stack, embeddedX as never), [shared, embeddedX]);
	});

	it('starts at the shared form itself when it owns the field', () => {
		assert.deepEqual(documentFormStack(stack, shared as never), [shared, embeddedX]);
	});

	it('walks past embedded forms up to the page', () => {
		assert.deepEqual(documentFormStack(stack, embeddedA as never), [page, embeddedA, shared, embeddedX]);
	});

	it('is empty when the form is not on the stack', () => {
		assert.deepEqual(documentFormStack(stack, { props: {} } as never), []);
	});
});
