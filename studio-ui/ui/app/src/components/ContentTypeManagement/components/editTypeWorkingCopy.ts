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

import type ContentType from '../../../models/ContentType';
import type { DataSource } from '../../../models/ContentType';

/** Deep-clone so nested fields/sections/dataSources are not shared with the rollback/diff baseline. */
export function createTypeWorkingCopy<T extends ContentType>(type: T): T {
	return structuredClone(type);
}

export function reorderTypeSections(currentType: ContentType, sections: Array<{ key: string }>): ContentType {
	return {
		...currentType,
		sections: sections.map((section) => currentType.sections.find((s) => s.id === section.key))
	};
}

export function deleteDataSourceFromType(currentType: ContentType, dataSourceId: string): ContentType {
	return {
		...currentType,
		dataSources: currentType.dataSources.filter((dataSource) => dataSource.id !== dataSourceId)
	};
}

export function insertDataSourceIntoType(
	currentType: ContentType,
	dataSource: DataSource,
	position: number
): ContentType {
	const nextDataSources = currentType.dataSources?.concat() ?? [];
	nextDataSources.splice(position, 0, dataSource);
	return { ...currentType, dataSources: nextDataSources };
}
