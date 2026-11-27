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
 * The selected file in the Configuration list is highlighted with `selected`, which is only visual. It must also be
 * exposed to assistive technology with `aria-current="true"` (a current item in a set, not a page), and the other
 * files must not carry the attribute.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { createTestIntl } = await import('../../../test/createTestIntl.mjs');
const { SiteConfigurationManagement } = await import('./SiteConfigurationManagement.tsx');

const site = 'editorial';
const username = 'admin';
const sessionStorageKey = `craftercms.${username}.projectToolsConfigurationData.${site}`;

const configList = `<config><files>
	<file><path>site-config.xml</path><title>Site Config</title><description>Project settings</description><module>studio</module><samplePath>site-config.xml</samplePath></file>
	<file><path>ui.xml</path><title>UI</title><description>User interface</description><module>studio</module><samplePath>ui.xml</samplePath></file>
	<file><path>permission-mappings-config.xml</path><title>Permission Mappings</title><description>Permissions</description><module>studio</module><samplePath>permission-mappings-config.xml</samplePath></file>
</files></config>`;

/** The slice of XMLHttpRequest rxjs `ajax` uses, answering the requests the Configuration screen makes on mount. */
class FakeXhr {
	status = 0;
	response: unknown = null;
	responseText = '';
	responseURL = '';
	responseType = '';
	timeout = 0;
	withCredentials = false;
	readyState = 0;
	upload = { addEventListener() {} };
	private listeners: Record<string, Array<(event: unknown) => void>> = {};
	private url = '';

	addEventListener(type: string, listener: (event: unknown) => void) {
		(this.listeners[type] ??= []).push(listener);
	}
	open(_method: string, url: string) {
		this.url = url;
		this.responseURL = url;
	}
	setRequestHeader() {}
	getAllResponseHeaders() {
		return '';
	}
	abort() {}
	send() {
		if (this.url.includes('active_environment')) {
			this.reply(200, { environment: 'dev' });
		} else if (this.url.includes('config-list.xml')) {
			this.reply(200, { content: configList });
		} else {
			// The selected file's own XML: failing it keeps the code editor out of the render.
			this.reply(500, { response: { code: 1, message: 'Not available in this test' } });
		}
	}
	private reply(status: number, body: unknown) {
		setTimeout(() => {
			this.status = status;
			this.readyState = 4;
			this.response = body;
			this.listeners.load?.forEach((listener) => listener({ type: 'load' }));
		}, 0);
	}
}

type SwappedGlobal = 'XMLHttpRequest' | 'DOMParser' | 'XMLSerializer' | 'sessionStorage';
const globals = globalThis as unknown as Record<SwappedGlobal, unknown>;
const RealXhr = globals.XMLHttpRequest;
const RealDOMParser = globals.DOMParser;
const RealXMLSerializer = globals.XMLSerializer;
beforeEach(() => {
	globals.XMLHttpRequest = FakeXhr;
	globals.DOMParser = window.DOMParser;
	globals.XMLSerializer = window.XMLSerializer;
	globals.sessionStorage ??= window.sessionStorage;
});

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	try {
		for (const { unmount, host } of mounted.splice(0)) {
			await act(async () => unmount());
			host.remove();
		}
	} finally {
		globals.XMLHttpRequest = RealXhr;
		globals.DOMParser = RealDOMParser;
		globals.XMLSerializer = RealXMLSerializer;
		sessionStorage.clear();
	}
});

async function renderConfigurationList() {
	const store = configureStore({
		reducer: {
			env: (state = { authoringBase: '/studio' }) => state,
			sites: (state = { active: site }) => state,
			user: (state = { username }) => state
		}
	});
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				Provider,
				{ store },
				React.createElement(
					RawIntlProvider,
					{ value: createTestIntl() },
					React.createElement(
						ThemeProvider,
						{ theme: createTheme() },
						React.createElement(SiteConfigurationManagement, { embedded: true })
					)
				)
			) as never
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	// The environment, then the file list, then the selected file's XML each resolve on a timer.
	for (let i = 0; i < 10; i++) {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
	}
	return host;
}

function fileButtons(host: HTMLElement) {
	const nav = host.querySelector('nav[aria-label="Configuration files"]');
	assert.ok(nav, 'the Configuration files navigation renders');
	return [...nav.querySelectorAll('[role="button"]')] as HTMLElement[];
}

describe('configuration file list', () => {
	it('marks only the selected file with aria-current="true"', async () => {
		sessionStorage.setItem(
			sessionStorageKey,
			JSON.stringify({
				selectedConfigFile: {
					id: 'studio/ui.xml',
					module: 'studio',
					path: 'ui.xml',
					title: 'UI',
					description: 'User interface',
					samplePath: 'ui.xml'
				}
			})
		);
		const buttons = fileButtons(await renderConfigurationList());
		assert.equal(buttons.length, 3);
		assert.deepEqual(
			buttons.map((button) => button.getAttribute('aria-current')),
			[null, 'true', null]
		);
		assert.deepEqual(
			buttons.map((button) => button.classList.contains('Mui-selected')),
			[false, true, false]
		);
	});

	it('marks no file while none is selected', async () => {
		const buttons = fileButtons(await renderConfigurationList());
		assert.equal(buttons.length, 3);
		assert.ok(buttons.every((button) => !button.hasAttribute('aria-current')));
	});
});
