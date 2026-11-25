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

/**
 * configurationEvent for a content-type form-definition path must emit
 * CONTENT_TYPE_UPDATED with the id parsed from targetPath.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../test/registerTsLoader.mjs';

const { handleSystemEvent } = await import('./configuration.ts');
const { configurationEvent, contentTypeUpdated } = await import('../actions/system.ts');
const { fetchQuickCreateList } = await import('../actions/content.ts');

describe('handleSystemEvent', () => {
	it('returns contentTypeUpdated with id parsed from form-definition path', () => {
		const action = configurationEvent({
			siteId: 'editorial',
			timestamp: 0,
			eventType: 'CONFIGURATION_EVENT',
			targetPath: '/config/studio/content-types/page/home/form-definition.xml',
			user: null
		});
		const result = handleSystemEvent(action);
		assert.deepEqual(result, [contentTypeUpdated({ contentTypeId: '/page/home' }), fetchQuickCreateList()]);
	});
});
