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
import { describe, it } from 'node:test';
import type { FieldUpdate } from '../lib/formsEngineContext.ts';
import type { FormFieldChange } from './types.ts';
import '../../../../test/registerTsLoader.mjs';

const { Subject, map, filter, config } = await import('rxjs');
const { atom, createStore } = await import('jotai');
const { createFormControllerContext } = await import('./runtime.ts');
const { createRelevanceContext } = await import('./relevance.ts');

function setup() {
	const store = createStore();
	const title = atom<unknown>('first');
	const body = atom<unknown>('b0');
	const fieldUpdates$ = new Subject<FieldUpdate>();
	const fieldChangeUnsubscribers = new Set<() => void>();
	let disposed = false;
	const ctx = createFormControllerContext({
		siteId: 'editorial',
		store,
		atoms: { valueByFieldId: { title_s: title, body_html: body }, readonly: atom(false), fileName: null } as never,
		contentType: { id: '/page/test', fields: {} } as never,
		getPath: () => '/site/website/test/index.xml',
		mode: 'edit',
		isEmbedded: false,
		fieldUpdates$,
		dispatch: (() => undefined) as never,
		fieldChangeUnsubscribers,
		isDisposed: () => disposed
	});
	// Mirrors what the host does on stack pop: run every teardown callback, then mark disposed.
	const dispose = () => {
		disposed = true;
		for (const unsubscribe of [...fieldChangeUnsubscribers]) unsubscribe();
		fieldChangeUnsubscribers.clear();
	};
	const write = (atomRef: typeof title, fieldId: string, value: unknown) => {
		store.set(atomRef, value);
		fieldUpdates$.next({ fieldId });
	};
	return { ctx, dispose, write, title, body, fieldUpdates$, fieldChangeUnsubscribers };
}

function collect(ctx: ReturnType<typeof setup>['ctx']) {
	const values: FormFieldChange[] = [];
	const state = { completed: false, errored: false };
	const subscription = ctx.fieldChanges.subscribe({
		next: (change) => values.push(change),
		error: () => (state.errored = true),
		complete: () => (state.completed = true)
	});
	return { values, state, subscription };
}

describe('form controller fieldChanges', () => {
	it('emits in order with the field id and the value read at emit time', () => {
		const { ctx, write, title, body } = setup();
		const { values } = collect(ctx);
		write(title, 'title_s', 'second');
		write(body, 'body_html', 'b1');
		write(title, 'title_s', 'third');
		assert.deepEqual(values, [
			{ fieldId: 'title_s', value: 'second' },
			{ fieldId: 'body_html', value: 'b1' },
			{ fieldId: 'title_s', value: 'third' }
		]);
	});

	it('reads the value when the event is delivered, not when it was queued', () => {
		const { ctx, fieldUpdates$, title, write } = setup();
		const { values } = collect(ctx);
		write(title, 'title_s', 'one');
		fieldUpdates$.next({ fieldId: 'title_s' });
		assert.deepEqual(
			values.map((change) => change.value),
			['one', 'one']
		);
	});

	it('emits read-only changes', () => {
		const { ctx, write, title } = setup();
		const { values } = collect(ctx);
		write(title, 'title_s', 'x');
		assert.equal(Object.isFrozen(values[0]), true);
		assert.throws(() => {
			(values[0] as { fieldId: string }).fieldId = 'other';
		}, TypeError);
	});

	it('works with rxjs operators', () => {
		const { ctx, write, title, body } = setup();
		const seen: unknown[] = [];
		ctx.fieldChanges
			.pipe(
				filter((change) => change.fieldId === 'title_s'),
				map((change) => change.value)
			)
			.subscribe((value) => seen.push(value));
		write(title, 'title_s', 'a');
		write(body, 'body_html', 'ignored');
		write(title, 'title_s', 'b');
		assert.deepEqual(seen, ['a', 'b']);
	});

	it('stops delivering after unsubscribe and leaves other subscribers alone', () => {
		const { ctx, write, title, fieldChangeUnsubscribers } = setup();
		const first = collect(ctx);
		const second = collect(ctx);
		assert.equal(fieldChangeUnsubscribers.size, 2);
		write(title, 'title_s', 'a');
		first.subscription.unsubscribe();
		assert.equal(fieldChangeUnsubscribers.size, 1);
		write(title, 'title_s', 'b');
		assert.deepEqual(
			first.values.map((change) => change.value),
			['a']
		);
		assert.deepEqual(
			second.values.map((change) => change.value),
			['a', 'b']
		);
		assert.equal(first.state.completed, false);
	});

	it('delivers every event to each of several subscribers', () => {
		const { ctx, write, title } = setup();
		const subscribers = [collect(ctx), collect(ctx), collect(ctx)];
		write(title, 'title_s', 'a');
		write(title, 'title_s', 'b');
		for (const { values } of subscribers) {
			assert.deepEqual(values, [
				{ fieldId: 'title_s', value: 'a' },
				{ fieldId: 'title_s', value: 'b' }
			]);
		}
	});

	it('completes every subscriber when the context is disposed', () => {
		const { ctx, dispose, write, title, fieldChangeUnsubscribers } = setup();
		const subscribers = [collect(ctx), collect(ctx)];
		write(title, 'title_s', 'a');
		dispose();
		for (const { state, values } of subscribers) {
			assert.equal(state.completed, true);
			assert.equal(state.errored, false);
			assert.equal(values.length, 1);
		}
		assert.equal(fieldChangeUnsubscribers.size, 0);
		write(title, 'title_s', 'late');
		for (const { values } of subscribers) assert.equal(values.length, 1);
	});

	it('completes a subscription made after disposal without emitting', () => {
		const { ctx, dispose, write, title } = setup();
		dispose();
		const warn = console.warn;
		const warnings: unknown[][] = [];
		console.warn = (...args: unknown[]) => void warnings.push(args);
		try {
			const { values, state } = collect(ctx);
			assert.equal(state.completed, true);
			write(title, 'title_s', 'late');
			assert.deepEqual(values, []);
		} finally {
			console.warn = warn;
		}
		assert.equal(warnings.length, 1);
	});

	it('does not let controllers push events', () => {
		const { ctx, write, title } = setup();
		const { values, state } = collect(ctx);
		const exposed = ctx.fieldChanges as unknown as Record<string, unknown>;
		for (const key of ['next', 'error', 'complete', 'asObservable']) {
			assert.equal(typeof exposed[key], 'undefined', key);
		}
		assert.equal(exposed instanceof Subject, false);
		write(title, 'title_s', 'real');
		assert.deepEqual(values, [{ fieldId: 'title_s', value: 'real' }]);
		assert.equal(state.completed, false);
	});

	it('shares one observable object across reads', () => {
		const { ctx } = setup();
		assert.equal(ctx.fieldChanges, ctx.fieldChanges);
	});
});

describe('form controller onFieldChange (unchanged)', () => {
	it('calls the listener with (fieldId, value) in order', () => {
		const { ctx, write, title, body } = setup();
		const calls: unknown[][] = [];
		ctx.onFieldChange((fieldId, value) => calls.push([fieldId, value]));
		write(title, 'title_s', 'a');
		write(body, 'body_html', 'b');
		assert.deepEqual(calls, [
			['title_s', 'a'],
			['body_html', 'b']
		]);
	});

	it('stops delivering once the returned function is called, and removes its teardown entry', () => {
		const { ctx, write, title, fieldChangeUnsubscribers } = setup();
		const calls: unknown[][] = [];
		const unsubscribe = ctx.onFieldChange((fieldId, value) => calls.push([fieldId, value]));
		assert.equal(fieldChangeUnsubscribers.size, 1);
		write(title, 'title_s', 'a');
		unsubscribe();
		unsubscribe();
		write(title, 'title_s', 'b');
		assert.deepEqual(calls, [['title_s', 'a']]);
		assert.equal(fieldChangeUnsubscribers.size, 0);
	});

	it('is dropped on dispose and refused afterwards with a warning and a no-op unsubscribe', () => {
		const { ctx, dispose, write, title } = setup();
		const calls: unknown[][] = [];
		ctx.onFieldChange((fieldId, value) => calls.push([fieldId, value]));
		dispose();
		write(title, 'title_s', 'late');
		assert.deepEqual(calls, []);
		const warn = console.warn;
		const warnings: unknown[][] = [];
		console.warn = (...args: unknown[]) => void warnings.push(args);
		try {
			const unsubscribe = ctx.onFieldChange((fieldId, value) => calls.push([fieldId, value]));
			assert.equal(typeof unsubscribe, 'function');
			assert.doesNotThrow(unsubscribe);
			write(title, 'title_s', 'later');
		} finally {
			console.warn = warn;
		}
		assert.equal(warnings.length, 1);
		assert.deepEqual(calls, []);
	});

	it('keeps delivering to other listeners when one throws', async () => {
		const { ctx, write, title } = setup();
		const calls: unknown[] = [];
		const previous = config.onUnhandledError;
		config.onUnhandledError = (error) => void calls.push(`unhandled:${(error as Error).message}`);
		try {
			ctx.onFieldChange(() => {
				throw new Error('boom');
			});
			ctx.onFieldChange((fieldId) => calls.push(fieldId));
			write(title, 'title_s', 'a');
			await new Promise((resolve) => setTimeout(resolve, 0));
		} finally {
			config.onUnhandledError = previous;
		}
		assert.deepEqual(calls, ['title_s', 'unhandled:boom']);
	});
});

describe('relevance (evaluation) context fieldChanges', () => {
	it('completes immediately and never emits', () => {
		const ctx = createRelevanceContext({
			siteId: 'editorial',
			contentType: { id: '/page/test', fields: {} } as never,
			values: { title_s: 'a' },
			path: undefined,
			mode: 'create',
			isEmbedded: false
		}) as unknown as { fieldChanges: ReturnType<typeof setup>['ctx']['fieldChanges'] };
		const events: string[] = [];
		ctx.fieldChanges.subscribe({
			next: () => events.push('next'),
			error: () => events.push('error'),
			complete: () => events.push('complete')
		});
		assert.deepEqual(events, ['complete']);
	});
});
