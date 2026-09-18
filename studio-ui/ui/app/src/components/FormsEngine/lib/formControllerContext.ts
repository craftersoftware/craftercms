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

/** Minimal props shape used to resolve controller mode (avoids importing FormsEngine.tsx). */
export type FormControllerModeProps = {
	create?: { embedded?: boolean };
	update?: { modelId?: string };
	repeat?: unknown;
	fieldsToRender?: ContentTypeField[];
};

export function resolveFormControllerMode(props: FormControllerModeProps): FormControllerMode {
	if (props.repeat) return 'repeat';
	if (props.create?.embedded || props.update?.modelId) return 'embedded';
	if (props.create) return 'create';
	return 'edit';
}

export interface CreateFormControllerContextArgs {
	siteId: string;
	store: JotaiStore;
	atoms: FormsEngineAtoms;
	contentType: ContentType;
	path: string | null | undefined;
	mode: FormControllerMode;
	readonly: boolean;
	contentTypesById: LookupTable<ContentType>;
	/** Internal subject; exposed on the context as a read-only Observable. */
	fieldUpdates$: Subject<string>;
}

export function createFormControllerContext({
	siteId,
	store,
	atoms,
	contentType,
	path,
	mode,
	readonly,
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
		readonly,
		isCreateMode,
		isEmbedded,
		fieldUpdates$: fieldUpdates$.asObservable(),
		getValues() {
			return extractAtomValues(store, atoms.valueByFieldId);
		},
		getValue(fieldId) {
			if (fieldId === XmlKeys.fileName && atoms.fileName) {
				return store.get(atoms.fileName);
			}
			const valueAtom = atoms.valueByFieldId[fieldId];
			return valueAtom ? store.get(valueAtom) : undefined;
		},
		setValue(fieldId, value) {
			if (fieldId === XmlKeys.fileName && atoms.fileName) {
				// `fileName` is typed as Atom on FormsEngineAtoms but is always a writable PrimitiveAtom at runtime.
				store.set(atoms.fileName as PrimitiveAtom<string>, value as string);
				return;
			}
			const valueAtom = atoms.valueByFieldId[fieldId];
			if (!valueAtom) {
				console.warn(`Form controller setValue: field "${fieldId}" has no value atom.`);
				return;
			}
			store.set(valueAtom, value);
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

/** Invokes and clears a stack entry's form-controller cleanup. */
export function runFormControllerCleanup(stackEntry: StableFormContextProps | undefined | null): void {
	if (!stackEntry?.formControllerCleanup) return;
	const cleanup = stackEntry.formControllerCleanup;
	stackEntry.formControllerCleanup = null;
	try {
		cleanup();
	} catch (error) {
		console.error('Form controller cleanup threw.', error);
	}
}

function clearFormControllerState(stackEntry: StableFormContextProps): void {
	stackEntry.formController = null;
	stackEntry.formControllerContext = null;
	stackEntry.formControllerCleanup = null;
	stackEntry.relevantFieldIds = null;
}

/**
 * Awaits `isFieldRelevant` for each field. Returns `null` when there is no hook (no filtering).
 * On rejection/error for a field, that field stays visible (soft-fail).
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
 * Loads the type's form controller (if gated), builds context, awaits `initialize`,
 * resolves field relevance, and stores controller + cleanup on the stack entry. Soft-fails on errors.
 */
export async function attachFormController(args: {
	siteId: string;
	store: JotaiStore;
	stackEntry: StableFormContextProps;
	contentTypesById: LookupTable<ContentType>;
	formProps: FormControllerModeProps;
}): Promise<void> {
	const { siteId, store, stackEntry, contentTypesById, formProps } = args;
	const contentType = stackEntry.itemMeta?.contentType;
	if (!contentType) {
		clearFormControllerState(stackEntry);
		return;
	}

	const controller = await loadFormController(siteId, contentType.id, contentType.hasJsController);
	if (!controller) {
		clearFormControllerState(stackEntry);
		return;
	}

	const mode = resolveFormControllerMode(formProps);
	const readonly = store.get(stackEntry.atoms.readonly);
	const ctx = createFormControllerContext({
		siteId,
		store,
		atoms: stackEntry.atoms,
		contentType,
		path: stackEntry.itemMeta.path,
		mode,
		readonly,
		contentTypesById,
		fieldUpdates$: stackEntry.fieldUpdates$
	});

	stackEntry.formController = controller;
	stackEntry.formControllerContext = ctx;
	stackEntry.formControllerCleanup = null;
	stackEntry.relevantFieldIds = null;

	try {
		const cleanup = await controller.initialize?.(ctx);
		stackEntry.formControllerCleanup = typeof cleanup === 'function' ? cleanup : null;
	} catch (error) {
		console.error(`Form controller initialize for "${contentType.id}" failed. ${commonInitErrorMsg}`, error);
		clearFormControllerState(stackEntry);
		return;
	}

	const fields = collectFieldsForRelevance(contentType, formProps, mode);
	try {
		stackEntry.relevantFieldIds = await resolveRelevantFieldIds(fields, controller, ctx);
	} catch (error) {
		console.error(
			`Form controller field relevance for "${contentType.id}" failed. All fields will remain visible.`,
			error
		);
		stackEntry.relevantFieldIds = null;
	}
}

/**
 * Runs the form controller's `onBeforeSave` hook.
 * Returns `false` when the controller vetoes save (explicit false or rejected promise).
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
