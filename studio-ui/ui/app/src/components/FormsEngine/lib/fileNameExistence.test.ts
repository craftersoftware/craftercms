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
 * Path-existence for the root file-name: debounce before the request, cancel on abort, and keep an older
 * response from replacing the current value. Required and unchanged-path checks stay synchronous.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import '../../../../test/registerTsLoader.mjs';
import type { ContentTypeField } from '../../../models/ContentType';

const { validateFieldValue } = await import('./validators.ts');
const { createFileNameAtom, createFormsEngineAtoms, createFormStackData, setFieldAtoms } =
	await import('./formUtils.tsx');
const { atom, createStore } = await import('jotai');

/** Matches `fileNameExistenceDebounceMs` in validators.ts. */
const debounceMs = 300;
const aboutPath = '/site/website/about/index.xml';
const fileNameField = { id: 'file-name', name: 'File Name', type: 'file-name', validations: {} } as ContentTypeField;
const meta = { siteId: 'editorial', itemMeta: { path: aboutPath, pathInSite: aboutPath } };

type PendingRequest = {
	url: string;
	aborted: boolean;
	respond: (exists: boolean) => void;
};

const pending: PendingRequest[] = [];
const originalXhr = globalThis.XMLHttpRequest;

function installDeferredXhr() {
	pending.length = 0;
	globalThis.XMLHttpRequest = class FakeXHR {
		readyState = 0;
		status = 0;
		response: unknown = null;
		responseType = '';
		timeout = 0;
		withCredentials = false;
		upload = { addEventListener() {} };
		#url = '';
		#aborted = false;
		#listeners = new Map<string, Set<(event: Event) => void>>();
		#entry: PendingRequest | null = null;

		addEventListener(type: string, listener: (event: Event) => void) {
			if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
			this.#listeners.get(type)!.add(listener);
		}

		#emit(type: string) {
			const event = { type } as Event;
			this.#listeners.get(type)?.forEach((listener) => listener(event));
		}

		open(_method: string, url: string) {
			this.#url = url;
			this.readyState = 1;
		}

		setRequestHeader() {}

		getAllResponseHeaders() {
			return 'content-type: application/json';
		}

		send() {
			this.readyState = 2;
			const entry: PendingRequest = {
				url: this.#url,
				aborted: false,
				respond: (exists: boolean) => {
					if (entry.aborted) return;
					this.status = 200;
					this.response = { exists };
					this.readyState = 4;
					this.#emit('load');
				}
			};
			this.#entry = entry;
			pending.push(entry);
		}

		abort() {
			this.#aborted = true;
			if (this.#entry) this.#entry.aborted = true;
			if (this.readyState !== 4) {
				this.readyState = 0;
				this.#emit('abort');
			}
		}
	} as unknown as typeof XMLHttpRequest;
}

/**
 * RxJS `timer` schedules with `setInterval`. Node's mock `tick` puts an interval back on the queue after its
 * callback has cleared it, so the next tick runs a cancelled debounce. Arm each interval with mocked `setTimeout`
 * instead: `tick` drops that timeout when `clearTimeout` runs inside the callback.
 */
function installIntervalAsTimeout() {
	const scheduleTimeout = globalThis.setTimeout;
	const cancelTimeout = globalThis.clearTimeout;
	type IntervalHandle = { cleared: boolean; timeout?: ReturnType<typeof setTimeout> };
	globalThis.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
		const handle: IntervalHandle = { cleared: false };
		const arm = () => {
			handle.timeout = scheduleTimeout(() => {
				if (handle.cleared) return;
				(handler as (...params: unknown[]) => void)(...args);
				if (!handle.cleared) arm();
			}, timeout);
		};
		arm();
		return handle as unknown as ReturnType<typeof setInterval>;
	}) as typeof setInterval;
	globalThis.clearInterval = ((handle?: IntervalHandle) => {
		if (!handle) return;
		handle.cleared = true;
		if (handle.timeout !== undefined) cancelTimeout(handle.timeout);
	}) as typeof clearInterval;
}

beforeEach(() => {
	installDeferredXhr();
	mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
	installIntervalAsTimeout();
});

afterEach(() => {
	mock.timers.reset();
	globalThis.XMLHttpRequest = originalXhr;
	pending.length = 0;
});

/** Advance the debounce timer and flush the microtasks that start the request. */
async function advanceDebounce() {
	mock.timers.tick(debounceMs);
	await Promise.resolve();
	await Promise.resolve();
}

describe('file-name path existence', () => {
	it('does not call the server until the debounce settles', async () => {
		const pendingResult = validateFieldValue(fileNameField, 'contact', meta);
		mock.timers.tick(debounceMs - 1);
		await Promise.resolve();
		assert.equal(pending.length, 0);

		await advanceDebounce();
		assert.equal(pending.length, 1);
		assert.match(pending[0].url, /contact/);

		pending[0].respond(false);
		assert.equal((await pendingResult).isValid, true);
	});

	it('sends one request for the latest value after a pause, not one per keystroke', async () => {
		const first = new AbortController();
		const firstResult = validateFieldValue(fileNameField, 'con', { ...meta, signal: first.signal });
		mock.timers.tick(100);
		first.abort();

		const second = new AbortController();
		const secondResult = validateFieldValue(fileNameField, 'conta', { ...meta, signal: second.signal });
		mock.timers.tick(100);
		second.abort();

		const thirdResult = validateFieldValue(fileNameField, 'contact', meta);
		assert.equal(pending.length, 0);
		await advanceDebounce();
		assert.equal(pending.length, 1);
		assert.match(pending[0].url, /contact/);

		pending[0].respond(false);
		assert.deepEqual(await firstResult, { isValid: false, messages: [] });
		assert.deepEqual(await secondResult, { isValid: false, messages: [] });
		assert.equal((await thirdResult).isValid, true);
	});

	it('does not ask the server when the run is aborted before the debounce settles', async () => {
		const controller = new AbortController();
		const pendingResult = validateFieldValue(fileNameField, 'contact', { ...meta, signal: controller.signal });
		controller.abort();
		mock.timers.tick(debounceMs);
		await Promise.resolve();
		assert.equal(pending.length, 0);
		assert.deepEqual(await pendingResult, { isValid: false, messages: [] });
	});

	it('cancels an in-flight existence check when the run is aborted', async () => {
		const controller = new AbortController();
		const pendingResult = validateFieldValue(fileNameField, 'contact', { ...meta, signal: controller.signal });
		await advanceDebounce();
		assert.equal(pending.length, 1);
		const request = pending[0];

		controller.abort();
		assert.equal(request.aborted, true);
		assert.deepEqual(await pendingResult, { isValid: false, messages: [] });

		request.respond(true);
		assert.deepEqual(await pendingResult, { isValid: false, messages: [] });
	});

	it('does not let an older existence response replace the current value', async () => {
		const formContextRef = { current: createFormStackData() };
		const atoms = createFormsEngineAtoms('author', {
			lockResult: atom({ locked: true, lockError: null, affectedPackages: null }),
			readonly: atom(false),
			fileName: createFileNameAtom(aboutPath, formContextRef)
		});
		formContextRef.current.atoms = atoms;
		formContextRef.current.itemMeta = { path: aboutPath, pathInSite: aboutPath } as never;
		const contentType = { id: '/page/article', name: 'Article', fields: { 'file-name': fileNameField } } as never;
		setFieldAtoms(
			formContextRef,
			contentType,
			contentType.fields,
			'file-name',
			atoms,
			'about',
			{ siteId: 'editorial' },
			false,
			aboutPath
		);
		const store = createStore();
		const validation = atoms.validationByFieldId['file-name'];
		store.sub(validation, () => undefined);
		assert.equal((await store.get(validation)).isValid, true);
		assert.equal(pending.length, 0);

		store.set(atoms.fileName as never, 'taken');
		await advanceDebounce();
		assert.equal(pending.length, 1);
		const older = pending[0];

		store.set(atoms.fileName as never, 'free');
		assert.equal(older.aborted, true);

		await advanceDebounce();
		assert.equal(pending.length, 2);
		const latest = pending[1];

		older.respond(true);
		latest.respond(false);

		assert.equal((await store.get(validation)).isValid, true);
		assert.deepEqual((await store.get(validation)).messages, []);
	});

	it('rejects a name that is already taken', async () => {
		const pendingResult = validateFieldValue(fileNameField, 'contact', meta);
		await advanceDebounce();
		assert.equal(pending.length, 1);
		pending[0].respond(true);
		const result = await pendingResult;
		assert.equal(result.isValid, false);
		assert.equal(result.messages.length, 1);
	});

	it('keeps required and unchanged-path checks immediate', async () => {
		const required = await validateFieldValue(fileNameField, '', meta);
		assert.equal(required.isValid, false);
		assert.equal(pending.length, 0);

		const unchanged = await validateFieldValue(fileNameField, 'about', meta);
		assert.equal(unchanged.isValid, true);
		assert.equal(pending.length, 0);

		mock.timers.tick(debounceMs);
		await Promise.resolve();
		assert.equal(pending.length, 0);
	});
});
