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
