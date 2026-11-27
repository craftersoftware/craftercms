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
import '../../test/registerTsLoader.mjs';
import type { ContentTypeField } from '../models/ContentType';

const { doesFieldAccept, isTypeAcceptedAsByField } = await import('./contentType.ts');

function fieldWithAllowed(partial: {
	allowedContentTypes?: Record<string, unknown>;
	allowedEmbeddedContentTypes?: string[];
	allowedSharedContentTypes?: string[];
	allowedSharedExistingContentTypes?: string[];
}): ContentTypeField {
	const validations: ContentTypeField['validations'] = {};
	if (partial.allowedContentTypes) {
		validations.allowedContentTypes = {
			id: 'allowedContentTypes',
			level: 'required',
			value: partial.allowedContentTypes
		};
	}
	if (partial.allowedEmbeddedContentTypes) {
		validations.allowedEmbeddedContentTypes = {
			id: 'allowedEmbeddedContentTypes',
			level: 'required',
			value: partial.allowedEmbeddedContentTypes
		};
	}
	if (partial.allowedSharedContentTypes) {
		validations.allowedSharedContentTypes = {
			id: 'allowedSharedContentTypes',
			level: 'required',
			value: partial.allowedSharedContentTypes
		};
	}
	if (partial.allowedSharedExistingContentTypes) {
		validations.allowedSharedExistingContentTypes = {
			id: 'allowedSharedExistingContentTypes',
			level: 'required',
			value: partial.allowedSharedExistingContentTypes
		};
	}
	return {
		id: 'items_o',
		name: 'Items',
		type: 'node-selector',
		sortable: false,
		validations
	};
}

describe('isTypeAcceptedAsByField', () => {
	it('accepts a type listed in allowedContentTypes when createMode is omitted (move rule)', () => {
		const field = fieldWithAllowed({
			allowedContentTypes: { '/component/hero': { embedded: true }, '/component/feature': { shared: true } }
		});
		assert.equal(isTypeAcceptedAsByField(field, '/component/hero'), true);
		assert.equal(isTypeAcceptedAsByField(field, '/component/feature'), true);
		assert.equal(isTypeAcceptedAsByField(field, '/component/other'), false);
	});

	it('accepts the wildcard', () => {
		const field = fieldWithAllowed({ allowedContentTypes: { '*': { embedded: true } } });
		assert.equal(isTypeAcceptedAsByField(field, '/component/anything'), true);
	});

	it('filters by embedded / shared / sharedExisting when createMode is set', () => {
		const field = fieldWithAllowed({
			allowedContentTypes: {
				'/component/hero': { embedded: true, shared: true },
				'/component/feature': { sharedExisting: true }
			},
			allowedEmbeddedContentTypes: ['/component/hero'],
			allowedSharedContentTypes: ['/component/hero'],
			allowedSharedExistingContentTypes: ['/component/feature']
		});
		assert.equal(isTypeAcceptedAsByField(field, '/component/hero', 'embedded'), true);
		assert.equal(isTypeAcceptedAsByField(field, '/component/feature', 'embedded'), false);
		assert.equal(isTypeAcceptedAsByField(field, '/component/hero', 'shared'), true);
		assert.equal(isTypeAcceptedAsByField(field, '/component/feature', 'sharedExisting'), true);
		assert.equal(isTypeAcceptedAsByField(field, '/component/hero', ['embedded', 'shared']), true);
	});
});

describe('doesFieldAccept', () => {
	it('resolves the field on the content type and delegates', () => {
		const contentType = {
			id: '/page/home',
			name: 'Home',
			type: 'page' as const,
			displayTemplate: '',
			sections: [],
			fields: {
				items_o: fieldWithAllowed({ allowedContentTypes: { '/component/hero': { embedded: true } } })
			},
			dataSources: null,
			quickCreate: false,
			quickCreatePath: '',
			hasLegacyFormDefinitionPath: false
		};
		assert.equal(doesFieldAccept(contentType, 'items_o', '/component/hero'), true);
		assert.equal(doesFieldAccept(contentType, 'items_o', '/component/other'), false);
	});
});
