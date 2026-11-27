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
import { join, sep } from 'node:path';
import { ruleTickets } from '../allow-list';

const repoRoot = join(__dirname, '../../../../../');

/**
 * Studio templates, Engine templates and the default site, Studio notification mail,
 * and deployer mail.
 */
const templateRoots = [
	'studio-ui/templates',
	'engine/src/main/webapp',
	'studio/src/main/webapp/WEB-INF/notification/templates',
	'deployer/src/main/resources/templates'
];

/** Whitespace before `lang`, so `data-lang` and `xml:lang` do not satisfy it. */
const htmlLangEn = /\slang\s*=\s*"en"/;

test('template documents set lang on the html element', () => {
	const missing: string[] = [];
	const checked: string[] = [];
	for (const root of templateRoots) {
		const files = readdirSync(join(repoRoot, root), { recursive: true })
			.map(String)
			.filter((file) => file.endsWith('.ftl') || file.endsWith('.html'));
		for (const file of files) {
			const relative = join(root, file);
			const source = readFileSync(join(repoRoot, relative), 'utf8');
			const tags = source.match(/<html\b[^>]*>/gi) ?? [];
			if (!tags.length) {
				continue;
			}
			checked.push(relative.split(sep).join('/'));
			tags.forEach((tag, index) => {
				if (!htmlLangEn.test(tag)) {
					missing.push(`${relative}${tags.length > 1 ? `#${index + 1}` : ''}: ${tag}`);
				}
			});
		}
	}
	expect(missing, 'html elements without lang="en"').toEqual([]);
	expect(templateRoots.filter((root) => checked.some((file) => file.startsWith(root)))).toEqual(templateRoots);
	expect(htmlLangEn.test('<html lang="en">')).toBe(true);
	expect(htmlLangEn.test('<html data-lang="en">')).toBe(false);
	expect(htmlLangEn.test('<html xml:lang="en">')).toBe(false);
});

test('html-has-lang is not an allow-listed exception', () => {
	expect(ruleTickets['html-has-lang']).toBeUndefined();
	const recorded = JSON.parse(readFileSync(join(__dirname, '../allow-list.json'), 'utf8')) as {
		rule: string;
	}[];
	expect(recorded.filter((entry) => entry.rule === 'html-has-lang')).toEqual([]);
});
