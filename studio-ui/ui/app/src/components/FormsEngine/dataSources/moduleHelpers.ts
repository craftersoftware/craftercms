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
import type LookupTable from '../../../models/LookupTable';
import type {
	DataSourceAction,
	DataSourceActionMeta,
	DataSourceAssetSelection,
	DataSourceCapability,
	DataSourceItemSelection,
	DataSourceListItem
} from './types';
import { expandPathOrRaw, toSearchPath } from './pathUtils';

/**
 * Normalizes a key/value list entry (configured options, taxonomy items, …).
 * Coerces key/value to strings, spreads remaining properties, and throws indexed errors when invalid.
 */
export function normalizeListItem(item: unknown, index: number, sourceLabel: string): DataSourceListItem {
	if (!item || typeof item !== 'object') {
		throw new Error(`${sourceLabel} entry at index ${index} is not an object.`);
	}
	const record = item as Record<string, unknown>;
	const key = String(record.key ?? '');
	const value = String(record.value ?? '');
	if (!key && !value) {
		throw new Error(`${sourceLabel} entry at index ${index} is missing key/value.`);
	}
	return { ...record, key, value };
}

/** Shared allow-lists for browse/search/upload filters; keep in sync with legacy FE1 expectations. */
export const IMAGE_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/tiff',
	'image/bmp',
	'image/svg+xml',
	'image/webp'
];

export const VIDEO_MIME_TYPES = ['video/mp4', 'video/x-msvideo', 'video/quicktime', 'video/webm', 'video/ogg'];

export const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm'];

/** Shared/embedded create destination used by create actions and {@link consolidateItemActions}. */
export type CreateTarget = {
	contentTypeId: string;
	path?: string;
	strategy: 'shared' | 'embedded';
};

/** Reads a DS property as string; missing/empty → `fallback`. Form XML often stores everything as strings. */
export function propString(record: DataSource, name: string, fallback = ''): string {
	const value = record.properties?.[name];
	if (value == null || value === '') return fallback;
	return String(value);
}

/**
 * Coerces a DS property to boolean. Missing/empty uses `defaultWhenMissing` so XML `"true"` strings
 * work and explicit absence stays distinct from false.
 */
export function propBoolean(record: DataSource, name: string, defaultWhenMissing = false): boolean {
	const value = record.properties?.[name];
	if (value == null || value === '') return defaultWhenMissing;
	if (typeof value === 'boolean') return value;
	return String(value) === 'true';
}

/** Trims a CSV from TB properties; empty → `[]`. */
export function splitCsv(value: string | undefined | null): string[] {
	if (!value?.trim()) return [];
	return value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

/** Normalizes site content types whether stored as an array or an id lookup table. */
export function contentTypesToArray(contentTypes: ContentType[] | LookupTable<ContentType> | undefined): ContentType[] {
	if (!contentTypes) return [];
	return Array.isArray(contentTypes) ? contentTypes : Object.values(contentTypes);
}

/**
 * Resolves a contentTypes property that may be `*` (all pages or components) or a CSV of ids.
 */
export function resolveContentTypeIds(
	raw: string | undefined,
	family: 'page' | 'component',
	contentTypes: ContentType[] | LookupTable<ContentType> | undefined
): string[] {
	const trimmed = raw?.trim();
	if (!trimmed) return [];
	if (trimmed !== '*') return splitCsv(trimmed);
	return contentTypesToArray(contentTypes)
		.filter((ct) => ct.type === family)
		.map((ct) => ct.id);
}

/** Reads `baseRepoPath` or legacy `baseRepositoryPath` so older form-definitions keep working. */
export function baseRepoPath(record: DataSource, fallback = ''): string {
	return propString(record, 'baseRepoPath') || propString(record, 'baseRepositoryPath') || fallback;
}

/** Reads `repoPath` or legacy `path`, falling back to `fallback` (typically `/static-assets/`). */
export function resolveRepoPath(record: DataSource, fallback = '/static-assets/'): string {
	return propString(record, 'repoPath') || propString(record, 'path', fallback);
}

/** Extension of the last path segment; no extension → `undefined`. */
export function fileExtensionFromPath(path: string): string | undefined {
	const slash = path.lastIndexOf('/');
	const name = slash >= 0 ? path.slice(slash + 1) : path;
	const dot = name.lastIndexOf('.');
	return dot > 0 ? name.slice(dot + 1) : undefined;
}

/**
 * Maps heterogeneous picker/search/browse results into {@link DataSourceItemSelection}, probing
 * common path/label/contentType fields from Studio dialogs.
 */
export function toItemSelection(item: unknown): DataSourceItemSelection {
	if (!item || typeof item !== 'object') {
		return { kind: 'item', value: item };
	}
	const candidate = item as Record<string, unknown>;
	const path =
		(typeof candidate.path === 'string' && candidate.path) ||
		(typeof candidate.browserUri === 'string' && candidate.browserUri) ||
		(typeof candidate.key === 'string' && candidate.key) ||
		undefined;
	const contentTypeId =
		(typeof candidate.contentTypeId === 'string' && candidate.contentTypeId) ||
		(typeof candidate.contentType === 'string' && candidate.contentType) ||
		undefined;
	const value = candidate.name ?? candidate.label ?? candidate.internalName ?? candidate.value ?? path;
	return { kind: 'item', path, contentTypeId, value };
}

export function toItemSelections(items: unknown[]): DataSourceItemSelection[] {
	return items.map(toItemSelection);
}

/**
 * Maps browse/upload results to assets; special-cases Uppy `meta` upload payloads vs repo browse
 * shapes. Throws if a path cannot be derived.
 */
export function toAssetSelection(item: unknown): DataSourceAssetSelection {
	if (typeof item === 'string') {
		return {
			kind: 'asset',
			relativeUrl: item,
			fileExtension: fileExtensionFromPath(item)
		};
	}
	if (!item || typeof item !== 'object') {
		throw new Error('Unable to map data-source result to an asset selection.');
	}
	const candidate = item as Record<string, unknown>;
	// Upload result (Uppy FileUpload)
	if (candidate.meta && typeof candidate.meta === 'object') {
		const meta = candidate.meta as { path?: string; name?: string; type?: string };
		const name = meta.name ?? (typeof candidate.name === 'string' ? candidate.name : '');
		const path = meta.path ?? '';
		if (!path && !name) {
			throw new Error('Unable to map data-source result to an asset selection: missing path.');
		}
		const relativeUrl = path; // `path` includes the full path to the file, including the filename
		return {
			kind: 'asset',
			relativeUrl,
			previewUrl: typeof candidate.preview === 'string' ? candidate.preview : undefined,
			fileExtension:
				(typeof candidate.extension === 'string' && candidate.extension) || fileExtensionFromPath(relativeUrl),
			mimeType: meta.type ?? (typeof candidate.type === 'string' ? candidate.type : undefined)
		};
	}
	const relativeUrl =
		(typeof candidate.relativeUrl === 'string' && candidate.relativeUrl) ||
		(typeof candidate.path === 'string' && candidate.path) ||
		(typeof candidate.browserUri === 'string' && candidate.browserUri) ||
		(typeof candidate.url === 'string' && candidate.url) ||
		'';
	if (!relativeUrl) {
		throw new Error('Unable to map data-source result to an asset selection: missing path.');
	}
	return {
		kind: 'asset',
		relativeUrl,
		previewUrl: typeof candidate.previewUrl === 'string' ? candidate.previewUrl : undefined,
		fileExtension:
			(typeof candidate.fileExtension === 'string' && candidate.fileExtension) || fileExtensionFromPath(relativeUrl),
		mimeType: typeof candidate.mimeType === 'string' ? candidate.mimeType : undefined
	};
}

export function toAssetSelections(items: unknown[]): DataSourceAssetSelection[] {
	return items.map(toAssetSelection);
}

/** Extracts Uppy `successful[]` into asset selections; upload action factories rely on this shape. */
export function mapUploadResultToAssets(result: unknown): DataSourceAssetSelection[] {
	if (!result || typeof result !== 'object') return [];
	const successful = (result as { successful?: unknown[] }).successful;
	if (!Array.isArray(successful) || successful.length === 0) return [];
	return toAssetSelections(successful);
}

/** Like {@link mapUploadResultToAssets}, but as item selections (path = relativeUrl). */
export function mapUploadResultToItems(result: unknown): DataSourceItemSelection[] {
	return mapUploadResultToAssets(result).map((asset) => ({
		kind: 'item',
		path: asset.relativeUrl,
		value: asset.relativeUrl
	}));
}

/**
 * Hard-fail stub for S3/WebDAV ops not yet on `DataSourceServices`.
 * Keeps remote modules loadable without fake success.
 */
export function unsupportedRemoteError(type: string, operation: string): never {
	throw new Error(
		`Data source "${type}" ${operation} is not yet supported by FormsEngine DataSourceServices. ` +
			`Remote S3/WebDAV ${operation} requires dedicated platform services.`
	);
}

/**
 * Factory for a standard browse action: expands path, calls host services, maps results to item or
 * asset selections. Prefer this over ad-hoc `run` so controls can group/consolidate uniformly.
 */
export function createBrowseAction(options: {
	id?: string;
	label?: string;
	path: string;
	contentTypes?: string[];
	mimeTypes?: string[];
	selection: 'item' | 'asset';
	meta?: DataSourceActionMeta;
}): DataSourceAction {
	const { path, contentTypes, mimeTypes, selection } = options;
	return {
		id: options.id ?? 'browse',
		kind: 'browse',
		label: options.label ?? 'Browse',
		meta: {
			path,
			contentTypes,
			mimeTypes,
			...options.meta
		},
		async run(ctx) {
			const expanded = expandPathOrRaw(ctx, path);
			const items = await ctx.services.browseFiles({
				path: expanded,
				contentTypes,
				mimeTypes,
				multiSelect: (ctx.remainingCapacity ?? 2) !== 1
			});
			if (!items.length) return null;
			return selection === 'asset' ? toAssetSelections(items) : toItemSelections(items);
		}
	};
}

/**
 * Factory for a standard search action (path expanded + recursive `/.+` suffix via {@link toSearchPath}).
 */
export function createSearchAction(options: {
	id?: string;
	label?: string;
	path: string;
	contentTypes?: string[];
	mimeTypes?: string[];
	selection: 'item' | 'asset';
	meta?: DataSourceActionMeta;
}): DataSourceAction {
	const { path, contentTypes, mimeTypes, selection } = options;
	return {
		id: options.id ?? 'search',
		kind: 'search',
		label: options.label ?? 'Search',
		meta: {
			path,
			contentTypes,
			mimeTypes,
			...options.meta
		},
		async run(ctx) {
			const expanded = toSearchPath(expandPathOrRaw(ctx, path));
			const initialParameters: Record<string, unknown> = {};
			if (mimeTypes?.length) {
				initialParameters.filters = { 'mime-type': mimeTypes };
			}
			const result = await ctx.services.search({
				path: expanded,
				contentTypes,
				initialParameters
			});
			const items = result.items?.length ? result.items : result.paths;
			if (!items.length) return null;
			return selection === 'asset' ? toAssetSelections(items) : toItemSelections(items);
		}
	};
}

/** Factory for a standard upload action; maps Uppy results via {@link mapUploadResultToAssets}. */
export function createUploadAction(options: {
	id?: string;
	label?: string;
	path: string;
	fileTypes?: string[];
	selection: 'item' | 'asset';
	meta?: DataSourceActionMeta;
}): DataSourceAction {
	const { path, fileTypes, selection } = options;
	return {
		id: options.id ?? 'upload',
		kind: 'upload',
		label: options.label ?? 'Upload',
		meta: {
			path,
			fileTypes,
			...options.meta
		},
		async run(ctx) {
			const expanded = expandPathOrRaw(ctx, path);
			const result = await ctx.services.upload({ path: expanded, fileTypes });
			const mapped = selection === 'asset' ? mapUploadResultToAssets(result) : mapUploadResultToItems(result);
			return mapped.length ? mapped : null;
		}
	};
}

/**
 * Factory for a standard create action. When multiple targets exist, the control must pass a create
 * target via `runOptions.target` — avoids ambiguous create.
 */
export function createCreateAction(options: {
	id?: string;
	label?: string;
	createTargets: CreateTarget[];
	meta?: DataSourceActionMeta;
}): DataSourceAction {
	const { createTargets } = options;
	return {
		id: options.id ?? 'create',
		kind: 'create',
		label: options.label ?? 'Create',
		meta: {
			createTargets,
			...options.meta
		},
		async run(ctx, runOptions) {
			if (createTargets.length === 0) {
				throw new Error('No create targets are configured for this data source.');
			}
			const selectedTarget = runOptions?.target;
			if (selectedTarget && selectedTarget.type !== 'create') {
				throw new Error(`Action "${options.id ?? 'create'}" requires a create target.`);
			}
			if (!selectedTarget && createTargets.length > 1) {
				throw new Error(
					'Multiple create targets are available; the control must pick a content type before calling run().'
				);
			}
			const target: CreateTarget =
				selectedTarget?.type === 'create'
					? {
							contentTypeId: selectedTarget.contentTypeId,
							path: selectedTarget.path,
							strategy: selectedTarget.strategy
						}
					: createTargets[0];
			const path = expandPathOrRaw(ctx, target.path ?? '');
			return ctx.services.createContent({
				path,
				contentTypeId: target.contentTypeId,
				embedded: target.strategy === 'embedded'
			});
		}
	};
}

/**
 * Action that always throws via {@link unsupportedRemoteError}.
 * Use for remote DS types until platform services exist.
 */
export function createRemoteStubAction(options: {
	id: string;
	kind: DataSourceAction['kind'];
	label: string;
	type: string;
	operation: string;
	meta?: DataSourceActionMeta;
}): DataSourceAction {
	return {
		id: options.id,
		kind: options.kind,
		label: options.label,
		meta: options.meta,
		async run() {
			unsupportedRemoteError(options.type, options.operation);
		}
	};
}

/**
 * Derives advertised capabilities from action kinds (+ extras) so instance `capabilities` stay
 * consistent with what `getActions` returns.
 */
export function capabilitiesFromActions(
	actions: readonly DataSourceAction[],
	extra: DataSourceCapability[] = []
): DataSourceCapability[] {
	const set = new Set<DataSourceCapability>(extra);
	actions.forEach((action) => {
		if (action.kind === 'browse' || action.kind === 'search' || action.kind === 'upload' || action.kind === 'create') {
			set.add(action.kind as DataSourceCapability);
		}
	});
	return Array.from(set);
}
