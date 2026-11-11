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
 * The row icon buttons name the action and the item. An editable row in a read-only form opens read-only, so its
 * name is View rather than Edit.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const { React, FormHost, baseItems, createEntry, createItemsStore, fieldFor, formPath } =
	await import('../lib/formItemTestHarness');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { RawIntlProvider } = await import('react-intl');
const { Provider } = await import('react-redux');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { default: NodeSelector } = await import('./NodeSelector.tsx');

const intl = createTestIntl();
const articlePath = '/site/components/article.xml';
const photoPath = '/site/components/photo.xml';

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

function storedItem(path: string, label: string, edit: boolean) {
	return {
		...baseItems()[formPath],
		path,
		label,
		systemType: 'component',
		mimeType: 'application/xml',
		stateMap: {},
		availableActionsMap: edit ? { edit: true } : {}
	};
}

async function renderSelector(readonly: boolean) {
	const store = createItemsStore({
		...baseItems(),
		// Embedded rows display the form item. It needs a state map or the publishing icon crashes.
		[formPath]: { ...baseItems()[formPath], stateMap: {} },
		[articlePath]: storedItem(articlePath, 'Article', true),
		[photoPath]: storedItem(photoPath, 'Photo', false)
	});
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(
						FormHost,
						{ entry: createEntry(['nodes_o']) },
						React.createElement(NodeSelector, {
							field: fieldFor('nodes_o', 'node-selector'),
							value: [
								{ key: articlePath, value: 'Article', include: articlePath },
								{ key: 'hero', value: 'Hero', component: { 'file-name': 'hero' } },
								{ key: photoPath, value: 'Photo', include: photoPath }
							],
							setValue() {},
							readonly,
							autoFocus: false,
							inputId: 'x',
							labelId: 'y',
							contentType: { id: '/component/thing', fields: {} }
						} as never)
					)
				)
			)
		);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 50));
	});
	return host;
}

const labelsOf = (host: HTMLElement) =>
	Array.from(host.querySelectorAll('button[aria-label]'), (button) => button.getAttribute('aria-label'));

describe('NodeSelector row button names', () => {
	it('names edit, view, delete and unlink with the item', async () => {
		const host = await renderSelector(false);
		const labels = labelsOf(host);
		assert.ok(labels.includes('Edit Article'));
		assert.ok(labels.includes('Unlink Article'));
		assert.ok(labels.includes('Edit Hero'));
		assert.ok(labels.includes('Delete Hero'));
		assert.ok(labels.includes('View Photo'));
		assert.ok(labels.includes('Unlink Photo'));
		assert.equal(labels.includes('Edit Photo'), false);
	});

	it('names an editable row View when the form is read-only', async () => {
		const host = await renderSelector(true);
		const labels = labelsOf(host);
		assert.ok(labels.includes('View Article'));
		assert.ok(labels.includes('View Hero'));
		assert.ok(labels.includes('View Photo'));
		assert.equal(labels.includes('Edit Article'), false);
		assert.equal(labels.includes('Unlink Article'), false);
		assert.equal(labels.includes('Delete Hero'), false);
	});
});
