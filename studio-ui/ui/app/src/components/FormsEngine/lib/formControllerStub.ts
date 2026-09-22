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
 *
 * Context (ctx) highlights:
 *   - getValue(fieldId) / getValues() / setValue(fieldId, value)
 *   - getField(fieldId) / getContentType(id?)
 *   - fieldUpdateStream — Observable<string> of field ids that changed
 *   - siteId, contentType, path, mode ('create' | 'edit' | 'embedded' | 'repeat')
 *
 * Prefer declarative field visibility via isFieldRelevant (do not toggle DOM).
 * Unsubscribe any fieldUpdateStream subscription in the cleanup returned from initialize.
 */
export default {
	/** Bump only when breaking the host-controller contract. */
	apiVersion: 1,

	/**
	 * Called once after form atoms/context exist, before fields paint.
	 * May return a cleanup function (or a Promise of one) for unmount / stack pop.
	 */
	initialize(ctx) {
		// Example: react to a field change
		// const sub = ctx.fieldUpdateStream.subscribe((fieldId) => {
		//   if (fieldId === 'title_s') {
		//     console.log('title is now', ctx.getValue(fieldId));
		//   }
		// });
		// return () => sub.unsubscribe();
	},

	/**
	 * Return false to omit a field from the rendered form (and ToC).
	 * Evaluated once before first paint; async is allowed (host awaits).
	 */
	isFieldRelevant(field, ctx) {
		// Example: hide a field in create mode
		// if (field.id === 'legacyId_s' && ctx.isCreateMode) return false;
		return true;
	},

	/**
	 * Return false (or throw / reject) to veto save after client validation,
	 * before XML write. Async is allowed.
	 */
	async onBeforeSave(ctx) {
		// Example: require a custom rule before save
		// if (!ctx.getValue('agree_b')) return false;
		return true;
	}
};
`;
