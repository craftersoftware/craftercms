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
 * The publish footer shows the reason and points the submit button at it.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { IntlProvider } = await import('react-intl');
const { PublishDialogFooter } = await import('./PublishDialogContainer.tsx');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(reason: string) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				IntlProvider,
				{ locale: 'en', messages: {}, onError() {} },
				React.createElement(PublishDialogFooter, {
					reason,
					reasonId: 'publish-reason',
					isSubmitting: false,
					submitDisabled: reason !== '',
					submitLabel: 'Publish',
					onCancel() {},
					onSubmit() {}
				})
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

describe('publish footer reason', () => {
	it('shows the reason and links it to the submit button', async () => {
		const host = await render('Enter a package title to publish.');
		const reason = host.querySelector('#publish-reason');
		assert.equal(reason?.textContent, 'Enter a package title to publish.');
		const submit = [...host.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Publish');
		assert.ok(submit);
		assert.equal(submit.getAttribute('aria-describedby'), 'publish-reason');
		assert.equal(submit.disabled, true);
	});

	it('omits the reason and the link when publishing is available', async () => {
		const host = await render('');
		assert.equal(host.querySelector('#publish-reason'), null);
		const submit = [...host.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Publish');
		assert.ok(submit);
		assert.equal(submit.getAttribute('aria-describedby'), null);
		assert.equal(submit.disabled, false);
	});

	it('keeps Cancel and Publish in one wrap item, apart from the reason', async () => {
		const host = await render('Enter a package title to publish.');
		const footer = host.querySelector('.MuiDialogActions-root');
		const [cancel, submit] = host.querySelectorAll('button');
		const group = cancel.parentElement;
		assert.ok(submit.parentElement === group, 'Cancel and Publish share one wrapper');
		assert.ok(group?.parentElement === footer, 'the wrapper is a single item of the footer');
		assert.ok(!group?.contains(host.querySelector('#publish-reason')), 'the reason is its own item');
	});

	it('keeps Cancel and Publish in one group apart from the start-aligned reason', async () => {
		const host = await render('Enter a package title to publish.');
		const reason = host.querySelector('#publish-reason');
		const buttons = [...host.querySelectorAll('button')];
		const cancel = buttons.find((button) => button.textContent?.trim() === 'Cancel');
		const submit = buttons.find((button) => button.textContent?.trim() === 'Publish');
		assert.ok(reason && cancel && submit);
		assert.equal(cancel.parentElement, submit.parentElement);
		assert.notEqual(cancel.parentElement, reason.parentElement);
		assert.equal(getComputedStyle(reason).textAlign, 'start');
	});
});
