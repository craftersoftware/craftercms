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
import type { MaybePromise } from '../../../models/MaybePromise';

/** Form open mode exposed to content-type-local form controllers. */
export type FormControllerMode = 'create' | 'edit';

export type FormControllerNotifySeverity = 'info' | 'success' | 'warning' | 'error';

/**
 * Return shape for `onBeforeSave`.
 * `false` or `{ ok: false }` vetoes save. `{ ok: false, message }` also shows the message to the author.
 */
export type FormControllerSaveResult = boolean | { ok: boolean; message?: string };

/**
 * Narrow host API over FE2 form state for type-local `form-controller.js` modules.
 * Controllers must not import React or reach into the DOM for field visibility;
 * use `isFieldRelevant` instead.
 */
export interface FormControllerContext {
	/** Active site id for site-scoped reads/writes from the controller. */
	siteId: string;
	/** Content type definition for the form this controller is attached to. */
	contentType: ContentType;
	/** Live item path when editing an existing item; `undefined` in create (and some stacked) modes. */
	readonly path: string | undefined;
	/** How the form was opened: create or edit. Combine with `isEmbedded` for embedded create/edit. */
	mode: FormControllerMode;
	/** True when this form is an embedded component (stacked or root). */
	isEmbedded: boolean;
	/** Live read of the form's readonly atom; true when the form is view-only. */
	readonly: boolean;
	/**
	 * Returns a snapshot of all current field values keyed by top-level field id.
	 * Repeat groups appear as arrays of item objects (not flattened paths).
	 * `file-name` is the dedicated file-name atom (same as {@link getValue}).
	 */
	getValues(): Record<string, unknown>;
	/**
	 * Returns the current value for a field id.
	 * Prefer a top-level atom id when present. Otherwise supports dotted paths into
	 * nested values (e.g. `myRepeat.0.title_s` → item 0's `title_s` inside the repeat).
	 * Numeric path segments are array indices. `onFieldChange` still emits the root field id.
	 */
	getValue(fieldId: string): unknown;
	/**
	 * Sets a field value.
	 * Same key rules as {@link getValue}: top-level atom id, or a dotted path into a
	 * nested value (immutable update of the root atom). Missing paths warn and no-op.
	 */
	setValue(fieldId: string, value: unknown): void;
	/**
	 * Looks up a field definition on the current content type.
	 * Accepts a top-level id or a dotted path; numeric segments (repeat indexes) are skipped.
	 */
	getField(fieldId: string): ContentTypeField | undefined;
	/**
	 * Registers a listener called whenever a field value changes. Returns a function
	 * that removes it. The host also drops listeners registered here on form teardown.
	 */
	onFieldChange(listener: (fieldId: string, value: unknown) => void): () => void;
	/** Shows a snackbar notification. Use for informational messages; veto messaging can also go on the `onBeforeSave` return. */
	notify(message: string, severity?: FormControllerNotifySeverity): void;
}

/**
 * ESM export shape for `/config/studio/content-types/{id}/form-controller.js`.
 * Default export (or named `formController`) must satisfy this contract.
 *
 * `apiVersion` is currently `1`. Missing `apiVersion` is treated as `1`.
 * Bump when breaking the host↔controller contract.
 */
export interface FormController {
	apiVersion?: 1;
	/**
	 * Called once per form that owns a controller (root and embedded children), after
	 * form context/atoms exist. Not called for repeat stacked forms — those are part of
	 * the parent form and reuse the parent's context for `isFieldRelevant` only.
	 * May return a cleanup (or a Promise of cleanup) invoked on form unmount / stack pop.
	 */
	initialize?(ctx: FormControllerContext): MaybePromise<void | (() => void)>;
	/**
	 * Return false to omit the field (or repeat definition) from the rendered form.
	 * Default true. Async allowed — host awaits before first field paint for that form.
	 * Repeat subfields are judged once, with the owning form's context, when that form attaches.
	 * The repeat item form reuses that result and does not call this again.
	 */
	isFieldRelevant?(field: ContentTypeField, ctx: FormControllerContext): MaybePromise<boolean>;
	/**
	 * Return false / `{ ok: false }` / rejected promise to veto save.
	 * `{ ok: false, message }` shows `message` to the author.
	 * Called in `useSaveForm` after client validation snapshot, before XML write.
	 * Not invoked for repeat item commits (in-memory merge into the parent).
	 */
	onBeforeSave?(ctx: FormControllerContext): MaybePromise<FormControllerSaveResult>;
}

/**
 * Controller-related fields on a form stack entry. `null` when this entry has never
 * attached a controller (or after an explicit clear). Repeat entries may hold only
 * `irrelevantFieldPaths` (no controller / context / cleanup).
 */
export interface FormControllerState {
	controller: FormController | null;
	context: FormControllerContext | null;
	cleanup: (() => void) | null;
	/** Unsubscribers for `onFieldChange` listeners handed out by this entry's context. */
	fieldChangeUnsubscribers: Set<() => void>;
	fileMissing: boolean;
	loadFailed: boolean;
	/** Set when this state was torn down. A late `initialize` cleanup still runs, but changes no shared state. */
	disposed: boolean;
	/**
	 * Qualified field paths the controller rejected via `isFieldRelevant`.
	 * A top-level field is its id (`heroImage_s`). A repeat subfield is
	 * `<repeatFieldId>.<subFieldId>` (`features_o.title_s`), so the same subfield id
	 * can be hidden in one repeat group and shown in another.
	 * `null` means no relevance hook — do not filter.
	 */
	irrelevantFieldPaths: Set<string> | null;
}

/** Empty controller state used when attaching or when a repeat entry only stores relevance. */
export function createEmptyFormControllerState(): FormControllerState {
	return {
		controller: null,
		context: null,
		cleanup: null,
		fieldChangeUnsubscribers: new Set(),
		fileMissing: false,
		loadFailed: false,
		disposed: false,
		irrelevantFieldPaths: null
	};
}
