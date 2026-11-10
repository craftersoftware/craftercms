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

import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { formatjsPluginOptions } from '../formatjs.config.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const { transformSync: esbuildTransform } = require('esbuild');
const { transformSync: babelTransform } = require('@babel/core');
const formatjsPlugin = require.resolve('babel-plugin-formatjs');

// @babel/plugin-syntax-typescript is not a dependency. The parser plugins are built into @babel/core.
const typescriptParserPlugins = ['typescript', 'jsx'];
const messageApi = /formatMessage|FormattedMessage|defineMessages|defineMessage/;

const extensions = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];

function resolveFile(base) {
	if (existsSync(base) && statSync(base).isFile()) return base;
	for (const extension of extensions) {
		const candidate = base + extension;
		if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
	}
	for (const extension of extensions) {
		const index = path.join(base, 'index' + extension);
		if (existsSync(index)) return index;
	}
	return null;
}

/**
 * node --test strips types but does not resolve extensionless TypeScript imports or JSX.
 * Tests that import the app register this hook, then dynamically import those modules.
 */
function resolveSpecifier(specifier, context, nextResolve) {
	if (specifier.endsWith('.css') || specifier.endsWith('.svg') || specifier.endsWith('.png')) {
		return { url: 'data:text/javascript,', shortCircuit: true };
	}
	const isRelative = specifier.startsWith('.') || specifier.startsWith('/');
	if (isRelative && context.parentURL?.startsWith('file:')) {
		const parent = fileURLToPath(context.parentURL);
		const file = resolveFile(path.resolve(path.dirname(parent), specifier));
		if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
	}
	try {
		return nextResolve(specifier, context);
	} catch (error) {
		// Some packages ship directory entry points that only CommonJS resolution understands.
		if (error?.code !== 'ERR_UNSUPPORTED_DIR_IMPORT' || !context.parentURL?.startsWith('file:')) throw error;
		const resolved = createRequire(context.parentURL).resolve(specifier);
		return { url: pathToFileURL(resolved).href, shortCircuit: true };
	}
}

// registerHooks calls this synchronously, including for require() from babel-plugin-formatjs.
export function resolve(specifier, context, nextResolve) {
	return resolveSpecifier(specifier, context, nextResolve);
}

export function load(url, context, nextLoad) {
	if (url.startsWith('data:')) {
		return { format: 'module', source: 'export default {};', shortCircuit: true };
	}
	const isAppSource = url.includes('/ui/app/src/') && (url.endsWith('.ts') || url.endsWith('.tsx'));
	if (!isAppSource) return nextLoad(url, context);
	const filename = fileURLToPath(url);
	let source = readFileSync(filename, 'utf8');
	// The app build injects message ids. The test runner does not, unless this pass does.
	const assignsMessageIds = messageApi.test(source);
	if (assignsMessageIds) {
		const transformed = babelTransform(source, {
			filename,
			babelrc: false,
			configFile: false,
			sourceMaps: 'inline',
			parserOpts: { sourceType: 'module', plugins: typescriptParserPlugins },
			plugins: [[formatjsPlugin, { ...formatjsPluginOptions }]]
		});
		source = transformed.code ?? source;
	}
	const result = esbuildTransform(source, {
		loader: url.endsWith('.tsx') ? 'tsx' : 'ts',
		format: 'esm',
		target: 'es2022',
		sourcefile: filename,
		sourcemap: assignsMessageIds ? 'inline' : false,
		jsx: 'automatic',
		// Vite injects this. Node has no import.meta.env, and a few modules read it while loading.
		define: {
			'import.meta.env': JSON.stringify({ DEV: true, PROD: false, MODE: 'test', BASE_URL: '/' })
		}
	});
	return { format: 'module', source: result.code, shortCircuit: true };
}
