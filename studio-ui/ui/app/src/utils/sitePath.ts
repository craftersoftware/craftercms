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
 * Preview URL and page-path checks with no further imports, so unit tests can load them
 * under Node's type stripper. `path.ts` re-exports both.
 */

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

/** True when the path is a page (`/site/website/.../index*.xml`). */
export const isPagePath = (path: string): boolean => {
	return /^\/site\/website(\/.*)?\/index.*\.xml$/.test(path);
};
