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
import { getText } from '../../../utils/ajax';
import { getFormControllerUrl } from '../../../services/contentTypes';
import type { FormController } from './formControllerTypes';

const SUPPORTED_API_VERSION = 1;

const commonErrorMsg = 'The form will proceed as though no custom type controller exists.';

/** Session cache of in-flight / completed loads, keyed by `siteId::contentTypeId`. */
const formControllerCache = new Map<string, Promise<FormController | null>>();

function cacheKey(siteId: string, contentTypeId: string): string {
	return `${siteId}::${contentTypeId}`;
}

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
 * Soft-fails (logs + returns `null`) on network, parse, or contract errors.
 * Pass `hasJsController: false` to skip the network call.
 */
export function loadFormController(
	siteId: string,
	contentTypeId: string,
	hasJsController = true
): Promise<FormController | null> {
	if (!hasJsController) {
		return Promise.resolve(null);
	}

	const key = cacheKey(siteId, contentTypeId);
	const cached = formControllerCache.get(key);
	if (cached) {
		return cached;
	}

	const loading = (async (): Promise<FormController | null> => {
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
				return null;
			}
			return controller;
		} catch (error) {
			console.error(
				`Error trying to load the form controller for "${contentTypeId}". Check that form-controller.js exists next to the content type definition and exports a valid FE2 FormController. ${commonErrorMsg}`,
				error
			);
			formControllerCache.delete(key);
			return null;
		} finally {
			if (blobUrl) {
				URL.revokeObjectURL(blobUrl);
			}
		}
	})();

	formControllerCache.set(key, loading);
	return loading;
}

/** Returns the cached controller promise if present (including in-flight loads). */
export function getCachedFormController(
	siteId: string,
	contentTypeId: string
): Promise<FormController | null> | undefined {
	return formControllerCache.get(cacheKey(siteId, contentTypeId));
}

/**
 * Clears the session form-controller cache.
 * Pass site + content type to clear one entry; omit both to clear all.
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
 */
export const formsEngineFormControllersHost = {
	load: loadFormController,
	getCached: getCachedFormController,
	clearCache: clearFormControllerCache
};
