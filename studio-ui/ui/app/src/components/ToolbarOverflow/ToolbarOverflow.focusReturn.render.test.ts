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
 * Widgets in the More dialog open their own modals (a Studio dialog, or a popover such as the Launcher).
 * The More dialog stays open underneath. Closing the widget's modal must put focus back on the control
 * inside the More dialog that opened it.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

// MUI's focus trap polls the active element on an interval. Under React's act() that poll never goes
// idle, so the test is killed. Focus restore itself runs in the trap's effect, not in the poll.
globalThis.setInterval = (() => 0) as typeof setInterval;
// The jsdom setup turns animation frames into timers. A transition that keeps scheduling frames
// never lets act() go idle. Run one frame synchronously instead.
const runFrame = (callback: FrameRequestCallback) => {
	callback(0);
	return 0;
};
globalThis.requestAnimationFrame = runFrame;
window.requestAnimationFrame = runFrame;

if (typeof globalThis.ShadowRoot === 'undefined') {
	Object.defineProperty(globalThis, 'ShadowRoot', { value: window.ShadowRoot, configurable: true });
}

if (typeof globalThis.ResizeObserver === 'undefined') {
	class ResizeObserverStub {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
	window.ResizeObserver = globalThis.ResizeObserver;
}

// jsdom reports 0 for every width, which the overflow bar treats as "not measured yet" and keeps
// every item inline. Give the bar a narrow client width and every other element a wide offset width
// so the single widget moves into the More dialog.
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
	configurable: true,
	get() {
		return 200;
	}
});
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
	configurable: true,
	get() {
		return this.hasAttribute('data-toolbar-overflow') ? 100 : 200;
	}
});

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { IntlProvider } = await import('react-intl');
const { ThemeProvider, createTheme } = await import('@mui/material/styles');
const { default: Dialog } = await import('@mui/material/Dialog');
const { default: Popover } = await import('@mui/material/Popover');
const { ToolbarOverflow } = await import('./ToolbarOverflow.tsx');
const { getFocusRingThemeOptions } = await import('../../styles/focusRing.ts');

(globalThis as { localStorage?: Storage }).localStorage ??= window.localStorage;

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => {
			unmount();
		});
		host.remove();
	}
});

function install() {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	const theme = createTheme({ ...getFocusRingThemeOptions('light'), palette: { mode: 'light' } });
	return {
		host,
		async render(node: React.ReactNode) {
			await act(async () => {
				root.render(
					React.createElement(
						ThemeProvider,
						{ theme },
						React.createElement(IntlProvider, { locale: 'en', messages: {}, onError() {} }, node)
					)
				);
			});
			mounted.push({ unmount: () => root.unmount(), host });
		}
	};
}

async function settle() {
	await act(async () => {});
}

function button(label: string): HTMLButtonElement {
	const found = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
	assert.ok(found, `missing button ${label}`);
	return found;
}

async function openMore() {
	await settle();
	const more = button('More toolbar actions');
	await act(async () => {
		more.click();
	});
	await settle();
}

function DialogWidget(props: { label: string }) {
	const [open, setOpen] = React.useState(false);
	return React.createElement(
		React.Fragment,
		null,
		React.createElement('button', {
			type: 'button',
			'aria-label': props.label,
			onClick: () => setOpen(true)
		}),
		React.createElement(
			Dialog,
			{ open, onClose: () => setOpen(false), transitionDuration: 0 },
			React.createElement('button', {
				type: 'button',
				'aria-label': `Close ${props.label}`,
				onClick: () => setOpen(false)
			})
		)
	);
}

function PopoverWidget(props: { label: string }) {
	const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
	return React.createElement(
		React.Fragment,
		null,
		React.createElement('button', {
			type: 'button',
			'aria-label': props.label,
			onClick: (event: React.MouseEvent<HTMLButtonElement>) => setAnchor(event.currentTarget)
		}),
		React.createElement(
			Popover,
			{
				open: Boolean(anchor),
				anchorEl: anchor,
				onClose: () => setAnchor(null),
				transitionDuration: 0
			},
			React.createElement('button', {
				type: 'button',
				'aria-label': `Close ${props.label}`,
				onClick: () => setAnchor(null)
			})
		)
	);
}

describe('ToolbarOverflow focus when a widget modal closes', () => {
	it('returns focus to the widget button when its dialog closes', async () => {
		const { render } = install();
		await render(React.createElement(ToolbarOverflow, null, React.createElement(DialogWidget, { label: 'Publish' })));
		await openMore();
		const publish = button('Publish');
		await act(async () => {
			// A pointer or keyboard activation focuses the control before the dialog opens.
			publish.focus();
			publish.click();
		});
		await settle();
		const close = button('Close Publish');
		await act(async () => {
			close.click();
		});
		await settle();
		assert.equal(document.activeElement, button('Publish'));
	});

	it('returns focus to the widget button when its popover closes', async () => {
		const { render } = install();
		await render(React.createElement(ToolbarOverflow, null, React.createElement(PopoverWidget, { label: 'Launcher' })));
		await openMore();
		const launcher = button('Launcher');
		await act(async () => {
			launcher.focus();
			launcher.click();
		});
		await settle();
		const close = button('Close Launcher');
		await act(async () => {
			close.click();
		});
		await settle();
		assert.equal(document.activeElement, button('Launcher'));
	});
});
