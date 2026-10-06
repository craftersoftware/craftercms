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

import { get } from '../utils/ajax';
import { map } from 'rxjs/operators';
import { toQueryString } from '../utils/object';
import { Observable } from 'rxjs';
import { AwsItem } from '../models/Aws';
import { Api2ResponseFormat } from '../models/ApiResponse';

export function list(
	siteId: string,
	profileId: string,
	options: { path?: string; type?: string } = {}
): Observable<AwsItem[]> {
	const qs = toQueryString({
		profileId,
		...options
	});
	return get<Api2ResponseFormat<{ items: AwsItem[] }>>(`/studio/api/2/aws/${siteId}/s3/list${qs}`).pipe(
		map((response) => response?.response?.items)
	);
}
