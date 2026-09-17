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
import type LookupTable from '../../../models/LookupTable';
import type { JotaiStore } from '../types';
import { XmlKeys } from './formConsts';
import type { FormsEngineAtoms, StableFormContextProps } from './formsEngineContext';
import { loadFormController } from './formControllerLoader';
import type { FormControllerContext, FormControllerMode } from './formControllerTypes';
import { extractAtomValues } from './formUtils';
import type { PrimitiveAtom } from 'jotai';

/** Minimal props shape used to resolve controller mode (avoids importing FormsEngine.tsx). */
export type FormControllerModeProps = {
	create?: { embedded?: boolean };
	update?: { modelId?: string };
	repeat?: unknown;
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
}

export function createFormControllerContext({
	siteId,
	store,
	atoms,
	contentType,
	path,
	mode,
	readonly,
	contentTypesById
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

/** Invokes and clears a stack entry's form-controller cleanup (idempotent). */
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

const commonInitErrorMsg = 'The form will proceed as though no custom type controller exists.';

/**
 * Loads the type's form controller (if gated), builds context, awaits `initialize`,
 * and stores controller + cleanup on the stack entry. Soft-fails on errors.
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
		stackEntry.formController = null;
		stackEntry.formControllerContext = null;
		stackEntry.formControllerCleanup = null;
		return;
	}

	const controller = await loadFormController(siteId, contentType.id, contentType.hasJsController);
	if (!controller) {
		stackEntry.formController = null;
		stackEntry.formControllerContext = null;
		stackEntry.formControllerCleanup = null;
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
		contentTypesById
	});

	stackEntry.formController = controller;
	stackEntry.formControllerContext = ctx;
	stackEntry.formControllerCleanup = null;

	try {
		const cleanup = await controller.initialize?.(ctx);
		stackEntry.formControllerCleanup = typeof cleanup === 'function' ? cleanup : null;
	} catch (error) {
		console.error(`Form controller initialize for "${contentType.id}" failed. ${commonInitErrorMsg}`, error);
		stackEntry.formController = null;
		stackEntry.formControllerContext = null;
		stackEntry.formControllerCleanup = null;
	}
}
