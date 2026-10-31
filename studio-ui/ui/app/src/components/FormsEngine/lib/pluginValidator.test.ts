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
 * Plugin validators are called as (value, ctx) and return { valid, messages }. They may be async.
 * The context has exactly field, signal, siteId and getValue, with no host internals. A result that is not
 * { valid: true } is invalid, and a malformed one is reported. Required stays host-owned and runs first.
 * The validation atom supplies the signal, and getValue reads the open form's current values.
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import '../../../../test/registerTsLoader.mjs';
import type { ComponentType } from 'react';
import type { AnyValue } from '../types';
import type { ContentTypeField } from '../../../models/ContentType';
import type PluginDescriptor from '../../../models/PluginDescriptor';
import type { Validator } from './validators.ts';

const { registerPlugin } = await import('../../../services/plugin.ts');
const { validateFieldValue, hasFieldValidator } = await import('./validators.ts');
const { createFieldAtoms } = await import('./formUtils.tsx');
const { createStore, atom } = await import('jotai');

const source = { site: 'editorial', type: 'control', name: 'example', file: 'index.js' };
const Component = (() => null) as ComponentType<AnyValue>;
const meta = { siteId: 'editorial', fileName: 'index.xml', itemMeta: { path: '/site/website/index.xml' } };

let counter = 0;
function plugin(validator: Validator<AnyValue>, validations: ContentTypeField['validations'] = {}) {
	const typeKey = `plugin-validator-${counter++}`;
	registerPlugin(
		{ id: `org.example.${typeKey}`, controls: { [typeKey]: { Component, validator } } } as PluginDescriptor,
		source
	);
	return { id: 'thing_s', name: 'Thing', type: typeKey, validations } as ContentTypeField;
}

describe('plugin validator', () => {
	it('is called with (value, ctx) and the context has only the public members', async () => {
		const calls: unknown[][] = [];
		const field = plugin((...args) => {
			calls.push(args);
			return { valid: true };
		});
		assert.equal(hasFieldValidator(field.type), true);
		const result = await validateFieldValue(field, 'abc', meta);
		assert.deepEqual(result, { isValid: true, messages: [] });
		assert.equal(calls.length, 1);
		assert.equal(calls[0].length, 2);
		assert.equal(calls[0][0], 'abc');
		const ctx = calls[0][1] as Record<string, unknown>;
		assert.deepEqual(Object.keys(ctx).sort(), ['field', 'getValue', 'signal', 'siteId']);
		assert.equal(ctx.field, field);
		assert.equal(ctx.siteId, 'editorial');
		assert.ok(ctx.signal instanceof AbortSignal);
		assert.equal('meta' in ctx, false);
		assert.equal('resolveEmbeddedRelevance' in ctx, false);
		assert.equal('irrelevantFieldPaths' in ctx, false);
	});

	it('awaits an async validator and returns its messages in order', async () => {
		const field = plugin(async () => {
			await new Promise((resolve) => setTimeout(resolve, 1));
			return { valid: false, messages: ['first', { defaultMessage: 'second' }] };
		});
		const result = await validateFieldValue(field, 'abc', meta);
		assert.equal(result.isValid, false);
		assert.deepEqual(result.messages, ['first', { defaultMessage: 'second' }]);
	});

	it('is valid only when the result says valid: true', async () => {
		const valid = plugin(() => ({ valid: true, messages: ['ignored when valid is fine'] }));
		assert.equal((await validateFieldValue(valid, 'x', meta)).isValid, true);
		const invalid = plugin(() => ({ valid: false }));
		const result = await validateFieldValue(invalid, 'x', meta);
		assert.deepEqual(result, { isValid: false, messages: [] });
	});

	it('reports a malformed result and treats it as invalid', async () => {
		const error = mock.method(console, 'error', () => undefined);
		try {
			for (const bad of [true, undefined, null, 'ok', { valid: 'yes' }, { messages: [] }]) {
				const field = plugin((() => bad) as unknown as Validator);
				const result = await validateFieldValue(field, 'x', meta);
				assert.equal(result.isValid, false, `result ${JSON.stringify(bad)}`);
				assert.deepEqual(result.messages, []);
			}
			assert.equal(error.mock.callCount(), 6);
		} finally {
			error.mock.restore();
		}
	});

	it('reports malformed messages and treats the result as invalid', async () => {
		const error = mock.method(console, 'error', () => undefined);
		try {
			const bad: unknown[] = [
				'x',
				null,
				[null],
				[1],
				[{}],
				[{ id: 1 }],
				[['plain string tuple']],
				[[{ defaultMessage: 'a' }, null]],
				[[{ defaultMessage: 'a' }, {}, 'extra']]
			];
			for (const messages of bad) {
				const field = plugin((() => ({ valid: true, messages })) as unknown as Validator);
				const result = await validateFieldValue(field, 'x', meta);
				assert.deepEqual(result, { isValid: false, messages: [] }, JSON.stringify(messages));
			}
			assert.equal(error.mock.callCount(), bad.length);
		} finally {
			error.mock.restore();
		}
	});

	it('accepts strings, message descriptors and descriptor tuples, and a missing messages as empty', async () => {
		const messages = [
			'plain',
			{ defaultMessage: 'by default message' },
			{ id: 'by.id' },
			[{ defaultMessage: 'tuple' }],
			[{ defaultMessage: 'tuple with values {n}' }, { n: 1 }]
		];
		const result = await validateFieldValue(
			plugin(() => ({ valid: false, messages }) as never),
			'x',
			meta
		);
		assert.deepEqual(result, { isValid: false, messages });
		const missing = await validateFieldValue(
			plugin(() => ({ valid: false })),
			'x',
			meta
		);
		assert.deepEqual(missing, { isValid: false, messages: [] });
	});

	it('does not run for a required field with an empty value', async () => {
		let called = false;
		const field = plugin(
			() => {
				called = true;
				return { valid: true };
			},
			{ required: { id: 'required', value: true, level: 'required' } }
		);
		const result = await validateFieldValue(field, '', meta);
		assert.equal(result.isValid, false);
		assert.equal(called, false);
		assert.equal((result.messages[0] as { defaultMessage: string }).defaultMessage, 'This field is required.');
	});

	it('receives the caller signal', async () => {
		const seen: AbortSignal[] = [];
		const field = plugin((_value, ctx) => {
			seen.push(ctx.signal);
			return { valid: !ctx.signal.aborted };
		});
		const controller = new AbortController();
		assert.equal((await validateFieldValue(field, 'x', { ...meta, signal: controller.signal })).isValid, true);
		assert.equal(seen[0], controller.signal);
		controller.abort();
		assert.equal((await validateFieldValue(field, 'x', { ...meta, signal: controller.signal })).isValid, false);
	});
});

describe('plugin validator that fails', () => {
	function quietly<T>(fn: (error: ReturnType<typeof mock.method>) => Promise<T>) {
		const error = mock.method(console, 'error', () => undefined);
		return fn(error).finally(() => error.mock.restore());
	}

	it('is invalid, and logged, when it throws synchronously or rejects', async () => {
		await quietly(async (error) => {
			const thrower = plugin(() => {
				throw new Error('boom');
			});
			const rejecter = plugin(() => Promise.reject(new Error('network')));
			for (const field of [thrower, rejecter]) {
				assert.deepEqual(await validateFieldValue(field, 'x', meta), { isValid: false, messages: [] });
			}
			assert.equal(error.mock.callCount(), 2);
		});
	});

	it('is invalid, and not logged, when it throws AbortError after the host signal aborted', async () => {
		await quietly(async (error) => {
			const controller = new AbortController();
			const field = plugin(async (_value, ctx) => {
				controller.abort();
				assert.equal(ctx.signal.aborted, true);
				throw new DOMException('aborted', 'AbortError');
			});
			const result = await validateFieldValue(field, 'x', { ...meta, signal: controller.signal });
			assert.deepEqual(result, { isValid: false, messages: [] });
			assert.equal(error.mock.callCount(), 0);
		});
	});

	it('is logged when the plugin aborts its own controller, and the field is still invalid', async () => {
		await quietly(async (error) => {
			const field = plugin(() => Promise.reject(new DOMException('aborted', 'AbortError')));
			assert.deepEqual(await validateFieldValue(field, 'x', meta), { isValid: false, messages: [] });
			assert.equal(error.mock.callCount(), 1);
		});
	});

	it('is logged when it fails with another error after its signal aborted', async () => {
		await quietly(async (error) => {
			const controller = new AbortController();
			controller.abort();
			const field = plugin(() => Promise.reject(new Error('real failure')));
			const result = await validateFieldValue(field, 'x', { ...meta, signal: controller.signal });
			assert.equal(result.isValid, false);
			assert.equal(error.mock.callCount(), 1);
		});
	});
});

describe('getValue in nested runs', () => {
	const sameAsSibling: Validator<string> = (value, ctx) => ({
		valid: value !== ctx.getValue('other_s'),
		messages: ['same as sibling']
	});

	it('reads the repeat item, not the page', async () => {
		const sub = plugin(sameAsSibling);
		const repeat = {
			id: 'rows_o',
			name: 'Rows',
			type: 'repeat',
			validations: {},
			fields: { thing_s: sub, other_s: { id: 'other_s', name: 'Other', type: 'input', validations: {} } }
		} as unknown as ContentTypeField;
		const root = { ...meta, getValue: () => 'page value' };
		// The item has a sibling equal to the value. The page's other_s differs, so a page read would pass.
		const same = await validateFieldValue(repeat, [{ thing_s: 'a', other_s: 'a' }], root);
		assert.equal(same.isValid, false);
		const differs = await validateFieldValue(repeat, [{ thing_s: 'a', other_s: 'b' }], root);
		assert.equal(differs.isValid, true);
		// Each item sees its own sibling.
		const second = await validateFieldValue(
			repeat,
			[
				{ thing_s: 'a', other_s: 'b' },
				{ thing_s: 'c', other_s: 'c' }
			],
			root
		);
		assert.equal(second.isValid, false);
		// A sibling the item does not have is undefined. The page's value is not used.
		const missing = await validateFieldValue(repeat, [{ thing_s: 'page value' }], root);
		assert.equal(missing.isValid, true);
	});

	it('reads the embedded component, not the page', async () => {
		const sub = plugin(sameAsSibling);
		const embedded = {
			id: 'embedded',
			type: 'component',
			fields: { thing_s: sub, other_s: { id: 'other_s', name: 'Other', type: 'input', validations: {} } }
		};
		const selector = { id: 'items_o', name: 'Items', type: 'node-selector', validations: {} } as ContentTypeField;
		const run = (component: Record<string, unknown>, pageValue: unknown) =>
			validateFieldValue(selector, [{ component: { 'content-type': 'embedded', objectId: 'o1', ...component } }], {
				...meta,
				contentTypesById: { embedded } as never,
				getValue: () => pageValue
			});
		// The page has the same id with a different value. The component's own value decides.
		assert.equal((await run({ thing_s: 'a', other_s: 'a' }, 'page')).isValid, false);
		assert.equal((await run({ thing_s: 'a', other_s: 'b' }, 'a')).isValid, true);
	});

	it('re-runs when the repeat value changes, and the page still reaches root fields', async () => {
		const seen: unknown[] = [];
		const sub = plugin((_value, ctx) => {
			seen.push(ctx.getValue('other_s'));
			return { valid: true };
		});
		const repeat = {
			id: 'rows_o',
			name: 'Rows',
			type: 'repeat',
			validations: {},
			fields: { thing_s: sub }
		} as unknown as ContentTypeField;
		const store = createStore();
		const formContextRef = {
			current: {
				itemMeta: meta.itemMeta,
				atoms: { valueByFieldId: {} },
				fieldUpdates$: { next: () => undefined },
				changedFieldIds: new Set<string>(),
				originalValues: {}
			}
		};
		const [valueAtom, validationAtom] = createFieldAtoms(
			repeat,
			[{ thing_s: 'a', other_s: 'one' }],
			formContextRef as never,
			{
				siteId: 'editorial'
			}
		);
		store.sub(validationAtom, () => undefined);
		await store.get(validationAtom);
		store.set(valueAtom, [{ thing_s: 'a', other_s: 'two' }]);
		await store.get(validationAtom);
		assert.deepEqual(seen, ['one', 'two']);
	});
});

describe('validation atom context', () => {
	function createAtoms(field: ContentTypeField, others: Record<string, unknown>) {
		const store = createStore();
		const otherAtoms = Object.fromEntries(Object.entries(others).map(([id, value]) => [id, atom(value)]));
		const formContextRef = {
			current: {
				itemMeta: meta.itemMeta,
				atoms: { valueByFieldId: otherAtoms },
				fieldUpdates$: { next: () => undefined },
				changedFieldIds: new Set<string>(),
				originalValues: {}
			}
		};
		const [valueAtom, validationAtom] = createFieldAtoms(field, 'initial', formContextRef as never, {
			siteId: 'editorial'
		});
		return { store, otherAtoms, valueAtom, validationAtom };
	}

	it('getValue returns the open form values and validation re-runs when they change', async () => {
		const seen: unknown[] = [];
		const field = plugin((value, ctx) => {
			const other = ctx.getValue('other_s');
			seen.push(other);
			return { valid: value !== other, messages: ['same as other_s'] };
		});
		const { store, otherAtoms, validationAtom } = createAtoms(field, { other_s: 'initial' });
		assert.equal((await store.get(validationAtom)).isValid, false);
		store.set(otherAtoms.other_s, 'different');
		assert.equal((await store.get(validationAtom)).isValid, true);
		assert.deepEqual(seen, ['initial', 'different']);
	});

	it('getValue is undefined for a field the form does not have', async () => {
		const seen: unknown[] = [];
		const field = plugin((_value, ctx) => {
			seen.push(ctx.getValue('missing_s'));
			return { valid: true };
		});
		const { store, validationAtom } = createAtoms(field, {});
		await store.get(validationAtom);
		assert.deepEqual(seen, [undefined]);
	});

	it('supplies a signal that aborts when the value changes before the validator settles', async () => {
		const signals: AbortSignal[] = [];
		const release: Array<() => void> = [];
		const field = plugin(
			(_value, ctx) =>
				new Promise((resolve) => {
					signals.push(ctx.signal);
					release.push(() => resolve({ valid: true }));
				})
		);
		const { store, valueAtom, validationAtom } = createAtoms(field, {});
		const unsubscribe = store.sub(validationAtom, () => undefined);
		const first = store.get(validationAtom);
		assert.equal(signals.length, 1);
		assert.equal(signals[0].aborted, false);
		store.set(valueAtom, 'changed');
		const second = store.get(validationAtom);
		assert.equal(signals.length, 2);
		assert.equal(signals[0].aborted, true);
		assert.equal(signals[1].aborted, false);
		release.forEach((fn) => fn());
		assert.equal((await second).isValid, true);
		await first.catch(() => undefined);
		unsubscribe();
	});
});
