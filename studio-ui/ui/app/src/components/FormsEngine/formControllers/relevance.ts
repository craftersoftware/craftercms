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
import { getFieldFromContentType, parseFieldValuePath, SAVE_MINIMUM_FIELD_IDS } from './runtime';
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
 * One entry per component value. Values update immutably, so a new object is a new resolution
 * and an unchanged component is free. WeakMap drops entries when the value is no longer referenced.
 */
const embeddedRelevanceByComponent = new WeakMap<object, Promise<Set<string> | null>>();

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
	const fields = Object.values(contentType.fields ?? {}).filter((field) => !SAVE_MINIMUM_FIELD_IDS.has(field.id));
	await Promise.all(
		fields.map(async (field) => {
			await considerField(controller, ctx, field.id, field, denied);
			if (field.type !== 'repeat' || !field.fields) return;
			const subFields = Object.values(field.fields).filter((subField) => !SAVE_MINIMUM_FIELD_IDS.has(subField.id));
			await Promise.all(
				subFields.map((subField) => considerField(controller, ctx, `${field.id}.${subField.id}`, subField, denied))
			);
		})
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
		const cached = embeddedRelevanceByComponent.get(component);
		if (cached) return cached;
		const ctx = createDetachedFormControllerContext({ siteId, contentType, values: component, dispatch });
		const pending = resolveEmbeddedFieldPaths(loadResult.controller, ctx, contentType);
		embeddedRelevanceByComponent.set(component, pending);
		return pending;
	};
}
