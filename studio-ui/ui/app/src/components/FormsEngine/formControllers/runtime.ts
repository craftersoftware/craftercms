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
import type { Subject } from 'rxjs';
import type { Dispatch as ReduxDispatch } from 'redux';
import type { IntlShape } from 'react-intl';
import type { JotaiStore } from '../types';
import { XmlKeys } from '../lib/formConsts';
import type { FormsEngineAtoms, StableFormContextProps } from '../lib/formsEngineContext';
import type { FormsEngineProps } from '../FormsEngine';
import { loadFormController } from './loader';
import {
	createEmptyFormControllerState,
	type FormController,
	type FormControllerContext,
	type FormControllerMode,
	type FormControllerNotifySeverity,
	type FormControllerState
} from './types';
import { extractAtomValues } from '../lib/formUtils';
import type { PrimitiveAtom } from 'jotai';
import { retrieveProperty, setProperty } from '../../../utils/object';
import { showSystemNotification } from '../../../state/actions/system';

type FormControllerFormProps = Pick<FormsEngineProps, 'create' | 'update' | 'repeat' | 'fieldsToRender'>;

/**
 * Derives the controller mode from how the form was opened.
 * Repeat stacked forms do not build a context, so they never call this.
 */
export function resolveFormControllerMode(props: FormControllerFormProps): FormControllerMode {
	return props.create ? 'create' : 'edit';
}

/** Arguments for building the narrow host API passed to type-local form controllers. */
export interface CreateFormControllerContextArgs {
	siteId: string;
	store: JotaiStore;
	atoms: FormsEngineAtoms;
	contentType: ContentType;
	/** Live path reader so create/rename updates are visible without re-attaching. */
	getPath: () => string | null | undefined;
	mode: FormControllerMode;
	isEmbedded: boolean;
	fieldUpdates$: Subject<string>;
	dispatch: ReduxDispatch;
	/** Set that owns `onFieldChange` unsubscribers for this stack entry. */
	fieldChangeUnsubscribers: Set<() => void>;
}

/**
 * Builds the narrow {@link FormControllerContext} host API for a type-local form controller.
 */
export function createFormControllerContext({
	siteId,
	store,
	atoms,
	contentType,
	getPath,
	mode,
	isEmbedded,
	fieldUpdates$,
	dispatch,
	fieldChangeUnsubscribers
}: CreateFormControllerContextArgs): FormControllerContext {
	const readValue = (fieldId: string): unknown => {
		if (fieldId === XmlKeys.fileName && atoms.fileName) {
			return store.get(atoms.fileName);
		}
		const valueAtom = atoms.valueByFieldId[fieldId];
		if (valueAtom) {
			return store.get(valueAtom);
		}
		const parsed = parseFieldValuePath(fieldId);
		if (!parsed) {
			return undefined;
		}
		const rootAtom = atoms.valueByFieldId[parsed.rootId];
		if (!rootAtom) {
			return undefined;
		}
		const root = store.get(rootAtom);
		if (root == null || typeof root !== 'object') {
			return undefined;
		}
		try {
			return retrieveProperty(root as object, parsed.nestedPath);
		} catch {
			return undefined;
		}
	};

	return {
		siteId,
		contentType,
		get path() {
			return getPath() ?? undefined;
		},
		mode,
		isEmbedded,
		get readonly() {
			return store.get(atoms.readonly);
		},
		getValues() {
			const values = extractAtomValues(store, atoms.valueByFieldId);
			if (atoms.fileName) {
				values[XmlKeys.fileName] = store.get(atoms.fileName);
			}
			return values;
		},
		getValue: readValue,
		setValue(fieldId, value) {
			if (fieldId === XmlKeys.fileName && atoms.fileName) {
				// `file-name` is stored twice: the dedicated atom the save path reads, and the
				// field value atom `getValues` / `onSave` see. Keep them in lockstep.
				store.set(atoms.fileName as PrimitiveAtom<string>, value as string);
				const fileNameValueAtom = atoms.valueByFieldId[XmlKeys.fileName];
				if (fileNameValueAtom) {
					store.set(fileNameValueAtom, value);
				}
				return;
			}
			const valueAtom = atoms.valueByFieldId[fieldId];
			if (valueAtom) {
				store.set(valueAtom, value);
				return;
			}
			const parsed = parseFieldValuePath(fieldId);
			if (!parsed) {
				console.warn(`Form controller setValue: field "${fieldId}" has no value atom.`);
				return;
			}
			const rootAtom = atoms.valueByFieldId[parsed.rootId];
			if (!rootAtom) {
				console.warn(`Form controller setValue: field "${parsed.rootId}" has no value atom.`);
				return;
			}
			const root = store.get(rootAtom);
			if (root == null || typeof root !== 'object') {
				console.warn(`Form controller setValue: path "${fieldId}" could not be resolved.`);
				return;
			}
			const next = structuredClone(root) as object;
			if (!canSetNestedProperty(next, parsed.nestedPath)) {
				console.warn(`Form controller setValue: path "${fieldId}" could not be resolved.`);
				return;
			}
			setProperty(next, parsed.nestedPath, value);
			store.set(rootAtom, next);
		},
		getField(fieldId) {
			return getFieldFromContentType(contentType, fieldId);
		},
		onFieldChange(listener) {
			const subscription = fieldUpdates$.subscribe((fieldId) => {
				listener(fieldId, readValue(fieldId));
			});
			const unsubscribe = () => {
				subscription.unsubscribe();
				fieldChangeUnsubscribers.delete(unsubscribe);
			};
			fieldChangeUnsubscribers.add(unsubscribe);
			return unsubscribe;
		},
		notify(message, severity: FormControllerNotifySeverity = 'info') {
			dispatch(
				showSystemNotification({
					message,
					options: { variant: severity }
				})
			);
		}
	};
}

/**
 * Looks up a field definition, walking nested `.fields` and skipping numeric (repeat index) segments.
 */
export function getFieldFromContentType(contentType: ContentType, fieldId: string): ContentTypeField | undefined {
	if (!fieldId.includes('.')) {
		return contentType.fields[fieldId];
	}
	const segments = fieldId.split('.').filter((segment) => segment !== '' && !/^\d+$/.test(segment));
	if (!segments.length) {
		return undefined;
	}
	let current: ContentTypeField | undefined = contentType.fields[segments[0]];
	for (let i = 1; i < segments.length && current; i++) {
		current = current.fields?.[segments[i]];
	}
	return current;
}

export function parseFieldValuePath(fieldId: string): { rootId: string; nestedPath: string } | null {
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

function invokeCleanup(cleanup: (() => void) | null | undefined): void {
	if (!cleanup) return;
	try {
		cleanup();
	} catch (error) {
		console.error('Form controller cleanup threw.', error);
	}
}

function unsubscribeFieldChangeListeners(state: FormControllerState | null | undefined): void {
	if (!state?.fieldChangeUnsubscribers.size) return;
	for (const unsubscribe of [...state.fieldChangeUnsubscribers]) {
		try {
			unsubscribe();
		} catch (error) {
			console.error('Form controller onFieldChange unsubscribe threw.', error);
		}
	}
	state.fieldChangeUnsubscribers.clear();
}

/**
 * Runs and clears the cleanup stored on a form stack entry (idempotent), including
 * `onFieldChange` listeners the host tracked for this entry.
 */
export function runFormControllerCleanup(stackEntry: StableFormContextProps | undefined | null): void {
	const state = stackEntry?.formControllerState;
	if (!state) return;
	state.disposed = true;
	const cleanup = state.cleanup;
	state.cleanup = null;
	unsubscribeFieldChangeListeners(state);
	invokeCleanup(cleanup);
}

/**
 * True when `fieldId` (qualified by `parentPath` for a repeat subfield) is on the controller deny-list.
 * A flat id match is not used for subfields: `title_s` hidden in one repeat group must not hide `title_s` in another.
 */
export function isFieldPathIrrelevant(
	irrelevantFieldPaths: Set<string> | null | undefined,
	fieldId: string,
	parentPath?: string
): boolean {
	if (!irrelevantFieldPaths?.size) return false;
	return irrelevantFieldPaths.has(parentPath ? `${parentPath}.${fieldId}` : fieldId);
}

/**
 * Save still requires these, so `isFieldRelevant` is never asked to hide them.
 * A hidden empty `internal-name` would otherwise block save with an alert for a field the author cannot see.
 */
export const SAVE_MINIMUM_FIELD_IDS = new Set<string>([XmlKeys.fileName, XmlKeys.internalName]);

/** Top-level fields plus one level of repeat subfields, addressed by qualified path. */
function collectRelevanceTargets(fields: ContentTypeField[]): Array<{ path: string; field: ContentTypeField }> {
	const targets: Array<{ path: string; field: ContentTypeField }> = [];
	for (const field of fields) {
		if (SAVE_MINIMUM_FIELD_IDS.has(field.id)) continue;
		targets.push({ path: field.id, field });
		if (field.type === 'repeat' && field.fields) {
			for (const subField of Object.values(field.fields)) {
				if (SAVE_MINIMUM_FIELD_IDS.has(subField.id)) continue;
				targets.push({ path: `${field.id}.${subField.id}`, field: subField });
			}
		}
	}
	return targets;
}

/**
 * Awaits `isFieldRelevant` for each field (and one level of repeat subfields) and returns the
 * qualified paths the controller rejected.
 *
 * Returns `null` when there is no relevance hook (caller should not filter). On rejection/error for
 * a single field, that field stays visible (not added to the deny-list).
 */
export async function resolveIrrelevantFieldIds(
	fields: ContentTypeField[],
	controller: FormController | null | undefined,
	ctx: FormControllerContext | null | undefined,
	dispatch: ReduxDispatch,
	formatMessage: IntlShape['formatMessage']
): Promise<Set<string> | null> {
	if (!controller?.isFieldRelevant || !ctx) {
		return null;
	}
	let failedCount = 0;
	const results = await Promise.all(
		collectRelevanceTargets(fields).map(async ({ path, field }) => {
			try {
				const relevant = await controller.isFieldRelevant!(field, ctx);
				return [path, relevant !== false] as const;
			} catch (error) {
				failedCount += 1;
				console.error(
					`Form controller isFieldRelevant for field "${path}" failed. The field will remain visible.`,
					error
				);
				return [path, true] as const;
			}
		})
	);
	if (failedCount > 0) {
		dispatch(
			showSystemNotification({
				message: formatMessage(
					{
						defaultMessage:
							'{count, plural, one {Form controller isFieldRelevant failed for # field. That field will remain visible.} other {Form controller isFieldRelevant failed for # fields. Those fields will remain visible.}}'
					},
					{ count: failedCount }
				),
				options: { variant: 'error' }
			})
		);
	}
	return new Set(results.filter(([, relevant]) => !relevant).map(([id]) => id));
}

/**
 * Fields offered to `isFieldRelevant`. `file-name` and `internal-name` are never hideable:
 * the save path requires both even when they are not rendered. Repeat / partial forms use `fieldsToRender`.
 */
function collectFieldsForRelevance(contentType: ContentType, formProps: FormControllerFormProps): ContentTypeField[] {
	const fields = formProps.fieldsToRender?.length ? formProps.fieldsToRender : Object.values(contentType.fields);
	return fields.filter((field) => !SAVE_MINIMUM_FIELD_IDS.has(field.id));
}

const commonInitErrorMsg = 'The form will proceed as though no custom type controller exists.';

/**
 * Loads the type's form controller (if gated by `hasJsController`), builds context, awaits
 * `initialize`, resolves field relevance, and stores controller + cleanup on the stack entry.
 *
 * Repeat stacked forms do **not** own a controller: they copy the owning form's already-resolved
 * deny-list (including that form's repeat subfields) and do not call `isFieldRelevant` again.
 */
export async function attachFormController(args: {
	siteId: string;
	store: JotaiStore;
	stackEntry: StableFormContextProps;
	parentStackEntry?: StableFormContextProps | null;
	formProps: FormControllerFormProps;
	dispatch: ReduxDispatch;
	formatMessage: IntlShape['formatMessage'];
	isStale?: () => boolean;
}): Promise<void> {
	const { siteId, store, stackEntry, parentStackEntry, formProps, dispatch, formatMessage, isStale } = args;
	const stale = () => Boolean(isStale?.());
	runFormControllerCleanup(stackEntry);
	stackEntry.formControllerState = null;

	if (formProps.repeat) {
		const state = createEmptyFormControllerState();
		// Resolved once by the owning form, so a repeat item cannot disagree with its parent.
		state.irrelevantFieldPaths = parentStackEntry?.formControllerState?.irrelevantFieldPaths ?? null;
		if (stale()) return;
		stackEntry.formControllerState = state;
		store.set(stackEntry.atoms.relevanceVersion, (version) => version + 1);
		return;
	}

	const contentType = stackEntry.itemMeta?.contentType;
	if (!contentType?.hasJsController) return;

	const loadResult = await loadFormController(siteId, contentType.id);
	if (stale()) return;

	const state = createEmptyFormControllerState();
	state.fileMissing = loadResult.status === 'missing';
	state.loadFailed = loadResult.status === 'failed';
	if (loadResult.status !== 'loaded') {
		stackEntry.formControllerState = state;
		return;
	}

	const controller = loadResult.controller;
	const mode = resolveFormControllerMode(formProps);
	const isEmbedded = Boolean(formProps.create?.embedded || formProps.update?.modelId);
	const ctx = createFormControllerContext({
		siteId,
		store,
		atoms: stackEntry.atoms,
		contentType,
		getPath: () => stackEntry.itemMeta?.path,
		mode,
		isEmbedded,
		fieldUpdates$: stackEntry.fieldUpdates$,
		dispatch,
		fieldChangeUnsubscribers: state.fieldChangeUnsubscribers
	});

	// Commit before `initialize` so stack pop or a replacement attach can reach listeners the
	// hook registers while it is still pending. `cleanup` stays null until the hook returns.
	state.controller = controller;
	state.context = ctx;
	stackEntry.formControllerState = state;

	let ownCleanup: (() => void) | null = null;
	try {
		const cleanup = await controller.initialize?.(ctx);
		ownCleanup = typeof cleanup === 'function' ? cleanup : null;
	} catch (error) {
		console.error(`Form controller initialize for "${contentType.id}" failed. ${commonInitErrorMsg}`, error);
		dispatch(
			showSystemNotification({
				message: formatMessage(
					{
						defaultMessage:
							'Form controller initialize for "{contentTypeId}" failed. The form will proceed as though no custom type controller exists.'
					},
					{ contentTypeId: contentType.id }
				),
				options: { variant: 'error' }
			})
		);
		unsubscribeFieldChangeListeners(state);
		invokeCleanup(ownCleanup);
		// Disposal already tore this entry down. Do not clear a controller a replacement attach installed.
		if (!state.disposed && stackEntry.formControllerState === state) {
			stackEntry.formControllerState = null;
		}
		return;
	}
	if (state.disposed || stale()) {
		// Teardown already ran (or this attach was superseded). Honour the controller's cleanup once,
		// but do not touch whatever state replaced this one.
		unsubscribeFieldChangeListeners(state);
		invokeCleanup(ownCleanup);
		return;
	}
	state.cleanup = ownCleanup;

	const fields = collectFieldsForRelevance(contentType, formProps);
	try {
		state.irrelevantFieldPaths = await resolveIrrelevantFieldIds(fields, controller, ctx, dispatch, formatMessage);
	} catch (error) {
		console.error(
			`Form controller field relevance for "${contentType.id}" failed. All fields will remain visible.`,
			error
		);
		dispatch(
			showSystemNotification({
				message: formatMessage(
					{
						defaultMessage:
							'Form controller field relevance for "{contentTypeId}" failed. All fields will remain visible.'
					},
					{ contentTypeId: contentType.id }
				),
				options: { variant: 'error' }
			})
		);
		state.irrelevantFieldPaths = null;
	}
	if ((stale() || state.disposed) && stackEntry.formControllerState === state) {
		runFormControllerCleanup(stackEntry);
		stackEntry.formControllerState = null;
		return;
	}
	// Validation atoms may already have been read during bootstrap, before this deny-list existed.
	if (stackEntry.formControllerState === state) {
		store.set(stackEntry.atoms.relevanceVersion, (version) => version + 1);
	}
}

/**
 * Owning form for a stacked entry: the nearest non-repeat entry below `stackIndex`.
 * Repeat entries are part of that form, so nested repeats skip other repeats and stop
 * at the first real form (root or embedded child). Returns that form only when it has
 * a controller context; otherwise null — do not keep searching past it.
 */
export function findAncestorFormControllerEntry(
	stack: StableFormContextProps[],
	stackIndex: number
): StableFormContextProps | null {
	for (let i = stackIndex - 1; i >= 0; i--) {
		if (stack[i].props?.repeat) {
			continue;
		}
		return stack[i].formControllerState?.context ? stack[i] : null;
	}
	return null;
}

export interface FormControllerBeforeSaveResult {
	allowed: boolean;
	message?: string;
}

/**
 * Runs the form controller's `onBeforeSave` hook for a stack entry.
 * Repeat entries store no controller, so this returns `{ allowed: true }`.
 */
export async function runFormControllerBeforeSave(
	stackEntry: StableFormContextProps | null | undefined,
	dispatch: ReduxDispatch,
	formatMessage: IntlShape['formatMessage']
): Promise<FormControllerBeforeSaveResult> {
	const controller = stackEntry?.formControllerState?.controller;
	const ctx = stackEntry?.formControllerState?.context;
	if (!controller?.onBeforeSave || !ctx) {
		return { allowed: true };
	}
	try {
		const result = await controller.onBeforeSave(ctx);
		if (result === false) {
			return { allowed: false };
		}
		if (result && typeof result === 'object' && result.ok === false) {
			return { allowed: false, message: result.message };
		}
		return { allowed: true };
	} catch (error) {
		console.error('Form controller onBeforeSave failed. Save was cancelled.', error);
		dispatch(
			showSystemNotification({
				message: formatMessage({
					defaultMessage: 'Form controller onBeforeSave failed. Save was cancelled.'
				}),
				options: { variant: 'error' }
			})
		);
		return { allowed: false };
	}
}
