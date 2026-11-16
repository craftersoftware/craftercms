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

const { Subject, map, filter, distinctUntilChanged, switchMap, config } = await import('rxjs');
const { atom, createStore } = await import('jotai');
const { createFormControllerContext, runFormControllerCleanup } = await import('./runtime.ts');
const { createEmptyFormControllerState } = await import('./types.ts');
const { createRelevanceContext } = await import('./relevance.ts');
const { createChangedFieldIdsAtom } = await import('../lib/formUtils.tsx');

/**
 * Builds a controller context over two emitting field atoms (`title_s`, `body_html`), with the same state
 * object the host keeps on the stack entry. `write` stores through the atom, which emits like the host's writer.
 */
function setup(extraAtoms: Record<string, unknown> = {}) {
	const store = createStore();
	const fieldUpdates$ = new Subject<FieldUpdate>();
	// Like the host's field atoms: a write stores the value, then emits the field update.
	const fieldAtom = (fieldId: string, initial: unknown) => {
		const base = atom(initial);
		return atom(
			(get) => get(base),
			(_get, set, value: unknown) => {
				set(base, value);
				fieldUpdates$.next({ fieldId });
			}
		);
	};
	const title = fieldAtom('title_s', 'first');
	const body = fieldAtom('body_html', 'b0');
	// Same state object the host keeps on the stack entry, so disposal runs the real teardown path.
	const state = createEmptyFormControllerState();
	const fieldChangeTeardowns = state.fieldChangeTeardowns;
	const order: string[] = [];
	const ctx = createFormControllerContext({
		siteId: 'editorial',
		store,
		atoms: {
			valueByFieldId: { title_s: title, body_html: body },
			readonly: atom(false),
			fileName: null,
			...extraAtoms
		} as never,
		contentType: { id: '/page/test', fields: {} } as never,
		getPath: () => '/site/website/test/index.xml',
		mode: 'edit',
		isEmbedded: false,
		fieldUpdates$,
		dispatch: (() => undefined) as never,
		fieldChangeTeardowns,
		isDisposed: () => state.disposed
	});
	state.context = ctx;
	state.cleanup = () => order.push('controller-cleanup');
	const dispose = () => runFormControllerCleanup({ formControllerState: state } as never);
	const write = (fieldId: 'title_s' | 'body_html', value: unknown) =>
		store.set(fieldId === 'title_s' ? title : body, value);
	return { ctx, dispose, write, title, body, fieldUpdates$, fieldChangeTeardowns, order, store };
}

/** Subscribes to `ctx.fieldChanges` and records the changes and how the subscription ended. */
function collect(ctx: ReturnType<typeof setup>['ctx'], order?: string[]) {
	const values: FormFieldChange[] = [];
	const state = { completed: false, errored: false };
	const subscription = ctx.fieldChanges.subscribe({
		next: (change) => values.push(change),
		error: () => (state.errored = true),
		complete: () => {
			state.completed = true;
			order?.push('complete');
		}
	});
	return { values, state, subscription };
}

describe('form controller fieldChanges', () => {
	it('emits in order with the field id and the value read when the subscriber is notified', () => {
		const { ctx, write } = setup();
		const { values } = collect(ctx);
		write('title_s', 'second');
		write('body_html', 'b1');
		write('title_s', 'third');
		assert.deepEqual(values, [
			{ fieldId: 'title_s', value: 'second' },
			{ fieldId: 'body_html', value: 'b1' },
			{ fieldId: 'title_s', value: 'third' }
		]);
	});

	it('reads the value when the event is delivered, not when it was queued', () => {
		const { ctx, fieldUpdates$, write } = setup();
		const { values } = collect(ctx);
		write('title_s', 'one');
		fieldUpdates$.next({ fieldId: 'title_s' });
		assert.deepEqual(
			values.map((change) => change.value),
			['one', 'one']
		);
	});

	it('emits read-only changes', () => {
		const { ctx, write } = setup();
		const { values } = collect(ctx);
		write('title_s', 'x');
		assert.equal(Object.isFrozen(values[0]), true);
		assert.throws(() => {
			(values[0] as { fieldId: string }).fieldId = 'other';
		}, TypeError);
	});

	it('works with rxjs operators', () => {
		const { ctx, write } = setup();
		const seen: unknown[] = [];
		ctx.fieldChanges
			.pipe(
				filter((change) => change.fieldId === 'title_s'),
				map((change) => change.value)
			)
			.subscribe((value) => seen.push(value));
		write('title_s', 'a');
		write('body_html', 'ignored');
		write('title_s', 'b');
		assert.deepEqual(seen, ['a', 'b']);
	});

	it('stops delivering after unsubscribe and leaves other subscribers alone', () => {
		const { ctx, write, fieldChangeTeardowns } = setup();
		const first = collect(ctx);
		const second = collect(ctx);
		assert.equal(fieldChangeTeardowns.size, 2);
		write('title_s', 'a');
		first.subscription.unsubscribe();
		assert.equal(fieldChangeTeardowns.size, 1);
		write('title_s', 'b');
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
		const { ctx, write } = setup();
		const subscribers = [collect(ctx), collect(ctx), collect(ctx)];
		write('title_s', 'a');
		write('title_s', 'b');
		for (const { values } of subscribers) {
			assert.deepEqual(values, [
				{ fieldId: 'title_s', value: 'a' },
				{ fieldId: 'title_s', value: 'b' }
			]);
		}
	});

	it('completes every subscriber when the context is disposed', () => {
		const { ctx, dispose, write, fieldChangeTeardowns } = setup();
		const subscribers = [collect(ctx), collect(ctx)];
		write('title_s', 'a');
		dispose();
		for (const { state, values } of subscribers) {
			assert.equal(state.completed, true);
			assert.equal(state.errored, false);
			assert.equal(values.length, 1);
		}
		assert.equal(fieldChangeTeardowns.size, 0);
		write('title_s', 'late');
		for (const { values } of subscribers) assert.equal(values.length, 1);
	});

	it('completes a subscription made after disposal without emitting', () => {
		const { ctx, dispose, write } = setup();
		dispose();
		const warn = console.warn;
		const warnings: unknown[][] = [];
		console.warn = (...args: unknown[]) => void warnings.push(args);
		try {
			const { values, state } = collect(ctx);
			assert.equal(state.completed, true);
			write('title_s', 'late');
			assert.deepEqual(values, []);
		} finally {
			console.warn = warn;
		}
		assert.equal(warnings.length, 1);
	});

	it('does not let controllers push events', () => {
		const { ctx, write } = setup();
		const { values, state } = collect(ctx);
		const exposed = ctx.fieldChanges as unknown as Record<string, unknown>;
		for (const key of ['next', 'error', 'complete']) {
			assert.equal(typeof exposed[key], 'undefined', key);
		}
		assert.equal(exposed instanceof Subject, false);
		assert.equal('fieldUpdates$' in ctx, false);
		write('title_s', 'real');
		assert.deepEqual(values, [{ fieldId: 'title_s', value: 'real' }]);
		assert.equal(state.completed, false);
	});

	it('emits a new object per change, so a bare distinctUntilChanged never skips one', () => {
		const { ctx, write } = setup();
		const { values } = collect(ctx);
		write('title_s', 'same');
		write('title_s', 'same');
		assert.notEqual(values[0], values[1]);
		const bare: unknown[] = [];
		ctx.fieldChanges.pipe(distinctUntilChanged()).subscribe((change) => bare.push(change));
		const byValue: unknown[] = [];
		ctx.fieldChanges
			.pipe(
				map((change) => change.value),
				distinctUntilChanged()
			)
			.subscribe((value) => byValue.push(value));
		write('title_s', 'x');
		write('title_s', 'x');
		assert.equal(bare.length, 2);
		assert.deepEqual(byValue, ['x']);
	});

	it('lets one subscriber write another field and every subscriber sees both changes in order', () => {
		const { ctx, write } = setup();
		const seen: string[] = [];
		ctx.fieldChanges.pipe(filter((change) => change.fieldId === 'title_s')).subscribe((change) => {
			seen.push(`a:${change.fieldId}`);
			ctx.setValue('body_html', 'derived');
		});
		ctx.fieldChanges.subscribe((change) => seen.push(`b:${change.fieldId}=${change.value}`));
		write('title_s', 'first-edit');
		assert.deepEqual(seen, ['a:title_s', 'b:body_html=derived', 'b:title_s=first-edit']);
	});

	it('gives later subscribers the newer value when an earlier one writes the same field during delivery', () => {
		const { ctx, write } = setup();
		const first: unknown[] = [];
		const second: unknown[] = [];
		ctx.fieldChanges.subscribe((change) => {
			first.push(change.value);
			if (change.value === 'a') ctx.setValue('title_s', 'b');
		});
		ctx.fieldChanges.subscribe((change) => second.push(change.value));
		write('title_s', 'a');
		// The nested write is delivered to everyone first; the outer event then reads the newer value.
		assert.deepEqual(first, ['a', 'b']);
		assert.deepEqual(second, ['b', 'b']);
	});

	it('stops a normalise-and-write-back loop when it compares mapped values', () => {
		const { ctx, write } = setup();
		let writes = 0;
		ctx.fieldChanges
			.pipe(
				filter((change) => change.fieldId === 'title_s'),
				map((change) => String(change.value).trim()),
				distinctUntilChanged()
			)
			.subscribe((trimmed) => {
				writes++;
				ctx.setValue('title_s', trimmed);
			});
		write('title_s', '  padded ');
		assert.equal(writes, 1);
	});

	it('keeps delivering to other subscribers when one throws, and leaks nothing', async () => {
		const { ctx, dispose, write, fieldChangeTeardowns } = setup();
		const calls: string[] = [];
		const previous = config.onUnhandledError;
		config.onUnhandledError = (error) => void calls.push(`unhandled:${(error as Error).message}`);
		try {
			ctx.fieldChanges.subscribe(() => {
				calls.push('thrower');
				throw new Error('boom');
			});
			const healthy = collect(ctx);
			write('title_s', 'a');
			write('title_s', 'b');
			await new Promise((resolve) => setTimeout(resolve, 0));
			assert.deepEqual(
				healthy.values.map((change) => change.value),
				['a', 'b']
			);
			assert.deepEqual(calls, ['thrower', 'thrower', 'unhandled:boom', 'unhandled:boom']);
			assert.equal(fieldChangeTeardowns.size, 2);
			dispose();
			assert.equal(healthy.state.completed, true);
			assert.equal(fieldChangeTeardowns.size, 0);
		} finally {
			config.onUnhandledError = previous;
		}
	});

	it('completes subscribers before the controller cleanup runs', () => {
		const { ctx, dispose, order } = setup();
		collect(ctx, order);
		collect(ctx, order);
		dispose();
		assert.deepEqual(order, ['complete', 'complete', 'controller-cleanup']);
		dispose();
		assert.deepEqual(order, ['complete', 'complete', 'controller-cleanup']);
	});

	it('leaves a switchMap inner running past completion until the pipeline is unsubscribed', () => {
		const { ctx, dispose, write } = setup();
		const inner = new Subject<string>();
		const log: string[] = [];
		const subscription = ctx.fieldChanges
			.pipe(
				filter((change) => change.fieldId === 'title_s'),
				switchMap(() => inner)
			)
			.subscribe({ next: (value) => log.push(value), complete: () => log.push('complete') });
		write('title_s', 'a');
		dispose();
		assert.deepEqual(log, []);
		assert.equal(subscription.closed, false);
		inner.next('late');
		assert.deepEqual(log, ['late']);
		subscription.unsubscribe();
		assert.equal(inner.observed, false);
	});
});

describe('form controller onFieldChange (unchanged)', () => {
	it('calls the listener with (fieldId, value) in order', () => {
		const { ctx, write } = setup();
		const calls: unknown[][] = [];
		ctx.onFieldChange((fieldId, value) => calls.push([fieldId, value]));
		write('title_s', 'a');
		write('body_html', 'b');
		assert.deepEqual(calls, [
			['title_s', 'a'],
			['body_html', 'b']
		]);
	});

	it('stops delivering once the returned function is called, and removes its teardown entry', () => {
		const { ctx, write, fieldChangeTeardowns } = setup();
		const calls: unknown[][] = [];
		const unsubscribe = ctx.onFieldChange((fieldId, value) => calls.push([fieldId, value]));
		assert.equal(fieldChangeTeardowns.size, 1);
		write('title_s', 'a');
		unsubscribe();
		unsubscribe();
		write('title_s', 'b');
		assert.deepEqual(calls, [['title_s', 'a']]);
		assert.equal(fieldChangeTeardowns.size, 0);
	});

	it('is dropped on dispose and refused afterwards with a warning and a no-op unsubscribe', () => {
		const { ctx, dispose, write } = setup();
		const calls: unknown[][] = [];
		ctx.onFieldChange((fieldId, value) => calls.push([fieldId, value]));
		dispose();
		write('title_s', 'late');
		assert.deepEqual(calls, []);
		const warn = console.warn;
		const warnings: unknown[][] = [];
		console.warn = (...args: unknown[]) => void warnings.push(args);
		try {
			const unsubscribe = ctx.onFieldChange((fieldId, value) => calls.push([fieldId, value]));
			assert.equal(typeof unsubscribe, 'function');
			assert.doesNotThrow(unsubscribe);
			write('title_s', 'later');
		} finally {
			console.warn = warn;
		}
		assert.equal(warnings.length, 1);
		assert.deepEqual(calls, []);
	});

	it('keeps delivering to other listeners when one throws', async () => {
		const { ctx, write } = setup();
		const calls: unknown[] = [];
		const previous = config.onUnhandledError;
		config.onUnhandledError = (error) => void calls.push(`unhandled:${(error as Error).message}`);
		try {
			ctx.onFieldChange(() => {
				throw new Error('boom');
			});
			ctx.onFieldChange((fieldId) => calls.push(fieldId));
			write('title_s', 'a');
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
		});
		const events: string[] = [];
		ctx.fieldChanges.subscribe({
			next: () => events.push('next'),
			error: () => events.push('error'),
			complete: () => events.push('complete')
		});
		assert.deepEqual(events, ['complete']);
	});
});

describe('field update producers', () => {
	const aboutPath = '/site/website/about/index.xml';
	const titleField = { id: 'title_s', name: 'Title', type: 'input', validations: {} } as never;
	const fileNameField = { id: 'file-name', name: 'File Name', type: 'file-name', validations: {} } as never;

	/** A form context stub with the pieces the field and file-name atom writers touch, and a recorder on `fieldUpdates$`. */
	function wire() {
		const fieldUpdates$ = new Subject<FieldUpdate>();
		const formContext = {
			fieldUpdates$,
			changedFieldIds: createChangedFieldIdsAtom(),
			originalValues: {} as Record<string, unknown>,
			atoms: { valueByFieldId: {} as Record<string, unknown>, fileName: null as unknown },
			itemMeta: { path: aboutPath, contentType: { fields: {} } },
			formControllerState: null
		};
		const ref = { current: formContext } as never;
		const events: FieldUpdate[] = [];
		fieldUpdates$.subscribe((event) => events.push(event));
		return { formContext, ref, events, store: createStore(), fieldUpdates$ };
	}

	it('emits { fieldId } when a field value atom is written', async () => {
		const { createFieldAtoms } = await import('../lib/formUtils.tsx');
		const { ref, events, store } = wire();
		const [valueAtom] = createFieldAtoms(titleField, 'a', ref);
		store.set(valueAtom, 'b');
		assert.deepEqual(events, [{ fieldId: 'title_s' }]);
	});

	it('emits { fieldId } once for a file-name write, whichever atom is written', async () => {
		const { createFieldAtoms, createFileNameAtom } = await import('../lib/formUtils.tsx');
		const { ref, formContext, events, store } = wire();
		const fileNameAtom = createFileNameAtom(aboutPath, ref);
		const [fileNameValueAtom] = createFieldAtoms(fileNameField, 'about', ref);
		formContext.atoms.fileName = fileNameAtom;
		formContext.atoms.valueByFieldId['file-name'] = fileNameValueAtom;
		store.set(fileNameAtom, 'renamed');
		assert.deepEqual(events, [{ fieldId: 'file-name' }]);
		assert.equal(store.get(fileNameValueAtom), 'renamed');
		store.set(fileNameValueAtom, 'again');
		assert.deepEqual(events, [{ fieldId: 'file-name' }, { fieldId: 'file-name' }]);
		assert.equal(store.get(fileNameAtom), 'again');
	});

	it('delivers one fieldChanges event for ctx.setValue on file-name', async () => {
		const { createFieldAtoms, createFileNameAtom } = await import('../lib/formUtils.tsx');
		const { ref, formContext, fieldUpdates$, store } = wire();
		const fileNameAtom = createFileNameAtom(aboutPath, ref);
		const [fileNameValueAtom] = createFieldAtoms(fileNameField, 'about', ref);
		formContext.atoms.fileName = fileNameAtom;
		formContext.atoms.valueByFieldId['file-name'] = fileNameValueAtom;
		const ctx = createFormControllerContext({
			siteId: 'editorial',
			store,
			atoms: { ...formContext.atoms, readonly: atom(false) } as never,
			contentType: { id: '/page/test', fields: {} } as never,
			getPath: () => aboutPath,
			mode: 'edit',
			isEmbedded: false,
			fieldUpdates$,
			dispatch: (() => undefined) as never,
			fieldChangeTeardowns: new Set(),
			isDisposed: () => false
		});
		const { values } = collect(ctx);
		ctx.setValue('file-name', 'from-controller');
		assert.deepEqual(values, [{ fieldId: 'file-name', value: 'from-controller' }]);
	});
});
