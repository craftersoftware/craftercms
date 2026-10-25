/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import { fixupConfigRules } from '@eslint/compat';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all
});

// plugin:jsx-a11y/recommended, with severity lowered to warn where studio-ui/ui/guest/src
// already has findings. Rules listed here had zero findings on that tree and stay error
// so a new violation fails eslint. Rules the recommended config sets to "off" stay off.
const jsxA11yErrorRules = new Set([
	'jsx-a11y/alt-text',
	'jsx-a11y/anchor-has-content',
	'jsx-a11y/anchor-is-valid',
	'jsx-a11y/aria-activedescendant-has-tabindex',
	'jsx-a11y/aria-props',
	'jsx-a11y/aria-proptypes',
	'jsx-a11y/aria-role',
	'jsx-a11y/aria-unsupported-elements',
	'jsx-a11y/autocomplete-valid',
	'jsx-a11y/heading-has-content',
	'jsx-a11y/html-has-lang',
	'jsx-a11y/iframe-has-title',
	'jsx-a11y/img-redundant-alt',
	'jsx-a11y/interactive-supports-focus',
	'jsx-a11y/label-has-associated-control',
	'jsx-a11y/media-has-caption',
	'jsx-a11y/mouse-events-have-key-events',
	'jsx-a11y/no-access-key',
	'jsx-a11y/no-autofocus',
	'jsx-a11y/no-distracting-elements',
	'jsx-a11y/no-interactive-element-to-noninteractive-role',
	'jsx-a11y/no-noninteractive-element-interactions',
	'jsx-a11y/no-noninteractive-element-to-interactive-role',
	'jsx-a11y/no-noninteractive-tabindex',
	'jsx-a11y/no-redundant-roles',
	'jsx-a11y/role-has-required-aria-props',
	'jsx-a11y/role-supports-aria-props',
	'jsx-a11y/scope',
	'jsx-a11y/tabindex-no-positive'
]);

function jsxA11yRules() {
	return Object.fromEntries(
		Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([name, setting]) => {
			const level = Array.isArray(setting) ? setting[0] : setting;
			if (level === 'off' || level === 0) {
				return [name, setting];
			}
			const severity = jsxA11yErrorRules.has(name) ? 'error' : 'warn';
			if (Array.isArray(setting)) {
				return [name, [severity, ...setting.slice(1)]];
			}
			return [name, severity];
		})
	);
}

export default [
	{
		ignores: ['**/dist', '**/build', '**/build_tsc', '**/.eslintrc.cjs', '**/target', '**/*.js', '**/*.mjs']
	},
	...fixupConfigRules(
		compat.extends(
			'eslint:recommended',
			'plugin:@typescript-eslint/recommended',
			'plugin:react-hooks/recommended',
			'plugin:prettier/recommended',
			'prettier'
		)
	).map((config) => ({
		...config,
		files: ['**/*.ts', '**/*.tsx']
	})),
	{
		files: ['**/*.ts', '**/*.tsx'],
		plugins: { 'react-refresh': reactRefresh, 'jsx-a11y': jsxA11y },
		languageOptions: {
			globals: {
				...globals.browser
			},
			parser: tsParser,
			parserOptions: {
				ecmaFeatures: {
					jsx: true
				}
			}
		},
		rules: {
			...jsxA11yRules(),
			'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
			'prettier/prettier': ['error'],
			'spaced-comment': [
				'error',
				'always',
				{
					line: {
						markers: ['/', '#']
					},
					block: {
						markers: ['!', '*', '#', 'function', 'const', 'if', 'export', 'interface', '#__PURE__', '@__PURE__'],
						exceptions: ['!', '*', '#'],
						balanced: false
					}
				}
			]
		}
	}
];
