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
 * Plugin locale maps can still use an underscore id. The document locale is already a BCP 47 tag
 * by the time a plugin calls augmentTranslations, so the strings have to be stored under that tag.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const i18nUrl = pathToFileURL(fileURLToPath(new URL('./i18n.ts', import.meta.url))).href;
const loaderUrl = pathToFileURL(fileURLToPath(new URL('../../test/registerTsLoader.mjs', import.meta.url))).href;

function pluginStringAfterLocale(stored: string, pluginLocales: Record<string, Record<string, string>>): string {
	const script = `
		import { JSDOM } from 'jsdom';
		await import(${JSON.stringify(loaderUrl)});
		const dom = new JSDOM('<!doctype html><html lang="en"><body></body></html>', { url: 'http://localhost' });
		dom.window.localStorage.setItem('crafterStudioLanguage', ${JSON.stringify(stored)});
		globalThis.window = dom.window;
		globalThis.document = dom.window.document;
		globalThis.CustomEvent = dom.window.CustomEvent;
		const mod = await import(${JSON.stringify(i18nUrl)});
		const target = ${JSON.stringify(stored)}.replaceAll('_', '-');
		await new Promise((resolve, reject) => {
			if (mod.getCurrentIntl().locale === target) return resolve();
			const timeout = setTimeout(() => reject(new Error('locale did not become ' + target)), 5000);
			const sub = mod.intl$.subscribe((intl) => {
				if (intl.locale !== target) return;
				clearTimeout(timeout);
				sub.unsubscribe();
				resolve();
			});
		});
		mod.augmentTranslations(${JSON.stringify(pluginLocales)});
		await new Promise((resolve, reject) => {
			const read = (intl) => intl.formatMessage({ id: 'pluginGreeting' });
			if (read(mod.getCurrentIntl()) === 'hola') return resolve();
			const timeout = setTimeout(() => reject(new Error('plugin string was not applied; got ' + read(mod.getCurrentIntl()))), 5000);
			const sub = mod.intl$.subscribe((intl) => {
				if (read(intl) !== 'hola') return;
				clearTimeout(timeout);
				sub.unsubscribe();
				resolve();
			});
		});
		process.stdout.write(JSON.stringify(mod.getCurrentIntl().formatMessage({ id: 'pluginGreeting' })));
	`;
	const result = spawnSync(
		process.execPath,
		['--experimental-strip-types', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module'],
		{
			input: script,
			encoding: 'utf8',
			cwd: fileURLToPath(new URL('../..', import.meta.url))
		}
	);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	return JSON.parse(result.stdout) as string;
}

describe('augmentTranslations', () => {
	it('stores an underscore plugin locale under its BCP 47 tag', () => {
		assert.equal(pluginStringAfterLocale('es_ES', { es_ES: { pluginGreeting: 'hola' } }), 'hola');
	});
});
