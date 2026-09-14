/*
 * Copyright (C) 2007-2021 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

import { LookupTable } from '@craftercms/models';

export interface CrafterConfig {
	site: string;
	/** @deprecated Use `fetchConfig.mode` instead */
	cors?: boolean | RequestInit['mode'];
	fetchConfig?: RequestInit;
	baseUrl: string;
	searchId?: string;
	endpoints?: Endpoints;
	// TODO: Remove this?
	contentTypeRegistry?: LookupTable;
	// TODO: Remove this in favour of fetchConfig.headers? Most make all sdk service use fetch.
	headers: LookupTable;
}

export interface Endpoints {
	GET_ITEM_URL: string;
	GET_DESCRIPTOR: string;
	GET_CHILDREN: string;
	GET_TREE: string;
	GET_NAV_TREE: string;
	GET_BREADCRUMB: string;
	TRANSFORM_URL: string;
	SEARCH: string;
}

export default CrafterConfig;
