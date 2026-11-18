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
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.document = window.document;

const { announceGuestStatus, createStatusAnnouncer, STATUS_REPEAT_DELAY_MS, subscribeGuestStatus } =
	await import('./guestAnnounce.ts');

describe('guest status announcer', () => {
	let region: HTMLElement;
	let texts: string[];
	let announcer: ReturnType<typeof createStatusAnnouncer>;
	let unsubscribe: () => void;

	beforeEach(() => {
		mock.timers.enable({ apis: ['setTimeout'] });
		document.body.innerHTML = '<div role="status" aria-live="polite"></div>';
		region = document.querySelector('[role="status"]');
		texts = [];
		announcer = createStatusAnnouncer((text) => {
			texts.push(text);
			region.textContent = text;
		});
		unsubscribe = subscribeGuestStatus(announcer.announce);
	});

	afterEach(() => {
		unsubscribe();
		announcer.dispose();
		mock.timers.reset();
	});

	it('repeats the sibling a11y delay of 40 ms', () => {
		assert.equal(STATUS_REPEAT_DELAY_MS, 40);
	});

	it('sets a different message immediately', () => {
		announceGuestStatus('Moved Hero.');
		assert.equal(region.textContent, 'Moved Hero.');
		announceGuestStatus('Moved Footer.');
		assert.equal(region.textContent, 'Moved Footer.');
		assert.deepEqual(texts, ['Moved Hero.', 'Moved Footer.']);
	});

	it('clears a repeated "Moved {label}." announcement and sets it again after the delay', () => {
		announceGuestStatus('Moved Hero.');
		assert.equal(region.textContent, 'Moved Hero.');
		announceGuestStatus('Moved Hero.');
		assert.equal(region.textContent, '');
		mock.timers.tick(STATUS_REPEAT_DELAY_MS - 1);
		assert.equal(region.textContent, '');
		mock.timers.tick(1);
		assert.equal(region.textContent, 'Moved Hero.');
		assert.deepEqual(texts, ['Moved Hero.', '', 'Moved Hero.']);
	});

	it('shows a different message right away when it arrives while a repeat is pending', () => {
		announceGuestStatus('Moved Hero.');
		announceGuestStatus('Moved Hero.');
		announceGuestStatus('Moved Footer.');
		assert.equal(region.textContent, 'Moved Footer.');
		mock.timers.tick(1000);
		assert.equal(region.textContent, 'Moved Footer.');
	});

	it('cancels the pending repeat on dispose', () => {
		announceGuestStatus('Moved Hero.');
		announceGuestStatus('Moved Hero.');
		announcer.dispose();
		mock.timers.tick(1000);
		assert.equal(region.textContent, '');
	});
});
