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
import type { ContentTypeField } from '../../../models/ContentType';
import type LookupTable from '../../../models/LookupTable';
import type { Subject } from 'rxjs';
import type { JotaiStore } from '../types';
import { XmlKeys } from './formConsts';
import type { FormsEngineAtoms, StableFormContextProps } from './formsEngineContext';
import { loadFormController } from './formControllerLoader';
import type { FormController, FormControllerContext, FormControllerMode } from './formControllerTypes';
import { extractAtomValues } from './formUtils';
import type { PrimitiveAtom } from 'jotai';
import { retrieveProperty, setProperty } from '../../../utils/object';

/**
 * Minimal form-open props used to resolve {@link FormControllerMode} without importing FormsEngine.tsx.
 */
export type FormControllerModeProps = {
	create?: { embedded?: boolean };
	update?: { modelId?: string };
	repeat?: unknown;
	fieldsToRender?: ContentTypeField[];
};

/**
 * Derives the controller mode from how the form was opened.
 *
 * @param props - Create / update / repeat / fieldsToRender flags from the form props
 * @returns `'repeat'` | `'embedded'` | `'create'` | `'edit'`
 */
export function resolveFormControllerMode(props: FormControllerModeProps): FormControllerMode {
	if (props.repeat) return 'repeat';
	if (props.create?.embedded || props.update?.modelId) return 'embedded';
	if (props.create) return 'create';
	return 'edit';
}

/** Arguments for building the narrow host API passed to type-local form controllers. */
export interface CreateFormControllerContextArgs {
	/** Active site id used for site-scoped reads/writes from the controller. */
	siteId: string;
	/** Jotai store that owns this form stack entry's field/value atoms. */
	store: JotaiStore;
	/** Form atoms (values, readonly, fileName, etc.) that getValue/setValue/readonly read from. */
	atoms: FormsEngineAtoms;
	/** Content type definition for the form this controller is attached to. */
	contentType: ContentType;
	/** Item path when editing an existing item; null/undefined in create (and some stacked) modes. */
	path: string | null | undefined;
	/** How the form was opened: create, edit, embedded, or repeat. */
	mode: FormControllerMode;
	/** Lookup of all loaded content types; used by getContentType(id) for embeds/related types. */
	contentTypesById: LookupTable<ContentType>;
	/**
	 * Internal subject that emits field ids when values change.
	 * Exposed on the context as a read-only Observable (`fieldUpdateStream`).
	 */
	fieldUpdates$: Subject<string>;
}

/**
 * Builds the narrow {@link FormControllerContext} host API for a type-local form controller.
 *
 * Controllers receive this object (not the Jotai store or React tree). Field I/O goes through
 * `getValue` / `setValue` / `getValues` (top-level ids, or dotted paths into repeat items);
 * change notifications through `fieldUpdateStream`; metadata through `getField` /
 * `getContentType`. `readonly` is read live from the form's readonly atom.
 *
 * @param args - Store, atoms, content type, and field-update subject for this form stack entry
 * @returns Context object passed to `initialize`, `isFieldRelevant`, and `onBeforeSave`
 */
export function createFormControllerContext({
	siteId,
	store,
	atoms,
	contentType,
	path,
	mode,
	contentTypesById,
	fieldUpdates$
}: CreateFormControllerContextArgs): FormControllerContext {
	const isCreateMode = mode === 'create';
	const isEmbedded = mode === 'embedded';
	return {
		siteId,
		contentType,
		path: path ?? undefined,
		mode,
		get readonly() {
			return store.get(atoms.readonly);
		},
		isCreateMode,
		isEmbedded,
		fieldUpdateStream: fieldUpdates$.asObservable(),
		getValues() {
			return extractAtomValues(store, atoms.valueByFieldId);
		},
		getValue(fieldId) {
			// File-name lives on a dedicated atom, not in valueByFieldId.
			if (fieldId === XmlKeys.fileName && atoms.fileName) {
				return store.get(atoms.fileName);
			}
			const valueAtom = atoms.valueByFieldId[fieldId];
			// Top-level field id — read that atom directly (includes whole repeat arrays).
			if (valueAtom) {
				return store.get(valueAtom);
			}
			// No flat atom: try a dotted path into a nested value (e.g. myRepeat.0.title_s).
			const parsed = parseFieldValuePath(fieldId);
			// Not a dotted path (or empty segments) — nothing to resolve.
			if (!parsed) {
				return undefined;
			}
			const rootAtom = atoms.valueByFieldId[parsed.rootId];
			// Root segment does not match a field atom on this form.
			if (!rootAtom) {
				return undefined;
			}
			const root = store.get(rootAtom);
			// Root value must be an object/array to walk into.
			if (root == null || typeof root !== 'object') {
				return undefined;
			}
			try {
				return retrieveProperty(root as object, parsed.nestedPath);
			} catch {
				// Null intermediate in the path throws inside retrieveProperty.
				return undefined;
			}
		},
		setValue(fieldId, value) {
			// File-name lives on a dedicated atom, not in valueByFieldId.
			if (fieldId === XmlKeys.fileName && atoms.fileName) {
				// `fileName` is typed as Atom on FormsEngineAtoms but is always a writable PrimitiveAtom at runtime.
				store.set(atoms.fileName as PrimitiveAtom<string>, value as string);
				return;
			}
			const valueAtom = atoms.valueByFieldId[fieldId];
			// Top-level field id — write that atom directly (includes whole repeat arrays).
			if (valueAtom) {
				store.set(valueAtom, value);
				return;
			}
			// No flat atom: try a dotted path into a nested value (e.g. myRepeat.0.title_s).
			const parsed = parseFieldValuePath(fieldId);
			// Not a dotted path — unknown field id.
			if (!parsed) {
				console.warn(`Form controller setValue: field "${fieldId}" has no value atom.`);
				return;
			}
			const rootAtom = atoms.valueByFieldId[parsed.rootId];
			// Root segment does not match a field atom on this form.
			if (!rootAtom) {
				console.warn(`Form controller setValue: field "${parsed.rootId}" has no value atom.`);
				return;
			}
			const root = store.get(rootAtom);
			// Root value must be an object/array to walk into.
			if (root == null || typeof root !== 'object') {
				console.warn(`Form controller setValue: path "${fieldId}" could not be resolved.`);
				return;
			}
			// Clone so Jotai sees a new root reference after the nested mutate.
			const next = structuredClone(root) as object;
			// Fail closed: missing parents or out-of-range repeat indexes (do not auto-create).
			if (!canSetNestedProperty(next, parsed.nestedPath)) {
				console.warn(`Form controller setValue: path "${fieldId}" could not be resolved.`);
				return;
			}
			setProperty(next, parsed.nestedPath, value);
			store.set(rootAtom, next);
		},
		getField(fieldId) {
			return contentType.fields[fieldId];
		},
		getContentType(id) {
			if (id == null || id === contentType.id) return contentType;
			return contentTypesById[id];
		}
	};
}

/**
 * Splits a dotted field path into a root atom id and nested path string for
 * {@link retrieveProperty} / {@link setProperty} (e.g. `myRepeat.0.title_s` → root `myRepeat`, nested `0.title_s`).
 *
 * @param fieldId - Flat field id or dotted path
 * @returns Parsed root + nested path, or `null` when there are no dots / empty segments
 */
function parseFieldValuePath(fieldId: string): { rootId: string; nestedPath: string } | null {
	if (!fieldId.includes('.')) {
		return null;
	}
	const segments = fieldId.split('.');
	if (segments.length < 2 || segments.some((segment) => segment === '')) {
		return null;
	}
	const [rootId, ...rest] = segments;
	return { rootId, nestedPath: rest.join('.') };
}

/**
 * Whether {@link setProperty} can write `nestedPath` without creating missing parents
 * (fail-closed for out-of-range repeat indexes / broken intermediates).
 */
function canSetNestedProperty(root: object, nestedPath: string): boolean {
	const segments = nestedPath.split('.');
	const last = segments[segments.length - 1];
	const parentPath = segments.slice(0, -1).join('.');
	let parent: unknown = root;
	if (parentPath) {
		try {
			parent = retrieveProperty(root, parentPath);
		} catch {
			return false;
		}
	}
	if (parent == null || typeof parent !== 'object') {
		return false;
	}
	if (Array.isArray(parent) && /^\d+$/.test(last)) {
		const index = Number(last);
		return Number.isInteger(index) && index >= 0 && index < parent.length;
	}
	return true;
}

/**
 * Invokes a form-controller cleanup callback, logging (and swallowing) any throw.
 *
 * @param cleanup - Function returned from `initialize`, if any
 */
function invokeCleanup(cleanup: (() => void) | null | undefined): void {
	if (!cleanup) return;
	try {
		cleanup();
	} catch (error) {
		console.error('Form controller cleanup threw.', error);
	}
}

/**
 * Runs and clears the cleanup stored on a form stack entry (idempotent).
 * Used on stack pop / engine unmount so `initialize` listeners are torn down once.
 *
 * @param stackEntry - Form stack entry that may hold `formControllerCleanup`
 */
export function runFormControllerCleanup(stackEntry: StableFormContextProps | undefined | null): void {
	if (!stackEntry?.formControllerCleanup) return;
	const cleanup = stackEntry.formControllerCleanup;
	stackEntry.formControllerCleanup = null;
	invokeCleanup(cleanup);
}

/**
 * Resets controller-related fields on a stack entry (controller, context, cleanup, relevance).
 *
 * @param stackEntry - Form stack entry to clear
 */
function clearFormControllerState(stackEntry: StableFormContextProps): void {
	stackEntry.formController = null;
	stackEntry.formControllerContext = null;
	stackEntry.formControllerCleanup = null;
	stackEntry.relevantFieldIds = null;
}

/**
 * Awaits `isFieldRelevant` for each field and returns the set of ids that should stay visible.
 *
 * Returns `null` when there is no relevance hook (caller should not filter). On rejection/error for
 * a single field, that field stays visible (soft-fail).
 *
 * @param fields - Candidate fields (full type or `fieldsToRender` subset)
 * @param controller - Loaded form controller, if any
 * @param ctx - Host context for the controller hooks
 * @returns Relevant field ids, or `null` if no filtering applies
 */
export async function resolveRelevantFieldIds(
	fields: ContentTypeField[],
	controller: FormController | null | undefined,
	ctx: FormControllerContext | null | undefined
): Promise<Set<string> | null> {
	if (!controller?.isFieldRelevant || !ctx) {
		return null;
	}
	const results = await Promise.all(
		fields.map(async (field) => {
			try {
				const relevant = await controller.isFieldRelevant!(field, ctx);
				return [field.id, relevant !== false] as const;
			} catch (error) {
				console.error(
					`Form controller isFieldRelevant for field "${field.id}" failed. The field will remain visible.`,
					error
				);
				return [field.id, true] as const;
			}
		})
	);
	return new Set(results.filter(([, relevant]) => relevant).map(([id]) => id));
}

/**
 * Chooses which fields to run relevance against for this form open.
 *
 * Uses `fieldsToRender` when present (repeat / partial forms); otherwise all type fields,
 * excluding `file-name` for embedded modes.
 *
 * @param contentType - Type whose fields may be filtered
 * @param formProps - Open props (may include `fieldsToRender`)
 * @param mode - Resolved controller mode
 * @returns Field list passed to {@link resolveRelevantFieldIds}
 */
function collectFieldsForRelevance(
	contentType: ContentType,
	formProps: FormControllerModeProps,
	mode: FormControllerMode
): ContentTypeField[] {
	if (formProps.fieldsToRender?.length) {
		return formProps.fieldsToRender;
	}
	let fields = Object.values(contentType.fields);
	if (mode === 'embedded') {
		fields = fields.filter((field) => field.id !== XmlKeys.fileName);
	}
	return fields;
}

const commonInitErrorMsg = 'The form will proceed as though no custom type controller exists.';

/**
 * Loads the type's form controller (if gated by `hasJsController`), builds context, awaits
 * `initialize`, resolves field relevance, and stores controller + cleanup on the stack entry.
 *
 * Soft-fails on load / initialize / relevance errors (form continues without a controller or with
 * all fields visible). The cleanup returned by `initialize` belongs to the invocation that obtained
 * it: when `isStale` reports that this invocation was superseded, that cleanup runs here and the
 * shared stack entry is left untouched for whoever owns it now.
 *
 * @param args.siteId - Active site id
 * @param args.store - Jotai store for this forms root
 * @param args.stackEntry - Stack entry to attach controller state onto
 * @param args.contentTypesById - Content-types lookup for context helpers
 * @param args.formProps - Open props used for mode + relevance field list
 * @param args.isStale - Optional; when true, discard results (prep re-run / unmount)
 */
export async function attachFormController(args: {
	siteId: string;
	store: JotaiStore;
	stackEntry: StableFormContextProps;
	contentTypesById: LookupTable<ContentType>;
	formProps: FormControllerModeProps;
	/** Reports whether this invocation was superseded (prep effect re-run / form unmount). */
	isStale?: () => boolean;
}): Promise<void> {
	const { siteId, store, stackEntry, contentTypesById, formProps, isStale } = args;
	const stale = () => Boolean(isStale?.());
	// A controller already on the entry is being replaced: run its cleanup rather than dropping it, and
	// stop exposing it, as it is torn down from here on.
	runFormControllerCleanup(stackEntry);
	clearFormControllerState(stackEntry);

	const contentType = stackEntry.itemMeta?.contentType;
	if (!contentType) return;

	const controller = await loadFormController(siteId, contentType.id, contentType.hasJsController);
	if (stale() || !controller) return;

	const mode = resolveFormControllerMode(formProps);
	const ctx = createFormControllerContext({
		siteId,
		store,
		atoms: stackEntry.atoms,
		contentType,
		path: stackEntry.itemMeta.path,
		mode,
		contentTypesById,
		fieldUpdates$: stackEntry.fieldUpdates$
	});

	let ownCleanup: (() => void) | null = null;
	try {
		const cleanup = await controller.initialize?.(ctx);
		ownCleanup = typeof cleanup === 'function' ? cleanup : null;
	} catch (error) {
		console.error(`Form controller initialize for "${contentType.id}" failed. ${commonInitErrorMsg}`, error);
		return;
	}
	if (stale()) {
		invokeCleanup(ownCleanup);
		return;
	}

	// Committed only once `initialize` settled, so the entry never exposes a half-initialized controller.
	stackEntry.formController = controller;
	stackEntry.formControllerContext = ctx;
	stackEntry.formControllerCleanup = ownCleanup;

	const fields = collectFieldsForRelevance(contentType, formProps, mode);
	let relevantFieldIds: Set<string> | null = null;
	try {
		relevantFieldIds = await resolveRelevantFieldIds(fields, controller, ctx);
	} catch (error) {
		console.error(
			`Form controller field relevance for "${contentType.id}" failed. All fields will remain visible.`,
			error
		);
		relevantFieldIds = null;
	}
	if (stale()) return;
	stackEntry.relevantFieldIds = relevantFieldIds;
}

/**
 * Runs the form controller's `onBeforeSave` hook for a stack entry.
 *
 * @param stackEntry - Form stack entry that may hold a loaded controller + context
 * @returns `true` to continue save; `false` when the controller vetoes (explicit false or thrown/rejected)
 */
export async function runFormControllerBeforeSave(
	stackEntry: StableFormContextProps | null | undefined
): Promise<boolean> {
	const controller = stackEntry?.formController;
	const ctx = stackEntry?.formControllerContext;
	if (!controller?.onBeforeSave || !ctx) {
		return true;
	}
	try {
		const allowed = await controller.onBeforeSave(ctx);
		return allowed !== false;
	} catch (error) {
		console.error('Form controller onBeforeSave failed. Save was cancelled.', error);
		return false;
	}
}
