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
import { retrieveProperty } from '../../../utils/object';

// Path helpers shared by the live form context (`runtime`) and the relevance snapshot (`relevance`).
// Kept apart so `runtime` can depend on `relevance` without an import cycle.

/**
 * Looks up a field definition, walking nested `.fields` and skipping numeric (repeat index) segments.
 */
export function getFieldFromContentType(contentType: ContentType, fieldId: string): ContentTypeField | undefined {
	if (!fieldId.includes('.')) {
		return contentType.fields[fieldId];
	}
	const segments = fieldId.split('.').filter((segment) => segment !== '' && !/^\d+$/.test(segment));
	if (!segments.length) {
		return undefined;
	}
	let current: ContentTypeField | undefined = contentType.fields[segments[0]];
	for (let i = 1; i < segments.length && current; i++) {
		current = current.fields?.[segments[i]];
	}
	return current;
}

export function parseFieldValuePath(fieldId: string): { rootId: string; nestedPath: string } | null {
	if (!fieldId.includes('.')) {
		return null;
	}
	const segments = fieldId.split('.');
	if (segments.length < 2 || segments.some((segment) => segment === '')) {
		return null;
	}
	const [rootId, ...rest] = segments;
	return { rootId, nestedPath: rest.join('.') };
}

/** Reads a top-level key, or a dotted path into a nested value (numeric segments are array indices). */
export function readValueFromSnapshot(values: Record<string, unknown>, fieldId: string): unknown {
	if (Object.prototype.hasOwnProperty.call(values, fieldId)) {
		return values[fieldId];
	}
	const parsed = parseFieldValuePath(fieldId);
	if (!parsed) return undefined;
	const root = values[parsed.rootId];
	if (root == null || typeof root !== 'object') return undefined;
	try {
		return retrieveProperty(root as object, parsed.nestedPath);
	} catch {
		return undefined;
	}
}
