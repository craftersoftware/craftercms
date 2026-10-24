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
 * Node's type stripper does not resolve extensionless TypeScript imports.
 * Tests import app modules the same way the bundler does (`./path`), so the
 * `test` script registers this hook.
 */
const suffixes = ['.ts', '.tsx', '.mts', '/index.ts', '/index.tsx'];

export async function resolve(specifier, context, nextResolve) {
	const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
	const hasExtension = /\.(tsx?|mts|jsx?|mjs|cjs|json|css|scss)$/.test(specifier);
	if (!isRelative || hasExtension) {
		return nextResolve(specifier, context);
	}
	let lastError;
	for (const suffix of suffixes) {
		try {
			return await nextResolve(`${specifier}${suffix}`, context);
		} catch (error) {
			lastError = error;
			if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
		}
	}
	throw lastError;
}
