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

import { createAction } from '@reduxjs/toolkit';
import { ApiResponse, Site, StandardAction } from '../../models';

export function changeSite(nextSite: string, nextUrl: string = '/'): StandardAction {
	return {
		type: changeSite.type,
		payload: { nextSite, nextUrl }
	};
}
export const changeSiteComplete = /*#__PURE__*/ createAction<{ nextSite: string; nextUrl: string }>(
	'CHANGE_SITE_COMPLETE'
);

changeSite.type = 'CHANGE_SITE';

export const fetchSites = /*#__PURE__*/ createAction('FETCH_SITES');
export const fetchSitesComplete = /*#__PURE__*/ createAction<Site[]>('FETCH_SITES_COMPLETE');
export const fetchSitesFailed = /*#__PURE__*/ createAction<{ error: ApiResponse }>('FETCH_SITES_FAILED');
export const popSite = /*#__PURE__*/ createAction<{ siteId: string; isActive: boolean }>('POP_SITE');
