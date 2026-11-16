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

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../../test/createTestIntl.mjs');
const { default: ValidationErrorsAlert } = await import('./ValidationErrorsAlert.tsx');

const intl = createTestIntl();

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(props: Record<string, unknown>) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	let shown = 0;
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl as never },
				React.createElement(ValidationErrorsAlert, { onShow: () => shown++, ...props } as never)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return { host, shown: () => shown };
}

const text = (host: HTMLElement) => host.querySelector('[role="status"]')?.textContent ?? '';

describe('ValidationErrorsAlert', () => {
	it('explains the draft when there are validation errors', async () => {
		const one = await render({ count: 1 });
		assert.match(
			text(one.host),
			/^The form has a validation error\. This will save as a draft until the error is fixed\./
		);
		assert.equal(one.host.querySelector('svg')?.getAttribute('data-testid'), 'WarningAmberRoundedIcon');
		const many = await render({ count: 3 });
		assert.match(text(many.host), /^The form has 3 validation errors\./);
	});

	it('names the missing fields with whatever the content type calls them, with no article', async () => {
		const both = await render({
			count: 0,
			minimumRequirements: { copy: 'both', fileName: 'Page URL', internalName: 'Apple' }
		});
		assert.match(text(both.host), /^Page URL and Apple are required to save this content\./);
		const fileName = await render({
			count: 0,
			minimumRequirements: { copy: 'fileName', fileName: 'Upload name', internalName: 'Label' }
		});
		assert.match(text(fileName.host), /^Upload name is required to save this content\./);
		const internal = await render({
			count: 0,
			minimumRequirements: { copy: 'internalName', fileName: 'File Name', internalName: 'Item' }
		});
		assert.match(text(internal.host), /^Item is required to save this content\./);
		assert.doesNotMatch(text(internal.host), /\ban? Item\b/i);
	});

	it('replaces the draft wording when the minimum is missing', async () => {
		const { host } = await render({
			count: 2,
			minimumRequirements: { copy: 'internalName', fileName: 'File Name', internalName: 'Internal Name' }
		});
		assert.doesNotMatch(text(host), /draft/i);
	});

	it('labels Show with the field name and calls back when clicked', async () => {
		const { host, shown } = await render({ count: 1, fieldName: 'Page URL' });
		const button = host.querySelector<HTMLButtonElement>('button');
		assert.equal(button?.getAttribute('aria-label'), 'Show Page URL');
		await act(async () => {
			button?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		});
		assert.equal(shown(), 1);
	});

	it('falls back to a generic Show label without a field name', async () => {
		const { host } = await render({ count: 1 });
		assert.equal(host.querySelector('button')?.getAttribute('aria-label'), 'Show the field');
	});
});
