/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import { atom } from 'jotai';

export const ItemNotFoundError = Symbol('ItemNotFoundError');
export const ContentTypeNotFoundError = Symbol('ContentTypeNotFoundError');
export const InvalidParamsError = Symbol('InvalidParamsError');
export const NoSiteIdError = Symbol('NoSiteIdError');
export const UnknownError = Symbol('UnknownError');
export const PropsChangedError = Symbol('PropsChangedError');

// TODO: should be defined in GlobalFormContext
export const stackFormCountAtom = atom(0);

export enum XmlKeys {
	modelId = 'objectId',
	contentTypeId = 'content-type',
	displayTemplate = 'display-template',
	mergeStrategy = 'merge-strategy',
	fileName = 'file-name',
	folderName = 'folder-name',
	internalName = 'internal-name',
	disabled = 'disabled',
	placeInNav = 'placeInNav',
	templateNotRequired = 'no-template-required',
	dateCreated = 'createdDate',
	dateCreatedDt = 'createdDate_dt',
	dateModified = 'lastModifiedDate',
	dateModifiedDt = 'lastModifiedDate_dt',
	savedAsDraft = 'savedAsDraft',
	navLabel = 'navLabel'
}

/**
 * Optional system fields. Written only when this field lookup defines them.
 * `disabled` is also on `systemPropsList`, so a stray tag does not warn; `placeInNav` and `navLabel` do.
 * A top-level `page-nav-order` field defines `placeInNav` even when its id is not `placeInNav`
 * (the server reads `/*[1]/placeInNav`).
 */
export const optionalSystemFieldIds = [XmlKeys.disabled, XmlKeys.placeInNav, XmlKeys.navLabel] as const;

const pageNavOrderControlType = 'page-nav-order';

/**
 * Drops `disabled`, `placeInNav`, and `navLabel` when this field lookup does not define them.
 * On a top-level document, any `page-nav-order` field supplies `placeInNav` (legacy page-nav-order.js).
 * Repeat items pass `topLevel: false` so a nested control does not invent that tag.
 * Mutates `values`.
 */
export function omitOptionalSystemPropsNotInForm(
	fields: { [id: string]: { type?: string } | undefined } | null | undefined,
	values: { [id: string]: unknown },
	options?: { topLevel?: boolean }
): void {
	const topLevel = options?.topLevel !== false;
	let pageNavOrderFieldId: string | undefined;
	if (topLevel && fields) {
		for (const fieldId of Object.keys(fields)) {
			if (fields[fieldId]?.type === pageNavOrderControlType) {
				pageNavOrderFieldId = fieldId;
				break;
			}
		}
	}
	if (pageNavOrderFieldId) {
		values[XmlKeys.placeInNav] = values[pageNavOrderFieldId];
	}
	for (const id of optionalSystemFieldIds) {
		if (id === XmlKeys.placeInNav && pageNavOrderFieldId) {
			continue;
		}
		if (id in values && !fields?.[id]) {
			delete values[id];
		}
	}
}

// These are not in the content type definition
export const systemFieldsNotInType = [
	XmlKeys.contentTypeId,
	XmlKeys.displayTemplate,
	XmlKeys.templateNotRequired,
	XmlKeys.mergeStrategy,
	XmlKeys.modelId,
	XmlKeys.fileName, // TODO: fileName is in the ContentType. Why was it added here?
	XmlKeys.folderName,
	XmlKeys.internalName,
	XmlKeys.dateCreated,
	`${XmlKeys.dateCreated}_dt`,
	XmlKeys.dateModified,
	`${XmlKeys.dateModified}_dt`
];
