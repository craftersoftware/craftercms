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

/**
 * Plain text of an HTML field value, for required and maxLength checks.
 *
 * DOMParser builds an inert document (no browsing context): scripts do not run and
 * resources are not loaded. The value is parsed with the HTML fragment algorithm
 * against a div in that document, which matches the text previously read from a
 * detached element's innerText, without assigning the value to innerHTML on a
 * live-document element (that runs event-handler attributes such as img onerror
 * and svg onload in the author's session).
 *
 * The inert document is created once and reused. rteValidator runs on every change,
 * and the document never gains a browsing context, so keeping it is safe.
 */
let inertContext: HTMLDivElement | undefined;

export function plainTextFromHtml(html: string): string {
	if (!inertContext) {
		const inertDocument = new DOMParser().parseFromString('', 'text/html');
		inertContext = inertDocument.createElement('div');
		inertDocument.body.appendChild(inertContext);
	}
	const range = inertContext.ownerDocument.createRange();
	range.selectNodeContents(inertContext);
	return range.createContextualFragment(html).textContent ?? '';
}

/** Trimmed plain text `rteValidator` compares against required and maxLength. */
export function measureRteValue(value: unknown): string {
	const safeValue = typeof value === 'string' ? value : '';
	return plainTextFromHtml(safeValue).trim();
}

export interface RteTextConstraints {
	isValid: boolean;
	requiredFailed: boolean;
	maxLengthExceeded: boolean;
}

/** Required fails on empty text. maxLength fails only when text is longer than the limit. */
export function evaluateRteConstraints(
	text: string,
	required: boolean,
	maxLength: number | null | undefined
): RteTextConstraints {
	const requiredFailed = required && text === '';
	const maxLengthExceeded = maxLength != null && text.length > maxLength;
	return { isValid: !requiredFailed && !maxLengthExceeded, requiredFailed, maxLengthExceeded };
}
