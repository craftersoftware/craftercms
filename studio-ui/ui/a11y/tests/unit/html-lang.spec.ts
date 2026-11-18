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

import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ruleTickets } from '../allow-list';

const templatesRoot = join(__dirname, '../../../../templates/web');

/**
 * Developer results table at `/studio/test`. It is not a Studio screen: the content type has no form,
 * and nothing in the app supplies the `tests` model it renders.
 */
const devOnlyTemplates = new Set(['test.ftl']);

test('studio web templates set lang on the html element', () => {
	const files = readdirSync(templatesRoot, { recursive: true })
		.map(String)
		.filter((file) => file.endsWith('.ftl') && !devOnlyTemplates.has(basename(file)));
	const missing: string[] = [];
	for (const file of files) {
		const source = readFileSync(join(templatesRoot, file), 'utf8');
		const tags = source.match(/<html\b[^>]*>/gi) ?? [];
		tags.forEach((tag, index) => {
			if (!/\blang\s*=\s*"en"/.test(tag)) {
				missing.push(`${file}${tags.length > 1 ? `#${index + 1}` : ''}: ${tag}`);
			}
		});
	}
	expect(missing, 'html elements without lang="en"').toEqual([]);
});

test('html-has-lang is not an allow-listed exception', () => {
	expect(ruleTickets['html-has-lang']).toBeUndefined();
	const recorded = JSON.parse(readFileSync(join(__dirname, '../allow-list.json'), 'utf8')) as {
		rule: string;
	}[];
	expect(recorded.filter((entry) => entry.rule === 'html-has-lang')).toEqual([]);
});
