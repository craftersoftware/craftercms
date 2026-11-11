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
 * The Type Builder delete buttons are named for what they delete. `ConfirmDropdown` used to give each of them the
 * generic name "Confirm".
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const { React, createEntry, createItemsStore, baseItems, mountTree, unmountAll } =
	await import('../../FormsEngine/lib/formItemTestHarness');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { default: TypeBuilderFormsEngine } = await import('./TypeBuilderFormsEngine.tsx');

// jsdom doesn't implement element scrolling.
(window.HTMLElement.prototype as { scroll: () => void }).scroll = () => undefined;

afterEach(() => {
	unmountAll();
});

const virtualType = { id: '/component/thing', name: 'Thing', sections: [], fields: {} };

async function renderBuilder(modeProps: Record<string, unknown>) {
	const entry = createEntry([]);
	return mountTree(
		createItemsStore(baseItems()),
		React.createElement(
			RawIntlProvider,
			{ value: createTestIntl() },
			React.createElement(TypeBuilderFormsEngine, {
				virtualType,
				formApiContext: { rollbackField() {} },
				stableFormContext: entry,
				onClose() {},
				...modeProps
			} as never)
		)
	);
}

const labelsOf = (host: HTMLElement) =>
	Array.from(host.querySelectorAll('button[aria-label]'), (button) => button.getAttribute('aria-label'));

describe('Type Builder delete button names', () => {
	it('names the delete field button for the field', async () => {
		const host = await renderBuilder({
			field: { id: 'title_s', name: 'Title', type: 'input', fields: {} },
			fieldIdPath: 'title_s',
			sectionId: 'main',
			controlDescriptor: { id: '/form-control/input', description: 'Input' },
			onDeleteField() {},
			onMoveFieldToSection() {},
			onSwapField() {},
			performCurrentFormErrorCheckAndWarning: () => true
		});
		const labels = labelsOf(host);
		assert.ok(labels.includes('Delete Title'), labels.join(' | '));
		assert.equal(labels.includes('Confirm'), false);
	});

	it('names the delete section button for the section', async () => {
		const host = await renderBuilder({
			section: { id: 'extras', title: 'Extras', fields: [] },
			isMainSection: false,
			onDeleteSection() {}
		});
		const labels = labelsOf(host);
		assert.ok(labels.includes('Delete Extras'), labels.join(' | '));
		assert.equal(labels.includes('Confirm'), false);
	});

	it('names the delete data source button for the data source', async () => {
		const host = await renderBuilder({
			dataSource: { id: 'articles', title: 'Articles', interface: 'item' },
			onDeleteDataSource() {}
		});
		const labels = labelsOf(host);
		assert.ok(labels.includes('Delete Articles'), labels.join(' | '));
		assert.equal(labels.includes('Confirm'), false);
	});
});
