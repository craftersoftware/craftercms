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

import type { ContentTypeField, ContentTypeSection, PublishPackage } from '../../../models';
import LookupTable from '../../../models/LookupTable';
import ContentType from '../../../models/ContentType';
import validateFieldValue, { FieldValidityState } from './validators';
import { getPropertyValue } from './fieldPropertyUtils';
import { catchError, forkJoin, map, Observable, of, Subject, switchMap } from 'rxjs';
import {
	FieldUpdate,
	FormRequirementsResponse,
	FormsEngineAtoms,
	FormsEngineEditContextProps,
	FormsEngineItemMetaContextProps,
	FormsEngineSourceMap,
	StableFormContextProps,
	StableGlobalContext,
	StableGlobalContextProps
} from './formsEngineContext';
import { fetchContentItem, fetchContentXML, fetchDescriptorXML, lock, unlock } from '../../../services/content';
import { getGlobalHeaders } from '../../../utils/ajax';
import { AjaxError } from 'rxjs/ajax';
import { fetchAffectedPackages } from '../../../services/workflow';
import { Dispatch as ReduxDispatch } from 'redux';
import { IntlShape } from 'react-intl';
import { showSystemNotification, showUnlockItemSuccessNotification } from '../../../state/actions/system';
import { atom, Atom, Getter, PrimitiveAtom, Setter, useAtomValue, useStore as useJotaiStore } from 'jotai';
import React, {
	ReactNode,
	RefObject,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	type SetStateAction
} from 'react';
import { fromString, getInnerHtml, getParsedField } from '../../../utils/xml';
import { nanoid } from 'nanoid';
import { popDialog, pushDialog } from '../../../state/actions/dialogStack';
import alertDialogUrl from '../../../assets/warning.svg';
import PrimaryButton from '../../PrimaryButton';
import { FormattedMessage } from 'react-intl';
import { AlertDialogProps } from '../../AlertDialog';
import { Theme } from '@mui/material/styles';
import { AtomWithStorage, JotaiStore } from '../types';
import {
	ContentTypeNotFoundError,
	InvalidParamsError,
	ItemNotFoundError,
	NoSiteIdError,
	PropsChangedError,
	preservedElements,
	systemFieldsNotInType,
	UnknownError,
	XmlKeys
} from './formConsts';
import { v4 as uuid } from 'uuid';
import { atomWithStorage } from 'jotai/utils';
import { useDispatch } from 'react-redux';
import type { FormsEngineProps } from '../FormsEngine';
import usePreviousValue from '../../../hooks/usePreviousValue';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import useActiveUser from '../../../hooks/useActiveUser';
import { areAllPairsEqual } from '../../../utils/array';
import { deserializeContentDoc } from './valueRetrievers';
import { buildContentXml } from './valueSerializers';
import {
	createFormVisibilityAtoms,
	fieldVisibility,
	aggregateStackFlags,
	hasFormAtoms,
	stackEntryFlagsAtom,
	type FormVisibilityState,
	type LaunchFieldsLookup,
	visibilityFromLaunch
} from './formVisibility';
import { createEmbeddedRelevanceResolver } from '../formControllers/relevance';
import useUpdateRefs from '../../../hooks/useUpdateRefs';
import ApiResponse from '../../../models/ApiResponse';
import {
	getFormsEngineCloseAfterSave,
	getFormsEngineCollapseToCKey,
	getFormsEngineMinimizeAfterSave,
	getFormsEngineReleaseLockOnClose,
	getFormsEngineSaveAsDraft,
	getStoredFormsEngineReleaseLockOnClose
} from '../../../utils/state';
import { createComponentId } from '../../../utils/system';
import { showErrorDialog } from '../../../state/actions/dialogs';
import { ensureSingleSlash } from '../../../utils/string';
import { createObjectGroupId, isPagePath } from '../../../utils/path';
import { nnou, nou } from '../../../utils/object';
import {
	postUnlockKeepalive,
	releaseFormSessionLocks,
	sharedPerUserAtom,
	shouldUnlockOnPageHide,
	unlockErrorPayload,
	unlockStateForEntry,
	type UnlockOnCloseState
} from './unlockOnClose';
import type { DescriptorContentType } from '../../ContentTypeManagement/utils';
import controlDescriptors from '../../ContentTypeManagement/descriptors/controls';

/**
 * Returns the scroll container for the form's container.
 **/
export function getScrollContainer(container: HTMLElement): HTMLElement {
	const mainContent = container.querySelector('[data-area-id="formMainContent"]');
	return mainContent instanceof HTMLElement ? mainContent : container;
}

const focusableControl =
	'input:not([type=hidden]):not([aria-hidden="true"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [role="combobox"], [tabindex="0"]';

/** Attribute selector for a field. Ids are not a closed set, so the value is escaped. */
export function fieldIdSelector(fieldId: string): string {
	return `[data-field-id="${CSS.escape(fieldId)}"]`;
}

function focusField(field: HTMLElement): void {
	const inner = field.querySelector<HTMLElement>(focusableControl);
	const target = inner ?? field;
	if (target === field && !field.hasAttribute('tabindex')) field.tabIndex = -1;
	target.focus({ preventScroll: true });
}

/**
 * Scrolls to a field after the form body layout settles (e.g. lazy controls, RTEs, images).
 * Observes `[data-area-id="formBody"]` — the content that grows — not the fixed-height scroll container.
 * Returns a disposer that cancels pending timers/observers.
 */
export function scrollToFieldWhenSettled(
	root: HTMLElement,
	fieldId: string,
	{ quietMs = 250, maxWaitMs = 2500, focus = false }: { quietMs?: number; maxWaitMs?: number; focus?: boolean } = {}
): () => void {
	const formBody = root.querySelector('[data-area-id="formBody"]');
	const scroll = () => {
		const selector = fieldIdSelector(fieldId);
		const field = formBody ? formBody.querySelector(selector) : root.querySelector(selector);
		if (!(field instanceof HTMLElement)) return;
		field.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
		// Plain `fieldToScroll` passes focus off. A reveal sets it so opening a hidden field moves focus.
		if (focus) focusField(field);
	};

	if (!formBody) {
		scroll();
		return () => undefined;
	}

	let done = false;
	let quietTimer: ReturnType<typeof setTimeout> | undefined;

	const finish = () => {
		if (done) return;
		done = true;
		clearTimeout(quietTimer);
		clearTimeout(maxTimer);
		observer.disconnect();
		scroll();
	};

	const bumpQuiet = () => {
		clearTimeout(quietTimer);
		quietTimer = setTimeout(finish, quietMs);
	};

	const observer = new ResizeObserver(bumpQuiet);
	observer.observe(formBody);
	bumpQuiet();
	const maxTimer = setTimeout(finish, maxWaitMs);

	return () => {
		done = true;
		clearTimeout(quietTimer);
		clearTimeout(maxTimer);
		observer.disconnect();
	};
}

/**
 * Creates a lookup table of section expanded state atoms, indexed by section name (e.g. `{ "Hero": atom(true), "SEO": atom(false) }`)
 */
export const buildSectionExpandedStateAtoms = (contentTypeSections: ContentTypeSection[]) => {
	return contentTypeSections.reduce(
		(sectionExpandedState, section) => {
			sectionExpandedState[section.id] = atom(section.expandByDefault);
			return sectionExpandedState;
		},
		{} as Record<string, PrimitiveAtom<boolean>>
	);
};

export const internalLockContentService: (siteId: string, path: string) => Observable<FormsEngineEditContextProps> = (
	siteId,
	path
) =>
	lock(siteId, path).pipe(
		map(() => ({ locked: true, lockError: null, lockedPath: path })),
		catchError((error: AjaxError) => {
			// switch (error.status) {
			//   case 404: {
			//     throw error;
			//   }
			//   case 409: {
			//     // content already locked...
			//   }
			// }
			return of({ locked: false, lockError: error.response?.response, lockedPath: null });
		}),
		switchMap((lockResult) =>
			fetchAffectedPackages(siteId, path).pipe(
				map((affectedPackages) => ({ ...lockResult, affectedPackages })),
				catchError((error) => of({ ...lockResult, affectedPackages: null, lockError: error.response?.response }))
			)
		)
	);

export const internalUnlockContentService: (siteId: string, path: string) => Observable<FormsEngineEditContextProps> = (
	siteId: string,
	path: string
) =>
	unlock(siteId, path).pipe(
		map(() => ({ locked: false, lockError: null, lockedPath: null })),
		// Still holding the lock. Keep `path` so a later close can release it. The caller shows the error.
		catchError((error: AjaxError) => of({ locked: true, lockError: unlockErrorPayload(error), lockedPath: path }))
	);

export function createSourceMap(descriptorXml: string): FormsEngineSourceMap {
	const descriptorDom = fromString(descriptorXml);
	const sourceMap: FormsEngineSourceMap = {};
	descriptorDom.querySelectorAll(':scope > [crafter-source]').forEach((element) => {
		if (element.innerHTML.trim() === '') {
			// Seen `folder-name` in the descriptor getting inherited in the case of Home.
			// Home's <folder-name /> tag is empty and the merger puts in the level descriptor folder-name — despite it being emtpy too.
			return;
		}
		sourceMap[element.tagName] = element.getAttribute('crafter-source');
	});
	return sourceMap;
}

export const createPathInProject = (fullPath: string) => {
	/* Example:
	 *   item.path = '/site/website/headless-cms-solutions/enterprise/index.xml'
	 *   pieces = item.path.split('/').slice(3)
	 *     ==> ['headless-cms-solutions', 'enterprise', 'index.xml']
	 *   pieces.slice(0, result.length - 2)
	 *     ==> ['headless-cms-solutions'] */
	const pieces = fullPath
		.split('/')
		// .slice(3) removes the first empty string created by the leading slash (''),
		// 'site', and whatever comes after (e.g. 'components' in /site/components,
		// or 'website' in /site/website).
		.slice(3);
	// .slice(0, length - 2) removes the folder name and file name.
	// In the case of no folder name, it will return an empty string.
	return `/${pieces.slice(0, pieces.length - 2).join('/')}/`.replace(/\/+/g, '/');
};

export const displayFormBeingSavedSnack = (dispatch: ReduxDispatch, formatMessage: IntlShape['formatMessage']) => {
	dispatch(
		showSystemNotification({ message: formatMessage({ defaultMessage: 'Content is being saved, please wait...' }) })
	);
};

/** Calculates the height for the main form wrapper */
export const getTargetHeight = (isDialog: boolean, isFullScreen: boolean, theme: Theme) =>
	isDialog ? `calc(100vh - ${isFullScreen ? 0 : theme.spacing(4)})` : '100%';

export type ValidatorsData = {
	/** The fields belong to a nested scope (a repeat item form). See {@link ValidatorMetaData.nested}. */
	nested?: boolean;
	siteId?: string;
	contentTypesById?: LookupTable<ContentType>;
	siblingIds?: string[];
	/** IDs belonging to the field/data source being edited (for example fieldId + additionalFieldId(s)); excluded from duplicate checks. */
	currentIds?: string[];
	/** `additionalFields` templates from the field's descriptor; expands the candidate variable name. */
	additionalFields?: string[];
	/**
	 * Site-config variable-name postfix rules for a top-level Type Builder field form.
	 * Omitted for nested fields, data sources, and when `<field-name-postfix>` is not `true`.
	 */
	fieldNamePostfix?: {
		enabled: boolean;
		ignoreFields: string[];
		suffixes: string[];
	};
	/** Resolves an embedded component's own form-controller deny-list. See `formControllers/relevance.ts`. */
	resolveEmbeddedRelevance?: (
		contentType: ContentType,
		component: Record<string, unknown>,
		path?: string
	) => Promise<Set<string> | null>;
};

type FieldTrackingContext = Pick<
	StableFormContextProps,
	'fieldUpdates$' | 'changedFieldIds' | 'originalValues' | 'atoms' | 'itemMeta' | 'formControllerState'
>;

/**
 * The shared "nothing changed" set. Set it on {@link ChangedFieldIdsAtom} to clear every changed marker (a save
 * checkpoint, a Type Builder commit), and {@link withChangedField} returns it when the last id is removed, so
 * "nothing changed" is always this one reference.
 *
 * Never add to it. `Object.freeze` does not stop a `Set` from being mutated; the `ReadonlySet` type is what keeps it
 * empty, so treat every changed-ids set as immutable.
 *
 * @example
 * ```ts
 * store.set(stableFormContext.changedFieldIds, EMPTY_CHANGED_FIELD_IDS);
 * ```
 */
export const EMPTY_CHANGED_FIELD_IDS: ReadonlySet<string> = Object.freeze(new Set<string>());

/**
 * The atom behind {@link StableFormContextProps.changedFieldIds}: the source of truth for which fields differ from
 * the last checkpoint. It holds an immutable set whose reference changes only when membership changes, so a write
 * that leaves the membership alone notifies nothing. Insertion order is the order fields were first changed
 * (`generateDefaultChangesComment` treats the last one as "last added").
 *
 * - Components: subscribe through the cached per-field {@link changedFieldAtom}, not by reading this atom, so only the
 *   affected field re-renders.
 * - Imperative code (save, Type Builder commit): `store.get(atom)`.
 * - Writes: build the next set with {@link withChangedField}. Never mutate the stored set. Clear with
 *   {@link EMPTY_CHANGED_FIELD_IDS}.
 *
 * This is state. The internal `fieldUpdates$` stream is the event side: it announces each value write after this atom
 * is updated, and does not announce clears.
 *
 * @see {@link StableFormContextProps.fieldUpdates$}
 */
export type ChangedFieldIdsAtom = PrimitiveAtom<ReadonlySet<string>>;

/**
 * Creates a changed-ids atom, starting at {@link EMPTY_CHANGED_FIELD_IDS}. One per form stack entry. Atoms are not
 * tied to a store, so creating one has no side effects.
 *
 * @example
 * ```ts
 * const changedFieldIds = createChangedFieldIdsAtom();
 * store.get(changedFieldIds) === EMPTY_CHANGED_FIELD_IDS; // true
 * ```
 *
 * @see {@link ChangedFieldIdsAtom}
 */
export function createChangedFieldIdsAtom(): ChangedFieldIdsAtom {
	return atom(EMPTY_CHANGED_FIELD_IDS);
}

const changedFieldAtomsByIds = new WeakMap<ChangedFieldIdsAtom, Map<string, Atom<boolean>>>();
// A context created without the atom (Type Builder's read-only chips) has nothing to track.
const neverChanged: Atom<boolean> = atom(false);

/**
 * Whether `fieldId` differs from the last checkpoint: a derived boolean atom over the changed-ids atom. Cached per
 * changed-ids atom and field id (like the value and validation atoms), so the same call returns the same atom, and
 * a subscriber is notified only when its own flag flips, not when another field is added or removed.
 *
 * This is the way React components read the changed state. Imperative code reads the changed-ids atom with
 * `store.get` instead. Pass `null` (Type Builder's read-only chips have no changed-ids atom) to get a constant
 * `false` atom.
 *
 * @example
 * ```tsx
 * // In a component: re-renders only when this field's flag flips
 * const hasChanges = useAtomValue(changedFieldAtom(stableForm.changedFieldIds, field.id));
 * ```
 *
 * @param changedFieldIds The form's changed-ids atom, or null/undefined when the form tracks nothing.
 * @param fieldId The field to watch.
 * @see {@link ChangedFieldIdsAtom}
 */
export function changedFieldAtom(
	changedFieldIds: ChangedFieldIdsAtom | null | undefined,
	fieldId: string
): Atom<boolean> {
	if (!changedFieldIds) return neverChanged;
	let byField = changedFieldAtomsByIds.get(changedFieldIds);
	if (!byField) {
		byField = new Map();
		changedFieldAtomsByIds.set(changedFieldIds, byField);
	}
	let fieldAtom = byField.get(fieldId);
	if (!fieldAtom) {
		fieldAtom = atom((get) => get(changedFieldIds).has(fieldId));
		byField.set(fieldId, fieldAtom);
	}
	return fieldAtom;
}

/**
 * The next changed-ids set after `fieldId` was found changed or not. This is how a writer updates the set: it never
 * mutates `ids`.
 *
 * Returns `ids` itself (same reference) when the membership already matches, so the caller can skip the write and
 * nothing is notified. Otherwise returns a copy with `fieldId` added last (insertion order is preserved) or removed,
 * and {@link EMPTY_CHANGED_FIELD_IDS} when the copy would be empty.
 *
 * @example
 * ```ts
 * const current = get(changedFieldIds);
 * const next = withChangedField(current, field.id, value !== original);
 * if (next !== current) set(changedFieldIds, next);
 * ```
 *
 * @param ids The current set. Not modified.
 * @param fieldId The field whose state was just evaluated.
 * @param changed Whether the field now differs from the checkpoint.
 */
export function withChangedField(ids: ReadonlySet<string>, fieldId: string, changed: boolean): ReadonlySet<string> {
	if (ids.has(fieldId) === changed) return ids;
	const next = new Set(ids);
	if (changed) next.add(fieldId);
	else next.delete(fieldId);
	return next.size === 0 ? EMPTY_CHANGED_FIELD_IDS : next;
}

/**
 * Records whether `field` differs from the value it was opened with, by updating the changed-ids atom (only when the
 * membership changes; see {@link withChangedField}).
 * `file-name` is compared to the original path; every other field is compared to `originalValues`.
 * Callers pass the value just written, and call this before emitting on `fieldUpdates$` so synchronous subscribers
 * read the new set. It does not emit — the writer does that once.
 */
function trackFieldChange(
	field: ContentTypeField,
	value: unknown,
	formContext: FieldTrackingContext,
	get: Getter,
	set: Setter
): void {
	let changed: boolean;
	if (field.id === XmlKeys.fileName) {
		const currentFileName = value as string;
		const originalPath = formContext.itemMeta.path;
		if (nou(originalPath)) {
			// If no originalPath exists => creating content
			changed = Boolean(currentFileName);
		} else {
			// If originalPath exists, validate if differs from original value
			const originalFileName = getFileNameValueFromPath(originalPath, isPagePath(originalPath));
			changed = currentFileName !== originalFileName;
		}
	} else {
		changed = value !== formContext.originalValues[field.id];
	}
	const current = get(formContext.changedFieldIds);
	const next = withChangedField(current, field.id, changed);
	if (next !== current) set(formContext.changedFieldIds, next);
}

/** Makes `values` the checkpoint that edits are compared with, and clears every changed marker. */
export function applyValuesCheckpoint(
	context: Pick<StableFormContextProps, 'originalValues' | 'changedFieldIds'>,
	values: LookupTable<unknown>,
	set: Setter
): void {
	context.originalValues = values;
	set(context.changedFieldIds, EMPTY_CHANGED_FIELD_IDS);
}

function applyAtomUpdate<T>(
	get: (atom: PrimitiveAtom<T>) => T,
	baseAtom: PrimitiveAtom<T>,
	update: SetStateAction<T>
): T {
	return typeof update === 'function' ? (update as (prev: T) => T)(get(baseAtom)) : update;
}

/**
 * Filename atom whose writes update dirty-tracking and emit `fieldUpdates$` once.
 * Also mirrors `valueByFieldId['file-name']` when that atom exists, without a second event:
 * the field atom's writer does not emit for `file-name`.
 */
function createTrackedFileNameAtom(
	initialFileName: string,
	formContextRef: RefObject<FieldTrackingContext>
): PrimitiveAtom<string> {
	const baseAtom = atom(initialFileName);
	return atom(
		(get) => get(baseAtom),
		(get, set, update: SetStateAction<string>) => {
			const next = applyAtomUpdate(get, baseAtom, update);
			set(baseAtom, next);
			const formContext = formContextRef.current;
			const valueAtom = formContext.atoms?.valueByFieldId?.[XmlKeys.fileName] as PrimitiveAtom<unknown> | undefined;
			// Guard so the field atom's writer can call back into this atom without looping.
			if (valueAtom && get(valueAtom) !== next) {
				set(valueAtom, next);
			}
			const field =
				formContext.itemMeta?.contentType?.fields?.[XmlKeys.fileName] ?? ({ id: XmlKeys.fileName } as ContentTypeField);
			trackFieldChange(field, next, formContext, get, set);
			formContext.fieldUpdates$.next({ fieldId: XmlKeys.fileName });
		}
	);
}

/**
 * Creates the value and validity atoms for a give field.
 * Dirty-tracking and `fieldUpdates$` run from the value write, not from validation.
 * `file-name` is the exception: the dedicated filename atom emits for it, so this writer only stores.
 **/
export function createFieldAtoms(
	field: ContentTypeField,
	initialValue: unknown,
	formContextRef: RefObject<FieldTrackingContext>,
	validatorsData?: ValidatorsData
): [PrimitiveAtom<unknown>, Atom<Promise<FieldValidityState>>] {
	const baseAtom = atom(initialValue);
	const valueAtom = atom(
		(get) => get(baseAtom),
		(get, set, update: SetStateAction<unknown>) => {
			const next = applyAtomUpdate(get, baseAtom, update);
			set(baseAtom, next);
			const formContext = formContextRef.current;
			if (field.id === XmlKeys.fileName) {
				const fileNameAtom = formContext.atoms?.fileName as PrimitiveAtom<string> | undefined;
				if (fileNameAtom && get(fileNameAtom) !== next) {
					set(fileNameAtom, next as string);
				}
				return;
			}
			trackFieldChange(field, next, formContext, get, set);
			formContext.fieldUpdates$.next({ fieldId: field.id });
		}
	);
	const validationAtom = atom(async (get, { signal }) => {
		// Relevance is stored after these atoms are created. Depending on the version forces a fresh verdict.
		const relevanceVersion = formContextRef.current.atoms?.relevanceVersion;
		if (relevanceVersion) get(relevanceVersion);
		const value = get(valueAtom);
		return validateFieldValue(field, value, {
			nested: validatorsData?.nested,
			siteId: validatorsData?.siteId,
			contentTypesById: validatorsData?.contentTypesById,
			siblingIds: validatorsData?.siblingIds,
			currentIds: validatorsData?.currentIds,
			additionalFields: validatorsData?.additionalFields,
			fieldNamePostfix: validatorsData?.fieldNamePostfix,
			signal,
			itemMeta: formContextRef.current.itemMeta as FormsEngineItemMetaContextProps,
			// Read at validation time. `validatorsData` is captured at bootstrap, before relevance exists.
			irrelevantFieldPaths: formContextRef.current.formControllerState?.irrelevantFieldPaths,
			resolveEmbeddedRelevance: validatorsData?.resolveEmbeddedRelevance,
			// Item-count fields compare min and max. Reading the partner subscribes this atom to it.
			getValue: (fieldId: string) => {
				const valueByFieldId = formContextRef.current.atoms?.valueByFieldId;
				// Own ids only. `constructor` or `toString` is not a field.
				const partner = valueByFieldId && Object.hasOwn(valueByFieldId, fieldId) ? valueByFieldId[fieldId] : undefined;
				return partner ? get(partner) : undefined;
			}
		});
	});
	return [valueAtom, validationAtom];
}

/** Creates the readonly flag property atom based on the lock result atom */
export const createReadonlyAtom = (lockedResultAtom: Atom<FormsEngineEditContextProps>) =>
	atom((get) => !get(lockedResultAtom).locked);

/**
 * Creates a Jotai atom for the file name based on the given path.
 * Writes update dirty-tracking and emit on `fieldUpdates$` (see {@link createTrackedFileNameAtom}).
 *
 * @param path - Full item path. `''` starts the atom empty (create / repeat, where there is no path yet).
 * @param initialValue - Used as-is when the filename is not derived from a path (embedded forms seed the model id).
 */
export function createFileNameAtom(
	path: string,
	formContextRef: RefObject<FieldTrackingContext>,
	initialValue?: string
): PrimitiveAtom<string> {
	const initial = initialValue ?? fileNameFromItemPath(path);
	return createTrackedFileNameAtom(initial, formContextRef);
}

/** Site root index. Its file name is fixed, so a blank file name is allowed there. */
export const rootPagePath = '/site/website/index.xml';

/**
 * File name for an item path. {@link createFileNameAtom} starts here when no initial value is given, and
 * {@link setFieldAtoms} starts the `file-name` field's value from it, so the two cannot drift.
 * The home page, and a form that has no path yet, are blank.
 */
export function fileNameFromItemPath(path?: string | null): string {
	if (!path) return '';
	return getFileNameValueFromPath(path, isPagePath(path));
}

/**
 * Retrieves the base path from a given file path.
 *
 * @param {string} path - The full file path to process.
 * @param {boolean} isPage - A flag indicating whether the path corresponds to a page.
 * @returns {string} - The base path extracted from the input path.
 *
 */
export const getBasePath = (path: string, isPage: boolean): string => {
	// If home page
	if (path === rootPagePath && isPage) return '/site/website/';

	const pathParts = path.split('/');
	return isPage
		? pathParts.slice(0, pathParts.length - 2).join('/') + '/'
		: pathParts.slice(0, pathParts.length - 1).join('/') + '/';
};

/**
 * Extracts the file name from a given file path.
 *
 * @param {string} path - The full file path to process.
 * @param {boolean} isPage - A flag indicating whether the path corresponds to a page.
 * @returns {string} - The file name extracted from the path. Returns an empty string if the path corresponds to the home page.
 *
 */
export const getFileNameValueFromPath = (path: string, isPage: boolean): string => {
	// If home page, return empty string
	if (path === rootPagePath && isPage) return '';

	const basePath = getBasePath(path, isPage);
	return path.replace(basePath, '').replace(isPage ? '/index.xml' : '.xml', '');
};

/**
 * Computes the full path for a file based on its name, type, and base path.
 *
 * @param {string} fileName - The name of the file (without extension or directory).
 * @param {boolean} isPage - A flag indicating whether the file represents a page.
 * @param {string} basePath - The base path of the file.
 * @returns {string} - The computed full path for the file.
 *
 */
export const computePathFromFileName = (fileName: string, isPage: boolean, basePath: string): string => {
	const fullFileName = isPage ? `${fileName}/index.xml` : `${fileName}.xml`;
	return ensureSingleSlash(`${basePath}/${fullFileName}`);
};

/**
 * A new stack entry's data: no atoms yet, an empty changed-ids atom ({@link createChangedFieldIdsAtom}) and a new
 * `fieldUpdates$` stream of {@link FieldUpdate}s. `mixin` overrides any of the defaults.
 */
export function createFormStackData(mixin?: Partial<StableFormContextProps>): StableFormContextProps {
	const data: StableFormContextProps = {
		atoms: null,
		itemFormMode: null,
		changedFieldIds: createChangedFieldIdsAtom(),
		fieldUpdates$: new Subject<FieldUpdate>(),
		itemMeta: null,
		originalValues: null,
		props: null,
		state: null,
		affectedPluginControlFields: [],
		formControllerState: null,
		getItem: () => null,
		...mixin
	};
	return data;
}

// TODO: This is useful for the whole system. Move.
export function showAlert({
	message,
	children,
	dispatch
}: {
	message?: string;
	children?: ReactNode;
	dispatch: ReduxDispatch;
}) {
	const id = nanoid();
	dispatch(
		pushDialog({
			id,
			component: createComponentId('AlertDialog'),
			allowFullScreen: false,
			allowMinimize: false,
			props: {
				body: message,
				children,
				imageUrl: alertDialogUrl,
				sxs: { image: { pb: 1 } },
				buttons: (
					<PrimaryButton fullWidth autoFocus onClick={() => dispatch(popDialog({ id }))}>
						<FormattedMessage defaultMessage="Accept" />
					</PrimaryButton>
				)
			} as Partial<AlertDialogProps>
		})
	);
}

export function useShowAlert() {
	const dispatch = useDispatch();
	return (messageOrProps: string | Omit<Parameters<typeof showAlert>[0], 'dispatch'>) => {
		const props = typeof messageOrProps === 'string' ? { message: messageOrProps } : messageOrProps;
		showAlert({ ...props, dispatch });
	};
}

/** Retrieves the value of an atom from the supplied jotai store */
export const getFieldAtomValue = (atom: Atom<unknown>, store: JotaiStore) => store.get(atom);

/**
 * Retrieves the values from the form atoms and returns them in a lookup table.
 */
export const extractAtomValues: (store: JotaiStore, valueAtoms: LookupTable<Atom<unknown>>) => LookupTable<unknown> = (
	store,
	valueAtoms
) =>
	Object.entries(valueAtoms).reduce((values, [fieldId, valueAtom]) => {
		values[fieldId] = store.get(valueAtom);
		return values;
	}, {});

/**
 * Fields for the save / invalid-form snapshot.
 * The deny-list is qualified (`repeatFieldId.subFieldId`). Only the unqualified entry applies
 * at this form's level, unless `parentPath` names the repeat group these atoms belong to.
 * Atoms the controller never rejected (descriptor additional fields, `folder-name`, …) stay.
 * Out-of-scope fields stay in the list.
 */
export function relevantFieldValidations(
	validationByFieldId: LookupTable<Atom<Promise<FieldValidityState>>>,
	irrelevantFieldPaths: ReadonlySet<string> | null | undefined,
	parentPath?: string
): Array<{ fieldId: string; atom: Atom<Promise<FieldValidityState>> }> {
	return Object.entries(validationByFieldId).flatMap(([fieldId, atom]) =>
		fieldVisibility({ fieldId, irrelevantFieldPaths, parentPath, scopeFieldIds: null }) === 'irrelevant'
			? []
			: [{ fieldId, atom }]
	);
}

/**
 * The verdict of the latest validation run. A run that is superseded while it is awaited (a value it reads changed)
 * is aborted and its result is discarded, so a validator that stops on abort can't make the field look invalid.
 */
async function readSettledValidity(
	store: { get<Value>(atom: Atom<Value>): Value },
	validityAtom: Atom<Promise<FieldValidityState>>
): Promise<FieldValidityState> {
	let pending = store.get(validityAtom);
	for (;;) {
		const state = await pending;
		const latest = store.get(validityAtom);
		if (latest === pending) return state;
		pending = latest;
	}
}

/** Live invalid field ids. The alert and a selected-item save both read through this. */
export async function readInvalidFieldIds(
	store: { get<Value>(atom: Atom<Value>): Value },
	validationByFieldId: LookupTable<Atom<Promise<FieldValidityState>>> | undefined,
	irrelevantFieldPaths: ReadonlySet<string> | null | undefined,
	parentPath?: string
): Promise<string[]> {
	if (!validationByFieldId) return [];
	const fields = relevantFieldValidations(validationByFieldId, irrelevantFieldPaths, parentPath);
	const states = await Promise.all(fields.map(({ atom: validityAtom }) => readSettledValidity(store, validityAtom)));
	return fields.flatMap(({ fieldId }, index) => (states[index]?.isValid ? [] : [fieldId]));
}

export function getValidationAtomsExcludingIrrelevant(
	validationByFieldId: LookupTable<Atom<Promise<FieldValidityState>>>,
	irrelevantFieldPaths: ReadonlySet<string> | null | undefined,
	parentPath?: string
): Array<Atom<Promise<FieldValidityState>>> {
	return relevantFieldValidations(validationByFieldId, irrelevantFieldPaths, parentPath).map(({ atom }) => atom);
}

/**
 * Retrieves all the data requirements to show an update form
 * TODO: Create a backend API to fetch this data at once.
 */
export function fetchUpdateRequirements({
	siteId,
	path,
	modelId,
	readonly,
	contentTypesById,
	changeTypeId
}: {
	siteId: string;
	path: string;
	modelId: string;
	readonly: boolean;
	contentTypesById: LookupTable<ContentType>;
	changeTypeId?: string;
}): Observable<FormRequirementsResponse> {
	// Good to start with the lock so that posterior fetch of the item comes with the lock status. If we need
	// to fetch the content type, will need the item first to determine its content type id, but currently relying
	// on a separate load for all content types. Alternatively, we could fetch all types here too if we get a form
	// requirements service.
	return (
		readonly
			? of({
					locked: false,
					lockError: null,
					affectedPackages: null,
					lockedPath: null
				} as FormsEngineEditContextProps)
			: internalLockContentService(siteId, path)
	).pipe(
		switchMap((lockResult) =>
			forkJoin([
				fetchContentItem(siteId, path),
				of(lockResult),
				// TODO: Check if these two are redundant
				fetchContentXML(siteId, path),
				fetchDescriptorXML(siteId, path, { flatten: false })
				// TODO: Assess removal:
				// fetchConfigurationXML(siteId, `/content-types${item.contentTypeId}/form-definition.xml`, 'studio'),
				// fetchContentType(siteId, item.contentTypeId),
				// of(null)
				// importPlugin({
				//   site: siteId,
				//   type: 'examples',
				//   name: 'forms-engine',
				//   file: 'index.js',
				//   id: 'org.craftercms'
				// }).catch(() => null)
			])
		),
		map(([item, lockResult, contentXml, descriptorXml]) => {
			let contentType = contentTypesById[changeTypeId ?? item.contentTypeId];
			if (!contentType) {
				throw ContentTypeNotFoundError;
			}
			let contentDom: XMLDocument | Element = fromString(contentXml);
			if (modelId) {
				contentDom = contentDom.querySelector(`[id="${modelId}"]`);
				contentType = contentTypesById[getInnerHtml(contentDom.querySelector(':scope > content-type'))];
			}
			const contentObject = deserializeContentDoc(contentDom);
			const sourceMap = createSourceMap(descriptorXml);
			const props: FormRequirementsResponse = {
				item,
				contentXml,
				contentObject,
				sourceMap,
				locked: lockResult.locked,
				lockError: lockResult.lockError,
				affectedPackages: lockResult.affectedPackages,
				lockedPath: lockResult.locked ? (lockResult.lockedPath ?? path) : null,
				// If opening as readonly, lock result is of no consequence. If opened for edit, will set to readonly
				// if there was an error locking the content (the item is not locked).
				// readonly: readonly || !lockResult.locked,
				contentType,
				pathInSite: createPathInProject(path)
			};
			return props;
		})
	);
}

/**
 * Creates a FormsEngineAtoms object with default values. Allows overriding defaults via `mixin` argument.
 **/
export function createFormsEngineAtoms(
	username: string,
	mixin: Partial<FormsEngineAtoms> & Pick<FormsEngineAtoms, 'readonly' | 'lockResult' | 'fileName'>,
	launch?: {
		selectedFields?: readonly string[];
		index?: string | number;
		fields: LaunchFieldsLookup;
	}
): FormsEngineAtoms {
	const visibility = visibilityFromLaunch(launch);
	const atoms: FormsEngineAtoms = {
		isSubmitting: atom(false),
		hasPendingChanges: atom(false),
		valueByFieldId: {},
		validationByFieldId: {},
		versionComment: atom(''),
		expandedStateBySectionId: {},
		tableOfContentsDrawerOpen: atom(false),
		isLargeContainer: atom(false),
		useCollapsedToC: atom((get) => (get(atoms.isLargeContainer) ? get(atoms.collapseToC) : true)),
		collapseToC: atomWithStorage(getFormsEngineCollapseToCKey(username), false, undefined, {
			getOnInit: true
		}) as unknown as AtomWithStorage,
		closeAfterSave: atomWithStorage(getFormsEngineCloseAfterSave(username), true, undefined, {
			getOnInit: true
		}) as unknown as AtomWithStorage,
		minimizeAfterSave: atomWithStorage(getFormsEngineMinimizeAfterSave(username), false, undefined, {
			getOnInit: true
		}) as unknown as AtomWithStorage,
		// One atom per user. A second form must not keep its own copy or a toggle on a stacked form is invisible to the root.
		releaseLockOnClose: sharedPerUserAtom(
			getFormsEngineReleaseLockOnClose(username),
			() =>
				atomWithStorage(getFormsEngineReleaseLockOnClose(username), true, undefined, {
					getOnInit: true
				}) as unknown as AtomWithStorage
		),
		// False or absent is Save. One atom per user, same as the release-lock switch.
		saveAsDraft: sharedPerUserAtom(
			getFormsEngineSaveAsDraft(username),
			() =>
				atomWithStorage(getFormsEngineSaveAsDraft(username), false, undefined, {
					getOnInit: true
				}) as unknown as AtomWithStorage
		),
		...mixin,
		relevanceVersion: atom(0),
		...createFormVisibilityAtoms(visibility.state, visibility.scrollFieldId)
	};
	return atoms;
}

/** The one write for a visibility change: scope notice, View in form, and a hidden-invalid save. */
export function commitFormVisibility(
	set: <Value>(atom: PrimitiveAtom<Value>, value: Value) => void,
	atoms: {
		formVisibility: PrimitiveAtom<FormVisibilityState>;
		pendingScrollFieldId: PrimitiveAtom<string | null>;
		pendingScrollFocus: PrimitiveAtom<boolean>;
	},
	next: FormVisibilityState,
	scrollFieldId?: string
): void {
	set(atoms.formVisibility, next);
	if (scrollFieldId) {
		set(atoms.pendingScrollFieldId, scrollFieldId);
		set(atoms.pendingScrollFocus, true);
	}
}

/**
 * The values a form opened with, for `originalValues`. Rollback writes them back, so the `file-name` entry is the
 * path-derived name {@link setFieldAtoms} starts the field from, not the XML element. Otherwise rolling back an
 * untouched form would rename the item.
 *
 * Same rule as `setFieldAtoms`: only a form that has an item path is normalized. `path` is `''` for a create form,
 * and `undefined`/`null` for a nested scope such as a repeat item form, whose `file-name` field, if it has one, is its
 * own value and is returned as is. Values with no `file-name` are returned as is too.
 */
export function withPathFileName(
	values: LookupTable<unknown>,
	atoms: Pick<FormsEngineAtoms, 'fileName'> | null | undefined,
	path?: string | null
): LookupTable<unknown> {
	return atoms?.fileName && path != null && XmlKeys.fileName in values
		? { ...values, [XmlKeys.fileName]: fileNameFromItemPath(path) }
		: values;
}

/**
 * Creates the value and validity atoms for a field and sets them on to the target object.
 *
 * @param itemPath - Full path of the item being edited. Only the `file-name` field reads it, to start its value
 * from the same name {@link createFileNameAtom} derives. Omit it for a form with no path yet (create).
 **/
export function setFieldAtoms(
	stableFormContextRef: RefObject<StableFormContextProps>,
	contentType: ContentType,
	fieldLookup: LookupTable<ContentTypeField>,
	fieldId: string,
	atomsTarget: FormsEngineAtoms,
	value: unknown,
	validatorsData?: ValidatorsData,
	isAdditional?: boolean,
	itemPath?: string | null
): void {
	let field = fieldLookup[fieldId];
	if (!field) {
		// TODO: Discuss `folder-name`. When should it be here, when not? Could/should we remove?
		if (fieldId === 'folder-name') {
			field = {
				defaultValue: undefined,
				description: '',
				fields: undefined,
				helpText: '',
				properties: undefined,
				sortable: false,
				type: '',
				validations: undefined,
				values: undefined,
				id: 'folder-name',
				name: 'Folder Name'
			};
		} else if (isAdditional) {
			field = {
				defaultValue: undefined,
				description: '',
				fields: undefined,
				helpText: '',
				properties: undefined,
				sortable: false,
				type: '',
				validations: undefined,
				values: undefined,
				id: fieldId,
				name: fieldId
			};
		} else {
			!systemFieldsNotInType.includes(fieldId) &&
				console.warn(`Field ${fieldId} not found in content type "${contentType.name}" (${contentType.id})`);
			return;
		}
	}
	// The file-name field has two sources: the `file-name` element in the XML, and the item path, which the
	// file-name atom, rename and save use. They can disagree at load, for example on legacy or migrated content,
	// after a rename done outside the form, or when the element is missing.
	// `fileNameValidator` validates only the field's own value (#9327 removed `fileName` from the validator
	// context), so the value must start from the path. Starting from the XML would validate a name that save
	// never uses.
	// Decision: the path wins. On edit the form shows and validates the path-derived name. Save leaves `file-name`
	// out of the XML it builds, so a differing XML element is omitted on the next save. The backend writes it
	// again only on a copy collision.
	// Only a form with an item path starts here. A nested scope (repeat item) passes none and keeps its value.
	const initialValue =
		fieldId === XmlKeys.fileName && atomsTarget.fileName && itemPath != null ? fileNameFromItemPath(itemPath) : value;
	const [valueAtom, validityAtom] = createFieldAtoms(field, initialValue, stableFormContextRef, validatorsData);
	atomsTarget.valueByFieldId[fieldId] = valueAtom;
	atomsTarget.validationByFieldId[fieldId] = validityAtom;
}

export type SystemPropsObject = Pick<
	Record<XmlKeys, string | boolean>,
	| XmlKeys.modelId
	| XmlKeys.groupId
	| XmlKeys.internalName
	| XmlKeys.contentTypeId
	| XmlKeys.displayTemplate
	| XmlKeys.templateNotRequired
	| XmlKeys.mergeStrategy
	| XmlKeys.dateCreated
	| XmlKeys.dateCreatedDt
	| XmlKeys.dateModified
	| XmlKeys.dateModifiedDt
	| XmlKeys.savedAsDraft
	| XmlKeys.disabled
	| XmlKeys.placeInNav
	| XmlKeys.navLabel
>;

/** System props written by {@link createObjectWithSystemProps} (excludes optional nav/disabled fields). */
export type CreatedSystemPropsObject = Omit<
	SystemPropsObject,
	XmlKeys.disabled | XmlKeys.placeInNav | XmlKeys.navLabel
>;

/**
 * Creates an object with all the base content item system props (objectId, content-type, etc.)
 * Assigns the supplied values if provided.
 * Does not include `disabled`, `placeInNav`, or `navLabel`.
 **/
export function createObjectWithSystemProps(
	contentType: ContentType,
	mixin?: Partial<SystemPropsObject>
): CreatedSystemPropsObject {
	const dateIsoString = new Date().toISOString();
	const objectId = (mixin?.[XmlKeys.modelId] as string) ?? uuid();
	const contentObject: CreatedSystemPropsObject = {
		[XmlKeys.modelId]: objectId,
		[XmlKeys.groupId]: mixin?.[XmlKeys.groupId] ?? createObjectGroupId(objectId),
		[XmlKeys.internalName]: mixin?.[XmlKeys.internalName] ?? '',
		[XmlKeys.contentTypeId]: contentType.id,
		[XmlKeys.displayTemplate]: contentType.displayTemplate ?? '',
		[XmlKeys.templateNotRequired]: contentType.displayTemplate ? 'false' : 'true',
		[XmlKeys.mergeStrategy]: contentType.mergeStrategy ?? 'inherit-levels',
		[XmlKeys.dateCreated]: mixin?.[XmlKeys.dateCreated] ?? dateIsoString,
		[XmlKeys.dateCreatedDt]: mixin?.[XmlKeys.dateCreatedDt] ?? dateIsoString,
		[XmlKeys.dateModified]: mixin?.[XmlKeys.dateModified] ?? dateIsoString,
		[XmlKeys.dateModifiedDt]: mixin?.[XmlKeys.dateModifiedDt] ?? dateIsoString,
		[XmlKeys.savedAsDraft]: mixin?.[XmlKeys.savedAsDraft] ?? 'false'
	};
	return contentObject;
}

/** Adds the system props and preserved elements that `values` doesn't have. Values already there are kept. */
export function complementValuesWithSystemProps(
	id: string,
	values: LookupTable<unknown>,
	contentObject: LookupTable<unknown>,
	contentType: ContentType,
	saveAsDraft: boolean
): void {
	const systemProps = createObjectWithSystemProps(contentType, {
		[XmlKeys.modelId]: id,
		[XmlKeys.internalName]: values[XmlKeys.internalName] as string,
		[XmlKeys.dateCreated]: getParsedField(contentObject, XmlKeys.dateCreated) as string,
		[XmlKeys.dateCreatedDt]: getParsedField(contentObject, XmlKeys.dateCreatedDt) as string,
		[XmlKeys.savedAsDraft]: saveAsDraft
	});

	// Do not overwrite any existing value.
	preservedElements.forEach((key) => {
		if (!(key in values) && nnou(contentObject[key])) {
			values[key] = contentObject[key];
		}
	});
	for (const key in systemProps) {
		if (!(key in values)) {
			values[key] = systemProps[key];
		}
	}
}

export function produceChangedFieldsMessage(changedFieldNames: string[]): string {
	if (changedFieldNames.length === 0) return '';
	return changedFieldNames.length > 1
		? `Updated ${changedFieldNames.slice(0, -1).join(', ')} and ${changedFieldNames[changedFieldNames.length - 1]}`
		: `Updated ${changedFieldNames[changedFieldNames.length - 1]}`;
}

/**
 * Inspects the form props, and that there is an active siteId, to ensure validity and ability to render a form correctly.
 **/
export function useValidateFormProps(props: Partial<FormsEngineProps>): void {
	const siteId = useActiveSiteId();
	const previousProps = usePreviousValue(props);
	const propsChangedRef = useRef(false);
	const { create, update, repeat, fieldIds, repeatIndex, readonly } = props;
	if (!siteId) {
		throw NoSiteIdError;
	} else if (
		// Missing or bad combination of props
		[create, update, repeat].filter(Boolean).length !== 1 ||
		// Update prop but no path
		(update && !update.path?.trim()) ||
		// Create prop but no path or content type id
		(create && (!create.path?.trim() || !create.contentTypeId?.trim())) ||
		// Repeat prop but no field id
		(repeat && !repeat.fieldId?.trim())
	) {
		throw InvalidParamsError;
	} else if (
		propsChangedRef.current ||
		(previousProps &&
			// Note: Make sure to include all relevant props here
			!areAllPairsEqual([
				[create, previousProps.create],
				[fieldIds, previousProps.fieldIds],
				[repeatIndex, previousProps.repeatIndex],
				[readonly, previousProps.readonly],
				[repeat?.fieldId, previousProps.repeat?.fieldId],
				[repeat?.values, previousProps.repeat?.values],
				[update?.modelId, previousProps.update?.modelId],
				[update?.path, previousProps.update?.path],
				[update?.values, previousProps.update?.values]
			]))
	) {
		propsChangedRef.current = true;
		throw PropsChangedError;
	}
}

/**
 * Inspects the error symbol and returns a message to display to the user.
 **/
export function getMessageForErrorSymbol(errorSymbol: unknown): ReactNode {
	// TODO: Should errors allow parameters? e.g. show the path that wasn't found, or the type id?
	switch (errorSymbol) {
		case ItemNotFoundError:
			return <FormattedMessage defaultMessage="The item was not found" />;
		case ContentTypeNotFoundError:
			return <FormattedMessage defaultMessage="The content type was not found" />;
		case InvalidParamsError:
			return <FormattedMessage defaultMessage="The form was opened with an incorrect set of arguments" />;
		case NoSiteIdError:
			return <FormattedMessage defaultMessage="No CrafterCMS project was specified" />;
		case PropsChangedError:
			return <FormattedMessage defaultMessage="Dynamic updates of the FormsEngine props are not supported" />;
		case UnknownError:
		default:
			return <FormattedMessage defaultMessage="An error occurred preparing the form" />;
	}
}

/**
 * Releases this form's lock when the form session ends, not when a dependency changes.
 * Mount it on the bootstrap that stays up across reload and minimize. A stacked form has its own.
 * Repeat, create, readonly, and an embedded form on an editable parent do not unlock.
 * A user choice to keep the lock is read from storage at close time, including pagehide.
 */
export function useUnlockOnClose(props: {
	stackIndex?: number;
	stableFormContextRef: RefObject<StableFormContextProps>;
	formsStackData: StableGlobalContextProps['formsStackData'];
}) {
	const { stackIndex = 0, stableFormContextRef, formsStackData } = props;
	const globalContext = useContext(StableGlobalContext);
	const store = useJotaiStore();
	const dispatch = useDispatch();
	const siteId = useActiveSiteId();
	const username = useActiveUser()?.username ?? '';
	const readEntryState = (entry: StableFormContextProps | undefined, index: number): UnlockOnCloseState => {
		const atoms = entry?.atoms ?? null;
		const lockResult = atoms ? store.get(atoms.lockResult) : null;
		const parentAtoms = stackEntryAtoms(index > 0 ? formsStackData[index - 1] : null);
		const props = entry?.props;
		const liveParentReadonly = parentAtoms ? store.get(parentAtoms.readonly) : false;
		return unlockStateForEntry({
			atomsReady: atoms != null,
			index,
			repeatFieldId: props?.repeat?.fieldId,
			createPath: props?.create?.path,
			updateModelId: props?.update?.modelId,
			readonly: atoms ? store.get(atoms.readonly) : true,
			locked: Boolean(lockResult?.locked),
			recordedLockedPath: lockResult?.lockedPath,
			itemPath: entry?.itemMeta?.path,
			// A mounted top unmounts after root reload has popped its parent. The remembered flag
			// is the parent that was still on the stack when this entry was popped.
			parentReadonly: entry
				? (globalContext?.lockReleaseSession.parentReadonly(entry, liveParentReadonly) ?? liveParentReadonly)
				: liveParentReadonly,
			siteId,
			// Storage is shared across dialog stores. The atom covers a missing or unreadable value.
			storedReleaseLockOnClose: getStoredFormsEngineReleaseLockOnClose(username),
			atomReleaseLockOnClose: atoms ? store.get(atoms.releaseLockOnClose) : undefined
		});
	};
	const unlockEffectRefs = useUpdateRefs({
		dispatch,
		readState: (): UnlockOnCloseState => readEntryState(stableFormContextRef.current, stackIndex),
		readCovered: (index: number): UnlockOnCloseState => readEntryState(formsStackData[index], index),
		stackLength: () => formsStackData.length,
		isRoot: stackIndex === 0,
		// A deeper form replaces this bootstrap. The entry is still in the stack until popForm.
		entryStillOnStack: () => stackIndex > 0 && formsStackData[stackIndex] === stableFormContextRef.current,
		coveredByDeeperForm: () => formsStackData.length > stackIndex + 1
	});
	// Only the top stacked bootstrap is mounted. popForm uses this to skip the entry that will unmount.
	useLayoutEffect(() => {
		const session = globalContext?.lockReleaseSession;
		if (!session || stackIndex === 0) return;
		const entry = stableFormContextRef.current;
		session.setMountedEntry(entry);
		return () => session.clearMountedEntry(entry);
	}, [globalContext, stackIndex, stableFormContextRef]);
	// Stable dep: the ref identity does not change. Save Draft must not re-run this cleanup while the form is open.
	useEffect(() => {
		const session = globalContext?.lockReleaseSession;
		const sendUnlock = (entry: StableFormContextProps, state: UnlockOnCloseState, via: 'pagehide' | 'unmount') => {
			session?.releaseOnce(entry, state, (path) => sendUnlockRequest(state.siteId, path, via));
		};
		const sendUnlockRequest = (siteId: string, path: string, via: 'pagehide' | 'unmount') => {
			if (via === 'pagehide') {
				postUnlockKeepalive(siteId, path, getGlobalHeaders());
				return;
			}
			unlock(siteId, path).subscribe({
				next: () => {
					unlockEffectRefs.current.dispatch(showUnlockItemSuccessNotification());
				},
				error: (error: AjaxError) => {
					unlockEffectRefs.current.dispatch(showErrorDialog({ error: unlockErrorPayload(error) }));
				}
			});
		};
		const release = (via: 'pagehide' | 'unmount') => {
			const refs = unlockEffectRefs.current;
			releaseFormSessionLocks({
				via,
				entry: stableFormContextRef.current,
				state: refs.readState(),
				entryStillOnStack: refs.entryStillOnStack(),
				coveredByDeeperForm: refs.coveredByDeeperForm(),
				isRoot: refs.isRoot,
				// Covered forms are not mounted, so closing the session must release the locks they still hold.
				readCovered: () => {
					const covered: Array<{ entry: StableFormContextProps | undefined; state: UnlockOnCloseState }> = [];
					for (let index = 1; index < refs.stackLength() - 1; index++) {
						covered.push({ entry: formsStackData[index], state: refs.readCovered(index) });
					}
					return covered;
				},
				session,
				send: (_entry, state, path) => sendUnlockRequest(state.siteId, path, via)
			});
		};
		if (session && stackIndex === 0) {
			session.setReleaseUnmounted((entry) => {
				const index = formsStackData.lastIndexOf(entry);
				if (index <= 0) return;
				const state = unlockEffectRefs.current.readCovered(index);
				sendUnlock(entry, state, 'unmount');
			});
		}
		const onPageHide = (event: PageTransitionEvent) => {
			if (!shouldUnlockOnPageHide(event)) return;
			release('pagehide');
		};
		window.addEventListener('pagehide', onPageHide);
		return () => {
			if (session && stackIndex === 0) session.setReleaseUnmounted(null);
			window.removeEventListener('pagehide', onPageHide);
			release('unmount');
		};
		// Intentional: the session lives for the whole form. Everything the effect reads that changes goes through
		// unlockEffectRefs. Re-running on globalContext, formsStackData or stackIndex would release the lock mid-session.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [unlockEffectRefs]);
}

/**
 * Generates a simple "save comment" stating the fields that having been modified.
 * TODO: plugin AI, or improve/revise comment generation.
 **/
export function generateDefaultChangesComment(
	contentTypeFields: LookupTable<ContentTypeField>,
	fields: ContentTypeField[],
	changedFieldIds: ReadonlySet<string>,
	currentMessage: string
): string | undefined {
	let namedFields = contentTypeFields;
	if (fields) {
		namedFields = {};
		fields.forEach((field) => {
			namedFields[field.id] = field;
		});
	}
	const fieldsChangedNames: string[] = Array.from(changedFieldIds).flatMap(
		(fieldId) => namedFields[fieldId]?.name ?? []
	);
	const newMessage = produceChangedFieldsMessage(fieldsChangedNames);
	if (
		// If message is blank, no point in checking if the user has altered the message.
		currentMessage !== '' &&
		// A repeated field is reporting changes, no need to set
		(currentMessage === newMessage ||
			// The version comment hasn't been manually altered by the user (i.e. if the current message is the same
			// as the message generated without the last field added to changedFieldIds, we can assume the message
			// has not been altered by user input)
			currentMessage !== produceChangedFieldsMessage(fieldsChangedNames.slice(0, -1)))
	) {
		// Do not set a new message
		return;
	}
	return newMessage;
}

/**
 * Generates the default "save comment" for content being created, based on the page URL (file name) it will be
 * created at.
 * @param pageUrl The current value of the file name field.
 * @param currentMessage The version comment currently held by the form.
 * @param lastGeneratedMessage The comment this function generated last, used to detect user input on the comment.
 * @returns The new comment, or undefined when the comment should be left untouched.
 **/
export function generateDefaultCreationComment(
	pageUrl: string,
	formatMessage: IntlShape['formatMessage'],
	currentMessage?: string,
	lastGeneratedMessage?: string
): string | undefined {
	const newMessage = pageUrl
		? formatMessage({ defaultMessage: 'Created {pageUrl}' }, { pageUrl })
		: formatMessage({ defaultMessage: 'Created content' });

	if (!currentMessage || !lastGeneratedMessage) {
		return newMessage;
	}

	if (
		// Nothing to change
		currentMessage === newMessage ||
		// If message is blank, no point in checking if the user has altered the message.
		(currentMessage !== '' &&
			// The version comment has been manually altered by the user (i.e. if the current message isn't the last
			// message generated here, we can assume the message has been altered by user input)
			currentMessage !== lastGeneratedMessage)
	) {
		// Do not set a new message
		return;
	}
	return newMessage;
}

/** True while any form on the stack is saving. Open full form and close both read this. */
export function useStackSubmitting(): boolean {
	const flags = useAtomValue(stackEntryFlagsAtom);
	return aggregateStackFlags(flags).submitting;
}

/** True for an embedded component: an existing one (`update.modelId`) or a new one (`create.embedded`). */
export function isEmbeddedForm(props: { update?: { modelId?: string }; create?: { embedded?: boolean } }): boolean {
	return Boolean(props.update?.modelId) || Boolean(props.create?.embedded);
}

/** Atoms of a stack entry, or null while prep has not finished. */
export function stackEntryAtoms(entry: { atoms: FormsEngineAtoms | null } | null | undefined): FormsEngineAtoms | null {
	return hasFormAtoms(entry) ? entry.atoms : null;
}

/**
 * The top stacked form's submit, pending-changes and readonly state, read from the store. Pending includes any changed
 * field id, not only the `hasPendingChanges` flag. Readonly when the entry has no atoms yet.
 */
export function getCurrentChildFormStateSummary(
	store: JotaiStore,
	formsStackData: StableGlobalContextProps['formsStackData']
): {
	isSubmitting: boolean;
	hasPendingChanges: boolean;
	readonly: boolean;
} {
	const atoms = stackEntryAtoms(formsStackData[formsStackData.length - 1]);
	if (!atoms) return { isSubmitting: false, hasPendingChanges: false, readonly: true };
	return {
		isSubmitting: store.get(atoms.isSubmitting),
		hasPendingChanges:
			store.get(atoms.hasPendingChanges) ||
			store.get(formsStackData[formsStackData.length - 1].changedFieldIds).size > 0,
		readonly: store.get(atoms.readonly)
	};
}

/**
 * Creates a unique `key` (to be used as the key prop on a ReactNode[]) for stacked forms.
 **/
export function createStackedFormKey(currentStackedFormProps: FormsEngineProps, stackFormCount: number): string {
	if (currentStackedFormProps.update) {
		return `${currentStackedFormProps.update.path}_${currentStackedFormProps.update.modelId ?? ''}_${stackFormCount}`;
	} else if (currentStackedFormProps.create) {
		return `${currentStackedFormProps.create.path}_${currentStackedFormProps.create.contentTypeId}_${stackFormCount}`;
	} else if (currentStackedFormProps.repeat) {
		return `${currentStackedFormProps.repeat.fieldId}_${stackFormCount}`;
	}
	return;
}

export function getNodeIndex(element: Element): number {
	let index = 0;
	let sibling = element.previousElementSibling;
	while (sibling) {
		index++;
		sibling = sibling.previousElementSibling;
	}
	return index;
}

export function prepareEmbeddedItemForm(props: {
	username: string;
	contentType: ContentType;
	locked: boolean;
	lockError: ApiResponse;
	affectedPackages: PublishPackage[];
	/** Path this form locked. Null when it is using the parent's lock. */
	lockedPath?: string | null;
	update: FormsEngineProps['update'];
	fieldIds?: string[];
	repeatIndex?: string | number;
	parentStackData: StableFormContextProps;
	stableFormContextRef: RefObject<StableFormContextProps>;
	parentPathInSite: string;
	siteId: string;
	contentTypesById?: LookupTable<ContentType>;
	customControls?: LookupTable<DescriptorContentType>;
}): { atoms: FormsEngineAtoms; values: LookupTable<unknown>; itemMeta: FormsEngineItemMetaContextProps } {
	const {
		username,
		contentType,
		update,
		fieldIds,
		repeatIndex,
		parentStackData,
		stableFormContextRef,
		parentPathInSite,
		locked,
		lockError,
		affectedPackages,
		lockedPath,
		siteId,
		contentTypesById,
		customControls
	} = props;
	const lockResultAtom = atom<FormsEngineEditContextProps>({
		locked,
		lockError,
		affectedPackages,
		lockedPath: locked ? (lockedPath ?? null) : null
	});
	const atoms = createFormsEngineAtoms(
		username,
		{
			lockResult: lockResultAtom,
			readonly: createReadonlyAtom(lockResultAtom),
			expandedStateBySectionId: buildSectionExpandedStateAtoms(contentType.sections),
			fileName: createFileNameAtom('', stableFormContextRef, update.modelId)
		},
		{ selectedFields: fieldIds, index: repeatIndex, fields: contentType.fields }
	);
	const values = { ...update.values };
	delete values[XmlKeys.fileName];
	const validatorsData: ValidatorsData = {
		siteId,
		contentTypesById,
		resolveEmbeddedRelevance: createEmbeddedRelevanceResolver(siteId)
	};

	const descriptors = resolveControlDescriptors(customControls);
	const additionalFieldsIds: string[] = [];
	// Retrieve all additional fields ids from the contentType fields.
	Object.values(contentType.fields).forEach((field) => {
		const descriptor = descriptors[field.type];
		if (!descriptor) return;
		additionalFieldsIds.push(...getAdditionalFieldsIdsFromDescriptor(field.id, descriptor));
	});
	// Ensure descriptor additional fields exist in values so atoms are created (same as main/repeat bootstrap).
	additionalFieldsIds.forEach((additionalFieldId) => {
		if (!Object.prototype.hasOwnProperty.call(values, additionalFieldId)) {
			values[additionalFieldId] = undefined;
		}
	});

	Object.entries(values).forEach(([fieldId, value]) => {
		// Embedded components don't have a path/file-name.
		if (fieldId === XmlKeys.fileName) return;
		const isAdditionalField = additionalFieldsIds.includes(fieldId);
		// System fields (e.g. content-type, display-template, etc.) are not part of the content type, but are part of the content object. We don't need atoms or validity checks for these.
		if (!contentType.fields[fieldId] && !isAdditionalField) return;
		setFieldAtoms(
			stableFormContextRef,
			contentType,
			contentType.fields,
			fieldId,
			atoms,
			value,
			validatorsData,
			isAdditionalField
		);
	});
	const element = fromString(parentStackData.itemMeta.contentXml ?? '').querySelector(`[id="${update.modelId}"]`);
	let contentObject: LookupTable<unknown>;
	let contentXml: string;
	if (element) {
		const fieldId = element.parentElement.parentElement.tagName; // <root><fieldId><item><component/></item></fieldId></root>, so (component.parentElement = item).parentElement = fieldId
		const index = getNodeIndex(element.parentElement); // Get the position of the `item` tag
		contentObject = (
			getParsedField(parentStackData.itemMeta.contentObject, fieldId) as {
				item: Array<{ component: LookupTable<unknown> }>;
			}
		).item[index].component;
		contentXml = element.outerHTML;
	} else {
		// Created (or edited) in-session; not yet serialized into parent contentXml
		contentObject = update.values;
		const { [XmlKeys.fileName]: _, ...valuesWithoutFileName } = update.values;
		contentXml = buildContentXml(valuesWithoutFileName, contentTypesById);
	}
	return {
		atoms,
		values,
		itemMeta: {
			id: values[XmlKeys.modelId] as string,
			path: update.path,
			sourceMap: null,
			pathInSite: parentPathInSite,
			contentType,
			contentXml,
			contentObject
		}
	};
}

export { getPropertyValue, getValidationValue } from './fieldPropertyUtils';

/**
 * Determines if a field is read-only based on the form's read-only state or the field's properties.
 *
 * @param field {ContentTypeField} - The field whose read-only status is being checked.
 * @param formReadonly {boolean} - A flag indicating whether the entire form is in read-only mode.
 * @returns {boolean} - `true` if the field is read-only, either due to the form's state or the field's properties; otherwise, `false`.
 */
export function isFieldReadOnly(field: ContentTypeField, formReadonly: boolean): boolean {
	return formReadonly || (getPropertyValue(field.properties, 'readonly') as boolean);
}

/**
 * Constructs the full path for a content item based on its type, base path, and file name.
 *
 * This function determines the appropriate path format based on the content type.
 * If the content type is a "page", the path will include an `index.xml` file within a folder.
 * Otherwise, the path will include the file name with a `.xml` extension directly.
 *
 * @param {string} basePath - The base path where the content item resides.
 * @param {string} fileName - The name of the file (without extension or directory).
 * @param {ContentType} contentType - The content type object, which determines the path format.
 * @returns {string} - The constructed full path for the content item.
 *
 */
export function composePathForType(basePath: string, fileName: string, contentType: ContentType): string {
	if (contentType.type === 'page') {
		return ensureSingleSlash(`${basePath}/${fileName}/index.xml`);
	} else {
		return ensureSingleSlash(`${basePath}/${fileName}.xml`);
	}
}

export function getAdditionalFieldsIdsFromDescriptor(fieldId: string, descriptor: DescriptorContentType): string[] {
	const additionalFields = descriptor.metadata?.additionalFields ?? [];
	return additionalFields.map((additionalField) => processAdditionalFieldMacro(fieldId, additionalField));
}

/**
 * Merges ui.xml custom control descriptors under code-default descriptors.
 * Code defaults win on key collision so OOB controls are not overridden by ui.xml entries.
 */
export function resolveControlDescriptors(
	customControls?: LookupTable<DescriptorContentType>
): LookupTable<DescriptorContentType> {
	return { ...customControls, ...controlDescriptors };
}

// TODO: are there going to be other placeholders besides {id}?
export function processAdditionalFieldMacro(parentFieldId: string, fieldId: string): string {
	return fieldId.replaceAll('{id}', parentFieldId);
}
