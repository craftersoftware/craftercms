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
 * The selected file's toolbar must not add a second page h1. Embedded in the Preview tools dialog it sits
 * under the dialog's h2, so its title is an h3 and its description is plain text. The prompt shown before a
 * file is chosen is never a heading.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../test/createTestIntl.mjs');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { default: GlobalAppToolbar } = await import('../GlobalAppToolbar/GlobalAppToolbar.tsx');
const { default: EmptyState } = await import('../EmptyState/EmptyState.tsx');
const { getConfigFileHeadings, selectConfigFilePromptComponent } = await import('./headings.ts');

const intl = createTestIntl();
const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

/** The file toolbar the way SiteConfigurationManagement renders it, under an optional dialog h2. */
async function renderFileToolbar(embedded: boolean) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(
					ThemeProvider,
					{ theme: createTheme() },
					embedded ? React.createElement('h2', null, 'Configuration') : null,
					React.createElement(GlobalAppToolbar, {
						showHamburgerMenuButton: false,
						showAppsButton: false,
						title: 'Site Configuration',
						subtitle: 'Defines the project settings',
						...getConfigFileHeadings(embedded)
					})
				)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

function outline(host: HTMLElement) {
	return [...host.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((node) => `${node.tagName} ${node.textContent}`);
}

describe('configuration file toolbar headings', () => {
	it('embedded: an h3 title under the dialog h2, with the description as plain text', async () => {
		const host = await renderFileToolbar(true);
		assert.deepEqual(outline(host), ['H2 Configuration', 'H3 Site Configuration']);
		assert.equal(host.querySelectorAll('h1').length, 0);
		const description = [...host.querySelectorAll('p')].find(
			(node) => node.textContent === 'Defines the project settings'
		);
		assert.ok(description, 'the description is a paragraph');
	});

	it('page: an h2 title with an h3 description, under the view toolbar h1', async () => {
		const host = await renderFileToolbar(false);
		assert.deepEqual(outline(host), ['H2 Site Configuration', 'H3 Defines the project settings']);
		assert.equal(host.querySelectorAll('h1').length, 0);
	});

	it('never asks for an h1', () => {
		for (const embedded of [true, false, undefined]) {
			assert.notEqual(getConfigFileHeadings(embedded).titleComponent, 'h1');
		}
	});
});

describe('configuration file prompt', () => {
	it('is plain text, not a heading', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const root = createRoot(host);
		await act(async () => {
			root.render(
				React.createElement(
					RawIntlProvider,
					{ value: intl },
					React.createElement(
						ThemeProvider,
						{ theme: createTheme() },
						React.createElement(EmptyState, {
							title: 'Please choose a config file from the left.',
							titleComponent: selectConfigFilePromptComponent
						})
					)
				)
			);
		});
		mounted.push({ unmount: () => root.unmount(), host });
		assert.equal(host.querySelectorAll('h1, h2, h3, h4, h5, h6').length, 0);
		const prompt = [...host.querySelectorAll('p')].find((node) => node.textContent?.includes('choose a config file'));
		assert.ok(prompt);
	});
});
