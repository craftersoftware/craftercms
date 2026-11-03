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
 * What the host guarantees around plugin code: a plugin's retriever fails on its own field only, a failing
 * serializer stops the save with a clear error, the hooks get read-only definitions, the published host objects and
 * registry reads can't be used to change what other plugins and built-ins see, and a plugin can't claim a built-in
 * control type.
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import '../../../../test/registerTsLoader.mjs';
import type { ComponentType } from 'react';
import type { AnyValue } from '../types';
import type ContentType from '../../../models/ContentType';
import type { ContentTypeField } from '../../../models/ContentType';
import type PluginDescriptor from '../../../models/PluginDescriptor';
import type { DataSourceModule } from '../dataSources/types';

const { registerPlugin } = await import('../../../services/plugin.ts');
const { createParsedValuesObject, retrieveFieldValue } = await import('./valueRetrievers.ts');
const { buildContentXml } = await import('./valueSerializers.ts');
const { validateFieldValue, isFieldRequired } = await import('./validators.ts');
const { formsEngineControlsHost, formsEngineDataSourcesHost } = await import('../dataSources/host.ts');
const { formsEngineFormControllersHost } = await import('../formControllers/host.ts');
const { registerBuiltInDataSourceModules } = await import('../dataSources/modules/index.ts');
const { getControlDataSourceBindings, registerControlDataSourceBindings } = await import('../dataSources/bindings.ts');

const source = { site: 'editorial', type: 'control', name: 'example', file: 'index.js' };
const Component = (() => null) as ComponentType<AnyValue>;
const meta = { siteId: 'editorial', fileName: 'index.xml', itemMeta: { path: '/site/website/index.xml' } };

function field(id: string, type: string, extra: Partial<ContentTypeField> = {}): ContentTypeField {
	return { id, name: id, type, validations: {}, ...extra } as ContentTypeField;
}

let counter = 0;
function control(entry: Record<string, unknown>, id = `org.example.hardening-${counter}`) {
	const typeKey = `hardening-${counter++}`;
	registerPlugin({ id, controls: { [typeKey]: { Component, ...entry } } } as PluginDescriptor, source);
	return { typeKey, pluginId: id };
}

async function quietly<T>(fn: (error: ReturnType<typeof mock.method>) => T | Promise<T>): Promise<T> {
	const error = mock.method(console, 'error', () => undefined);
	try {
		return await fn(error);
	} finally {
		error.mock.restore();
	}
}

describe('a plugin valueRetriever that throws', () => {
	it('falls back to the raw value for that field, and names the plugin and field in the console', async () => {
		const { typeKey, pluginId } = control({
			valueRetriever: () => {
				throw new Error('cannot read legacy shape');
			}
		});
		await quietly((error) => {
			const thing = field('thing_s', typeKey, { defaultValue: 'fallback' });
			assert.equal(retrieveFieldValue(thing, 'raw'), 'raw');
			assert.equal(retrieveFieldValue(thing, undefined), 'fallback');
			assert.equal(error.mock.callCount(), 2);
			const message = String(error.mock.calls[0].arguments[0]);
			assert.match(message, new RegExp(pluginId.replace(/\./g, '\\.')));
			assert.match(message, /thing_s/);
			assert.equal((error.mock.calls[0].arguments[1] as Error).message, 'cannot read legacy shape');
		});
	});

	it('does not stop the rest of the form from loading', async () => {
		const { typeKey } = control({
			valueRetriever: () => {
				throw new TypeError('boom');
			}
		});
		await quietly(() => {
			const fields = {
				before_s: field('before_s', 'input'),
				thing_s: field('thing_s', typeKey),
				after_s: field('after_s', 'input')
			};
			const values = createParsedValuesObject(
				fields,
				{ before_s: 'one', thing_s: 'two', after_s: 'three' },
				{} as Record<string, ContentType>
			);
			assert.deepEqual([values.before_s, values.thing_s, values.after_s], ['one', 'two', 'three']);
		});
	});
});

describe('a plugin valueSerializer that throws', () => {
	function contentTypeWith(thing: ContentTypeField) {
		const type = { id: '/component/thing', type: 'component', fields: { thing_s: thing } } as unknown as ContentType;
		return { type, lookup: { [type.id]: type } };
	}

	it('fails the save with an error that names the field and the plugin, and keeps the cause', async () => {
		const cause = new Error('cannot write this');
		const { typeKey, pluginId } = control({
			valueSerializer: () => {
				throw cause;
			}
		});
		const { type, lookup } = contentTypeWith(field('thing_s', typeKey, { name: 'Thing' }));
		await quietly((error) => {
			assert.throws(
				() => buildContentXml({ 'content-type': type.id, objectId: 'abc', thing_s: 'value' }, lookup),
				(thrown: unknown) => {
					assert.ok(thrown instanceof Error);
					assert.match(thrown.message, /Thing/);
					assert.match(thrown.message, /thing_s/);
					assert.ok(thrown.message.includes(pluginId));
					assert.match(thrown.message, /cannot write this/);
					assert.equal(thrown.cause, cause);
					return true;
				}
			);
			assert.equal(error.mock.callCount(), 1);
		});
	});

	it('does not silently write the unconverted value', async () => {
		const { typeKey } = control({
			valueSerializer: () => {
				throw new Error('nope');
			}
		});
		const { type, lookup } = contentTypeWith(field('thing_s', typeKey));
		await quietly(() => {
			let xml: string | undefined;
			try {
				xml = buildContentXml({ 'content-type': type.id, objectId: 'abc', thing_s: 'value' }, lookup);
			} catch {
				// expected
			}
			assert.equal(xml, undefined);
		});
	});
});

describe('field definitions handed to plugin hooks', () => {
	it('are read-only at runtime, so a validator cannot switch the required check off', async () => {
		let attempted = false;
		const { typeKey } = control({
			validator: (_value: unknown, ctx: { field: ContentTypeField }) => {
				attempted = true;
				ctx.field.validations.required.value = false;
				return { valid: true };
			}
		});
		const thing = field('thing_s', typeKey, {
			validations: { required: { id: 'required', value: true, level: 'required' } } as ContentTypeField['validations']
		});
		await quietly(async () => {
			const result = await validateFieldValue(thing, 'x', meta);
			assert.equal(attempted, true);
			assert.equal(result.isValid, false);
			assert.equal(isFieldRequired(thing), true);
			assert.equal((await validateFieldValue(thing, '', meta)).isValid, false);
		});
	});

	it('are read-only for a retriever and a serializer too', async () => {
		const mutate = (_value: unknown, ctx: { field: ContentTypeField }) => {
			ctx.field.name = 'changed';
			return 'x';
		};
		const { typeKey } = control({ valueRetriever: mutate, valueSerializer: mutate });
		const thing = field('thing_s', typeKey, { name: 'Original' });
		const type = { id: '/component/thing', type: 'component', fields: { thing_s: thing } } as unknown as ContentType;
		await quietly(() => {
			assert.equal(retrieveFieldValue(thing, 'raw'), 'raw');
			assert.throws(() =>
				buildContentXml({ 'content-type': type.id, objectId: 'abc', thing_s: 'v' }, { [type.id]: type })
			);
			assert.equal(thing.name, 'Original');
		});
	});
});

describe('published host objects', () => {
	const hosts = {
		controls: formsEngineControlsHost,
		dataSources: formsEngineDataSourcesHost,
		formControllers: formsEngineFormControllersHost
	};

	for (const [name, host] of Object.entries(hosts)) {
		it(`${name} cannot get members replaced, added or removed`, () => {
			assert.ok(Object.isFrozen(host));
			assert.throws(() => {
				(host as Record<string, unknown>).apiVersion = 99;
			}, TypeError);
			assert.throws(() => {
				(host as Record<string, unknown>).extra = true;
			}, TypeError);
			assert.throws(() => {
				delete (host as Record<string, unknown>).apiVersion;
			}, TypeError);
			assert.equal(typeof host.apiVersion, 'number');
		});
	}

	it('controls keeps its member functions and xmlKeys table in place', () => {
		const original = formsEngineControlsHost.xmlKeys;
		assert.throws(() => {
			(formsEngineControlsHost as Record<string, unknown>).xmlKeys = { cdata: 'hacked' };
		}, TypeError);
		assert.equal(formsEngineControlsHost.xmlKeys, original);
		assert.throws(() => {
			(formsEngineControlsHost as Record<string, unknown>).getControl = () => undefined;
		}, TypeError);
	});

	it('formControllers keeps its internal helpers in place', () => {
		assert.ok(Object.isFrozen(formsEngineFormControllersHost.__internal));
		assert.throws(() => {
			(formsEngineFormControllersHost.__internal as Record<string, unknown>).load = () => undefined;
		}, TypeError);
	});
});

describe('registry reads', () => {
	it('getControl returns an entry that cannot be changed to swap the Component or the hooks', () => {
		const { typeKey } = control({ validator: () => ({ valid: true }), dataSourceBindings: [binding('mainManager')] });
		const entry = formsEngineControlsHost.getControl(typeKey);
		assert.ok(entry && Object.isFrozen(entry));
		assert.throws(() => {
			(entry as { Component: unknown }).Component = () => null;
		}, TypeError);
		assert.throws(() => {
			(entry as { validator: unknown }).validator = () => ({ valid: false });
		}, TypeError);
		assert.throws(() => (entry.bindings as unknown[]).push({}), TypeError);
		assert.throws(() => {
			(entry.bindings[0] as { propertyName: string }).propertyName = 'evil';
		}, TypeError);
		assert.equal(formsEngineControlsHost.getControl(typeKey)?.Component, Component);
	});

	it("the plugin's own bindings object is not the one the registry hands out", () => {
		const own = binding('ownManager');
		const { typeKey } = control({ dataSourceBindings: own });
		own.propertyName = 'changed later';
		assert.equal(formsEngineControlsHost.getDataSourceBindings(typeKey)[0].propertyName, 'ownManager');
	});

	it('getDataSourceBindings cannot be used to push into the built-in bindings', () => {
		const bindings = formsEngineControlsHost.getDataSourceBindings('node-selector');
		assert.ok(Object.isFrozen(bindings));
		assert.throws(() => (bindings as unknown[]).push(binding('evil')), TypeError);
		assert.throws(() => {
			(bindings[0] as { propertyName: string }).propertyName = 'evil';
		}, TypeError);
		assert.throws(() => (bindings[0].interfaces as string[]).push('image'), TypeError);
		assert.equal(formsEngineControlsHost.getDataSourceBindings('node-selector')[0].propertyName, 'itemManager');
	});

	it('freezes a copy of a plugin data source module and leaves the registered object unfrozen', () => {
		const type = `hardening-ds-${counter++}`;
		const interfaces = ['item'];
		const capabilities = ['list'];
		const module = { type, interfaces, capabilities, create: () => ({}) } as unknown as DataSourceModule;
		const plugin = { id: `org.example.${type}`, dataSources: { [type]: module } } as PluginDescriptor;
		registerPlugin(plugin, source);
		const read = formsEngineDataSourcesHost.get(type);
		assert.ok(read && read !== module && Object.isFrozen(read));
		assert.ok(!Object.isFrozen(module) && !Object.isFrozen(interfaces) && !Object.isFrozen(capabilities));
		interfaces.push('image');
		(module as { create: unknown }).create = () => ({ tag: 'changed by owner' });
		assert.deepEqual(read.interfaces, ['item']);
		assert.notEqual(read.create, module.create);
		// Registering the plugin's own module again is not a conflict.
		assert.doesNotThrow(() => registerPlugin(plugin, source));
		const other = { ...module, interfaces: ['item'] } as unknown as DataSourceModule;
		assert.throws(
			() => registerPlugin({ id: `org.example.${type}.2`, dataSources: { [type]: other } } as PluginDescriptor, source),
			/different module/
		);
	});

	it('keeps a prototype create, bound to its module, on the registered copy of a class instance module', async () => {
		const type = `hardening-ds-${counter++}`;
		class ClassModule {
			readonly type = type;
			readonly interfaces = ['item'];
			readonly capabilities = ['list'];
			readonly tag = 'receiver';
			create() {
				return { tag: this.tag };
			}
		}
		const module = new ClassModule() as unknown as DataSourceModule;
		registerPlugin({ id: `org.example.${type}`, dataSources: { [type]: module } } as PluginDescriptor, source);
		const read = formsEngineDataSourcesHost.get(type);
		assert.ok(read && Object.isFrozen(read) && !Object.isFrozen(module));
		assert.equal(typeof read.create, 'function');
		assert.deepEqual(await read.create({} as never), { tag: 'receiver' });
		assert.deepEqual(read.interfaces, ['item']);
		assert.deepEqual(read.capabilities, ['list']);
		assert.ok(!('apiVersion' in read));
	});

	it('getDataSourceBindings treats an inherited object member as no control type', () => {
		assert.deepEqual(formsEngineControlsHost.getDataSourceBindings('constructor'), []);
		assert.deepEqual(formsEngineControlsHost.getDataSourceBindings('toString'), []);
	});

	it('data source modules are read-only through get and getAll', () => {
		const type = `hardening-ds-${counter++}`;
		const module = {
			type,
			interfaces: ['item'],
			capabilities: ['list'],
			create: () => ({})
		} as unknown as DataSourceModule;
		registerPlugin({ id: `org.example.${type}`, dataSources: { [type]: module } } as PluginDescriptor, source);
		const read = formsEngineDataSourcesHost.get(type);
		assert.ok(read && Object.isFrozen(read));
		assert.throws(() => {
			(read as { create: unknown }).create = () => ({ tag: 'HIJACKED' });
		}, TypeError);
		assert.throws(() => (read.interfaces as string[]).push('image'), TypeError);
		assert.throws(() => (read.capabilities as string[]).push('upload'), TypeError);
		registerBuiltInDataSourceModules();
		const all = formsEngineDataSourcesHost.getAll();
		assert.ok(all.length > 1 && all.every((entry) => Object.isFrozen(entry)));
		assert.throws(() => {
			(all[0] as { create: unknown }).create = () => ({});
		}, TypeError);
	});
});

describe('registration', () => {
	it('refuses a type that a built-in control or a Type Builder control already owns', () => {
		for (const typeKey of [
			'input',
			'node-selector',
			'variable',
			'path-with-macro-creator',
			'rte',
			'string',
			'datasource:image'
		]) {
			assert.throws(
				() =>
					registerPlugin(
						{ id: `org.example.claim-${typeKey}`, controls: { [typeKey]: { Component } } } as PluginDescriptor,
						source
					),
				/collides with a built-in control/,
				typeKey
			);
		}
	});

	it('refuses a fieldSx that is not an sx value, and accepts an object, an array and a function', () => {
		assert.throws(() => control({ fieldSx: 'margin: 1px' }), /fieldSx must be an sx object, array or function/);
		assert.throws(() => control({ fieldSx: 1 }), /fieldSx/);
		for (const fieldSx of [{ mt: 1 }, [{ mt: 1 }, false], () => ({ mt: 1 })]) {
			assert.doesNotThrow(() => control({ fieldSx }));
		}
	});

	it('keeps eagerly registered bindings when the control declares none, and lets declared ones win', () => {
		const typeKey = `hardening-eager-${counter++}`;
		registerControlDataSourceBindings(typeKey, binding('eagerManager'));
		registerPlugin(
			{ id: `org.example.${typeKey}`, controls: { [typeKey]: { Component } } } as PluginDescriptor,
			source
		);
		assert.equal(getControlDataSourceBindings(typeKey)[0]?.propertyName, 'eagerManager');
		const declared = control({ dataSourceBindings: binding('declaredManager') });
		assert.equal(getControlDataSourceBindings(declared.typeKey)[0]?.propertyName, 'declaredManager');
	});
});

function binding(propertyName: string) {
	return { propertyName, interfaces: ['item'], selection: 'multi' } as {
		propertyName: string;
		interfaces: string[];
		selection: 'multi';
	};
}
