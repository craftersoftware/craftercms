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

// node --test has no DOMParser or XMLSerializer. jsdom supplies both.
const { window } = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.DOMParser = window.DOMParser;
globalThis.XMLSerializer = window.XMLSerializer;

const { clearDisplayTemplateOnFormDefinition, setDisplayTemplateOnFormDefinition } = await import('./contentTypes.ts');
const { fromString, serialize } = await import('../utils/xml.ts');

const pathWithSpecialChars = '/templates/web/a&b<c>.ftl';

function formDefinitionDoc(propertiesInnerXml: string): XMLDocument {
	return fromString(`<?xml version="1.0" encoding="UTF-8"?>
<form>
	<title>Article</title>
	<content-type>/page/article</content-type>
	<properties>${propertiesInnerXml}</properties>
</form>`);
}

function displayTemplateValue(doc: XMLDocument): string | null | undefined {
	const property = Array.from(doc.querySelectorAll('properties > property')).find(
		(node) => node.querySelector('name')?.textContent?.trim() === 'display-template'
	);
	return property?.querySelector('value')?.textContent;
}

describe('display-template form-definition path encoding', () => {
	// Paths with <, >, or & must round-trip through textContent + XMLSerializer without
	// breaking well-formedness or decoding &amp; back to & prematurely.
	it('writes and reads back a template path containing <, >, and & verbatim', () => {
		const existing = formDefinitionDoc(`
			<property>
				<name>display-template</name>
				<label>Display Template</label>
				<value>/templates/web/old.ftl</value>
				<type>template</type>
			</property>`);
		setDisplayTemplateOnFormDefinition(existing, pathWithSpecialChars);
		assert.equal(displayTemplateValue(existing), pathWithSpecialChars);

		const xml = serialize(existing);
		assert.equal(fromString(xml).querySelector('parsererror'), null);
		assert.match(xml, /&amp;/);
		assert.match(xml, /&lt;/);
		assert.equal(displayTemplateValue(fromString(xml)), pathWithSpecialChars);

		assert.equal(clearDisplayTemplateOnFormDefinition(existing), true);
		assert.equal(displayTemplateValue(existing), '');
		assert.equal(displayTemplateValue(fromString(serialize(existing))), '');

		const created = formDefinitionDoc('');
		setDisplayTemplateOnFormDefinition(created, pathWithSpecialChars);
		assert.equal(displayTemplateValue(fromString(serialize(created))), pathWithSpecialChars);
	});
});
