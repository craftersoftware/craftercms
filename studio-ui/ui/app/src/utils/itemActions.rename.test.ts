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
 * Pages and components keep the rename bit for the Page URL pencil. The context menu must not offer
 * Rename, because that opens RenameAssetDialog on the descriptor path (…/index.xml).
 */

import '../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IntlFormatters } from 'react-intl';
import type { ContentItem } from '../models/Item';
import type SystemType from '../models/SystemType';

const { generateSingleItemOptions } = await import('./itemActions.ts');
const { CONTENT_RENAME_MASK } = await import('./constants.ts');

const formatMessage = ((descriptor: { defaultMessage?: string }) =>
	descriptor.defaultMessage ?? '') as IntlFormatters['formatMessage'];

function item(systemType: SystemType, path: string): ContentItem {
	return {
		systemType,
		path,
		availableActions: CONTENT_RENAME_MASK,
		mimeType: 'text/xml',
		previewUrl: null,
		childrenCount: 0,
		stateMap: { scheduled: false, submitted: false }
	} as ContentItem;
}

function optionIds(systemType: SystemType, path: string): string[] {
	return generateSingleItemOptions(item(systemType, path), formatMessage)
		.flat()
		.map((option) => option.id);
}

describe('context menu rename', () => {
	it('hides Rename for pages and components that still have the rename bit', () => {
		assert.equal(optionIds('page', '/site/website/about/index.xml').includes('rename'), false);
		assert.equal(optionIds('component', '/site/components/header/header.xml').includes('rename'), false);
	});

	it('keeps Rename for assets, folders, templates and scripts', () => {
		assert.equal(optionIds('asset', '/static-assets/images/logo.png').includes('rename'), true);
		assert.equal(optionIds('folder', '/static-assets/images').includes('rename'), true);
		assert.equal(optionIds('renderingTemplate', '/templates/web/entry.ftl').includes('rename'), true);
		assert.equal(optionIds('script', '/scripts/pages/entry.groovy').includes('rename'), true);
	});
});
