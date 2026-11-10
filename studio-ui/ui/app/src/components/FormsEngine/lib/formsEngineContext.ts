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

import { createContext } from 'react';
import { ContentItem, PublishPackage } from '../../../models';
import ContentType from '../../../models/ContentType';
import ApiResponse from '../../../models/ApiResponse';
import { type FormsEngineProps } from '../FormsEngine';
import LookupTable from '../../../models/LookupTable';
import { atom, useAtom, type Atom, type PrimitiveAtom } from 'jotai';
import { FieldValidityState } from './validators';
import { Subject } from 'rxjs';
import { AtomWithStorage } from '../types';
import { createUseContextHook } from '../../../utils/system';
import type { AffectedPluginControlField } from './controlPluginLoader';
import type { FormControllerState } from '../formControllers/types';
import type { FormVisibilityState } from './formVisibility';
import type { FormLockReleaseSession } from './unlockOnClose';
import type { DataSourceServices } from '../dataSources/types';

export type FormsEngineSourceMap = LookupTable<string>;
export type { AffectedPluginControlField };

export interface FormsEngineDialogContextProps {
	disableEnforceFocus?: boolean;
	setDisableEnforceFocus?: (disable: boolean) => void;
}

// Provides an API global to the form(s) to manage & operate the forms stack
export interface FormsEngineGlobalApiContextProps {
	updateProps(stackIndex: number, formProps: FormsEngineProps): void;
	setStateCache(stackIndex: number, state: FormsEngineCachedStackedFormState): void;
	pushForm(formProps: FormsEngineProps): void;
	popForm(): void;
}

// Provides an API of operations that concern the state of the form values
export interface FormsEngineFormApiContextProps {
	rollback(): void;
	rollbackField(fieldId: string): void;
	setValuesCheckpoint(values: LookupTable<unknown>): void;
}

export interface FormRequirementsResponse
	extends
		Pick<FormsEngineItemMetaContextProps, 'sourceMap' | 'pathInSite' | 'contentType' | 'contentObject' | 'contentXml'>,
		FormsEngineEditContextProps {
	item: ContentItem;
	contentObject: LookupTable<unknown>;
}

// Contains the information related to the form's content item
export interface FormsEngineItemMetaContextProps {
	id: string;
	path: string;
	sourceMap: FormsEngineSourceMap;
	pathInSite: string;
	contentType: ContentType;
	contentObject: LookupTable<unknown>; // The raw deserialised XML content document.
	contentXml: string; // The raw XML content document.
}

// Contains information related to lock status and whether packages are affected by editing the content item
export interface FormsEngineEditContextProps {
	locked: boolean;
	lockError: ApiResponse;
	affectedPackages?: PublishPackage[];
	/**
	 * Path this form successfully locked. A saved rename updates it to the new path,
	 * because a move carries the lock. Null when this form does not hold a lock.
	 */
	lockedPath?: string | null;
}

// Contains the various state atoms of a form
export interface FormsEngineAtoms {
	isSubmitting: PrimitiveAtom<boolean>;
	hasPendingChanges: PrimitiveAtom<boolean>;
	readonly: Atom<boolean>;
	lockResult: PrimitiveAtom<FormsEngineEditContextProps>;
	valueByFieldId: LookupTable<PrimitiveAtom<unknown>>;
	validationByFieldId: LookupTable<Atom<Promise<FieldValidityState>>>;
	versionComment: PrimitiveAtom<string>;
	collapseToC: AtomWithStorage; // Note: `collapseToC` is an atomWithStorage
	useCollapsedToC: Atom<boolean>;
	isLargeContainer: PrimitiveAtom<boolean>;
	expandedStateBySectionId: LookupTable<PrimitiveAtom<boolean>>;
	tableOfContentsDrawerOpen: PrimitiveAtom<boolean>;
	closeAfterSave: AtomWithStorage;
	minimizeAfterSave: AtomWithStorage;
	/** Per-user. When false, closing the form keeps the lock. Defaults to true. */
	releaseLockOnClose: AtomWithStorage;
	/** Per-user. False or absent means Save. True means the user last chose Save Draft. */
	saveAsDraft: AtomWithStorage;
	fileName?: Atom<string>;
	/**
	 * Bumped after form-controller relevance is stored. Validation atoms read it so a
	 * deny-list that arrives after bootstrap invalidates verdicts computed without it.
	 */
	relevanceVersion: PrimitiveAtom<number>;
	/**
	 * Launch scope and the "open full form" toggle. Relevance is not stored here;
	 * `fieldVisibility` reads this atom together with the controller deny-list.
	 */
	formVisibility: PrimitiveAtom<FormVisibilityState>;
	/** Set when a save or "View in form" should scroll to a field after the scope changes. */
	pendingScrollFieldId: PrimitiveAtom<string | null>;
	/** A reveal moves focus. The launch fallback scroll names a field and leaves this false. */
	pendingScrollFocus: PrimitiveAtom<boolean>;
}

// Contains information to restore the state of a form when it comes back to being the active form on the stack
export interface FormsEngineCachedStackedFormState {
	collapsedToC: boolean;
	previousScrollTopPosition: number;
	// TODO: Having moved this to Jotai, it might not be required to be here.
	//  Because everything is on the same jotai store, two content types with the same section name could collide.
	sectionExpandedState: LookupTable<boolean>;
}

// Context global/available to the entire forms stack. Once initialised, it won't change (won't cause re-renders)
export interface StableGlobalContextProps {
	formsStackData: StableFormContextProps[];
	api: FormsEngineGlobalApiContextProps;
	/**
	 * The root form publishes these from a layout effect. The functions read refs that
	 * update every render, so a selected-fields Save runs the current root save.
	 */
	rootFormActions: {
		save: (draft?: boolean | 'auto') => Promise<'revealed' | 'invalid' | 'saved' | void>;
	};
	/**
	 * Dedup and parent-readonly memory for unlocks in this root session. It also tracks the mounted stacked
	 * bootstrap and the release for a covered form popped by reload, which have no bootstrap to release them.
	 */
	lockReleaseSession: FormLockReleaseSession<StableFormContextProps>;
}

/**
 * Payload of the internal `fieldUpdates$` stream: which field's value was just written.
 *
 * Internal to FE2 and Type Builder. It carries the field id only, with no `value` or `previousValue`:
 * subscribers read the current value from the field's atom. Wrapping the id in an object lets the event
 * grow later without changing every subscriber.
 *
 * Form controllers must not depend on this type. They use `FormControllerContext.fieldChanges` or
 * `FormControllerContext.onFieldChange`, which deliver a read-only `FormFieldChange` with the value.
 */
export interface FieldUpdate {
	readonly fieldId: string;
}

// Consolidated base data store for the form instance (single form/item). Once initialised, it won't change (won't cause re-renders).
export interface StableFormContextProps {
	/**
	 * Null until this entry's prep finishes. `pushForm` inserts the entry before atoms exist.
	 * strictNullChecks is off, so the compiler does not enforce this.
	 * Readers must use hasFormAtoms or stackEntryAtoms.
	 */
	atoms: FormsEngineAtoms | null;
	/**
	 * Set for an Experience Builder item launch. `selected` uses the parent's Save card.
	 * Only Open full form, View in form, and Back to selected fields change it.
	 * Null for the pencil and for Add.
	 */
	itemFormMode: PrimitiveAtom<'selected' | 'full'> | null;
	/**
	 * Source of truth for which fields differ from the last checkpoint (the values the form opened with, or the last
	 * save). An atom holding an immutable set of field ids; the set's reference changes only when its membership does.
	 * Null in Type Builder's read-only chips, which track nothing.
	 *
	 * - React components subscribe per field with `changedFieldAtom(changedFieldIds, fieldId, additionalFieldIds)`, so only the
	 *   field whose flag flips re-renders (additional field writes light the parent control's chrome).
	 * - Imperative code (save, Type Builder commit, pending-changes checks) reads with `store.get(changedFieldIds)`.
	 * - Writers replace the set (`withChangedField`) and never mutate it. Clearing is setting `EMPTY_CHANGED_FIELD_IDS`.
	 *
	 * This is state. {@link StableFormContextProps.fieldUpdates$} is the matching event stream: it says an edit happened,
	 * this says what is changed.
	 *
	 * @example
	 * ```ts
	 * // Imperative read, e.g. before closing the form
	 * const hasEdits = store.get(stableFormContext.changedFieldIds).size > 0;
	 * // Clear after a save (see `applyValuesCheckpoint`)
	 * store.set(stableFormContext.changedFieldIds, EMPTY_CHANGED_FIELD_IDS);
	 * ```
	 *
	 * @see {@link StableFormContextProps.fieldUpdates$}
	 */
	changedFieldIds: PrimitiveAtom<ReadonlySet<string>> | null;
	/**
	 * Internal event stream of value writes for this form: one emission per write to a field's value atom, and one
	 * per write to the file-name atom (the `file-name` field's own value atom mirrors it and does not emit twice).
	 * Emitted synchronously, after the field's value is stored and {@link StableFormContextProps.changedFieldIds} is
	 * updated, so a synchronous subscriber can read the new state with `store.get`.
	 *
	 * The payload is a {@link FieldUpdate}: the id of the field that was written (`'file-name'` for the file name),
	 * and nothing else (no `value` or `previousValue`). A write inside a repeat reports the root field's id. A write
	 * that does not change the changed-ids set still emits: this is a stream of writes, not of changes.
	 *
	 * Nothing emits for clears or checkpoints (a save, a Type Builder commit, a stack rebuild): those set
	 * {@link StableFormContextProps.changedFieldIds} directly, with no write behind them.
	 *
	 * Use it to react to the act of an edit: debounced side effects (the default version comment, background
	 * validation), publishing pending state, or bridging to the form controller's `onFieldChange`. It is not a source
	 * of truth. Do not accumulate state from it: read the value atoms and `changedFieldIds`.
	 *
	 * Internal to FE2 and Type Builder. Controllers and plugins never receive this Subject: they use the read-only
	 * `fieldChanges` observable or `onFieldChange` on the controller context, which bridge from this stream and read
	 * the current value themselves. Only the field and file-name atom writers call `next`; no one else should.
	 *
	 * @example
	 * ```ts
	 * // Debounced side effect that reads state, not the payload
	 * const sub = fieldUpdates$.pipe(debounceTime(300)).subscribe(() => {
	 *   const changed = store.get(changedFieldIds);
	 *   // ...build the default version comment from `changed`
	 * });
	 * return () => sub.unsubscribe();
	 * ```
	 *
	 * @see {@link StableFormContextProps.changedFieldIds}
	 */
	fieldUpdates$: Subject<FieldUpdate>;
	itemMeta: FormsEngineItemMetaContextProps; // TODO: There's a dedicated ItemMetaContext; why have here too?
	originalValues: LookupTable<unknown>;
	props: FormsEngineProps;
	state: FormsEngineCachedStackedFormState;
	/**
	 * Fields whose control plugins failed preload. Bootstrap entries (`fromBootstrap`) persist
	 * until the form reloads and always block save. Save-time entries are cleared/retried on
	 * each save attempt.
	 */
	affectedPluginControlFields: AffectedPluginControlField[];
	/**
	 * Form-controller attachment for this stack entry (`null` when none).
	 * Repeat entries may hold only a deny-list (`irrelevantFieldPaths`) and no controller.
	 */
	formControllerState: FormControllerState | null;
	/**
	 * Reads the form's current content item (the live Redux item, so it follows renames and moves) at call time,
	 * without subscribing to it. Callbacks and effect bodies that only need the item when they run use this, so an item
	 * update doesn't re-render them. Returns null when the form has no item (create mode) or none is stored yet.
	 * `FormsEngine` publishes the real reader from a layout effect (see `useFormEntryProvisioning`); until then it
	 * returns null.
	 */
	getItem(): ContentItem | null;
	/**
	 * Services that bridge data-source dialogs and `pushForm` into promises. Created once per form by `FormsEngine`
	 * (`useFormEntryProvisioning`) rather than once per field. Optional: a form context that doesn't provide them, such
	 * as the Type Builder's virtual form, makes each `ResolvedControlRenderer` build its own as a fallback.
	 */
	dataSourceServices?: DataSourceServices;
}

export const FormsEngineDialogContext = /*#__PURE__*/ createContext<FormsEngineDialogContextProps | undefined>(
	undefined
);

export const FormsEngineFormContextApi = /*#__PURE__*/ createContext<FormsEngineFormApiContextProps>(undefined);
FormsEngineFormContextApi.displayName = 'FormsEngineFormContextApi';

// Single instance context, shared between all forms of a root
export const StableGlobalContext = /*#__PURE__*/ createContext<StableGlobalContextProps>(undefined);
StableGlobalContext.displayName = 'StableGlobalContext';

// Each form (e.g. root form and stacked child form) has one
export type ReadyFormContext = StableFormContextProps & { atoms: FormsEngineAtoms };

export const StableFormContext = /*#__PURE__*/ createContext<ReadyFormContext>(undefined);
StableFormContext.displayName = 'StableFormContext';

/**
 * The store key (`itemsByPath` key) of the form's content item, or null when the form has no item (create mode). It
 * changes only when the form moves to another path (e.g. a saved rename), never when the item's content changes, so
 * providing it doesn't re-render consumers on item updates. Read the item with the `useFormItem*` hooks
 * (lib/formItem.ts) where it is rendered, or with `StableFormContext.getItem()` in callbacks.
 */
export const FormItemKeyContext = /*#__PURE__*/ createContext<string | null>(null);
FormItemKeyContext.displayName = 'FormItemKeyContext';

export const ItemMetaContext = /*#__PURE__*/ createContext<FormsEngineItemMetaContextProps>(undefined);
ItemMetaContext.displayName = 'ItemMetaContext';

export const useFormApiContext = /*#__PURE__*/ createUseContextHook('useFormApiContext', FormsEngineFormContextApi);

export const useStableGlobalContext = /*#__PURE__*/ createUseContextHook('useStableGlobalContext', StableGlobalContext);

export const useStableGlobalApiContext = /*#__PURE__*/ createUseContextHook<StableGlobalContextProps, 'api'>(
	'useStableGlobalApiContext',
	StableGlobalContext,
	(instance) => instance.api
);

export const useStableFormContext = /*#__PURE__*/ createUseContextHook('useStableFormContext', StableFormContext);

// Shared stand-in so `useFieldValue` can call `useAtom` unconditionally when a field has no atom.
const missingFieldAtom = atom<unknown>(undefined);
const noop = (): void => {};

/**
 * Purpose-built access to a sibling field's value (e.g. a descriptor-declared additional
 * field such as `{id}_tz`) without exposing the atom map or Jotai to plugin controls.
 * Returns `[value, setValue, exists]`; when the field wasn't initialized, `value` is
 * `undefined`, `exists` is `false` and `setValue` is a no-op.
 */
export function useFieldValue<T = unknown>(fieldId: string): [T | undefined, (value: T) => void, boolean] {
	const { atoms } = useStableFormContext();
	const fieldAtom = Object.prototype.hasOwnProperty.call(atoms.valueByFieldId, fieldId)
		? (atoms.valueByFieldId[fieldId] as PrimitiveAtom<T>)
		: undefined;
	const [value, setValue] = useAtom(fieldAtom ?? (missingFieldAtom as PrimitiveAtom<T>));
	return [fieldAtom ? value : undefined, fieldAtom ? setValue : noop, Boolean(fieldAtom)];
}

export const useItemMetaContext = /*#__PURE__*/ createUseContextHook('useItemMetaContext', ItemMetaContext);

export const RenamedPathContext = createContext<{
	renamedPath: string | null;
	setRenamedPath(path: string | null): void;
	reloadNonce: number;
	triggerReload(): void;
	setSavedCreatePath(path: string | null): void;
}>({
	renamedPath: null,
	setRenamedPath: () => {},
	reloadNonce: 0,
	triggerReload: () => {},
	setSavedCreatePath: () => {}
});
