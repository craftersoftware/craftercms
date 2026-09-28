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

export interface SearchResultHit {
	_id: string;
	_index: string;
	_score: string;
	_source: LookupTable<any>;
	_type: string;
}

export interface SearchResult {
	hits: SearchResultHit[];
	max_score: number;
	total: {
		relation: string;
		value: number;
	};
}
