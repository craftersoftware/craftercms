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

import {
	ContentType,
	ContentTypeField,
	ContentTypeFieldValidation,
	ContentTypeFieldValidations,
	ContentTypeSection,
	DataSource,
	LegacyContentType,
	LegacyDataSource,
	LegacyFormDefinition,
	LegacyFormDefinitionField,
	LegacyFormDefinitionProperty,
	LegacyFormDefinitionSection,
	ValidationKeys
} from '../models/ContentType';
import { LookupTable } from '../models/LookupTable';
import { camelize, capitalize, ensureSingleSlash, isBlank, toColor } from '../utils/string';
import { defer, Observable, of, Subscription, throwError } from 'rxjs';
import { CONTENT_TYPE_JSON, get, getBinary, getGlobalHeaders, post } from '../utils/ajax';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { createLookupTable, nou, toQueryString } from '../utils/object';
import {
	countLimitPropertyWrites,
	countLimitsFromLegacy,
	getCountLimitStorage,
	itemCountEditorValue,
	type CountLimits
} from '../utils/countLimits';
import { fetchContentItems } from './content';
import { ContentItem } from '../models/Item';
import { fetchConfigurationDOM, writeConfiguration } from './configuration';
import { beautify, deserialize, entityEncodingTagValueProcessor, serialize } from '../utils/xml';
import { Api2ResponseFormat } from '../models/ApiResponse';
import { asArray, immutableEmptyArray } from '../utils/array';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';
import AllowedContentTypesData from '../models/AllowedContentTypesData';
import {
	createFormDefinitionPathFromTypeId,
	normalizeThumbnailFileName,
	systemValidationsKeysMap,
	systemValidationsNames
} from '../utils/contentType';
import { XmlKeys } from '../components/FormsEngine/lib/formConsts';
import { ajax, AjaxError, AjaxResponse } from 'rxjs/ajax';
import { DEFAULT_CONTENT_TYPE_PREVIEW_IMAGE_URL } from '../utils/constants';

// FE2 TODO: Verify removal
// const typeMap = {
//   input: 'text',
//   rte: 'html',
//   checkbox: 'boolean',
//   'image-picker': 'image'
// };

function bestGuessParse(value: unknown): unknown {
	if (nou(value)) {
		return null;
	} else if (value === 'true') {
		return true;
	} else if (value === 'false') {
		return false;
	} else if (!isNaN(parseFloat(value as string))) {
		return parseFloat(value as string);
	} else {
		return value;
	}
}

interface ParseComponentsDataSourceContentTypesPropertyOutput {
	allowedContentTypes: ContentTypeFieldValidation<LookupTable<AllowedContentTypesData>>;
	allowedEmbeddedContentTypes: ContentTypeFieldValidation<string[]>;
	allowedSharedContentTypes: ContentTypeFieldValidation<string[]>;
	allowedSharedExistingContentTypes: ContentTypeFieldValidation<string[]>;
}

export function parseComponentsDataSourceContentTypesProperty(
	dataSource: DataSource,
	contentTypesPropertyValue: string,
	validations: Partial<ContentTypeFieldValidations> = {}
): Partial<ParseComponentsDataSourceContentTypesPropertyOutput> {
	const value = contentTypesPropertyValue?.split(',') ?? immutableEmptyArray;
	validations.allowedContentTypes = validations.allowedContentTypes ?? {
		id: 'allowedContentTypes',
		level: 'required',
		value: {} as LookupTable<AllowedContentTypesData<boolean>>
	};
	validations.allowedEmbeddedContentTypes = validations.allowedEmbeddedContentTypes ?? {
		id: 'allowedEmbeddedContentTypes',
		level: 'required',
		value: []
	};
	validations.allowedSharedContentTypes = validations.allowedSharedContentTypes ?? {
		id: 'allowedSharedContentTypes',
		level: 'required',
		value: []
	};
	validations.allowedSharedExistingContentTypes = validations.allowedSharedExistingContentTypes ?? {
		id: 'allowedSharedExistingContentTypes',
		level: 'required',
		value: []
	};
	const allowedContentTypesMeta: LookupTable<AllowedContentTypesData> = validations.allowedContentTypes.value;
	value.forEach((typeId) => {
		allowedContentTypesMeta[typeId] = allowedContentTypesMeta[typeId] ?? {};
		const propsLookup = dataSource.properties;
		const allowEmbedded = propsLookup.allowEmbedded;
		const allowShared = propsLookup.allowShared;
		const allowSharedExisting = propsLookup.enableBrowse || propsLookup.enableSearch;
		if (allowEmbedded) {
			allowedContentTypesMeta[typeId].embedded = true;
			validations.allowedEmbeddedContentTypes.value.push(typeId);
		}
		if (allowShared) {
			allowedContentTypesMeta[typeId].shared = true;
			validations.allowedSharedContentTypes.value.push(typeId);
		}
		if (allowSharedExisting) {
			allowedContentTypesMeta[typeId].sharedExisting = true;
			validations.allowedSharedExistingContentTypes.value.push(typeId);
		}
	});
	return validations;
}

function getFieldValidations(
	fieldProperty: LegacyFormDefinitionProperty | LegacyFormDefinitionProperty[],
	dropTargetsLookup?: LookupTable<DataSource>
): Partial<ContentTypeFieldValidations> {
	const map = asArray<LegacyFormDefinitionProperty>(fieldProperty).reduce<LookupTable<LegacyFormDefinitionProperty>>(
		(table, prop) => {
			if ((prop.name === 'width' || prop.name === 'height') && Boolean(prop.value)) {
				const parsedValidation = JSON.parse(prop.value);
				if (parsedValidation.exact) {
					table[prop.name] = {
						name: prop.name,
						type: prop.type,
						value: parsedValidation.exact
					};
				} else {
					table[`min${capitalize(prop.name)}`] = {
						name: prop.name,
						type: prop.type,
						value: parsedValidation.min
					};
					table[`max${capitalize(prop.name)}`] = {
						name: prop.name,
						type: prop.type,
						value: parsedValidation.max
					};
				}
			} else {
				table[prop.name] = prop;
			}
			return table;
		},
		{}
	);

	const validations: Partial<ContentTypeFieldValidations> = {};

	Object.keys(map).forEach((key) => {
		if (systemValidationsNames.includes(key)) {
			if (key === 'itemManager' && dropTargetsLookup) {
				map.itemManager?.value?.split(',').forEach((itemManagerId) => {
					Object.entries(dropTargetsLookup[itemManagerId]?.properties ?? {}).forEach(([name, value]) => {
						const mappedPropName = systemValidationsKeysMap[name];
						if (mappedPropName === 'allowedContentTypes') {
							parseComponentsDataSourceContentTypesProperty(dropTargetsLookup[itemManagerId], value, validations);
						} else if (mappedPropName) {
							validations[mappedPropName] = {
								id: mappedPropName,
								value: value?.split(',') ?? immutableEmptyArray,
								level: 'required'
							};
						}
					});
				});
			} else if (systemValidationsNames.includes(key) && !isBlank(map[key]?.value)) {
				validations[systemValidationsKeysMap[key]] = {
					id: systemValidationsKeysMap[key],
					// TODO: Parse values robustly
					value: bestGuessParse(map[key].value),
					level: 'required'
				};
			}
		}
	});
	return validations;
}

function getFieldDataSourceValidations(
	fieldProperty: LegacyFormDefinitionProperty | LegacyFormDefinitionProperty[],
	dataSources: LegacyDataSource[]
): Partial<ContentTypeFieldValidations> {
	let validations = {};
	if (
		dataSources &&
		dataSources.length > 0 &&
		asArray(fieldProperty).find((prop) =>
			['imageManager', 'videoManager', 'audioManager', 'fileManager'].includes(prop.name)
		)
	) {
		validations = asArray<LegacyFormDefinitionProperty>(fieldProperty).reduce<LookupTable<ContentTypeFieldValidation>>(
			(table, prop) => {
				if (
					prop.name === 'imageManager' ||
					prop.name === 'videoManager' ||
					prop.name === 'audioManager' ||
					prop.name === 'fileManager'
				) {
					const dataSourcesIds = prop.value.trim() !== '' ? prop.value.split(',') : null;
					dataSourcesIds?.forEach((id) => {
						const dataSource = dataSources.find((datasource) => datasource.id === id);
						if (dataSource && systemValidationsNames.includes(camelize(dataSource.type))) {
							table[systemValidationsKeysMap[camelize(dataSource.type)]] = {
								id: systemValidationsKeysMap[camelize(dataSource.type)],
								value: asArray(dataSource.properties.property).find((prop) => prop.name === 'repoPath').value,
								level: 'required'
							};
						}
					});
				}
				if (prop.name === 'addMedia') {
					table[systemValidationsKeysMap['addMedia']] = {
						id: systemValidationsKeysMap['addMedia'] as ValidationKeys,
						value: prop.value.trim() === 'true',
						level: 'required'
					};
				}
				return table;
			},
			{}
		);
	}
	return validations;
}

function parseAllowedRoles(definition: LegacyFormDefinition): string[] {
	const seen = new Set<string>();
	const roles: string[] = [];
	for (const entry of asArray(definition['allowed-roles']?.role)) {
		if (typeof entry !== 'string') continue;
		const trimmed = entry.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		roles.push(trimmed);
	}
	return roles;
}

function rawLegacyPropertyValue(legacyField: LegacyFormDefinitionField, name: string): unknown {
	return asArray(legacyField.properties?.property).find((prop) => prop.name === name)?.value;
}

function rawLegacyConstraintValue(legacyField: LegacyFormDefinitionField, name: string): unknown {
	return asArray(legacyField.constraints?.constraint).find((constraint) => constraint.name === name)?.value;
}

/**
 * Stores the editor value for one bound. `ensure` creates a missing property (repeats).
 * Without it, a missing property stays missing (node selector). The table decides which.
 */
function writeCountEditorProperty(
	field: ContentTypeField,
	name: string,
	limit: number | undefined,
	kind: 'min' | 'max',
	options?: { ensure?: boolean; type?: string }
): void {
	const current = field.properties?.[name];
	if (!current && !options?.ensure) return;
	const type = options?.type ?? current?.type ?? (kind === 'min' ? 'int' : 'string');
	field.properties[name] = {
		...current,
		name,
		type,
		value: itemCountEditorValue(limit, kind, type)
	};
}

/** Writes virtual minCount/maxCount. Absent means unlimited. See utils/countLimits.ts. */
function assignCountLimits(field: ContentTypeField, limits: CountLimits): void {
	if (limits.minCount == null) delete field.validations.minCount;
	else field.validations.minCount = { id: 'minCount', value: limits.minCount, level: 'required' };
	if (limits.maxCount == null) delete field.validations.maxCount;
	else field.validations.maxCount = { id: 'maxCount', value: limits.maxCount, level: 'required' };
}

/** Applies the count-limit table for this control. No entry means the field is left as parsed. */
function applyCountLimits(
	field: ContentTypeField,
	legacyField: LegacyFormDefinitionField,
	contentTypeId?: string
): void {
	const storage = getCountLimitStorage(legacyField.type);
	if (!storage) return;
	for (const name of storage.stripConstraints) {
		delete field.validations[name as keyof typeof field.validations];
	}
	const limits = countLimitsFromLegacy(
		storage,
		{
			element: (name) => legacyField[name as 'minOccurs' | 'maxOccurs'],
			property: (name) => rawLegacyPropertyValue(legacyField, name),
			constraint: (name) => rawLegacyConstraintValue(legacyField, name)
		},
		{ contentTypeId, fieldId: field.id }
	);
	assignCountLimits(field, limits);
	for (const write of countLimitPropertyWrites(storage, limits)) {
		writeCountEditorProperty(field, write.name, write.limit, write.kind, {
			ensure: write.ensure,
			...(write.type ? { type: write.type } : {})
		});
	}
}

/** Maps legacy form-definition fields into the Forms Engine content-type model. */
function parseLegacyFormDefinitionFields(
	legacyFieldsToBeParsed: LegacyFormDefinitionField[] | LegacyFormDefinitionField,
	currentFieldLookup: LookupTable<ContentTypeField>,
	dropTargetsLookup: LookupTable<DataSource>,
	sectionFieldIds?: Array<string>,
	dataSources?: LegacyDataSource[],
	contentTypeId?: string
): void {
	asArray<LegacyFormDefinitionField>(legacyFieldsToBeParsed).forEach((legacyField) => {
		// FE2 TODO: Changed the camelizing of file-name and internal-name
		// const fieldId = ['file-name', 'internal-name'].includes(legacyField.id) ? camelize(legacyField.id) : legacyField.id;
		const fieldId = legacyField.id;

		sectionFieldIds?.push(fieldId);

		const rawConstraints: LegacyFormDefinitionProperty[] = [];
		const field: ContentTypeField = {
			id: fieldId,
			name: legacyField.title,
			description: legacyField.description,
			helpText: legacyField.help,
			type: legacyField.type, // FE2 TODO: Changed from `type: typeMap[legacyField.type] || legacyField.type,`
			sortable: legacyField.type === 'node-selector' || legacyField.type === 'repeat',
			validations: {},
			properties: {},
			defaultValue: legacyField.defaultValue,
			rawConstraints
		};

		if (legacyField.plugin) {
			field.properties.plugin = legacyField.plugin;
		}

		asArray<LegacyFormDefinitionProperty>(legacyField.properties?.property).forEach((legacyProp) => {
			let value;
			switch (legacyProp.type) {
				case 'boolean':
					value = legacyProp.value === 'true';
					break;
				case 'int':
					value = legacyProp.value ? parseInt(legacyProp.value) : null;
					break;
				default:
					value = legacyProp.value;
			}
			field.properties[legacyProp.name] = {
				...legacyProp,
				value
			};
		});

		asArray<LegacyFormDefinitionProperty>(legacyField.constraints?.constraint).forEach((legacyProp) => {
			if (!legacyProp.name) return;
			rawConstraints.push({ ...legacyProp });
			const value = legacyProp.value?.trim();
			switch (legacyProp.name) {
				case 'required':
					if (value) {
						field.validations.required = {
							id: 'required',
							value: value === 'true',
							level: 'required'
						};
					}
					break;
				case 'allowDuplicates':
					if (value === 'true') {
						field.validations.allowDuplicates = {
							id: 'allowDuplicates',
							value: value === 'true',
							level: 'required'
						};
					}
					break;
				case 'pattern':
					if (value) {
						field.validations.pattern = {
							id: 'pattern',
							value,
							level: 'required'
						};
					}
					break;
				default:
					// Item-count constraints (checkbox minSize) are applied from countLimitStorage, not as runtime validations.
					break;
			}
		});

		const propertyProp = legacyField.properties?.property;
		switch (legacyField.type) {
			case 'repeat': {
				// Nested fields only. Count limits come from countLimitStorage below.
				field.fields = {};
				parseLegacyFormDefinitionFields(
					legacyField.fields?.field,
					field.fields,
					dropTargetsLookup,
					null,
					dataSources,
					contentTypeId
				);
				break;
			}
			case 'node-selector': {
				// Datasource validations. Count limits come from countLimitStorage below.
				field.validations = {
					...field.validations,
					...getFieldValidations(propertyProp, dropTargetsLookup)
				};
				break;
			}
			case 'input':
			case 'textarea':
			case 'numeric-input':
			case 'image-picker':
				field.validations = {
					...field.validations,
					...getFieldValidations(propertyProp),
					...getFieldDataSourceValidations(propertyProp, dataSources)
				};
				break;
			case 'video-picker':
			case 'rte':
				field.validations = {
					...field.validations,
					...getFieldValidations(propertyProp),
					...getFieldDataSourceValidations(propertyProp, dataSources)
				};
		}

		// Item-count limits for every control in countLimitStorage. Other types are unchanged.
		applyCountLimits(field, legacyField, contentTypeId);

		currentFieldLookup[fieldId] = field;
	});
}

/** Maps a form-definition document into the Forms Engine content-type model. */
export function parseLegacyFormDefinition(definition: LegacyFormDefinition): ContentType {
	// A missing document parses as an empty form. `{}` has no sections and must not throw.
	definition = definition ?? ({} as LegacyFormDefinition);

	const fields: LookupTable<ContentTypeField> = {};
	const sections: Array<ContentTypeSection> = [];
	const dataSources: LookupTable<DataSource> = {};
	const dropTargetsLookup: LookupTable<DataSource> = {};

	const legacyDataSourceArray = asArray(definition.datasources?.datasource);

	// get receptacles dataSources
	legacyDataSourceArray.forEach((datasource: LegacyDataSource) => {
		// Keep only the typed DataSource shape. Legacy XML may carry extra keys; plugin coords are preserved explicitly.
		dataSources[datasource.id] = {
			id: datasource.id,
			type: datasource.type,
			title: datasource.title,
			interface: datasource.interface,
			properties: {},
			...(datasource.plugin ? { plugin: datasource.plugin } : {})
		};
		asArray(datasource.properties?.property).forEach((property) => {
			let value: unknown = property.value;
			switch (property.type) {
				case 'boolean':
					value = property.value.trim().toLowerCase() === 'true';
					break;
				case 'int':
					value = Number(property.value);
					if (isNaN(value as number)) value = 0;
				// TODO: There's more `types`. Review getSupportedProperties across different DSs. Preferably we drop these. These types should be on the descriptor for the DS form.
				// case 'minMax':
				//   value =
				//   break;
			}
			dataSources[datasource.id].properties[property.name] = value;
		});
		if (datasource.type === 'components') {
			dropTargetsLookup[datasource.id] = dataSources[datasource.id];
		}
	});

	// Parse Sections & Fields
	asArray<LegacyFormDefinitionSection>(definition.sections?.section).forEach((legacySection, index) => {
		const fieldIds = [];
		parseLegacyFormDefinitionFields(
			legacySection.fields?.field,
			fields,
			dropTargetsLookup,
			fieldIds,
			legacyDataSourceArray,
			definition['content-type']
		);

		sections.push({
			id: `section-${index}`,
			title: legacySection.title,
			color: legacySection.color ?? toColor(legacySection.title, 0.7),
			description: legacySection.description,
			expandByDefault: legacySection.defaultOpen === 'true',
			fields: fieldIds
		});
	});

	const formProperties = asArray(definition.properties?.property).map((property) => ({ ...property }));
	const topLevelPropMap: LookupTable<LegacyFormDefinitionProperty> = createLookupTable(formProperties, 'name');

	return {
		id: definition['content-type'],
		name: definition.title,
		description: definition.description,
		quickCreate: definition.quickCreate?.trim() === 'true',
		quickCreatePath: definition.quickCreatePath,
		type: definition.objectType as LegacyContentType['type'],
		displayTemplate: topLevelPropMap[XmlKeys.displayTemplate]?.value?.trim() || null,
		mergeStrategy: topLevelPropMap[XmlKeys.mergeStrategy]?.value?.trim() || null,
		// ∨∨∨ Added during TypeBuilder 2 ∨∨∨
		hasJsController: definition.controller?.trim() === 'true',
		thumbnailFileName: normalizeThumbnailFileName(definition.imageThumbnail),
		isHeadless: topLevelPropMap[XmlKeys.templateNotRequired]?.value?.trim() === 'true',
		paths: parseLegacyFormDefinitionPathsProp(definition),
		'delete-dependencies': parseFormDefinitionDeleteDependencies(definition),
		'copy-dependencies': parseFormDefinitionCopyDependencies(definition),
		previewable: definition.previewable?.trim() === 'true',
		allowedRoles: parseAllowedRoles(definition),
		formProperties,
		// ^^^ Added during TypeBuilder 2 ^^^
		dataSources: Object.values(dataSources),
		sections,
		fields
	};
}

function parseLegacyFormDefinitionPathsProp(definition: LegacyFormDefinition): ContentType['paths'] {
	const paths: ContentType['paths'] = {
		includes: { pattern: [] },
		excludes: { pattern: [] }
	};
	if (!definition.paths) return paths;
	if (definition.paths?.includes) {
		paths.includes = {
			pattern: asArray(definition.paths.includes.pattern)
		};
	}
	if (definition.paths?.excludes) {
		paths.excludes = {
			pattern: asArray(definition.paths.excludes.pattern)
		};
	}
	return paths;
}

function parseFormDefinitionDeleteDependencies(definition: LegacyFormDefinition): ContentType['delete-dependencies'] {
	return {
		'delete-dependency': asArray(definition['delete-dependencies']?.['delete-dependency'])
	};
}

function parseFormDefinitionCopyDependencies(definition: LegacyFormDefinition): ContentType['copy-dependencies'] {
	return {
		'copy-dependency': asArray(definition['copy-dependencies']?.['copy-dependency'])
	};
}

export function fetchContentTypes(site: string): Observable<ContentType[]> {
	return post(`/studio/api/2/model/${site}/definitions`).pipe(
		map(({ response }) =>
			response.types.map((xmlStr) =>
				parseLegacyFormDefinition(
					deserialize(xmlStr, {
						parseTagValue: false,
						tagValueProcessor: entityEncodingTagValueProcessor
					}).form
				)
			)
		)
	);
}

/**
 * Get allowed content types for a given site at a given path
 *
 * @param {string} siteId - The ID of the site for which to fetch allowed content types.
 * @param {string} path - The path within the site to check for allowed content types.
 * @returns {Observable<string[]>} An Observable that emits an array of allowed content type IDs.
 */
export function fetchAllowedTypes(siteId: string, path: string): Observable<string[]> {
	const qs = toQueryString({ path });
	return get(`/studio/api/2/configuration/content_types/${siteId}/allowed_types${qs}`).pipe(
		map((response) => response?.response?.allowedTypes ?? [])
	);
}

export interface FetchContentTypeUsageResponse<T = string> {
	templates: T[];
	scripts: T[];
	content: T[];
}

export function fetchContentTypeUsage(
	site: string,
	contentTypeId: string
): Observable<FetchContentTypeUsageResponse<ContentItem>> {
	const qs = toQueryString({ contentType: contentTypeId });
	return get<Api2ResponseFormat<{ usage: FetchContentTypeUsageResponse }>>(
		`/studio/api/2/configuration/content_types/${site}/usage${qs}`
	).pipe(
		map((response) => response?.response.usage),
		switchMap((usage) =>
			usage.templates.length + usage.scripts.length + usage.content.length === 0
				? of(
						// @ts-expect-error: at this point, `usage` is known to be empty arrays so we can safely cast it to `FetchContentTypeUsageResponse<ContentItem>`
						usage as FetchContentTypeUsageResponse<ContentItem>
					)
				: fetchContentItems(site, [...usage.templates, ...usage.scripts, ...usage.content]).pipe(
						map((items) => {
							const itemLookup = createLookupTable(items, 'path');
							const mapper = (path) => itemLookup[path];
							return {
								templates: usage.templates.map(mapper).filter(Boolean),
								scripts: usage.scripts.map(mapper).filter(Boolean),
								content: usage.content.map(mapper).filter(Boolean)
							};
						})
					)
		)
	);
}

export function deleteContentType(site: string, contentTypeId: string): Observable<boolean> {
	return ajax({
		url: `/studio/api/2/configuration/content_types/${site}`,
		method: 'DELETE',
		body: { contentType: contentTypeId, deleteDependencies: true },
		headers: { ...getGlobalHeaders(), ...CONTENT_TYPE_JSON }
	}).pipe(map(() => true));
}

const formDefinitionWriteTails = new Map<string, Promise<void>>();

/**
 * Runs `task` once every earlier queued write to the same site + type form-definition has settled.
 * `task` is only called at its turn, so read-modify-write helpers fetch the document then, and a full
 * definition write builds its XML then. Otherwise two writers that each read before the other wrote
 * would silently drop one change. Unsubscribing before the turn skips the task.
 */
export function queueFormDefinitionWrite<T>(
	site: string,
	contentTypeId: string,
	task: () => Observable<T>
): Observable<T> {
	return new Observable<T>((subscriber) => {
		const key = `${site}:${contentTypeId}`;
		const previous = formDefinitionWriteTails.get(key) ?? Promise.resolve();
		let release: () => void;
		const settled = new Promise<void>((resolve) => (release = resolve));
		const tail = previous.then(() => settled);
		formDefinitionWriteTails.set(key, tail);
		tail.then(() => {
			if (formDefinitionWriteTails.get(key) === tail) formDefinitionWriteTails.delete(key);
		});
		let closed = false;
		let inner: Subscription | null = null;
		previous.then(() => {
			if (closed) {
				release();
				return;
			}
			inner = defer(task)
				.pipe(finalize(() => release()))
				.subscribe({
					next: (value) => subscriber.next(value),
					error: (error) => subscriber.error(error),
					complete: () => subscriber.complete()
				});
		});
		return () => {
			closed = true;
			inner?.unsubscribe();
		};
	});
}

export function associateTemplate(site: string, contentTypeId: string, displayTemplate: string): Observable<boolean> {
	return queueFormDefinitionWrite(site, contentTypeId, () =>
		associateTemplateNow(site, contentTypeId, displayTemplate)
	);
}

function associateTemplateNow(site: string, contentTypeId: string, displayTemplate: string): Observable<boolean> {
	const path = createFormDefinitionPathFromTypeId(contentTypeId);
	const module = 'studio';
	return fetchConfigurationDOM(site, path, 'studio').pipe(
		switchMap((doc) => {
			const properties = doc.querySelectorAll('properties > property');
			const property = Array.from(properties).find(
				(node) => node.querySelector('name').innerHTML.trim() === 'display-template'
			);
			if (property) {
				property.querySelector('value').innerHTML = displayTemplate;
			} else {
				const property = document.createElement('property');
				const name = document.createElement('name');
				const label = document.createElement('label');
				const value = document.createElement('value');
				const type = document.createElement('type');
				name.innerHTML = 'display-template';
				label.innerHTML = 'Display Template';
				value.innerHTML = displayTemplate;
				type.innerHTML = 'template';
				property.appendChild(name);
				property.appendChild(label);
				property.appendChild(value);
				property.appendChild(type);
				doc.querySelector('properties').appendChild(property);
			}
			return fromPromise(beautify(serialize(doc))).pipe(
				switchMap((xml) => writeConfiguration(site, path, module, xml))
			);
		})
	);
}

function isMissingFormDefinition(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const ajaxError = error as Partial<AjaxError> & { response?: { response?: { code?: number | string } } };
	if (ajaxError.status === 404) return true;
	const code = ajaxError.response?.response?.code;
	return code === 7000 || code === '7000';
}

/**
 * Writes `<controller>true|false</controller>` on the saved form-definition.
 * Type Builder keeps a separate draft; this is what FE2 reads via `hasJsController`
 * if that draft is discarded.
 *
 * Returns `false` only when the form-definition is missing (unsaved type), so the
 * draft flag can still be stored with the type's first save. Errors from
 * `writeConfiguration` on an existing definition propagate; they are not returned as `false`.
 */
export function setJsControllerEnabled(site: string, contentTypeId: string, enabled: boolean): Observable<boolean> {
	return queueFormDefinitionWrite(site, contentTypeId, () => setJsControllerEnabledNow(site, contentTypeId, enabled));
}

function setJsControllerEnabledNow(site: string, contentTypeId: string, enabled: boolean): Observable<boolean> {
	const path = createFormDefinitionPathFromTypeId(contentTypeId);
	const module = 'studio';
	return fetchConfigurationDOM(site, path, module).pipe(
		catchError((error: unknown) => {
			if (isMissingFormDefinition(error)) {
				return of(false as const);
			}
			return throwError(() => error);
		}),
		switchMap((doc) => {
			if (doc === false) {
				return of(false);
			}
			const form = doc.querySelector('form');
			if (!form) {
				return throwError(() => new Error(`Form definition for "${contentTypeId}" has no <form> element.`));
			}
			let controller: Element | null = null;
			for (const child of Array.from(form.children)) {
				if (child.localName === 'controller') {
					controller = child;
					break;
				}
			}
			if (!controller) {
				controller = doc.createElement('controller');
				form.insertBefore(controller, form.firstChild);
			}
			controller.textContent = enabled ? 'true' : 'false';
			return fromPromise(beautify(serialize(doc))).pipe(
				switchMap((xml) => writeConfiguration(site, path, module, xml))
			);
		})
	);
}

export function dissociateTemplate(site: string, contentTypeId: string): Observable<boolean> {
	return queueFormDefinitionWrite(site, contentTypeId, () => dissociateTemplateNow(site, contentTypeId));
}

function dissociateTemplateNow(site: string, contentTypeId: string): Observable<boolean> {
	const path = createFormDefinitionPathFromTypeId(contentTypeId);
	const module = 'studio';
	return fetchConfigurationDOM(site, path, 'studio').pipe(
		switchMap((doc) => {
			const properties = doc.querySelectorAll('properties > property');
			const property = Array.from(properties).find(
				(node) => node.querySelector('name').innerHTML.trim() === 'display-template'
			);
			if (property) {
				property.querySelector('value').innerHTML = '';
				return fromPromise(beautify(serialize(doc))).pipe(
					switchMap((xml) => writeConfiguration(site, path, module, xml))
				);
			} else {
				return of(false);
			}
		})
	);
}

export function fetchPreviewImage(site: string, contentTypeId: string): Observable<AjaxResponse<Blob>> {
	const qs = toQueryString({ contentTypeId });
	return getBinary(`/studio/api/2/configuration/content_types/${site}/preview_image${qs}`);
}

/**
 * Returns a URL for a content type thumbnail.
 * When `thumbnailFileName` is provided, loads that file from the type's config folder (works with unsaved draft filenames)
 * and returns an object URL. When empty/absent, returns the static default placeholder (does not use preview_image,
 * which would still serve the saved form-definition thumbnail until save).
 */
export function fetchContentTypePreviewImageUrl(
	site: string,
	contentTypeId: string,
	thumbnailFileName?: string
): Observable<string> {
	if (thumbnailFileName) {
		const path = ensureSingleSlash(`/config/studio/content-types/${contentTypeId}/${thumbnailFileName}`);
		return getBinary(
			`/studio/api/2/content/${site}/get_content_by_commit_id${toQueryString({ path, commitId: 'HEAD' })}`,
			void 0,
			'blob'
		).pipe(
			map((ajax) => URL.createObjectURL(ajax.response as Blob)),
			catchError(() => of(DEFAULT_CONTENT_TYPE_PREVIEW_IMAGE_URL))
		);
	}
	return of(DEFAULT_CONTENT_TYPE_PREVIEW_IMAGE_URL);
}

/**
 * Authenticated URL for a content type's client-side `form-controller.js`.
 * Use with `getText` (or equivalent); do not load via bare `<script src>` / `import()`.
 */
export function getFormControllerUrl(site: string, contentTypeId: string): string {
	const qs = toQueryString({ contentTypeId });
	return `/studio/api/2/configuration/content_types/${site}/form_controller${qs}`;
}

/**
 * @deprecated Use {@link getFormControllerUrl}. Kept for Forms Engine v1 (FE1) call sites.
 */
export const getFetchLegacyFormControllerUrl = getFormControllerUrl;
