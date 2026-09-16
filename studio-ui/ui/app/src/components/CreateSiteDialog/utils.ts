/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

import { Site } from '../../models';

export const siteInputMaxLength = 4000;
export const siteNameMaxLength = 255;
export const siteIdMaxLength = 50;

export const siteIdExist = (sites: Array<Site>, value: string): boolean => {
	return Boolean(sites && sites.find((site: Site) => site.id === value));
};

export const siteNameExist = (sites: Array<Site>, value: string) => {
	return Boolean(sites && sites.find((site: Site) => site.name === value));
};

export function getSiteIdFromSiteName(siteName: string): string {
	let siteId = siteName
		.replace(/[^a-zA-Z0-9_\s-]/g, '')
		.replace(/[_\s]/g, '-')
		.toLowerCase();
	if (siteId.startsWith('0') || siteId.startsWith('-') || siteId.startsWith('_')) {
		siteId = siteId.replace(/0|-|_/, '');
	}

	// Site id max length differs from the site name max length, so the id needs to be trimmed to
	// its max length
	return siteId.substring(0, siteIdMaxLength);
}

export function cleanupSiteId(siteId: string): string {
	return siteId
		.replace(/[^a-zA-Z0-9_\s-]/g, '')
		.replace(/[_\s]/g, '-')
		.toLowerCase();
}

export function cleanupGitBranch(branch: string): string {
	return (
		branch
			.replace(/\s+|[~^:?*[@\\]/g, '')
			// It cannot have two or more consecutive dots anywhere.
			.replace(/\.{2,}/g, '.')
			// It cannot have two or more consecutive slashes anywhere.
			.replace(/\/{2,}/g, '/')
	);
}
