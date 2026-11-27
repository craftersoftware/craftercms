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
 * The version comment is shown in a MUI tooltip so the full text can be read when the row truncates it.
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
const { VersionList } = await import('./VersionList.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });
const store = configureStore({
	reducer: { uiConfig: (state = { locale: { localeCode: 'en-US', dateTimeFormatOptions: { hour12: true } } }) => state }
});

// jsdom has no layout, so report the comment as truncated (scrollWidth > clientWidth) to pass the component's gate.
Object.defineProperty(window.HTMLElement.prototype, 'scrollWidth', {
	configurable: true,
	get(this: HTMLElement) {
		return this.classList.contains('MuiListItemText-secondary') && this.textContent.length > 40 ? 500 : 0;
	}
});

const longComment = `${'A very long version comment that does not fit on a single line. '.repeat(10)}The end.`;
const shortComment = 'Fix the hero';

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function render(comment: string, onItemClick: (version: unknown) => void = () => {}) {
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
					React.createElement(VersionList, {
						versions: [
							{
								versionNumber: '2',
								modifiedDate: '2026-03-04T15:00:00.000Z',
								comment,
								author: { username: 'ada' },
								committer: 'ada',
								oldPath: '',
								path: '/site/website/index.xml',
								revertible: true
							}
						],
						selected: [],
						onItemClick
					} as never)
				)
			)
		);
	});
	return host;
}

// MUI waits `enterDelay` (100ms by default) before opening the tooltip.
async function wait(ms = 250) {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, ms));
	});
}

function getRow(host: HTMLElement) {
	const row = host.querySelector<HTMLElement>('.MuiListItemButton-root');
	assert.ok(row, 'version row');
	return row;
}

function getCommentTarget(host: HTMLElement) {
	const target = Array.from(host.querySelectorAll<HTMLElement>('span')).find((el) => el.textContent === longComment);
	assert.ok(target, 'comment element');
	return target;
}

async function hover(el: HTMLElement) {
	await act(async () => {
		el.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));
	});
	await wait();
}

async function focusViaKeyboard(el: HTMLElement) {
	await act(async () => {
		// MUI only opens the tooltip on focus-visible, which jsdom infers from a prior keyboard event.
		document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
		el.focus();
	});
	await wait();
}

describe('version list comment tooltip', () => {
	it('shows the full text of a truncated comment in the tooltip', async () => {
		const host = await render(longComment);
		assert.equal(document.querySelector('[role="tooltip"]'), null, 'no tooltip before interaction');
		await hover(getCommentTarget(host));
		const tooltip = document.querySelector('[role="tooltip"]');
		assert.ok(tooltip, 'tooltip');
		assert.equal(tooltip.textContent, longComment);
	});

	it('does not call onItemClick when clicking inside the tooltip', async () => {
		const clicks: unknown[] = [];
		const host = await render(longComment, (version) => clicks.push(version));
		await hover(getCommentTarget(host));
		const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]');
		assert.ok(tooltip, 'tooltip');
		await act(async () => {
			tooltip.firstElementChild?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		});
		assert.equal(clicks.length, 0, 'onItemClick was called from a click inside the tooltip');
		// Sanity check: clicking the row itself still selects the version.
		await act(async () => {
			getRow(host).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		});
		assert.equal(clicks.length, 1);
	});

	it('opens the tooltip when the row receives keyboard focus', async () => {
		const host = await render(longComment);
		await focusViaKeyboard(getRow(host));
		const tooltip = document.querySelector('[role="tooltip"]');
		assert.ok(tooltip, 'tooltip');
		assert.equal(tooltip.textContent, longComment);
	});

	it('does not open the tooltip for a comment that fits', async () => {
		const host = await render(shortComment);
		const comment = Array.from(host.querySelectorAll<HTMLElement>('span')).find(
			(el) => el.textContent === shortComment
		);
		assert.ok(comment, 'comment element');
		await hover(comment);
		assert.equal(document.querySelector('[role="tooltip"]'), null, 'hover opened the tooltip');
		await focusViaKeyboard(getRow(host));
		assert.equal(document.querySelector('[role="tooltip"]'), null, 'keyboard focus opened the tooltip');
	});
	it('does not ripple the row on mousedown inside the tooltip', async () => {
		const host = await render(longComment);
		await hover(getCommentTarget(host));
		const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]');
		assert.ok(tooltip, 'tooltip');
		await act(async () => {
			tooltip.firstElementChild?.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
		});
		assert.equal(host.querySelectorAll('.MuiTouchRipple-child').length, 0, 'the row rippled');
	});

	it('renders no tooltip for an empty comment', async () => {
		const host = await render('');
		await focusViaKeyboard(getRow(host));
		const el = host.querySelector('.MuiListItemText-secondary');
		assert.equal(el, null, 'no secondary text');
		assert.equal(document.querySelector('[role="tooltip"]'), null);
	});
});
