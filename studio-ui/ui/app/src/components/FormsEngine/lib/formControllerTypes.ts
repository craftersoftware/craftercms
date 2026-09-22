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
import type { Observable } from 'rxjs';

export type MaybePromise<T> = T | Promise<T>;

/** Form open mode exposed to content-type-local form controllers. */
export type FormControllerMode = 'create' | 'edit' | 'embedded' | 'repeat';

/**
 * Narrow host API over FE2 form state for type-local `form-controller.js` modules.
 * Controllers must not import React or reach into the DOM for field visibility;
 * use `isFieldRelevant` instead.
 */
export interface FormControllerContext {
	siteId: string;
	contentType: ContentType;
	path: string | undefined;
	mode: FormControllerMode;
	readonly: boolean;
	isCreateMode: boolean;
	isEmbedded: boolean;
	getValues(): Record<string, unknown>;
	getValue(fieldId: string): unknown;
	setValue(fieldId: string, value: unknown): void;
	getField(fieldId: string): ContentTypeField | undefined;
	getContentType(id?: string): ContentType | undefined;
	/**
	 * Emits the field id whenever a field value changes (after initialization).
	 * Subscribe in `initialize` and unsubscribe in the returned cleanup.
	 */
	fieldUpdateStream: Observable<string>;
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
	 * Called once after form context/atoms exist.
	 * May return a cleanup (or a Promise of cleanup) invoked on form unmount / stack pop.
	 */
	initialize?(ctx: FormControllerContext): MaybePromise<void | (() => void)>;
	/**
	 * Return false to omit the field (or repeat definition) from the rendered form.
	 * Default true. Async allowed — host awaits before first field paint for that form.
	 */
	isFieldRelevant?(field: ContentTypeField, ctx: FormControllerContext): MaybePromise<boolean>;
	/**
	 * Return false / rejected promise to veto save.
	 * Called in `useSaveForm` after client validation snapshot, before XML write.
	 */
	onBeforeSave?(ctx: FormControllerContext): MaybePromise<boolean>;
}
