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
import { contentFormSaveAction, formsEnginePropsFromLaunch, saveSuccessFollowUps } from './contentFormLaunch.ts';

/**
 * Covers the adapter between a content-form launch and Forms Engine props.
 * The dialog still speaks the legacy launch shape. These tests check that
 * selected fields, the repeat index, and the save-result action survive that
 * mapping, and that a draft save does not also raise the success notification.
 */

describe('formsEnginePropsFromLaunch', () => {
	// Create mode must keep the zone's fields and index so the form can scope itself after the type loads.
	it('maps a new page onto create mode and keeps the selected fields', () => {
		const props = formsEnginePropsFromLaunch({
			path: '/site/website/index.xml',
			isNewContent: true,
			contentTypeId: '/page/entry',
			selectedFields: ['title_s', 'articles_o.headline_s'],
			index: 0
		});
		assert.deepEqual(props.create, { path: '/site/website/index.xml', contentTypeId: '/page/entry' });
		assert.equal(props.update, undefined);
		assert.deepEqual(props.fieldIds, ['title_s', 'articles_o.headline_s']);
		assert.equal(props.repeatIndex, 0);
		assert.equal(props.readonly, false);
	});

	// An empty selection is "no scope", not a form with zero fields.
	it('keeps a field id list and ignores an empty one', () => {
		const props = formsEnginePropsFromLaunch({
			path: '/site/website/index.xml',
			selectedFields: ['title_s']
		});
		assert.deepEqual(props.fieldIds, ['title_s']);
		const unscoped = formsEnginePropsFromLaunch({
			path: '/site/website/index.xml',
			selectedFields: []
		});
		assert.equal(unscoped.fieldIds, undefined);
	});

	// Embedded opens are updates of a model id, and readonly must pass through.
	it('maps an embedded model onto update.modelId', () => {
		const props = formsEnginePropsFromLaunch({
			path: '/site/website/index.xml',
			modelId: 'abc',
			isEmbedded: true,
			readonly: true
		});
		assert.deepEqual(props.update, { path: '/site/website/index.xml', modelId: 'abc' });
		assert.equal(props.readonly, true);
		assert.equal(props.fieldIds, undefined);
	});

	// Changing the template is still an update of the same path.
	it('maps a content-type change onto changeTypeId', () => {
		const props = formsEnginePropsFromLaunch({
			path: '/site/website/index.xml',
			changeTemplate: '/page/article'
		});
		assert.deepEqual(props.update, { path: '/site/website/index.xml', changeTypeId: '/page/article' });
	});
});

describe('contentFormSaveAction', () => {
	// Callers branch on this string. Close wins when both boxes are checked; neither box is a plain save.
	it('reports the checkbox that actually runs, with close ahead of minimize', () => {
		assert.equal(contentFormSaveAction({ close: true, minimize: true }), 'saveAndClose');
		assert.equal(contentFormSaveAction({ close: false, minimize: true }), 'saveAndMinimize');
		assert.equal(contentFormSaveAction({ close: false, minimize: false }), 'save');
	});
});

describe('edit and change-template save follow-ups', () => {
	// The form already says the item was saved as a draft, so the success toast must not fire again.
	it('edit: skips the success notification on a draft and still runs the other action', () => {
		assert.deepEqual(saveSuccessFollowUps(true, 'notify', ['onActionSuccess']), ['onActionSuccess']);
	});

	// A completed save, including one that left the form open, still notifies.
	it('edit: notifies on a completed save, including one that stayed open', () => {
		assert.deepEqual(saveSuccessFollowUps(false, 'notify', ['onActionSuccess']), ['notify', 'onActionSuccess']);
		assert.deepEqual(saveSuccessFollowUps(undefined, 'notify', []), ['notify']);
	});

	// The item still needs a reload after a draft template change. Only the toast is skipped.
	it('change-template: reloads on a draft without the success notification', () => {
		assert.deepEqual(saveSuccessFollowUps(true, 'notify', ['reload']), ['reload']);
	});

	// A completed template change both notifies and reloads.
	it('change-template: notifies and reloads on a completed save', () => {
		assert.deepEqual(saveSuccessFollowUps(false, 'notify', ['reload']), ['notify', 'reload']);
	});
});
