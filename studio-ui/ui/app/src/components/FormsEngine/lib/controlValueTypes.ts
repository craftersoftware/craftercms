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

/** XML / form-value → in-memory control value (form load). */
export type ValueRetriever<T = unknown> = (value: unknown, field: ContentTypeField) => T;

/** In-memory control value → XML-serialiser-ready shape (form save). */
export type ValueSerializer<T = unknown> = (
	field: ContentTypeField,
	value: unknown,
	contentTypesLookup?: LookupTable<ContentType>
) => T;
