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

import type ContentType from '../../../models/ContentType';
import type { ContentTypeField } from '../../../models/ContentType';
import type LookupTable from '../../../models/LookupTable';

/** Second argument of a {@link ValueRetriever}. New members may be added; existing ones are stable. */
export interface ValueRetrieverContext {
	readonly field: Readonly<ContentTypeField>;
}

/** XML / form-value → in-memory control value (form load). Synchronous. */
export type ValueRetriever<V = unknown> = (value: unknown, ctx: ValueRetrieverContext) => V;

/** Second argument of a {@link ValueSerializer}. New members may be added; existing ones are stable. */
export interface ValueSerializerContext {
	readonly field: Readonly<ContentTypeField>;
	/** Every content type known to the form, by id. Empty when serializing outside a content form. */
	readonly contentTypesById: Readonly<LookupTable<ContentType>>;
}

/**
 * In-memory control value → XML-serialiser-ready shape (form save). Synchronous.
 * The returned shape uses the special keys documented next to the `XML_*` constants below.
 */
export type ValueSerializer<V = unknown> = (value: V, ctx: ValueSerializerContext) => unknown;

/** Prefix of an object key that becomes an XML attribute. `{ '@:inline': true }` renders `inline="true"`. */
export const XML_ATTRIBUTE_PREFIX = '@:';
/** Key whose value is emitted wrapped in a CDATA section. `{ __cdata__: html }`. */
export const XML_CDATA_KEY = '__cdata__';
/** Key holding a text node next to attributes. `{ '@:tokenized': true, '#text': 'x' }`. */
export const XML_TEXT_KEY = '#text';
/** Key whose array value renders as repeated `<item>` elements. `{ item: [...] }`. */
export const XML_LIST_ITEM_KEY = 'item';
/** Attribute key that marks a `{ item: [...] }` list as an item list. */
export const XML_ITEM_LIST_ATTRIBUTE = `${XML_ATTRIBUTE_PREFIX}item-list` as const;
