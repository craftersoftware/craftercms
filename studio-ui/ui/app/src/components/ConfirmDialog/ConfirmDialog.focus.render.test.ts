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
 * defaultFocus="cancel" focuses Cancel, and focus never lands on a disabled action.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

// MUI's focus trap checks ShadowRoot. jsdom exposes it on window, not as a Node global.
globalThis.ShadowRoot ??= window.ShadowRoot ?? class ShadowRoot {};

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { IntlProvider } = await import('react-intl');
const { default: ConfirmDialog } = await import('./ConfirmDialog.tsx');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(props: Record<string, unknown> = {}) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				IntlProvider,
				{ locale: 'en', messages: {}, onError() {} },
				React.createElement(ConfirmDialog, {
					open: true,
					title: 'Leave this form?',
					body: 'Your changes will be discarded.',
					onOk() {},
					onCancel() {},
					defaultFocus: 'cancel',
					...props
				})
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

function buttonByName(name: string): HTMLButtonElement {
	const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === name);
	assert.ok(button, name);
	return button as HTMLButtonElement;
}

describe('ConfirmDialog default focus', () => {
	it('focuses Cancel when defaultFocus is cancel', async () => {
		await render();
		const cancel = buttonByName('Cancel');
		assert.equal(document.activeElement, cancel);
		assert.equal(cancel.disabled, false);
	});

	it('does not focus a disabled Cancel, and focuses the enabled accept action instead', async () => {
		await render({ disableCancelButton: true });
		const cancel = buttonByName('Cancel');
		const accept = buttonByName('Accept');
		assert.equal(cancel.disabled, true);
		assert.notEqual(document.activeElement, cancel);
		assert.equal(document.activeElement, accept);
		assert.equal((document.activeElement as HTMLButtonElement).disabled, false);
	});

	it('does not focus a disabled button when both actions are disabled', async () => {
		await render({ disableOkButton: true, disableCancelButton: true });
		assert.equal((document.activeElement as HTMLButtonElement | null)?.disabled, undefined);
		for (const button of document.querySelectorAll('button')) {
			if (button.disabled) assert.notEqual(document.activeElement, button);
		}
	});
});
