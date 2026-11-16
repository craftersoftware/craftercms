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

import '../../scripts/eslintTypescriptRedirect.cjs';
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

const jsxA11yRecommended = jsxA11y.flatConfigs.recommended.rules;
// Downgrades a recommended jsx-a11y rule to a warning while keeping any options from the recommended entry.
const warnRecommended = (ruleName) => {
	const entry = jsxA11yRecommended[ruleName];
	return Array.isArray(entry) ? ['warn', ...entry.slice(1)] : 'warn';
};

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
			parserOptions: { ecmaFeatures: { jsx: true } }
		},
		rules: {
			...jsxA11yRecommended,
			// Rules with existing findings are warnings until those are cleared; the rest of the recommended set errors.
			'jsx-a11y/click-events-have-key-events': warnRecommended('jsx-a11y/click-events-have-key-events'),
			'jsx-a11y/no-static-element-interactions': warnRecommended('jsx-a11y/no-static-element-interactions'),
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
