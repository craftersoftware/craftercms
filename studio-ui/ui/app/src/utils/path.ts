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

import queryString, { ParsedQuery } from 'query-string';
import { ContentItem, PasteItem } from '../models/Item';
import { toQueryString } from './object';
import LookupTable from '../models/LookupTable';
import ContentType from '../models/ContentType';
import { SystemType } from '../models';
import { v4 as uuid } from 'uuid';
import { ensureSingleSlash } from './string';

// Originally from ComponentPanel.getPreviewPagePath
export function getPathFromPreviewURL(previewURL: string): string {
	let pagePath = previewURL;

	if (pagePath.indexOf('?') > 0) {
		pagePath = pagePath.split('?')[0];
	}
	if (pagePath.indexOf('#') > 0) {
		pagePath = pagePath.split('#')[0];
	}
	if (pagePath.indexOf(';') > 0) {
		pagePath = pagePath.split(';')[0];
	}

	pagePath = pagePath.replace('.html', '.xml');

	if (pagePath.indexOf('.xml') === -1) {
		if (pagePath.substring(pagePath.length - 1) !== '/') {
			pagePath += '/';
		}
		pagePath += 'index.xml';
	}

	return `/site/website${pagePath}`;
}

/**
 * Computes and returns the preview URL from a path. Notice non-previewable paths will not be transformed.
 * @param path {string} The path to compute the preview URL from
 * @returns {string} The preview URL
 */
export function getPreviewURLFromPath(path: string): string {
	// Transform only paths that start with `/site/website`. Preview url and path for static assets is the same.
	// Non-previewable paths are not transformed by this function.
	// It is known that for some existing platform users, paths do not end with `/index.xml`. For example in
	// `/site/website/folder/article.xml` previewUrl should be `/folder/article`. In these cases, the file
	// name cannot be striped off.
	return /^\/site\/website/.test(path)
		? path
				.replace(/^\/site\/website/, '')
				.replace(/\/(index|default).xml$/, '')
				.replace(/(.xml|\/)$/, '') || '/'
		: path;
}

export function getFileNameFromPath(path: string): string {
	return path.substring(path.lastIndexOf('/') + 1);
}

export function getQueryVariable(query: string, variable: string): string | string[] {
	let qs = queryString.parse(query);
	return qs[variable] ?? null;
}

export function parseQueryString(): ParsedQuery {
	return queryString.parse(window.location.search);
}

export function withoutIndex(path: string): string {
	return path?.replace('/index.xml', '');
}

export function withIndex(path: string): string {
	return `${withoutIndex(path)}/index.xml`;
}

/**
 * Takes in a path and if it ends with a file, strips the file off the path (returns the parent
 * path of the file). Returns same path if not file is present in the path.
 **/
export function withoutFile(path: string): string {
	const pieces = path.replace('/$', '').split('/');
	const lastPieceSplitByDot = pieces[pieces.length - 1].split('.');
	if (lastPieceSplitByDot.length > 1) {
		return `/${pieces.slice(1, pieces.length - 1).join('/')}`;
	} else {
		return path;
	}
}

/**
 * Takes in a path (or file name) and extracts its extension (e.g. "/files/names.txt" => "txt")
 **/
export function getFileExtension(path: string): string {
	return (path ?? '').match(/\.[0-9a-z]+$/i)?.[0].substr(1) ?? '';
}

export function hasExtension(path: string): boolean {
	return getFileExtension(path) !== '';
}

export function removeExtension(name: string) {
	return name.replace(/\.[^/.]+$/, '');
}

export function getParentPath(path: string): string {
	let splitPath = withoutIndex(path).split('/');
	splitPath.pop();
	return splitPath.join('/') || '/';
}

export function isRootPath(path: string): boolean {
	return getRootPath(path) === withoutIndex(path);
}

export function getRootPath(path: string): string {
	return withoutIndex(path)
		.split('/')
		.slice(0, path.startsWith('/site') ? 3 : 2)
		.join('/');
}

export function getParentsFromPath(path: string, rootPath: string): string[] {
	let splitPath = withoutIndex(path).replace(rootPath, '').split('/');
	splitPath.pop();
	return [rootPath, ...splitPath.map((value, i) => `${rootPath}/${splitPath.slice(1, i + 1).join('/')}`).splice(1)];
}

export function getIndividualPaths(path: string, rootPath = ''): string[] {
	// `/` is not valid path in CrafterCMS
	rootPath === '/' && (rootPath = '');
	let rootWithoutIndex = withoutIndex(rootPath);
	let paths = (rootPath ? path.replace(new RegExp(`^${withoutIndex(rootPath)}`), '') : path).split('/');
	paths[0] === '' && paths.shift();
	let length = paths.length;
	let individualPaths = paths.map((p, i) => `${rootWithoutIndex}/${paths.slice(0, length - i).join('/')}`).reverse();
	rootWithoutIndex && individualPaths.unshift(rootWithoutIndex);
	if (
		individualPaths.length > 1 &&
		individualPaths[individualPaths.length - 1] === `${individualPaths[individualPaths.length - 2]}/index.xml`
	) {
		individualPaths.pop();
		individualPaths[individualPaths.length - 1] += '/index.xml';
	}
	return individualPaths;
}

export function isValidCopyPastePath(targetPath: string, sourcePath: string): boolean {
	return !getIndividualPaths(targetPath).includes(sourcePath);
}

export function isValidCutPastePath(targetPath: string, sourcePath: string): boolean {
	return (
		isValidCopyPastePath(targetPath, sourcePath) &&
		// Check if target path is not an immediate parent of source path
		withoutIndex(targetPath) !== getParentPath(sourcePath) &&
		// Check if target path is not a child of source path
		!targetPath.includes(withoutIndex(sourcePath))
	);
}

export function getEditFormSrc({
	path,
	selectedFields,
	site,
	authoringBase,
	readonly,
	isHidden,
	modelId,
	changeTemplate,
	contentTypeId,
	isNewContent,
	iceGroupId,
	newEmbedded,
	canEdit,
	fieldsIndexes
}: {
	path: string;
	selectedFields?: string;
	site: string;
	authoringBase: string;
	readonly?: boolean;
	isHidden?: boolean;
	modelId?: string;
	changeTemplate?: string;
	contentTypeId?: string;
	isNewContent?: boolean;
	iceGroupId?: string;
	newEmbedded?: string;
	canEdit?: boolean;
	fieldsIndexes?: string;
}): string {
	const qs = toQueryString({
		site,
		path,
		selectedFields,
		readonly,
		isHidden,
		modelId,
		changeTemplate,
		contentTypeId,
		isNewContent,
		iceId: iceGroupId,
		newEmbedded,
		canEdit,
		fieldsIndexes
	});
	return `${authoringBase}/legacy/form${qs}`;
}

export function getCodeEditorSrc({
	path,
	site,
	type,
	contentType,
	authoringBase,
	readonly
}: {
	path: string;
	site: string;
	type: string;
	contentType?: string;
	authoringBase: string;
	readonly: boolean;
}): string {
	const qs = toQueryString({
		site,
		path,
		type,
		contentType,
		readonly
	});
	return `${authoringBase}/legacy/form${qs}`;
}

// TODO: Dupe of ensureSingleSlash
export function stripDuplicateSlashes(str: string): string {
	return str.replace(/\/+/g, '/');
}

export function getItemGroovyPath(item: ContentItem): string {
	const contentTypeName = /[^/]*$/.exec(item.contentTypeId)[0];
	return `${getControllerPath(item.systemType)}/${contentTypeName}.groovy`;
}

export function getItemTemplatePath(item: ContentItem, contentTypes: LookupTable<ContentType>): string {
	return contentTypes[item.contentTypeId].displayTemplate;
}

export function getControllerPath(type: SystemType): string {
	return `/scripts/${type === 'page' ? 'pages' : 'components'}`;
}

// For nested embedded components, parentPath will be the last non-embedded (shared) path, meaning that the parent
// path will always be a 'physical' path.
const availableMacrosRegex = /{(objectId|objectGroupId|objectGroupId2|year|month|yyyy|mm|dd|parentPath(\[[0-9]+])?)}/;

export function processPathMacros(dependencies: {
	path: string;
	objectId: string;
	objectGroupId?: string;
	useUUID?: boolean;
	fullParentPath?: string;
}): string {
	let { path, objectId, objectGroupId, useUUID, fullParentPath } = dependencies;
	if (!path) return path;

	let processedPath = path;

	// Remove unrecognized macros.
	const pathMacros = processedPath.match(/\{(.+)}/g) ?? [];
	pathMacros.forEach((macro) => {
		if (!availableMacrosRegex.test(macro)) {
			processedPath = processedPath.replace(macro, '');
		}
	});
	processedPath = ensureSingleSlash(processedPath);

	// The objectGroupId is the first 4 characters of the objectId, so compute if not provided.
	if (objectGroupId === undefined && objectId) {
		objectGroupId = objectId.substring(0, 4);
	}

	if (processedPath.includes('{objectId}')) {
		if (useUUID) {
			processedPath = processedPath.replace('{objectId}', uuid());
		} else {
			processedPath = processedPath.replace('{objectId}', objectId);
		}
	}

	if (processedPath.includes('{objectGroupId}')) {
		processedPath = processedPath.replace('{objectGroupId}', objectGroupId);
	}

	if (processedPath.includes('{objectGroupId2}')) {
		processedPath = processedPath.replace('{objectGroupId2}', objectGroupId.substring(0, 2));
	}

	const currentDate = new Date();
	if (processedPath.includes('{year}')) {
		processedPath = processedPath.replace('{year}', `${currentDate.getFullYear()}`);
	}

	if (processedPath.includes('{month}')) {
		processedPath = processedPath.replace('{month}', ('0' + (currentDate.getMonth() + 1)).slice(-2));
	}

	if (processedPath.includes('{yyyy}')) {
		processedPath = processedPath.replace('{yyyy}', `${currentDate.getFullYear()}`);
	}

	if (processedPath.includes('{mm}')) {
		processedPath = processedPath.replace('{mm}', ('0' + (currentDate.getMonth() + 1)).slice(-2));
	}

	if (processedPath.includes('{dd}')) {
		processedPath = processedPath.replace('{dd}', ('0' + currentDate.getDate()).slice(-2));
	}

	if (fullParentPath) {
		const parentPathPieces = fullParentPath.substr(1).split('/');
		processedPath = processedPath.replace(/{parentPath(\[\s*?(\d+)\s*?])?}/g, function (fullMatch, indexExp, index) {
			if (indexExp === void 0) {
				// Handle simple exp `{parentPath}`
				return fullParentPath.replace(/\/[^/]*\/[^/]*\/([^.]*)(\/[^/]*\.xml)?$/, '$1');
			} else {
				// Handle indexed exp `{parentPath[i]}`
				return parentPathPieces[parseInt(index) + 2];
			}
		});
	}

	return processedPath;
}

export const pickExtensionForItemType = (systemType: string, name?: string, extension?: string) => {
	if (systemType === 'asset') {
		return getFileExtension(name);
	} else if (systemType === 'controller') {
		return 'groovy';
	} else if (extension) {
		return extension.replace(/^\./, '');
	} else {
		return 'ftl';
	}
};

export const getFileNameWithExtensionForItemType = (type: string, name: string, extension?: string) => {
	const pickedExtension = pickExtensionForItemType(type, name, extension);
	const normalizedName = name.replace(new RegExp(`\\.${pickedExtension}$`), '');
	return `${normalizedName}.${pickedExtension}`.replace(/\.{2,}/g, '.');
};

/**
 * Determines if the given path corresponds to a page path.
 *
 * @param {string} path - The path to check.
 * @returns {boolean} - Returns `true` if the path matches the pattern for a page path; otherwise, `false`.
 *
 */
export const isPagePath = (path: string): boolean => {
	return /^\/site\/website(\/.*)?\/index.*\.xml$/.test(path);
};
