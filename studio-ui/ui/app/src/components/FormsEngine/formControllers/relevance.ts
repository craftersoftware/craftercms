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
import type { Dispatch as ReduxDispatch } from 'redux';
import { retrieveProperty } from '../../../utils/object';
import { showSystemNotification } from '../../../state/actions/system';
import { loadFormController } from './loader';
import { collectRelevanceTargets, getFieldFromContentType, parseFieldValuePath } from './runtime';
import type { FormController, FormControllerContext } from './types';

const detachedWriteWarning =
	'Form controller writes are unavailable while resolving relevance for an embedded component.';

export interface DetachedFormControllerContextArgs {
	siteId: string;
	contentType: ContentType;
	values: Record<string, unknown>;
	dispatch: ReduxDispatch;
}

/**
 * Read-only {@link FormControllerContext} over an embedded component's values.
 * Used to resolve that component's own `isFieldRelevant` without opening its form.
 * `setValue` and `onFieldChange` are inert: relevance must not mutate the component.
 */
export function createDetachedFormControllerContext({
	siteId,
	contentType,
	values,
	dispatch
}: DetachedFormControllerContextArgs): FormControllerContext {
	return {
		siteId,
		contentType,
		path: undefined,
		mode: 'edit',
		isEmbedded: true,
		readonly: true,
		getValues() {
			return { ...values };
		},
		getValue(fieldId) {
			if (Object.prototype.hasOwnProperty.call(values, fieldId)) {
				return values[fieldId];
			}
			const parsed = parseFieldValuePath(fieldId);
			if (!parsed) return undefined;
			const root = values[parsed.rootId];
			if (root == null || typeof root !== 'object') return undefined;
			try {
				return retrieveProperty(root as object, parsed.nestedPath);
			} catch {
				return undefined;
			}
		},
		setValue() {
			console.warn(detachedWriteWarning);
		},
		getField(fieldId) {
			return getFieldFromContentType(contentType, fieldId);
		},
		onFieldChange() {
			console.warn(detachedWriteWarning);
			return () => undefined;
		},
		notify(message, severity = 'info') {
			dispatch(showSystemNotification({ message, options: { variant: severity } }));
		}
	};
}

/**
 * Keyed by controller, then by component value. A controller edit clears the loader cache and the
 * next load yields a new controller object, so verdicts from the previous code are never reused.
 * The controller is per site and type, so it also scopes the entry. Values update immutably, so a
 * new component object is a new resolution and an unchanged one is free. Both levels are weak.
 */
const embeddedRelevanceByController = new WeakMap<FormController, WeakMap<object, Promise<Set<string>>>>();

function getComponentRelevanceCache(controller: FormController): WeakMap<object, Promise<Set<string>>> {
	let byComponent = embeddedRelevanceByController.get(controller);
	if (!byComponent) {
		byComponent = new WeakMap();
		embeddedRelevanceByController.set(controller, byComponent);
	}
	return byComponent;
}

async function considerField(
	controller: FormController,
	ctx: FormControllerContext,
	path: string,
	field: ContentTypeField,
	denied: Set<string>
): Promise<void> {
	try {
		const relevant = await controller.isFieldRelevant!(field, ctx);
		if (relevant === false) denied.add(path);
	} catch (error) {
		// Fail open and log only. This runs inside validation, so a snackbar would fire on every revalidation.
		console.error(
			`Form controller isFieldRelevant for embedded field "${path}" failed. The field will stay validated.`,
			error
		);
	}
}

async function resolveEmbeddedFieldPaths(
	controller: FormController,
	ctx: FormControllerContext,
	contentType: ContentType
): Promise<Set<string>> {
	const denied = new Set<string>();
	await Promise.all(
		collectRelevanceTargets(Object.values(contentType.fields ?? {})).map(({ path, field }) =>
			considerField(controller, ctx, path, field, denied)
		)
	);
	return denied;
}

/**
 * Resolves the deny-list for an embedded component from that type's own form controller.
 * Returns `null` when the type has no controller or no `isFieldRelevant` hook.
 * Those fast paths are not cached: a later load of the controller must still be able to run.
 */
export function createEmbeddedRelevanceResolver(
	siteId: string,
	dispatch: ReduxDispatch
): (contentType: ContentType, component: Record<string, unknown>) => Promise<Set<string> | null> {
	return async (contentType, component) => {
		if (!contentType?.hasJsController) return null;
		if (component == null || typeof component !== 'object') return null;
		const loadResult = await loadFormController(siteId, contentType.id);
		if (loadResult.status !== 'loaded' || !loadResult.controller.isFieldRelevant) return null;
		const byComponent = getComponentRelevanceCache(loadResult.controller);
		const cached = byComponent.get(component);
		if (cached) return cached;
		const ctx = createDetachedFormControllerContext({ siteId, contentType, values: component, dispatch });
		const pending = resolveEmbeddedFieldPaths(loadResult.controller, ctx, contentType);
		byComponent.set(component, pending);
		return pending;
	};
}
