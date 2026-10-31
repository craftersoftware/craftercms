/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import prettierXmlPlugin from '@prettier/plugin-xml';
import { format } from 'prettier/standalone';
import { nnou } from './object';
import { XMLBuilder, XMLParser, X2jOptions } from 'fast-xml-parser';
import { legacyUnescapeXml } from './string';

export function fromString(xml: string): XMLDocument {
	return xml != null ? new DOMParser().parseFromString(xml, 'text/xml') : null;
}

export function serialize(doc: Node): string {
	return new XMLSerializer().serializeToString(doc);
}

export interface BeautifyOptions {
	tabWidth: number;
	printWidth: number;
	xmlSelfClosingSpace: boolean;
	xmlWhitespaceSensitivity: 'strict' | 'preserve' | 'ignore';
	xmlSortAttributesByKey: boolean;
	xmlQuoteAttributes: 'preserve' | 'single' | 'double';
	singleAttributePerLine: boolean;
	bracketSameLine: boolean;
}

export function beautify(xml: string): Promise<string>;
export function beautify(xml: string, options: Partial<BeautifyOptions>): Promise<string>;
export function beautify(xml: string, options?: Partial<BeautifyOptions>): Promise<string> {
	return format(xml, {
		tabWidth: 2,
		printWidth: +Infinity,
		// @prettier/plugin-xml v3.3.1 breaks xmlWhitespaceSensitivity behaviour: encoded entities started
		// to get spaces in between the encoded `<`, `>`, and tag name, breaking the decoding.
		// Setting xmlWhitespaceSensitivity to 'preserve' would prevent the issue, but it has consequences
		// on the desired format result. See https://github.com/prettier/plugin-xml/issues/784.
		xmlWhitespaceSensitivity: 'ignore',
		xmlSelfClosingSpace: true,
		...options,
		parser: 'xml',
		plugins: [prettierXmlPlugin]
	});
}

interface GetInnerHtmlOptions {
	trim: boolean;
	applyLegacyUnescaping: boolean;
}

export function getInnerHtml(element: Element): string;
export function getInnerHtml(element: Element, options: Partial<GetInnerHtmlOptions>): string;
export function getInnerHtml(element: Element, options?: Partial<GetInnerHtmlOptions>): string {
	let opts = Object.assign({ trim: true, applyLegacyUnescaping: false } as GetInnerHtmlOptions, options);
	let content = element?.innerHTML;
	if (content) {
		// @ts-ignore downlevelIteration
		const matches = [...content.matchAll(/<!\[CDATA\[([\s\S\n]*?)\]\]>/g)];
		if (matches.length > 0) {
			// ']]>' is stored as adjacent sections (]]]]><![CDATA[>). Read every section in that run.
			// Joining adjacent CDATA sections on read is intentional.
			let cdata = matches[0][1];
			let end = matches[0].index + matches[0][0].length;
			for (let i = 1; i < matches.length && matches[i].index === end; i++) {
				cdata += matches[i][1];
				end = matches[i].index + matches[i][0].length;
			}
			content = cdata.trim();
		}
		if (opts.trim) {
			content = content.trim();
		}
		if (opts.applyLegacyUnescaping) {
			content = legacyUnescapeXml(content);
		}
	}
	return nnou(content) ? content : null;
}

export function getInnerHtmlNumber(element: Element, parser = parseInt): number {
	const content = getInnerHtml(element);
	const num = parser(content);
	if (content === null || content === '') {
		return null;
	} else if (isNaN(num)) {
		console.error(`[utils/xml/getInnerHtmlNumber] Expected number but got NaN. Received value was "${content}".`);
		return null;
	} else {
		return num;
	}
}

export function extractLocalizedElements(nodes: Array<Element> | NodeListOf<Element>) {
	const items: any = {};
	if (!Array.isArray(nodes)) {
		nodes = Array.from(nodes);
	}
	nodes.forEach((tag) => {
		const tagName = tag.tagName;
		const lang = tag.getAttribute('lang');
		if (lang === null) {
			items[tagName] = getInnerHtml(tag);
		} else {
			items[`tagName_${lang}`] = getInnerHtml(tag);
		}
	});
	return items;
}

export function commentless(xml: string) {
	return xml.replace(/<!--[\s\S\n]*?-->/g, '');
}

export function findDocumentElement(element: Element) {
	do {
		if (element instanceof XMLDocument) {
			return element;
		}
		element = element?.parentNode as Element;
	} while (element);
	return null;
}

export function createElements(element: Element, data: object): void {
	Object.entries(data).forEach(([tag, content]) => {
		if (tag === '@attributes') {
			Object.entries(content).forEach(([attr, value]) => {
				element.setAttribute(attr, `${value}`);
			});
		} else {
			const elem = createElement(tag);
			if (typeof content === 'string' || typeof content === 'number' || typeof content === 'boolean') {
				elem.innerHTML = `${content}`;
			} else if (Array.isArray(content)) {
				elem.setAttribute('item-list', 'true');
				if (content.length) {
					if (typeof content[0] === 'object') {
						content.forEach((itemData) => {
							const item = createElement('item');
							createElements(item, itemData);
							elem.appendChild(item);
						});
					} else {
						console.error(
							`[utils/xml/createElements] Incorrect data supplied. Received an array with items of type ${typeof content[0]}.`,
							content
						);
					}
				}
			} else if (content instanceof Element) {
				elem.appendChild(content);
			} else if (content !== null && content !== void 0) {
				createElements(elem, content);
			}
			element.appendChild(elem);
		}
	});
}

export function wrapElementInAuxDocument(element: Element): XMLDocument {
	return fromString(`<?xml version="1.0" encoding="UTF-8"?>${element.outerHTML}`);
}

export const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
export function newXMLDocument(rootTagName = 'root'): XMLDocument {
	// With the document.implementation.createDocument, new elements then inserted into the xml document
	// end up with an undesirable namespace and serialization, loss of case, hence sticking with creating from string.
	return fromString(`${xmlDeclaration}<${rootTagName} />`);
}

// Having this "factory" avoids repeatedly creating a document every time this method gets invoked.
let elementFactory: XMLDocument;
export function createElement(tagName: string): Element;
export function createElement(tagName: string, options: ElementCreationOptions): Element;
export function createElement(tagName: string, options?: ElementCreationOptions): Element {
	return (elementFactory ?? (elementFactory = newXMLDocument())).createElement(tagName, options);
}

export function deserialize(xml: string): any;
export function deserialize(xml: Node): any;
export function deserialize(xml: string, options: Partial<X2jOptions>): any;
export function deserialize(xml: Node, options: Partial<X2jOptions>): any;
export function deserialize(xml: string | Node, options?: Partial<X2jOptions>): any {
	// fast-xml-parser 5.11.2: constructor, prototype and __proto__ throw [SECURITY] Invalid name.
	// toString, valueOf and hasOwnProperty are renamed with a __ prefix.
	const parser = new XMLParser({
		attributeNamePrefix: '',
		ignoreAttributes: false,
		htmlEntities: true,
		ignoreDeclaration: true,
		...options
	});
	if (typeof xml !== 'string') {
		xml = serialize(xml);
	}
	return parser.parse(xml);
}

// fast-xml-parser stores Object.prototype names on a __ prefix (toString → __toString).
// Own-property reads skip the inherited value. constructor, prototype and __proto__ still throw in deserialize.
export function getParsedField(source: object | null | undefined, fieldId: string): unknown {
	if (source == null) return undefined;
	const record = source as Record<string, unknown>;
	if (Object.hasOwn(record, fieldId)) return record[fieldId];
	const renamed = `__${fieldId}`;
	if (Object.hasOwn(record, renamed)) return record[renamed];
	return undefined;
}

// Uses the library's CDATA handling. null and undefined become an empty section.
const cdataBuilder = new XMLBuilder({ cdataPropName: '#cdata' });

export function cdataWrap(value: string): string {
	return cdataBuilder.build({ '#cdata': value == null ? '' : String(value) });
}

export function parseValidateDocument(content: string): XMLDocument | string {
	const xml = fromString(content);
	const parseError = xml.querySelector('parsererror');

	if (parseError) {
		return parseError.querySelector('div').innerText;
	}

	return xml;
}

export const entityEncodingTagValueProcessor = (tag, value) =>
	value
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');

/**
 * Escapes special characters in a string to their corresponding XML entities.
 *
 * @param {string} str - The input string to be escaped.
 * @returns {string} - The escaped string with special characters replaced by XML entities.
 *
 */
export const escapeXml = (str: string): string =>
	str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');

/**
 * Unescapes XML entities in a string back to their corresponding special characters.
 *
 * @param {string} str - The input string containing XML entities to be unescaped.
 * @returns {string} - The unescaped string with XML entities replaced by their original characters.
 *
 */
export const unescapeXml = (str: string): string => entityEncodingTagValueProcessor(null, str);
