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

const require = createRequire(new URL('../package.json', import.meta.url));
const { transformSync } = require('esbuild');

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
export async function resolve(specifier, context, nextResolve) {
	if (specifier.endsWith('.css') || specifier.endsWith('.svg') || specifier.endsWith('.png')) {
		return { url: 'data:text/javascript,', shortCircuit: true };
	}
	const isRelative = specifier.startsWith('.') || specifier.startsWith('/');
	if (isRelative && context.parentURL?.startsWith('file:')) {
		const parent = fileURLToPath(context.parentURL);
		const file = resolveFile(path.resolve(path.dirname(parent), specifier));
		if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
	}
	return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
	if (url.startsWith('data:')) {
		return { format: 'module', source: 'export default {};', shortCircuit: true };
	}
	const isAppSource = url.includes('/ui/app/src/') && (url.endsWith('.ts') || url.endsWith('.tsx'));
	if (!isAppSource) return nextLoad(url, context);
	const filename = fileURLToPath(url);
	const result = transformSync(readFileSync(filename, 'utf8'), {
		loader: url.endsWith('.tsx') ? 'tsx' : 'ts',
		format: 'esm',
		target: 'es2022',
		sourcefile: filename,
		jsx: 'automatic'
	});
	return { format: 'module', source: result.code, shortCircuit: true };
}
