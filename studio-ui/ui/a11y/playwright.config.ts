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

import { defineConfig, devices } from '@playwright/test';

const storageState = '.auth/user.json';
const use = { ...devices['Desktop Chrome'], locale: 'en-US', reducedMotion: 'reduce' as const };

export default defineConfig({
	testDir: './tests',
	outputDir: 'report/artifacts',
	timeout: 90_000,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	forbidOnly: Boolean(process.env.CI),
	reporter: [
		['list'],
		['html', { outputFolder: 'report/html', open: 'never' }],
		['json', { outputFile: 'report/results.json' }]
	],
	use: {
		baseURL: process.env.STUDIO_URL ?? 'http://localhost:8080',
		trace: 'retain-on-failure'
	},
	projects: [
		{ name: 'setup', testMatch: /auth\.setup\.ts/ },
		{
			name: 'light',
			testMatch: /\.spec\.ts/,
			dependencies: ['setup'],
			use: { ...use, colorScheme: 'light', storageState }
		},
		{
			name: 'dark',
			testMatch: /\.spec\.ts/,
			dependencies: ['setup'],
			use: { ...use, colorScheme: 'dark', storageState }
		}
	]
});
