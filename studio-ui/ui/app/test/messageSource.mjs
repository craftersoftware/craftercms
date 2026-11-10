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

// formatjs `ast: true` replaces a message string with this element list. Tests that
// read the source text use this to get the string back.

const literal = 0;
const argument = 1;
const number = 2;
const date = 3;
const time = 4;
const select = 5;
const plural = 6;
const pound = 7;
const tag = 8;

function printList(elements) {
	return (elements ?? []).map(printElement).join('');
}

function printStyle(style) {
	if (style == null || style === '') return '';
	if (typeof style === 'string') return `, ${style}`;
	return '';
}

function printOptions(element) {
	return Object.entries(element.options)
		.map(([key, option]) => `${key} {${printList(option.value)}}`)
		.join(' ');
}

function printElement(element) {
	switch (element?.type) {
		case literal:
			return element.value ?? '';
		case argument:
			return `{${element.value}}`;
		case number:
			return `{${element.value}, number${printStyle(element.style)}}`;
		case date:
			return `{${element.value}, date${printStyle(element.style)}}`;
		case time:
			return `{${element.value}, time${printStyle(element.style)}}`;
		case select:
			return `{${element.value}, select, ${printOptions(element)}}`;
		case plural: {
			const kind = element.pluralType === 'ordinal' ? 'selectordinal' : 'plural';
			const offset = element.offset ? ` offset:${element.offset}` : '';
			return `{${element.value}, ${kind},${offset} ${printOptions(element)}}`;
		}
		case pound:
			return '#';
		case tag:
			return `<${element.value}>${printList(element.children)}</${element.value}>`;
		default:
			return '';
	}
}

/** A source message, or the ICU string of a precompiled formatjs message. */
export function messageSource(message) {
	if (typeof message === 'string' || message == null) return message ?? '';
	if (!Array.isArray(message)) return message;
	return printList(message);
}
