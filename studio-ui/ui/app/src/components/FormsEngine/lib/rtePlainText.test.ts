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
import { evaluateRteConstraints, measureRteValue, plainTextFromHtml } from './rtePlainText.ts';

// node --test has no DOMParser. jsdom supplies one whose documents have no
// browsing context (defaultView is null), matching a browser DOMParser document.
// Inline handlers on a live jsdom document still run when the event is dispatched,
// so the test can show the old innerHTML path executes and this path does not.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'https://studio.example/',
	runScripts: 'dangerously'
});
const { window } = dom;
globalThis.DOMParser = window.DOMParser;

const onerrorPayload = `<img src="x" onerror="window.__xssCalls.push('img')">`;
const onloadPayload = `<svg onload="window.__xssCalls.push('svg')"></svg>`;

function resetCalls(): void {
	window.__xssCalls = [];
}

describe('plainTextFromHtml', () => {
	it('does not run img onerror or svg onload payloads', () => {
		resetCalls();
		const text = plainTextFromHtml(`<p>Hello</p>${onerrorPayload}${onloadPayload}`).trim();
		assert.equal(text, 'Hello');
		assert.deepEqual(window.__xssCalls, []);

		const inert = new window.DOMParser().parseFromString('', 'text/html');
		assert.equal(inert.defaultView, null);
		const context = inert.createElement('div');
		inert.body.appendChild(context);
		const range = inert.createRange();
		range.selectNodeContents(context);
		const fragment = range.createContextualFragment(`${onerrorPayload}${onloadPayload}`);
		fragment.querySelector('img').dispatchEvent(new window.Event('error'));
		fragment.querySelector('svg').dispatchEvent(new window.Event('load'));
		assert.deepEqual(window.__xssCalls, []);

		const live = window.document.createElement('div');
		window.document.body.appendChild(live);
		live.innerHTML = `${onerrorPayload}${onloadPayload}`;
		live.querySelector('img').dispatchEvent(new window.Event('error'));
		live.querySelector('svg').dispatchEvent(new window.Event('load'));
		assert.deepEqual(window.__xssCalls, ['img', 'svg']);
		live.remove();
	});

	it('reuses the inert context without mixing earlier values', () => {
		assert.equal(plainTextFromHtml('<p>One</p>').trim(), 'One');
		assert.equal(plainTextFromHtml('<p>Two</p>').trim(), 'Two');
		assert.equal(plainTextFromHtml(onerrorPayload).trim(), '');
		assert.equal(plainTextFromHtml('<p>Three</p>').trim(), 'Three');
	});

	it('matches detached innerText for normal markup', () => {
		assert.equal(plainTextFromHtml('<p>Hello</p><p>World</p>').trim(), 'HelloWorld');
		assert.equal(plainTextFromHtml('<p>Hello</p>\n<p>World</p>').trim(), 'Hello\nWorld');
		assert.equal(plainTextFromHtml('<p>Hello <strong>world</strong></p>').trim(), 'Hello world');
		assert.equal(plainTextFromHtml('<p><br></p>').trim(), '');
		assert.equal(plainTextFromHtml('Hello &amp; world').trim(), 'Hello & world');
	});
});

describe('rte required and maxLength text', () => {
	it('treats an &nbsp;-only value as empty', () => {
		const text = measureRteValue('<p>&nbsp;</p>');
		assert.equal(text, '');
		const required = evaluateRteConstraints(text, true, 10);
		assert.equal(required.requiredFailed, true);
		assert.equal(required.maxLengthExceeded, false);
		assert.equal(required.isValid, false);
		const optional = evaluateRteConstraints(text, false, 0);
		assert.equal(optional.isValid, true);
	});

	it('counts text the same way for required and maxLength', () => {
		const text = measureRteValue('<p>Hello <strong>world</strong></p>');
		assert.equal(text, 'Hello world');
		assert.equal(text.length, 11);
		assert.equal(evaluateRteConstraints(text, true, 11).isValid, true);
		assert.equal(evaluateRteConstraints(text, true, 10).maxLengthExceeded, true);
		assert.equal(evaluateRteConstraints(text, true, 10).requiredFailed, false);
		assert.equal(evaluateRteConstraints(text, false, undefined).isValid, true);

		const withNbsp = measureRteValue('Hello&nbsp;world');
		assert.equal(withNbsp.length, 11);
		assert.equal(evaluateRteConstraints(withNbsp, true, 10).maxLengthExceeded, true);
		assert.equal(evaluateRteConstraints(withNbsp, true, 11).isValid, true);

		const payload = measureRteValue(`<p>Hi</p>${onerrorPayload}`);
		assert.equal(payload, 'Hi');
		assert.equal(evaluateRteConstraints(payload, true, 2).isValid, true);
		assert.equal(evaluateRteConstraints(payload, true, 1).maxLengthExceeded, true);
	});
});
