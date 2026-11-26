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
 * MountOnFirstOpen must not render its children (and so must not trigger the download of a lazy chunk) until `open` is
 * true for the first time, and must keep them mounted afterwards so the exit transition and `onClosed` can still run.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { act, lazy } = await import('react');
const { createRoot } = await import('react-dom/client');
const { MountOnFirstOpen } = await import('./MountOnFirstOpen.tsx');

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];

afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

function setup() {
	const events = { chunkRequests: 0, renders: [] as boolean[], unmounts: 0 };
	// Same shape as a `lazy(() => import('...'))` dialog: the factory runs when React first renders the component.
	const LazyDialog = lazy(() => {
		events.chunkRequests++;
		return Promise.resolve({
			default: function Dialog(props: { open: boolean }) {
				React.useEffect(() => () => void events.unmounts++, []);
				events.renders.push(props.open);
				return React.createElement('div', { 'data-testid': 'dialog', 'data-open': String(props.open) });
			}
		});
	});
	const host = document.createElement('div');
	document.body.append(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	const render = (open: boolean) =>
		act(async () => {
			root.render(React.createElement(MountOnFirstOpen, { open }, React.createElement(LazyDialog, { open })));
		});
	const dialog = () => host.querySelector('[data-testid="dialog"]');
	return { events, render, dialog };
}

describe('MountOnFirstOpen', () => {
	it('does not render the children, nor request the lazy chunk, while it has never been open', async () => {
		const { events, render, dialog } = setup();
		await render(false);
		await render(false);
		assert.equal(dialog(), null);
		assert.equal(events.chunkRequests, 0);
		assert.deepEqual(events.renders, []);
	});

	it('renders the children, requesting the chunk once, as soon as it opens', async () => {
		const { events, render, dialog } = setup();
		await render(false);
		await render(true);
		assert.equal(dialog()?.getAttribute('data-open'), 'true');
		assert.equal(events.chunkRequests, 1);
	});

	it('renders the children right away when it is open on first render', async () => {
		const { events, render, dialog } = setup();
		await render(true);
		assert.equal(dialog()?.getAttribute('data-open'), 'true');
		assert.equal(events.chunkRequests, 1);
	});

	it('keeps the children mounted, receiving open=false, after it closes so exit transitions and onClosed can run', async () => {
		const { events, render, dialog } = setup();
		await render(true);
		await render(false);
		assert.equal(dialog()?.getAttribute('data-open'), 'false');
		assert.equal(events.unmounts, 0);
	});

	it('does not request the chunk again, nor remount the children, when opened a second time', async () => {
		const { events, render, dialog } = setup();
		await render(true);
		await render(false);
		await render(true);
		assert.equal(dialog()?.getAttribute('data-open'), 'true');
		assert.equal(events.chunkRequests, 1);
		assert.equal(events.unmounts, 0);
	});
});
