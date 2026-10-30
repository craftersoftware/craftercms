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

import prettier from 'eslint-plugin-prettier';
import globals from 'globals';
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

export default [{
  ignores: [
    '.git',
    '**/*.ignore.*',
    '**/build',
    '**/node_modules',
    '**/target',
    'ui/models',
    'ui/utils',
    'ui/services',
    'scripts/*',
    'ui/app/public/*',
    'ui/app/build',
    'ui/app/build_tsc',
    'ui/guest/build',
    'ui/guest/build_tsc',
    'static-assets/libs/ace/*',
    'static-assets/components/cstudio-common/amplify-core.js',
    'static-assets/components/cstudio-common/heatmap-support.js',
    'static-assets/components/cstudio-preview-tools/mods/annotate',
    'static-assets/libs/*',
    'static-assets/js/*',
    'static-assets/modules/*',
    'static-assets/next/*',
    'static-assets/scripts/craftercms-guest.umd.js',
    'static-assets/scripts/craftercms-xb.umd.js',
    'static-assets/scripts/preview-landing.umd.js',
    'static-assets/yui/*',
    'static-assets/jquery/*',
    'ui/legacy/babel.config.js',
    'ui/scss/scripts/*',
    'ui/uppy/types/*',
    'ui/uppy/lib/*',
    'ui/uppy/lib/**',
    '**/*.js',
    '**/*.mjs',
    '**/*.d.ts'
  ]
}, ...compat.extends('plugin:prettier/recommended').map((config) => ({
  ...config,
  files: ['**/*.ts', '**/*.tsx']
})), {
  files: ['**/*.ts', '**/*.tsx'],
  plugins: {
    prettier
  },
  languageOptions: {
    globals: {
      ...globals.browser
    },
    ecmaVersion: 2015,
    sourceType: 'script'
  },
  rules: {
    'prettier/prettier': ['error'],
    'spaced-comment': ['error', 'always', {
      line: {
        markers: ['/', '#']
      },
      block: {
        markers: [
          '!',
          '*',
          '#',
          'function',
          'const',
          'if',
          'export',
          'interface',
          '#__PURE__',
          '@__PURE__'
        ],
        exceptions: ['!', '*', '#'],
        balanced: false
      }
    }]
  }
}];
