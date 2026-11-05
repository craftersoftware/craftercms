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

// typescript-eslint needs the TypeScript JS API, which TypeScript 7 (the native compiler) doesn't provide and
// typescript-eslint rejects (peer range >=4.8.4 <6.1.0). Until it supports TS 7, route the `typescript` requires made
// by typescript-eslint and ts-api-utils to the TypeScript 5 copy installed as `typescript-eslint-compat`.
//
// Upstream tracking issue: https://github.com/typescript-eslint/typescript-eslint/issues/10940
// Proper fix: craftersoftware/craftercms-e#1441
//
// Remove once typescript-eslint supports TS 7, all together:
// - this file
// - the `typescript-eslint-compat` devDependency in studio-ui/package.json
// - the `eslintTypescriptRedirect.cjs` imports in ui/app/eslint.config.mjs and ui/guest/eslint.config.mjs
const Module = require('node:module');

const compatTypescript = require.resolve('typescript-eslint-compat/package.json').replace(/package\.json$/, '');
const consumers = /[\\/]node_modules[\\/](@typescript-eslint[\\/][^\\/]+|ts-api-utils)[\\/]/;
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, ...rest) {
	if ((request === 'typescript' || request.startsWith('typescript/')) && consumers.test(parent?.filename ?? '')) {
		request = request.replace(/^typescript/, compatTypescript.replace(/[\\/]$/, ''));
	}
	return originalResolveFilename.call(this, request, parent, ...rest);
};
