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
import type { ContentTypeField, DataSource } from '../../../models/ContentType';
import type LookupTable from '../../../models/LookupTable';

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

type DatasourceProperty = { type?: string; value?: unknown };

function isDatasourceProperty(property: unknown): property is DatasourceProperty {
	return (
		property != null &&
		typeof property === 'object' &&
		typeof (property as DatasourceProperty).type === 'string' &&
		(property as DatasourceProperty).type.startsWith('datasource:')
	);
}

function datasourceIdsFromValue(value: unknown): string[] {
	if (typeof value !== 'string' || !value) return [];
	return value
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
}

function fieldReferencesDataSource(field: ContentTypeField, dataSourceId: string): boolean {
	for (const [key, property] of Object.entries(field.properties ?? {})) {
		if (key === 'plugin' || !isDatasourceProperty(property)) continue;
		if (datasourceIdsFromValue(property.value).includes(dataSourceId)) return true;
	}
	return false;
}

/** Fields (including nested) whose datasource:* properties reference the given id. */
export function findFieldsReferencingDataSource(
	type: ContentType,
	dataSourceId: string
): Array<{ id: string; name: string }> {
	const result: Array<{ id: string; name: string }> = [];
	const visit = (fields: LookupTable<ContentTypeField> | undefined) => {
		if (!fields) return;
		for (const field of Object.values(fields)) {
			if (fieldReferencesDataSource(field, dataSourceId)) {
				result.push({ id: field.id, name: field.name });
			}
			visit(field.fields);
		}
	};
	visit(type.fields);
	return result;
}

function stripDataSourceIdFromFields(
	fields: LookupTable<ContentTypeField> | undefined,
	dataSourceId: string
): LookupTable<ContentTypeField> | undefined {
	if (!fields) return fields;
	let changed = false;
	const next: LookupTable<ContentTypeField> = {};
	for (const [id, field] of Object.entries(fields)) {
		const stripped = stripDataSourceIdFromField(field, dataSourceId);
		next[id] = stripped;
		if (stripped !== field) changed = true;
	}
	return changed ? next : fields;
}

function stripDataSourceIdFromField(field: ContentTypeField, dataSourceId: string): ContentTypeField {
	let properties = field.properties;
	let propertiesChanged = false;
	if (properties) {
		const nextProperties = { ...properties };
		for (const [key, property] of Object.entries(properties)) {
			if (key === 'plugin' || !isDatasourceProperty(property)) continue;
			const values = datasourceIdsFromValue(property.value);
			if (values.length === 0) continue;
			const filtered = values.filter((id) => id !== dataSourceId);
			if (filtered.length !== values.length) {
				nextProperties[key] = { ...property, value: filtered.join(',') };
				propertiesChanged = true;
			}
		}
		if (propertiesChanged) properties = nextProperties;
	}

	const nextNested = stripDataSourceIdFromFields(field.fields, dataSourceId);
	const nestedChanged = nextNested !== field.fields;

	if (!propertiesChanged && !nestedChanged) return field;
	return {
		...field,
		...(propertiesChanged ? { properties } : {}),
		...(nestedChanged ? { fields: nextNested } : {})
	};
}

export function deleteDataSourceFromType(currentType: ContentType, dataSourceId: string): ContentType {
	return {
		...currentType,
		dataSources: currentType.dataSources.filter((dataSource) => dataSource.id !== dataSourceId),
		fields: stripDataSourceIdFromFields(currentType.fields, dataSourceId)
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

/** Path written by CreateFileDialog for a new FreeMarker template. */
export function typeTemplatePathFromCreatedItem(item: { path: string; fileName: string }): string {
	return `${item.path}/${item.fileName}`;
}

/**
 * After header-link template creation: assign the new path onto the working type.
 * Creating the file / opening the editor alone must not leave displayTemplate unset.
 */
export function assignCreatedTypeTemplate(
	currentType: ContentType,
	item: { path: string; fileName: string }
): ContentType {
	return { ...currentType, displayTemplate: typeTemplatePathFromCreatedItem(item) };
}
