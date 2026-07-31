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

import type { ContentType, DataSource } from '../../../models/ContentType';
import type { ContentTypeField } from '../../../models';
import { useMemo } from 'react';

/** Extracts the data sources list from a field using a datasourceProperty, which is the property of the field that
 * contains the list of datasource ids for the given field.
 *
 * @param contentType The content type object containing the data sources.
 * @param field The content type field from which to extract the data sources.
 * @param dataSourceProperty The property of the field that contains the list of datasource ids.
 * @returns An array of DataSource objects associated with the field.
 */
export function useExtractDataSources(
	contentType: ContentType,
	field: ContentTypeField,
	dataSourceProperty: string
): DataSource[] {
	const dataSources = contentType.dataSources;
	const dataSourceIdString =
		typeof field.properties[dataSourceProperty]?.value === 'string' ? field.properties[dataSourceProperty].value : '';
	return useMemo(() => {
		const dataSourceIds = dataSourceIdString
			.split(',')
			.map((id) => id.trim())
			.filter((id) => id.length > 0);
		const dataSourcesById = new Map(dataSources.map((dataSource) => [dataSource.id, dataSource]));
		return dataSourceIds
			.map((id) => dataSourcesById.get(id))
			.filter((dataSource): dataSource is DataSource => Boolean(dataSource));
	}, [dataSources, dataSourceIdString]);
}
