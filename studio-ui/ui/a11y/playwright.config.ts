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

const use = { ...devices['Desktop Chrome'], locale: 'en-US', reducedMotion: 'reduce' as const };

export default defineConfig({
	testDir: './tests',
	outputDir: 'report/artifacts',
	timeout: 180_000,
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
		{
			name: 'light',
			testMatch: /\.spec\.ts/,
			use: { ...use, colorScheme: 'light' }
		},
		{
			name: 'dark',
			testMatch: /\.spec\.ts/,
			use: { ...use, colorScheme: 'dark' }
		}
	]
});
