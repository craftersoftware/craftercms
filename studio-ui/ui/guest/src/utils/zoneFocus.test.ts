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

import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.document = window.document;
globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
	globalThis.setTimeout(() => callback(0), 16) as unknown as number;

const {
	focusAddressesAfterRemoval,
	notifyZoneRegistryChange,
	noteZoneButtonsRendered,
	requestZoneFocus,
	shiftedCollectionIndex
} = await import('./zoneFocus.ts');

interface Zone {
	iceId: number;
	index: string;
	fieldId?: string;
}

const modelId = 'model-1';
const fieldId = 'items_o';

/** Keyed like the real list: a button keeps its node (and focus) while its zone stays in the list. */
function renderZones(zones: Zone[]) {
	const existing = new Map(
		Array.from(document.querySelectorAll<HTMLElement>('[data-craftercms-zone-button]')).map((button) => [
			button.getAttribute('data-craftercms-zone-button'),
			button
		])
	);
	const wanted = new Set(zones.map(({ iceId }) => String(iceId)));
	existing.forEach((button, key) => wanted.has(key) || button.remove());
	zones.forEach(({ iceId, index, fieldId: field = fieldId }) => {
		const button = existing.get(String(iceId)) ?? document.body.appendChild(document.createElement('button'));
		button.setAttribute('data-craftercms-zone-button', String(iceId));
		button.setAttribute('data-craftercms-model-id', modelId);
		button.setAttribute('data-craftercms-field-id', field);
		button.setAttribute('data-craftercms-index', index);
	});
}

function activeIndex() {
	return document.activeElement?.getAttribute('data-craftercms-index') ?? null;
}

/** The registry changed and the zone buttons were re-rendered, as the keyboard controls do in a frame. */
function registryChangedTo(zones: Zone[]) {
	notifyZoneRegistryChange();
	renderZones(zones);
	noteZoneButtonsRendered();
}

const address = (index: string) => ({ modelId, fieldId, index });

describe('shiftedCollectionIndex', () => {
	it('shifts a flat index', () => {
		assert.equal(shiftedCollectionIndex(2, -1), '1');
		assert.equal(shiftedCollectionIndex('2', 1), '3');
	});
	it('shifts only the last part of a nested index', () => {
		assert.equal(shiftedCollectionIndex('1.2', 1), '1.3');
	});
	it('treats a non-numeric index as 0', () => {
		assert.equal(shiftedCollectionIndex('', 1), '1');
	});
});

describe('focusAddressesAfterRemoval', () => {
	it('prefers the same index, then the previous one', () => {
		assert.deepEqual(focusAddressesAfterRemoval(modelId, fieldId, 2), [address('2'), address('1'), address('')]);
	});
	it('has no previous address for the first item', () => {
		assert.deepEqual(focusAddressesAfterRemoval(modelId, fieldId, 0), [address('0'), address('')]);
	});
	it('keeps the parent part of a nested index', () => {
		assert.deepEqual(focusAddressesAfterRemoval(modelId, fieldId, '1.2'), [
			address('1.2'),
			address('1.1'),
			address('1')
		]);
	});
});

describe('requestZoneFocus', () => {
	before(() => mock.timers.enable({ apis: ['setTimeout'] }));
	after(() => mock.timers.reset());
	beforeEach(() => {
		document.body.innerHTML = '';
	});
	afterEach(() => {
		// Replace any pending request so the next test starts clean.
		requestZoneFocus({ addresses: [] });
	});

	it('focuses the origin button right away when no registry change is expected', () => {
		renderZones([{ iceId: 1, index: '0' }]);
		requestZoneFocus({ iceId: 1 });
		assert.equal(document.activeElement?.getAttribute('data-craftercms-zone-button'), '1');
	});

	it('keeps the origin focused on a move, then focuses the moved item once the registry changed', () => {
		renderZones([
			{ iceId: 1, index: '0' },
			{ iceId: 2, index: '1' },
			{ iceId: 3, index: '2' }
		]);
		requestZoneFocus({ iceId: 3, addresses: [address('1')], afterRegistryChange: true });
		// The neighbour at the target index is still the old one. It must not get focus.
		assert.equal(activeIndex(), '2');
		noteZoneButtonsRendered();
		assert.equal(activeIndex(), '2');
		registryChangedTo([
			{ iceId: 1, index: '0' },
			{ iceId: 3, index: '1' },
			{ iceId: 2, index: '2' }
		]);
		assert.equal(activeIndex(), '1');
		assert.equal(document.activeElement?.getAttribute('data-craftercms-zone-button'), '3');
	});

	it('focuses the same index after deleting a middle item', () => {
		renderZones([
			{ iceId: 1, index: '0' },
			{ iceId: 2, index: '1' },
			{ iceId: 3, index: '2' }
		]);
		requestZoneFocus({
			iceId: 2,
			addresses: focusAddressesAfterRemoval(modelId, fieldId, 1),
			afterRegistryChange: true,
			focusCurrent: false
		});
		registryChangedTo([
			{ iceId: 1, index: '0' },
			{ iceId: 3, index: '1' }
		]);
		assert.equal(document.activeElement?.getAttribute('data-craftercms-zone-button'), '3');
	});

	it('focuses the previous item, not the field zone, after deleting the last one', () => {
		renderZones([
			{ iceId: 9, index: '' },
			{ iceId: 1, index: '0' },
			{ iceId: 2, index: '1' }
		]);
		requestZoneFocus({
			iceId: 2,
			addresses: focusAddressesAfterRemoval(modelId, fieldId, 1),
			afterRegistryChange: true,
			focusCurrent: false
		});
		registryChangedTo([
			{ iceId: 9, index: '' },
			{ iceId: 1, index: '0' }
		]);
		assert.equal(document.activeElement?.getAttribute('data-craftercms-zone-button'), '1');
	});

	it('focuses the field zone right away after deleting the only item', () => {
		const fieldZone = { iceId: 9, index: '' };
		renderZones([fieldZone, { iceId: 1, index: '0' }]);
		requestZoneFocus({
			iceId: 1,
			addresses: focusAddressesAfterRemoval(modelId, fieldId, 0),
			afterRegistryChange: true,
			focusCurrent: false
		});
		registryChangedTo([fieldZone]);
		assert.equal(document.activeElement?.getAttribute('data-craftercms-zone-button'), '9');
	});

	it('focuses the next item, not the field zone, after deleting the first of several when the deregister and the re-index land in one render', () => {
		renderZones([
			{ iceId: 9, index: '' },
			{ iceId: 1, index: '0' },
			{ iceId: 2, index: '1' },
			{ iceId: 3, index: '2' }
		]);
		requestZoneFocus({
			iceId: 1,
			addresses: focusAddressesAfterRemoval(modelId, fieldId, 0),
			afterRegistryChange: true,
			focusCurrent: false
		});
		// Two registry changes in the same task (the deregister, then the sibling re-index), one render for both.
		notifyZoneRegistryChange();
		notifyZoneRegistryChange();
		renderZones([
			{ iceId: 9, index: '' },
			{ iceId: 2, index: '0' },
			{ iceId: 3, index: '1' }
		]);
		noteZoneButtonsRendered();
		assert.equal(document.activeElement?.getAttribute('data-craftercms-zone-button'), '2');
	});

	it('lands on the field zone when a render falls between the deregister and the re-index', () => {
		renderZones([
			{ iceId: 9, index: '' },
			{ iceId: 1, index: '0' },
			{ iceId: 2, index: '1' }
		]);
		requestZoneFocus({
			iceId: 1,
			addresses: focusAddressesAfterRemoval(modelId, fieldId, 0),
			afterRegistryChange: true,
			focusCurrent: false
		});
		// Only the deregister has happened: the next item is still at index '1', so '0' does not exist yet.
		registryChangedTo([
			{ iceId: 9, index: '' },
			{ iceId: 2, index: '1' }
		]);
		assert.equal(document.activeElement?.getAttribute('data-craftercms-zone-button'), '9');
	});

	it('does not pull focus back when the user tabbed elsewhere during the wait', () => {
		renderZones([
			{ iceId: 1, index: '0' },
			{ iceId: 2, index: '1' }
		]);
		requestZoneFocus({ iceId: 2, addresses: [address('0')], afterRegistryChange: true });
		const other = document.querySelector<HTMLElement>('[data-craftercms-zone-button="1"]');
		other.focus();
		registryChangedTo([
			{ iceId: 2, index: '0' },
			{ iceId: 1, index: '1' }
		]);
		assert.equal(document.activeElement?.getAttribute('data-craftercms-zone-button'), '1');
		mock.timers.tick(1500);
		assert.equal(document.activeElement?.getAttribute('data-craftercms-zone-button'), '1');
	});

	it('falls back to the container field zone of a nested item when the registry never changes', () => {
		renderZones([
			{ iceId: 8, index: '' },
			{ iceId: 9, index: '1' },
			{ iceId: 1, index: '1.0' }
		]);
		requestZoneFocus({
			iceId: 1,
			addresses: [address('1.0')],
			afterRegistryChange: true,
			focusCurrent: false
		});
		renderZones([
			{ iceId: 8, index: '' },
			{ iceId: 9, index: '1' }
		]);
		mock.timers.tick(1500);
		assert.equal(document.activeElement?.getAttribute('data-craftercms-zone-button'), '9');
	});

	it('leaves focus on the origin button when the move never repaints', () => {
		renderZones([
			{ iceId: 9, index: '' },
			{ iceId: 1, index: '0' },
			{ iceId: 2, index: '1' }
		]);
		requestZoneFocus({ iceId: 2, addresses: [address('0')], afterRegistryChange: true });
		mock.timers.tick(1500);
		assert.equal(document.activeElement?.getAttribute('data-craftercms-zone-button'), '2');
	});
});
