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
 * The Git and Duplicate project cards are one button over an icon, a title and a description.
 * The accessible name is the visible title (WCAG 2.5.3): aria-labelledby points at that title, and the
 * description is outside the button so it is not part of the visible label. aria-describedby still
 * points at it. Two cards must not share ids.
 */

import '../../../test/stringListDomSetup.mjs';
import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { RawIntlProvider } = await import('react-intl');
const { createTestIntl } = await import('../../../test/createTestIntl.mjs');
const { default: PluginCard } = await import('./PluginCard.tsx');

const intl = createTestIntl();
const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function renderCard(plugin: { id: string; name: string; description: string }, onPluginSelected = () => {}) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(PluginCard, {
					plugin: {
						...plugin,
						documentation: '',
						media: { screenshots: [], videos: [] }
					},
					onPluginSelected,
					onDetails() {}
				} as never)
			)
		);
	});
	mounted.push({ unmount: () => root.unmount(), host });
	return host;
}

const text = (element: Element | null) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The card action, its visible title and its description, resolved the way a browser names a button. */
function actionParts(host: HTMLElement) {
	const button = host.querySelector('button.MuiCardActionArea-root');
	assert.ok(button, 'the card action is not a button');
	const labelledBy = button.getAttribute('aria-labelledby');
	assert.ok(labelledBy, 'the action has no aria-labelledby');
	assert.equal(labelledBy.split(/\s+/).length, 1, 'the name is the title alone');
	const title = document.getElementById(labelledBy);
	assert.ok(title, `aria-labelledby points at "${labelledBy}", which is not rendered`);
	assert.equal(document.querySelectorAll(`[id="${labelledBy}"]`).length, 1);
	assert.equal(button.contains(title), true, 'the visible title is not inside the button');
	const describedBy = button.getAttribute('aria-describedby');
	assert.ok(describedBy, 'the action has no aria-describedby');
	const description = document.getElementById(describedBy);
	assert.ok(description, `aria-describedby points at "${describedBy}", which is not rendered`);
	assert.equal(button.contains(description), false, 'the description is part of the button label');
	return { button, title, description };
}

describe('PluginCard accessible name', () => {
	it('names the Git and Duplicate actions from the visible title and describes them with the summary', async () => {
		const cards = [
			{
				id: 'GIT',
				name: 'Remote Git Repository',
				description: 'Create a new project from a remote git repository'
			},
			{
				id: 'DUPLICATE',
				name: 'Duplicate Project',
				description: 'Create an exact copy of an existing Studio project.'
			}
		];
		const hosts = [];
		for (const plugin of cards) {
			let selected: { id: string; view: number } | undefined;
			const host = await renderCard(plugin, (chosen, view) => {
				selected = { id: chosen.id, view };
			});
			const { button, title, description } = actionParts(host);
			const name = text(title);
			const visible = text(button);
			assert.equal(name, plugin.name);
			assert.equal(visible, plugin.name, 'the button shows text other than its title');
			assert.equal(name.startsWith(visible), true);
			assert.equal(text(description), plugin.description);
			assert.equal(visible.includes(plugin.description), false);
			assert.equal(title.tagName, 'H2');
			assert.equal(title.classList.contains('cardTitle'), true);
			await act(async () => (button as HTMLButtonElement).click());
			assert.deepEqual(selected, { id: plugin.id, view: 1 });
			hosts.push({
				labelledBy: button.getAttribute('aria-labelledby'),
				describedBy: button.getAttribute('aria-describedby')
			});
		}
		assert.notEqual(hosts[0].labelledBy, hosts[1].labelledBy);
		assert.notEqual(hosts[0].describedBy, hosts[1].describedBy);
	});
});
