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

import type { ComponentType, ReactNode } from 'react';
import type { ContentType, ContentTypeField, DataSource } from '../../../models/ContentType';
import type LookupTable from '../../../models/LookupTable';
import type { FormsEngineProps } from '../FormsEngine';

export const DATA_SOURCE_API_VERSION = 1 as const;

export type DataSourceInterface = 'item' | 'image' | 'video' | 'transcoded-video' | 'audio' | 'options' | string;

export type DataSourceCapability = 'browse' | 'search' | 'upload' | 'create' | 'list' | 'edit' | 'refreshItem';

export type DataSourceActionKind = Exclude<DataSourceCapability, 'list' | 'edit' | 'refreshItem'> | string;

/** Selection of a file/media asset (image, video, audio, or generic file). */
export interface DataSourceAssetSelection {
	kind: 'asset';
	relativeUrl: string;
	previewUrl?: string;
	fileExtension?: string;
	mimeType?: string;
}

/** Selection of a content item (page/component), optionally with an embedded value payload. */
export interface DataSourceItemSelection {
	kind: 'item';
	path?: string;
	contentTypeId?: string;
	value?: unknown;
}

/** Selection of a key/value option (dropdown, checkbox-group, taxonomy, configured lists). */
export interface DataSourceOptionSelection {
	kind: 'option';
	key: string;
	value: string;
}

/** Selection of transcoded/variant media URLs produced by a transcoding data source. */
export interface DataSourceVariantsSelection {
	kind: 'variants';
	items: Array<{ url: string; [key: string]: unknown }>;
}

/** Plugin-defined selection shapes. `kind` must not collide with built-in kinds so unions narrow cleanly. */
export interface DataSourceCustomSelection {
	kind: Exclude<string, 'asset' | 'item' | 'option' | 'variants'>;
	[key: string]: unknown;
}

export type DataSourceSelection =
	| DataSourceAssetSelection
	| DataSourceItemSelection
	| DataSourceOptionSelection
	| DataSourceVariantsSelection
	| DataSourceCustomSelection;

/** Inputs for {@link DataSourceServices.browseFiles}. */
export interface DataSourceBrowseRequest {
	path: string;
	contentTypes?: string[];
	mimeTypes?: string[];
	multiSelect?: boolean;
	preselectedPaths?: string[];
	initialParameters?: Record<string, unknown>;
}

/** Inputs for {@link DataSourceServices.search}. */
export interface DataSourceSearchRequest {
	path: string;
	contentTypes?: string[];
	preselectedPaths?: string[];
	initialParameters?: Record<string, unknown>;
}

/** Inputs for {@link DataSourceServices.upload}. */
export interface DataSourceUploadRequest {
	path: string;
	fileTypes?: string[];
}

/** Inputs for {@link DataSourceServices.createContent}. */
export interface DataSourceCreateRequest {
	path: string;
	contentTypeId: string;
	embedded: boolean;
}

/** Result of {@link DataSourceServices.search}. */
export interface DataSourceSearchResult {
	paths: string[];
	items: unknown[];
}

/**
 * Stable host operations available to built-in and plugin data-source modules.
 * Modules should use these services instead of importing Studio dialog internals.
 */
export interface DataSourceServices {
	browseFiles(request: DataSourceBrowseRequest): Promise<unknown[]>;
	search(request: DataSourceSearchRequest): Promise<DataSourceSearchResult>;
	upload(request: DataSourceUploadRequest): Promise<unknown>;
	createContent(request: DataSourceCreateRequest): Promise<DataSourceItemSelection | null>;
	/** @deprecated Use createContent so the action can return the created selection. */
	pushForm(props: FormsEngineProps): void;
}

/**
 * Per-field runtime context passed into actions and capabilities.
 * Built once per control field and shared across that field's resolved data sources.
 */
export interface DataSourceFieldContext {
	siteId: string;
	contentType: ContentType;
	field: ContentTypeField;
	value: unknown;
	readonly: boolean;
	remainingCapacity?: number;
	services: DataSourceServices;
	/** Expand path macros (${objectId}, etc.). Controls/host should supply this. */
	expandPath?(path: string): string;
	/** Site content types for wildcard resolution (e.g. components contentTypes="*"). */
	contentTypes?: ContentType[] | LookupTable<ContentType>;
}

/** Context supplied to {@link DataSourceModule.create} when instantiating a configured data source. */
export interface DataSourceCreateContext {
	siteId: string;
	record: DataSource;
	services: DataSourceServices;
}

/** Props for custom action `MenuItem` / `Dialog` React components. */
export interface DataSourceActionComponentProps {
	action: DataSourceAction;
	context: DataSourceFieldContext;
	disabled?: boolean;
	onResult(selection: DataSourceSelection | DataSourceSelection[] | null): void;
	onError(error: unknown): void;
}

/**
 * Optional structured hints for control UX (1-vs-N pickers, create targets).
 * Modules should still implement `run()` for the single-target / fire-directly case.
 */
export interface DataSourceActionMeta {
	path?: string;
	contentTypes?: string[];
	mimeTypes?: string[];
	sortBy?: string;
	sortOrder?: 'asc' | 'desc';
	createTargets?: Array<{
		contentTypeId: string;
		path?: string;
		strategy: 'shared' | 'embedded';
	}>;
	createPaths?: string[];
	[key: string]: unknown;
}

export type DataSourceActionTarget =
	| {
			type: 'create';
			contentTypeId: string;
			path?: string;
			strategy: 'shared' | 'embedded';
	  }
	| {
			type: 'create-path';
			path: string;
	  }
	| {
			type: 'custom';
			payload: Record<string, unknown>;
	  };

/** Options passed to {@link DataSourceAction.run} when a grouped choice selects a concrete target. */
export interface DataSourceActionRunOptions {
	target?: DataSourceActionTarget;
}

/**
 * Executable action exposed by a data-source instance.
 * Prefer `run` for service-backed intents; use `MenuItem`/`Dialog` only for custom UI.
 */
export interface DataSourceAction {
	id: string;
	kind: DataSourceActionKind;
	label: ReactNode;
	icon?: ReactNode;
	meta?: DataSourceActionMeta;
	run?(
		context: DataSourceFieldContext,
		options?: DataSourceActionRunOptions
	): Promise<DataSourceSelection | DataSourceSelection[] | null>;
	MenuItem?: ComponentType<DataSourceActionComponentProps>;
	Dialog?: ComponentType<DataSourceActionComponentProps>;
}

/**
 * {@link DataSourceAction} stamped with stable cross-instance identity and owning binding.
 * `actionKey` is `${dataSourceId}::${action.id}`.
 */
export interface ResolvedDataSourceAction extends DataSourceAction {
	actionKey: string;
	dataSourceId: string;
	dataSourceTitle: string;
	binding: DataSourceBinding;
}

/**
 * One concrete option inside a presentation group (e.g. a create target or a single DS browse entry).
 * Always retains the owning {@link ResolvedDataSourceAction}.
 */
export interface DataSourceActionChoice {
	key: string;
	label: ReactNode;
	description?: ReactNode;
	action: ResolvedDataSourceAction;
	target?: DataSourceActionTarget;
}

/**
 * Intent-level presentation group (`binding.propertyName` + `kind`) that may contain
 * multiple {@link DataSourceActionChoice}s from different data sources.
 */
export interface DataSourceActionGroup {
	key: string;
	kind: DataSourceActionKind;
	label: ReactNode;
	icon?: ReactNode;
	choices: DataSourceActionChoice[];
}

/**
 * Host presentation result: standard intents flattened into groups,
 * plus custom `MenuItem`/`Dialog`/non-standard actions kept standalone.
 */
export interface GroupedDataSourceActions {
	groups: DataSourceActionGroup[];
	customActions: ResolvedDataSourceAction[];
}

/** Key/value row returned by {@link DataSourceListCapability}. */
export interface DataSourceListItem {
	key: string;
	value: string;
	[key: string]: unknown;
}

/** Capability that supplies option lists for dropdown / checkbox-group style controls. */
export interface DataSourceListCapability {
	(context: DataSourceFieldContext): Promise<DataSourceListItem[]>;
}

/** Capability that opens an editor for an existing selection and returns the updated value. */
export interface DataSourceEditCapability {
	(selection: DataSourceSelection, context: DataSourceFieldContext): Promise<DataSourceSelection | null>;
}

/** Capability that reloads metadata for an existing selection without opening a full editor. */
export interface DataSourceRefreshItemCapability {
	(selection: DataSourceSelection, context: DataSourceFieldContext): Promise<DataSourceSelection | null>;
}

/**
 * Live instance created from a configured form-definition data-source record.
 * Owns actions and optional list/edit/refresh capabilities for one field binding.
 */
export interface DataSourceInstance {
	id: string;
	type: string;
	title: string;
	interfaces: readonly DataSourceInterface[];
	capabilities: readonly DataSourceCapability[];
	getActions(context: DataSourceFieldContext): readonly DataSourceAction[] | Promise<readonly DataSourceAction[]>;
	list?: DataSourceListCapability;
	edit?: DataSourceEditCapability;
	refreshItem?: DataSourceRefreshItemCapability;
	flags?: {
		contentReference?: boolean;
		embedded?: boolean;
	};
}

/**
 * Versioned behavior factory registered by data-source type (built-in or plugin).
 * A form-definition `DataSource` record is configuration only; this module makes it executable.
 */
export interface DataSourceModule {
	apiVersion: typeof DATA_SOURCE_API_VERSION;
	type: string;
	interfaces: readonly DataSourceInterface[];
	capabilities: readonly DataSourceCapability[];
	create(context: DataSourceCreateContext): DataSourceInstance | Promise<DataSourceInstance>;
}

/**
 * Declares how a control property binds to data sources: which interfaces it accepts
 * and whether the field value is single- or multi-valued.
 */
export interface DataSourceBinding {
	propertyName: string;
	interfaces: readonly DataSourceInterface[];
	selection: 'single' | 'multi';
}

/** Fully resolved triple: form-definition record + registered module + live instance + control binding. */
export interface ResolvedDataSource {
	record: DataSource;
	module: DataSourceModule;
	instance: DataSourceInstance;
	binding: DataSourceBinding;
}

/** Structured failure captured while resolving or loading a field's data sources. */
export interface DataSourceResolutionError {
	code:
		| 'unknown-id'
		| 'unknown-type'
		| 'plugin-load'
		| 'interface-mismatch'
		| 'invalid-module'
		| 'create-failed'
		| 'actions-failed';
	message: string;
	dataSourceId?: string;
	cause?: unknown;
}

/**
 * Aggregate passed to controls via `ControlProps.dataSources`.
 * Includes configured records, resolved instances, flattened actions, and load status.
 */
export interface ResolvedDataSources {
	context: DataSourceFieldContext | null;
	records: DataSource[];
	instances: ResolvedDataSource[];
	actions: ResolvedDataSourceAction[];
	status: 'idle' | 'loading' | 'ready' | 'error';
	errors: DataSourceResolutionError[];
}
