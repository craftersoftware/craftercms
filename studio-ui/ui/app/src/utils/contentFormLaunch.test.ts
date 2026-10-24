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
import type { ContentType, ContentTypeField } from '../models/ContentType';
import {
	buildContentFormLaunch,
	contentFormSaveAction,
	fe2LaunchPropDisposition,
	fieldsToRenderForLaunch,
	hiddenInvalidFieldLabels,
	normalizeRepeatIndex,
	resolveContentFormFieldTarget,
	toContentFormSaveSuccess,
	unmatchedLaunchTargetWarning
} from './contentFormLaunch.ts';

function field(partial: Pick<ContentTypeField, 'id' | 'type'> & Partial<ContentTypeField>): ContentTypeField {
	return {
		name: partial.id,
		validations: {},
		defaultValue: '',
		...partial
	};
}

const contentType = {
	fields: {
		title_s: field({ id: 'title_s', type: 'input', iceId: 'hero' }),
		body_html: field({ id: 'body_html', type: 'rte', iceId: 'hero' }),
		articles_o: field({
			id: 'articles_o',
			type: 'repeat',
			iceId: 'articles',
			fields: {
				headline_s: field({ id: 'headline_s', type: 'input' })
			}
		}),
		sidebar_s: field({ id: 'sidebar_s', type: 'input', iceId: 'sidebar' })
	}
} as ContentType;

describe('resolveContentFormFieldTarget', () => {
	it('limits an ICE group to the fields that share that iceId', () => {
		const resolved = resolveContentFormFieldTarget(contentType, { iceGroupId: 'hero' });
		assert.deepEqual(
			resolved.fields?.map((item) => item.id),
			['title_s', 'body_html']
		);
		assert.equal(resolved.repeatItem, undefined);
	});

	it('returns an empty field list when the ICE group matches nothing', () => {
		const resolved = resolveContentFormFieldTarget(contentType, { iceGroupId: 'missing' });
		assert.deepEqual(resolved.fields, []);
		assert.equal(fieldsToRenderForLaunch(undefined, resolved.fields), undefined);
		assert.match(
			unmatchedLaunchTargetWarning({ iceGroupId: 'missing', fields: resolved.fields }) ?? '',
			/ICE group "missing"/
		);
	});

	it('leaves the full form in place when the launch did not target fields', () => {
		assert.deepEqual(resolveContentFormFieldTarget(contentType, {}), {});
	});

	it('opens the indexed repeat item for a dotted field id', () => {
		const resolved = resolveContentFormFieldTarget(contentType, {
			fieldIds: ['articles_o.headline_s'],
			repeatIndex: 2
		});
		assert.deepEqual(
			resolved.fields?.map((item) => item.id),
			['articles_o']
		);
		assert.equal(resolved.repeatItem?.field.id, 'articles_o');
		assert.equal(resolved.repeatItem?.index, 2);
		assert.equal(resolved.repeatItem?.scrollFieldId, 'headline_s');
	});

	it('does not open a repeat item when the ICE group has no index', () => {
		const resolved = resolveContentFormFieldTarget(contentType, { iceGroupId: 'articles' });
		assert.equal(resolved.repeatItem, undefined);
		assert.equal(resolved.fields?.[0].type, 'repeat');
	});

	it('prefers selected fields over an ICE group', () => {
		const resolved = resolveContentFormFieldTarget(contentType, {
			fieldIds: ['sidebar_s'],
			iceGroupId: 'hero'
		});
		assert.deepEqual(
			resolved.fields?.map((item) => item.id),
			['sidebar_s']
		);
	});

	it('ignores a nested repeat index FE2 cannot address', () => {
		assert.equal(normalizeRepeatIndex('1.2'), undefined);
		assert.equal(normalizeRepeatIndex('3'), 3);
		assert.equal(normalizeRepeatIndex(0), 0);
		const resolved = resolveContentFormFieldTarget(contentType, {
			fieldIds: ['articles_o'],
			repeatIndex: normalizeRepeatIndex('1.2')
		});
		assert.equal(resolved.repeatItem, undefined);
	});
});

describe('buildContentFormLaunch', () => {
	it('maps a new page onto create mode', () => {
		const launch = buildContentFormLaunch({
			path: '/site/website/',
			isNewContent: true,
			contentTypeId: '/page/entry',
			readonly: undefined
		});
		assert.deepEqual(launch.create, { path: '/site/website/', contentTypeId: '/page/entry' });
		assert.equal(launch.readonly, false);
	});

	it('maps an embedded model onto update.modelId', () => {
		const launch = buildContentFormLaunch({
			path: '/site/website/index.xml',
			modelId: 'abc-123',
			isEmbedded: true,
			selectedFields: ['title_s'],
			index: '1'
		});
		assert.deepEqual(launch.update, { path: '/site/website/index.xml', modelId: 'abc-123' });
		assert.deepEqual(launch.fieldIds, ['title_s']);
		assert.equal(launch.fieldToScroll, 'title_s');
		assert.equal(launch.repeatIndex, 1);
	});

	it('maps a content-type change onto changeTypeId', () => {
		const launch = buildContentFormLaunch({
			path: '/site/website/index.xml',
			changeTemplate: '/page/entry'
		});
		assert.deepEqual(launch.update, { path: '/site/website/index.xml', changeTypeId: '/page/entry' });
	});

	it('keeps the ICE group id for the form to resolve once the content type is loaded', () => {
		const launch = buildContentFormLaunch({
			path: '/site/website/index.xml',
			iceGroupId: 'hero'
		});
		assert.equal(launch.iceGroupId, 'hero');
		assert.equal(launch.fieldIds, undefined);
	});
});

describe('toContentFormSaveSuccess', () => {
	it('builds the page payload QuickCreate redirects with', () => {
		const success = toContentFormSaveSuccess({
			path: '/site/website/about/index.xml',
			action: 'saveAndClose',
			contentType: { id: '/page/entry', type: 'page', previewable: true }
		});
		assert.equal(success.action, 'saveAndClose');
		assert.equal(success.redirectUrl, '/about');
		assert.equal(success.item?.isPage, true);
		assert.equal(success.item?.isPreviewable, true);
		assert.equal(success.item?.browserUri, '/about');
	});

	it('does not mark a component as a page', () => {
		const success = toContentFormSaveSuccess({
			path: '/site/components/header/default.xml',
			action: 'save',
			contentType: { id: '/component/header', type: 'component' }
		});
		assert.equal(success.action, 'save');
		assert.equal(success.item?.isPage, false);
		assert.equal(success.item?.isPreviewable, true);
	});

	it('still reports the action when the write has no path', () => {
		assert.deepEqual(toContentFormSaveSuccess({ action: 'saveAndMinimize' }), { action: 'saveAndMinimize' });
	});
});

describe('contentFormSaveAction', () => {
	it('reports the checkbox that actually runs, with close ahead of minimize', () => {
		assert.equal(contentFormSaveAction({ close: true, minimize: true }), 'saveAndClose');
		assert.equal(contentFormSaveAction({ close: false, minimize: true }), 'saveAndMinimize');
		assert.equal(contentFormSaveAction({ close: false, minimize: false }), 'save');
	});
});

describe('fieldsToRenderForLaunch', () => {
	it('keeps an explicit field list and a matching target', () => {
		const title = contentType.fields.title_s;
		assert.deepEqual(fieldsToRenderForLaunch([title], []), [title]);
		assert.deepEqual(fieldsToRenderForLaunch(undefined, [title]), [title]);
	});

	it('names the field ids that matched nothing', () => {
		assert.match(unmatchedLaunchTargetWarning({ fieldIds: ['gone_s'], fields: [] }) ?? '', /gone_s/);
	});

	it('does not warn when the launch did not target fields', () => {
		assert.equal(unmatchedLaunchTargetWarning({}), undefined);
		assert.equal(unmatchedLaunchTargetWarning({ fields: [contentType.fields.title_s] }), undefined);
	});
});

describe('hiddenInvalidFieldLabels', () => {
	const labelFor = (fieldId: string) => ({ title_s: 'Title', sidebar_s: 'Sidebar' })[fieldId];

	it('names invalid fields the targeted form is not showing', () => {
		assert.deepEqual(hiddenInvalidFieldLabels(['title_s', 'sidebar_s'], ['title_s', 'body_html'], labelFor), [
			'Sidebar'
		]);
	});

	it('returns nothing when every invalid field is visible', () => {
		assert.equal(hiddenInvalidFieldLabels(['title_s'], ['title_s'], labelFor), undefined);
	});

	it('treats a dotted id as visible when its base field is targeted', () => {
		assert.equal(
			hiddenInvalidFieldLabels(['articles_o.headline_s'], ['articles_o'], () => undefined),
			undefined
		);
	});

	it('returns nothing when the form is not a targeted subset', () => {
		assert.equal(hiddenInvalidFieldLabels(['sidebar_s'], undefined, labelFor), undefined);
		assert.equal(hiddenInvalidFieldLabels(['sidebar_s'], [], labelFor), undefined);
	});
});

describe('fe2LaunchPropDisposition', () => {
	it('classifies every launcher prop', () => {
		assert.equal(fe2LaunchPropDisposition.onSaveSuccess, 'saveCallback');
		assert.equal(fe2LaunchPropDisposition.iceGroupId, 'formsEngine');
		assert.equal(fe2LaunchPropDisposition.index, 'formsEngine');
		assert.equal(fe2LaunchPropDisposition.inProgress, 'notApplied');
		assert.equal(fe2LaunchPropDisposition.isHidden, 'notApplied');
		assert.equal(fe2LaunchPropDisposition.newEmbedded, 'notApplied');
	});
});
