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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JSDOM } from 'jsdom';
import '../../test/registerTsLoader.mjs';

// node --test has no DOMParser or XMLSerializer. jsdom supplies both; deserialize serializes the node first.
const { window } = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.DOMParser = window.DOMParser;
globalThis.XMLSerializer = window.XMLSerializer;

const { fromString } = await import('../utils/xml.ts');
const { readFormEnginePostfixRules } = await import('./configuration.ts');

function rulesFrom(xml: string) {
	return readFormEnginePostfixRules(fromString(xml));
}

describe('readFormEnginePostfixRules', () => {
	it('turns several ignore fields into a string array when the rule is true', () => {
		const rules = rulesFrom(`
			<site-config>
				<form-engine>
					<field-name-postfix>true</field-name-postfix>
					<ignore-postfix-fields>
						<field>internal-name</field>
						<field>file-name</field>
					</ignore-postfix-fields>
				</form-engine>
			</site-config>
		`);
		assert.equal(rules.fieldNamePostfix, true);
		assert.deepEqual(rules.ignorePostfixFields, ['internal-name', 'file-name']);
	});

	it('normalizes a single ignore field to an array', () => {
		const rules = rulesFrom(`
			<site-config>
				<form-engine>
					<field-name-postfix>true</field-name-postfix>
					<ignore-postfix-fields>
						<field>internal-name</field>
					</ignore-postfix-fields>
				</form-engine>
			</site-config>
		`);
		assert.deepEqual(rules.ignorePostfixFields, ['internal-name']);
	});

	it('turns the rule on only for the string true', () => {
		for (const value of ['false', 'True', '1', 'yes']) {
			const rules = rulesFrom(`
				<site-config>
					<form-engine>
						<field-name-postfix>${value}</field-name-postfix>
					</form-engine>
				</site-config>
			`);
			assert.equal(rules.fieldNamePostfix, false, value);
		}
	});

	it('trims field names and stays off when form-engine is missing', () => {
		const trimmed = rulesFrom(`
			<site-config>
				<form-engine>
					<field-name-postfix> true </field-name-postfix>
					<ignore-postfix-fields>
						<field> internal-name </field>
					</ignore-postfix-fields>
				</form-engine>
			</site-config>
		`);
		assert.equal(trimmed.fieldNamePostfix, true);
		assert.deepEqual(trimmed.ignorePostfixFields, ['internal-name']);
		assert.deepEqual(rulesFrom('<site-config></site-config>'), {
			fieldNamePostfix: false,
			ignorePostfixFields: []
		});
	});
});
