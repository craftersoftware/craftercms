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
 * The filter popover's close button is icon-only, so "Close" is its only name. It had none on develop.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { AuditGridFilterPopoverBody } = await import('./AuditGridFilterPopoverBody.tsx');

// The real createIntl, so a message without an id fails the test instead of getting one made up.
const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

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
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(AuditGridFilterPopoverBody, {
					open: true,
					filterId: 'siteId',
					anchorPosition: { top: 0, left: 0 },
					options: { sites: [], users: [], operations: [], origins: [], timezones: [] },
					onClose() {},
					onTimezoneSelected() {},
					onResetFilter() {},
					onFilterChange() {}
				} as never)
			)
		);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 30));
	});
	return host;
}

describe('audit grid filter popover close button', () => {
	it('names the close button', async () => {
		const host = await render();
		const labels = Array.from(host.querySelectorAll('button'), (button) => button.getAttribute('aria-label'));
		assert.ok(labels.includes('Close'), labels.join(' | '));
	});
});
