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

/** Filename of the content-type-local FE2 form controller. */
export const FORM_CONTROLLER_FILE_NAME = 'form-controller.js';

/**
 * Starter ESM module written into a new `form-controller.js`.
 * Host contract: `FormController` / `FormControllerContext` (apiVersion 1).
 */
export const FORM_CONTROLLER_JS_STUB = `/**
 * Content-type form controller.
 *
 * Loaded only when this type has <controller>true</controller> (hasJsController).
 * Export a FormController object as the default export (or named \`formController\`).
 * This file is Blob-imported, so it must stay a single standalone module.
 * Relative imports are not supported — bundle any dependencies into this file.
 *
 * Context (ctx) highlights:
 *   - getValue(fieldId) / getValues() / setValue(fieldId, value)
 *   - Nested repeat fields via dotted paths: getValue('myRepeat.0.title_s')
 *   - getField(fieldId) — top-level id or dotted path (numeric indexes skipped)
 *   - onFieldChange(listener) — listener(fieldId, value); returns unsubscribe
 *   - notify(message, severity?) — snackbar
 *   - siteId, contentType, path, mode ('create' | 'edit'), isEmbedded, readonly
 *
 * Prefer declarative field visibility via isFieldRelevant (do not toggle DOM).
 * Repeat item forms reuse this parent context; they do not call initialize again.
 * The host unsubscribes onFieldChange listeners on teardown; returning a cleanup
 * from initialize is still the place for any other resources you open.
 */
export default {
	/** Bump only when breaking the host-controller contract. */
	apiVersion: 1,

	/**
	 * Called once per form that owns a controller (root and embedded children),
	 * after form atoms/context exist, before fields paint.
	 * May return a cleanup function (or a Promise of one) for unmount / stack pop.
	 */
	initialize(ctx) {
		// Example: react to a field change
		// const unsubscribe = ctx.onFieldChange((fieldId, value) => {
		//   if (fieldId === 'title_s') {
		//     console.log('title is now', value);
		//   }
		// });
		// return unsubscribe;
	},

	/**
	 * Return false to omit a field from the rendered form (and ToC).
	 * Evaluated once before first paint; async is allowed (host awaits).
	 * Repeat stacked forms call this against the parent form's context.
	 */
	isFieldRelevant(field, ctx) {
		// Example: hide a field in create mode
		// if (field.id === 'legacyId_s' && ctx.mode === 'create') return false;
		return true;
	},

	/**
	 * Return false, { ok: false, message }, or throw/reject to veto save after
	 * client validation, before XML write. Async is allowed.
	 * Not called for repeat item commits.
	 */
	async onBeforeSave(ctx) {
		// Example: require a custom rule before save
		// if (!ctx.getValue('agree_b')) {
		//   return { ok: false, message: 'You must agree before saving.' };
		// }
		return true;
	}
};
`;
