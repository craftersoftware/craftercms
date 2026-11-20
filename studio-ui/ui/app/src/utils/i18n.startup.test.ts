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
 * i18n.ts applies the stored locale while the module loads. Each case runs in its own process so that
 * startup runs once, against a jsdom document that already has lang="en".
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const i18nUrl = pathToFileURL(fileURLToPath(new URL('./i18n.ts', import.meta.url))).href;
const loaderUrl = pathToFileURL(fileURLToPath(new URL('../../test/registerTsLoader.mjs', import.meta.url))).href;

interface StartupResult {
	lang: string;
	locale: string;
	langWrites: string[];
}

function loadStoredLocale(stored: string, target = stored.replaceAll('_', '-')): StartupResult {
	const script = `
		import { JSDOM } from 'jsdom';
		await import(${JSON.stringify(loaderUrl)});
		const dom = new JSDOM('<!doctype html><html lang="en"><body></body></html>', { url: 'http://localhost' });
		dom.window.localStorage.setItem('crafterStudioLanguage', ${JSON.stringify(stored)});
		globalThis.window = dom.window;
		globalThis.document = dom.window.document;
		globalThis.CustomEvent = dom.window.CustomEvent;
		const element = dom.window.document.documentElement;
		const langWrites = [];
		const setAttribute = element.setAttribute.bind(element);
		element.setAttribute = (name, value) => {
			if (name === 'lang') langWrites.push(value);
			setAttribute(name, value);
		};
		const mod = await import(${JSON.stringify(i18nUrl)});
		const target = ${JSON.stringify(target)};
		if (target !== 'en') {
			await new Promise((resolve, reject) => {
				if (mod.getCurrentIntl().locale === target) return resolve();
				const timeout = setTimeout(
					() => reject(new Error('intl$ did not emit ' + target + '; locale is ' + mod.getCurrentIntl().locale)),
					5000
				);
				const sub = mod.intl$.subscribe((intl) => {
					if (intl.locale !== target) return;
					clearTimeout(timeout);
					sub.unsubscribe();
					resolve();
				});
			});
		} else {
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		process.stdout.write(JSON.stringify({
			lang: element.lang,
			locale: mod.getCurrentIntl().locale,
			langWrites
		}));
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
	return JSON.parse(result.stdout) as StartupResult;
}

describe('stored locale on startup', () => {
	it('sets lang from a stored non-en locale', () => {
		const loaded = loadStoredLocale('es');
		assert.equal(loaded.lang, 'es');
		assert.equal(loaded.locale, 'es');
	});

	it('leaves lang as it is when the stored locale is en', () => {
		const loaded = loadStoredLocale('en');
		assert.deepEqual(loaded.langWrites, []);
		assert.equal(loaded.lang, 'en');
		assert.equal(loaded.locale, 'en');
	});

	it('writes a stored underscore locale as a BCP 47 lang tag', () => {
		const loaded = loadStoredLocale('es_ES', 'es-ES');
		assert.equal(loaded.lang, 'es-ES');
		assert.equal(loaded.locale, 'es-ES');
	});

	it('canonicalises a lower-case stored locale', () => {
		const loaded = loadStoredLocale('es_es', 'es-ES');
		assert.equal(loaded.lang, 'es-ES');
		assert.equal(loaded.locale, 'es-ES');
	});
});
