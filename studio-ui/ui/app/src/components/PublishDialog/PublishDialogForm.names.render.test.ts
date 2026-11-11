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
 * The Scheduling and Publishing Target radio groups are named by their legends. The fieldset names the group of
 * controls, but the radiogroup MUI renders inside it is its own role and needs its own name.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { PublishDialogForm } = await import('./PublishDialogForm.tsx');

class FakeXhr extends EventTarget {
	status = 200;
	statusText = 'OK';
	readyState = 4;
	responseType = '';
	response: unknown = null;
	responseText = '';
	upload = new EventTarget();
	open() {}
	setRequestHeader() {}
	getAllResponseHeaders() {
		return 'content-type: application/json';
	}
	getResponseHeader() {
		return 'application/json';
	}
	abort() {}
	send() {
		const body = {
			response: { code: 0 },
			published: true,
			publishingTargets: [
				{ name: 'live', order: 1, publishStatus: 'ready' },
				{ name: 'staging', order: 2, publishStatus: 'ready' }
			]
		};
		this.response = this.responseType === 'json' ? body : JSON.stringify(body);
		this.responseText = JSON.stringify(body);
		setTimeout(() => this.dispatchEvent(new Event('load')), 0);
	}
}
(window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;
(globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

// The real createIntl, not createTestIntl: the shared helper makes up an id for a descriptor that has none, which
// hides a message the app would throw on. Here a missing id fails the test.
const strictIntl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function render() {
	const store = configureStore({
		reducer: {
			sites: (state = { active: 'editorial' }) => state,
			uiConfig: (state = { publishing: {} }) => state
		}
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
					{ value: strictIntl },
					React.createElement(PublishDialogForm, {
						onSubmit() {},
						onInputChange() {},
						onDateTimePickerChange() {},
						formState: {
							packageTitle: 'Package',
							requestApproval: false,
							publishingTarget: 'live',
							submissionComment: '',
							scheduling: 'now',
							scheduledDateTime: new Date(),
							error: null,
							fetchingItems: false
						}
					} as never)
				)
			)
		);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 50));
	});
	return host;
}

const groupLabelledBy = (host: HTMLElement, legend: string) =>
	Array.from(host.querySelectorAll('[role="radiogroup"]')).find((group) =>
		document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent?.includes(legend)
	);

describe('publish dialog radio groups', () => {
	it('names the Scheduling radio group with its legend', async () => {
		const host = await render();
		assert.ok(groupLabelledBy(host, 'Scheduling'), 'expected a radiogroup labelled by the Scheduling legend');
	});

	it('names the Publishing Target radio group with its legend', async () => {
		const host = await render();
		assert.ok(host.querySelectorAll('[role="radiogroup"]').length >= 2, 'targets did not load');
		assert.ok(
			groupLabelledBy(host, 'Publishing Target'),
			'expected a radiogroup labelled by the Publishing Target legend'
		);
	});

	it('gives every radio group a name', async () => {
		const host = await render();
		for (const group of host.querySelectorAll('[role="radiogroup"]')) {
			assert.ok(group.getAttribute('aria-labelledby'));
		}
	});
});
