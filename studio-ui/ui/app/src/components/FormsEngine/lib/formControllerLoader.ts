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

import { firstValueFrom } from 'rxjs';
import { AjaxError } from 'rxjs/ajax';
import { getText } from '../../../utils/ajax';
import { getFormControllerUrl } from '../../../services/contentTypes';
import type { FormController } from './formControllerTypes';

const SUPPORTED_API_VERSION = 1;

const commonErrorMsg = 'The form will proceed as though no custom type controller exists.';

/** Outcome of attempting to load a content-type-local form controller. */
export type LoadFormControllerResult =
	| { status: 'skipped'; controller: null }
	| { status: 'loaded'; controller: FormController }
	| { status: 'missing'; controller: null }
	| { status: 'failed'; controller: null };

/** Session cache of in-flight / completed loads, keyed by `siteId::contentTypeId`. */
const formControllerCache = new Map<string, Promise<LoadFormControllerResult>>();

/**
 * Builds the session-cache key for a site + content type pair.
 *
 * @param siteId - Active site id
 * @param contentTypeId - Content type id whose `form-controller.js` is being loaded
 * @returns Cache key in the form `siteId::contentTypeId`
 */
function cacheKey(siteId: string, contentTypeId: string): string {
	return `${siteId}::${contentTypeId}`;
}

/**
 * Picks and validates a {@link FormController} from an ESM module export.
 * Accepts `default` or named `formController`; requires `apiVersion` to match
 * the supported API version (defaults to that version when omitted).
 *
 * @param module - Namespace object from dynamic `import()` of the controller source
 * @returns The controller object, or `null` if missing / wrong shape / unsupported version
 */
function resolveControllerExport(module: Record<string, unknown>): FormController | null {
	const candidate = (module.default ?? module.formController) as FormController | undefined;
	if (!candidate || typeof candidate !== 'object') {
		return null;
	}
	const version = (candidate as { apiVersion?: number }).apiVersion ?? SUPPORTED_API_VERSION;
	if (version !== SUPPORTED_API_VERSION) {
		return null;
	}
	return candidate;
}

/**
 * Fetches and ESM-imports a content-type-local `form-controller.js`.
 *
 * Soft-fails on network, parse, or contract errors so the form can continue without a custom
 * controller. Successful and in-flight loads are cached for the session; failed / missing loads
 * are removed from the cache so a later retry can try again.
 *
 * @param siteId - Active site id
 * @param contentTypeId - Content type id that owns the controller file
 * @param hasJsController - When `false`, skips the network call (`status: 'skipped'`)
 * @returns Promise of a {@link LoadFormControllerResult}
 */
export function loadFormController(
	siteId: string,
	contentTypeId: string,
	hasJsController = true
): Promise<LoadFormControllerResult> {
	if (!hasJsController) {
		return Promise.resolve({ status: 'skipped', controller: null });
	}

	const key = cacheKey(siteId, contentTypeId);
	const cached = formControllerCache.get(key);
	if (cached) {
		return cached;
	}

	const loading = (async (): Promise<LoadFormControllerResult> => {
		let blobUrl: string | undefined;
		try {
			const ajax = await firstValueFrom(getText(getFormControllerUrl(siteId, contentTypeId)));
			const source = ajax.response as string;
			const blob = new Blob([source], { type: 'application/javascript' });
			blobUrl = URL.createObjectURL(blob);
			const module = (await import(/* @vite-ignore */ blobUrl)) as Record<string, unknown>;
			const controller = resolveControllerExport(module);
			if (!controller) {
				const exported = module.default ?? module.formController;
				const reportedVersion =
					exported && typeof exported === 'object' ? (exported as { apiVersion?: number }).apiVersion : undefined;
				if (reportedVersion != null && reportedVersion !== SUPPORTED_API_VERSION) {
					console.error(
						`The form controller for "${contentTypeId}" reports unsupported apiVersion ${reportedVersion} (expected ${SUPPORTED_API_VERSION}). ${commonErrorMsg}`
					);
				} else {
					console.error(
						`The form controller for "${contentTypeId}" loaded but did not export a FormController (default or named formController). ${commonErrorMsg}`
					);
				}
				formControllerCache.delete(key);
				return { status: 'failed', controller: null };
			}
			return { status: 'loaded', controller };
		} catch (error) {
			formControllerCache.delete(key);
			const isMissing =
				(error && typeof error === 'object' && 'name' in error && (error as { name: string }).name === 'AjaxError'
					? (error as AjaxError).status
					: undefined) === 404;
			if (isMissing) {
				console.error(
					`The form controller for "${contentTypeId}" was not found (form-controller.js missing). ${commonErrorMsg}`,
					error
				);
				return { status: 'missing', controller: null };
			}
			console.error(
				`Error trying to load the form controller for "${contentTypeId}". Check that form-controller.js exists next to the content type definition and exports a valid FE2 FormController. ${commonErrorMsg}`,
				error
			);
			return { status: 'failed', controller: null };
		} finally {
			if (blobUrl) {
				URL.revokeObjectURL(blobUrl);
			}
		}
	})();

	formControllerCache.set(key, loading);
	return loading;
}

/**
 * Returns the cached controller load result promise for a site + content type, if any.
 * Includes in-flight loads; does not start a new fetch.
 *
 * @param siteId - Active site id
 * @param contentTypeId - Content type id whose cache entry to look up
 * @returns The cached promise, or `undefined` when nothing has been loaded yet
 */
export function getCachedFormController(
	siteId: string,
	contentTypeId: string
): Promise<LoadFormControllerResult> | undefined {
	return formControllerCache.get(cacheKey(siteId, contentTypeId));
}

/**
 * Clears the session form-controller cache.
 * Pass both `siteId` and `contentTypeId` to remove one entry; omit both to clear all.
 *
 * @param siteId - Optional site id of the entry to clear
 * @param contentTypeId - Optional content type id of the entry to clear (required with `siteId`)
 */
export function clearFormControllerCache(siteId?: string, contentTypeId?: string): void {
	if (siteId != null && contentTypeId != null) {
		formControllerCache.delete(cacheKey(siteId, contentTypeId));
		return;
	}
	formControllerCache.clear();
}

/**
 * Public runtime surface for form-controller load/cache helpers (tests & debugging).
 * Authors do not need this; FE2 loads controllers during form bootstrap.
 *
 * - `load` → {@link loadFormController}
 * - `getCached` → {@link getCachedFormController}
 * - `clearCache` → {@link clearFormControllerCache}
 */
export const formsEngineFormControllersHost = {
	load: loadFormController,
	getCached: getCachedFormController,
	clearCache: clearFormControllerCache
};
