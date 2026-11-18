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
import type { Observable } from 'rxjs';

/** Form open mode exposed to content-type-local form controllers. */
export type FormControllerMode = 'create' | 'edit';

export type FormControllerNotifySeverity = 'info' | 'success' | 'warning' | 'error';

/**
 * Return shape for `onBeforeSave`.
 * `false` or `{ ok: false }` vetoes save. `{ ok: false, message }` also shows the message to the author.
 */
export type FormControllerSaveResult = boolean | { ok: boolean; message?: string };

/**
 * One field value write, as delivered by {@link FormControllerContext.fieldChanges}.
 *
 * @remarks
 * Only the change object itself is frozen (shallow). `value` is the value the form holds, by reference: for a
 * repeat, component or other object value it is the live object, and the host does not freeze or copy it.
 * Treat it as read-only. Mutating it bypasses dirty tracking, validation and rendering, so the form can save
 * a value the author never saw. Write with {@link FormControllerContext.setValue} instead, passing a new
 * object rather than editing this one.
 *
 * `onFieldChange` listeners receive the same two pieces of data as `(fieldId, value)` arguments.
 *
 * @example
 * ```js
 * ctx.fieldChanges.subscribe((change) => {
 *   // change.fieldId → 'title_s'
 *   // change.value   → the value of 'title_s' when this subscriber was notified
 *   console.log(change.fieldId, change.value);
 * });
 * ```
 *
 * @see {@link FormControllerContext.fieldChanges}
 * @see {@link FormControllerContext.onFieldChange}
 */
export interface FormFieldChange {
	/**
	 * Id of the field whose value was written. A write to a nested path (for example
	 * `setValue('myRepeat.0.title_s', …)`) reports the **root** field id (`myRepeat`), not the path.
	 * Editing the file name reports `file-name`.
	 */
	readonly fieldId: string;
	/**
	 * The field's value, read synchronously when the event reaches the subscriber (each subscriber reads for
	 * itself, in subscription order), exactly as {@link FormControllerRelevanceContext.getValue} would return it
	 * for `fieldId` at that moment. It is not captured once per write, and it is not re-read after that, so an
	 * operator that delays delivery (`delay`, `debounceTime`, `switchMap`) hands you the value as of the
	 * notification, which may be older than the field's current value. Call `ctx.getValue(fieldId)` when you
	 * need the latest.
	 *
	 * Re-entrant writes: if an earlier subscriber writes the same field while the event is being delivered, the
	 * nested change is delivered to everyone first, and subscribers notified after that write then read the
	 * newer value for the outer event as well (they see the newer value twice). Filter by field or compare
	 * values (`map` to the value, then `distinctUntilChanged`) when that matters.
	 *
	 * For a nested write this is the whole root value (the repeat array or component object), not the changed
	 * leaf. Treat it as read-only (see {@link FormFieldChange}).
	 */
	readonly value: unknown;
}

/**
 * Read-only snapshot passed to `isFieldRelevant`. It is the same for an open form and for a parent
 * validating that component without opening it, so a verdict may depend only on these inputs:
 * the values as loaded (before `initialize`), the type, and how the form opens.
 * No `readonly`, no writes, no listeners, no notifications, and no state set up by `initialize`.
 */
export interface FormControllerRelevanceContext {
	/** Active site id for site-scoped reads/writes from the controller. */
	siteId: string;
	/** Content type definition for the form this controller is attached to. */
	contentType: ContentType;
	/**
	 * Item path when editing an existing item; `undefined` in create (and some stacked) modes.
	 * An embedded component reports the path of the item that contains it.
	 */
	readonly path: string | undefined;
	/**
	 * How the form was opened: create or edit. Combine with `isEmbedded` for embedded create/edit.
	 * An existing embedded component is always `edit`, the way it opens from its parent.
	 */
	mode: FormControllerMode;
	/** True when this form is an embedded component (stacked or root). */
	isEmbedded: boolean;
	/**
	 * Returns a snapshot of all field values keyed by top-level field id.
	 * Repeat groups appear as arrays of item objects (not flattened paths).
	 * `file-name` is the dedicated file-name atom (same as {@link getValue}).
	 */
	getValues(): Record<string, unknown>;
	/**
	 * Returns the value for a field id.
	 * Prefer a top-level atom id when present. Otherwise supports dotted paths into
	 * nested values (e.g. `myRepeat.0.title_s` → item 0's `title_s` inside the repeat).
	 * Numeric path segments are array indices. `onFieldChange` still emits the root field id.
	 */
	getValue(fieldId: string): unknown;
	/**
	 * Looks up a field definition on the current content type.
	 * Accepts a top-level id or a dotted path; numeric segments (repeat indexes) are skipped.
	 */
	getField(fieldId: string): ContentTypeField | undefined;
	/**
	 * Always an observable that completes immediately without emitting: this context has no live form, so
	 * there is nothing to observe. Subscribing is harmless but pointless. The live stream is on
	 * {@link FormControllerContext.fieldChanges}, available from `initialize` and `onBeforeSave`.
	 */
	readonly fieldChanges: Observable<FormFieldChange>;
}

/**
 * Narrow host API over FE2 form state for type-local `form-controller.js` modules.
 * Controllers must not import React or reach into the DOM for field visibility;
 * use `isFieldRelevant` instead. Reads here are live (`path`, `readonly`, values).
 */
export interface FormControllerContext extends FormControllerRelevanceContext {
	/** Live read of the form's readonly atom; true when the form is view-only. */
	readonly: boolean;
	/**
	 * Sets a field value.
	 * Same key rules as {@link getValue}: top-level atom id, or a dotted path into a
	 * nested value (immutable update of the root atom). Missing paths warn and no-op.
	 * Ignored (with a warning) once the form this context belongs to was torn down.
	 */
	setValue(fieldId: string, value: unknown): void;
	/**
	 * Calls `listener` each time a field value is written. The simple way to react to edits: a callback in,
	 * an unsubscribe function out, and no RxJS knowledge needed.
	 *
	 * @remarks
	 * **When to use it.** Pick `onFieldChange` for a direct, per-change reaction: "when `title_s` changes,
	 * update `slug_s`". If you need to filter by field, debounce, drop repeats, cancel stale async work,
	 * combine edits with other streams or stop on a condition, use {@link FormControllerContext.fieldChanges}
	 * instead. It is the same event stream, built for composition with the `craftercms.libs.rxjs` operators.
	 *
	 * **What it delivers.** One call per value write, in the order the writes happen, including writes to a
	 * field that is not rendered and writes made through {@link FormControllerContext.setValue} (so a listener
	 * that writes back to the field it listens to will re-enter itself; guard against loops). `fieldId` is
	 * the root field id (a nested path write reports its root). `value` is read synchronously when the listener is notified. If an
	 * earlier listener or subscriber writes the same field during delivery, later listeners receive the newer
	 * value for that event too (see {@link FormFieldChange.value}).
	 * It is not called for the initial values, only for later writes.
	 *
	 * **Lifecycle.** The host removes every listener when the form this context belongs to is torn down
	 * (stack pop, unmount, replacement attach, or a failed `initialize`), including while `initialize` is
	 * still pending, so you do not have to unsubscribe in a cleanup. After teardown, registering is refused:
	 * a warning is logged, nothing is subscribed, and the returned function is a no-op. There is no
	 * completion callback; use {@link FormControllerContext.fieldChanges} if you need to know the form ended.
	 * The `isFieldRelevant` context has no live form: it ignores this call with a warning.
	 *
	 * If `listener` throws, the error is reported asynchronously (RxJS unhandled error reporting). It does not
	 * stop other listeners and does not remove this one.
	 *
	 * @param listener - Called with the root field id and the value read when this listener was notified.
	 * @returns A function that removes the listener. Safe to call more than once.
	 *
	 * @example
	 * ```js
	 * initialize(ctx) {
	 *   const unsubscribe = ctx.onFieldChange((fieldId, value) => {
	 *     if (fieldId === 'title_s') {
	 *       ctx.notify(`Title is now ${value ?? ''}`, 'info');
	 *     }
	 *   });
	 *   // Optional: the host also removes the listener when the form closes.
	 *   return unsubscribe;
	 * }
	 * ```
	 *
	 * @see {@link FormControllerContext.fieldChanges} for the observable form of the same events.
	 * @see {@link FormFieldChange}
	 */
	onFieldChange(listener: (fieldId: string, value: unknown) => void): () => void;
	/**
	 * Read-only observable of the same field writes {@link FormControllerContext.onFieldChange} reports, as
	 * {@link FormFieldChange} objects. Use it when you want to compose changes with `craftercms.libs.rxjs`
	 * operators.
	 *
	 * @remarks
	 * **When to use it.** Pick `fieldChanges` when a plain callback gets awkward:
	 * - filter to some fields (`filter`);
	 * - wait for the author to pause typing (`debounceTime`) or skip repeated values (`map` to the value, then `distinctUntilChanged`);
	 * - run async work and drop stale results when a newer edit arrives (`switchMap`);
	 * - combine edits with other streams (`combineLatest`, `merge`, `withLatestFrom`);
	 * - stop on a condition (`takeUntil`, `takeWhile`, `first`).
	 *
	 * For a simple per-change reaction, {@link FormControllerContext.onFieldChange} is shorter and needs no
	 * RxJS. Both are driven by the same events, in the same order, with the same values.
	 *
	 * **What it delivers.** The observable is cold and unicast per subscription: each `subscribe` is
	 * independent, sees only changes written after it subscribed (no replay of the initial or latest value),
	 * and emits synchronously on the write. It never errors. Read the field id and value off each
	 * {@link FormFieldChange}; `value` is read synchronously when each subscriber is notified, not captured once
	 * per write. If an earlier subscriber writes the same field during delivery, the nested change is delivered
	 * first and later subscribers receive the newer value for the outer event too, so filter by field or compare
	 * values when that matters. Operators that delay delivery pass along the value as of the notification, not
	 * the field's current value.
	 *
	 * **Read-only.** The host never hands out its internal subject. The observable has no `next`, `error` or
	 * `complete`, so a controller cannot push events into the form or end the stream for others.
	 *
	 * **Lifecycle.** The observable **completes** for every subscriber when the form this context belongs to
	 * is torn down (stack pop, unmount, replacement attach, or a failed `initialize`). A pipeline made only
	 * of operators that pass completion straight through (`filter`, `map`, `distinctUntilChanged`, `take`...)
	 * ends at that moment, and `takeUntil` / `finalize` / the `complete` callback run then. Two caveats:
	 * - Operators that hold an inner observable (`switchMap`, `concatMap`, `mergeMap`, `exhaustMap`) only
	 *   complete once that inner observable settles, so in-flight work (a fetch, a timer) keeps running past
	 *   teardown. Keep the `Subscription` and unsubscribe it from the cleanup you return from `initialize`;
	 *   the host runs that cleanup right after completing the subscribers.
	 * - Operators that buffer, such as `debounceTime`, emit their pending value when the source completes. A
	 *   `setValue` made from that last delivery is ignored with a warning, because the context is already
	 *   disposed.
	 *
	 * Unsubscribe earlier to stop delivery sooner. Subscribing after teardown logs a warning and completes
	 * immediately without emitting. In the `isFieldRelevant` context (which has no live form) the property
	 * exists but completes immediately without emitting. Stop any non-RxJS work you start from a subscription
	 * (timers, fetches) in your own cleanup.
	 *
	 * Like `onFieldChange`, it also fires for writes made through {@link FormControllerContext.setValue}, so
	 * writing to a field you are observing can loop. Break the cycle by filtering the field out
	 * (`filter((change) => change.fieldId !== 'slug_s')`), or by comparing values: `map((change) => change.value)`
	 * then `distinctUntilChanged()`, or `distinctUntilChanged((a, b) => a.fieldId === b.fieldId && Object.is(a.value, b.value))`.
	 * A bare `distinctUntilChanged()` on the changes never skips anything, because each change is a new object.
	 *
	 * @example
	 * Debounce edits to one field, skip repeated values and write a derived value. It never writes to
	 * `title_s`, so it cannot feed itself.
	 * ```js
	 * const { filter, debounceTime, map, distinctUntilChanged } = craftercms.libs.rxjs;
	 *
	 * initialize(ctx) {
	 *   ctx.fieldChanges
	 *     .pipe(
	 *       filter((change) => change.fieldId === 'title_s'),
	 *       debounceTime(400),
	 *       map((change) => String(change.value ?? '').toLowerCase().replace(/\s+/g, '-')),
	 *       distinctUntilChanged()
	 *     )
	 *     .subscribe((slug) => ctx.setValue('slug_s', slug));
	 *   // Nothing to clean up: this pipeline completes when the form closes.
	 * }
	 * ```
	 *
	 * @example
	 * Cancel stale async work with `switchMap`. The returned cleanup unsubscribes, so a lookup still in
	 * flight when the form closes is cancelled instead of writing to a form that is gone.
	 * ```js
	 * const { filter, switchMap, from } = craftercms.libs.rxjs;
	 *
	 * initialize(ctx) {
	 *   const subscription = ctx.fieldChanges
	 *     .pipe(
	 *       filter((change) => change.fieldId === 'sku_s'),
	 *       switchMap((change) => from(lookupProduct(change.value))) // a newer edit drops the pending lookup
	 *     )
	 *     .subscribe((product) => ctx.setValue('productName_s', product?.name ?? ''));
	 *   return () => subscription.unsubscribe();
	 * }
	 * ```
	 *
	 * @see {@link FormControllerContext.onFieldChange} for the callback form of the same events.
	 * @see {@link FormFieldChange}
	 */
	readonly fieldChanges: Observable<FormFieldChange>;
	/**
	 * Shows a snackbar notification. Use for informational messages; veto messaging can also go on the `onBeforeSave` return.
	 * Ignored (with a warning) once this context was torn down, including when `initialize` failed.
	 */
	notify(message: string, severity?: FormControllerNotifySeverity): void;
}

/**
 * FE2 form-controller contract. One positive integer, not semver.
 * A missing `apiVersion` counts as this value. Any other value is rejected at load.
 * Published as `craftercms.formsEngine.formControllers.apiVersion`.
 * Bump only for a breaking change. Policy: `docs/type-builder-forms-engine-plugins.md` §10.
 */
export const FORM_CONTROLLER_API_VERSION = 1 as const;

/**
 * ESM export shape for `/config/studio/content-types/{id}/form-controller.js`.
 * Default export (or named `formController`) must satisfy this contract.
 */
export interface FormController {
	/**
	 * Contract version. Currently {@link FORM_CONTROLLER_API_VERSION}.
	 * A missing value counts as that version. Any other value is refused at load.
	 */
	apiVersion?: typeof FORM_CONTROLLER_API_VERSION;
	/**
	 * Called once per form that owns a controller (root and embedded children), after
	 * form atoms exist and relevance is resolved. Not called for repeat stacked forms — those
	 * are part of the parent form and reuse its deny-list.
	 * May return a cleanup (or a Promise of cleanup) invoked on form unmount / stack pop.
	 */
	initialize?(ctx: FormControllerContext): MaybePromise<void | (() => void)>;
	/**
	 * Return false to omit the field (or repeat definition) from the rendered form.
	 * Default true. Async allowed — host awaits before first field paint for that form.
	 * Runs **before** `initialize`, on a {@link FormControllerRelevanceContext} snapshot, so it must not
	 * rely on anything `initialize` sets up. The same snapshot is used when a parent validates an
	 * embedded component that was never opened. A commit keeps this session's deny-list for the
	 * values handed back, so the parent does not judge those committed values again.
	 * Repeat subfields are judged once by the owning form; the repeat item form reuses that result.
	 */
	isFieldRelevant?(field: ContentTypeField, ctx: FormControllerRelevanceContext): MaybePromise<boolean>;
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
	/** Teardown callbacks for `onFieldChange` listeners and `fieldChanges` subscribers of this entry's context. */
	fieldChangeTeardowns: Set<() => void>;
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
		fieldChangeTeardowns: new Set(),
		fileMissing: false,
		loadFailed: false,
		disposed: false,
		irrelevantFieldPaths: null
	};
}
