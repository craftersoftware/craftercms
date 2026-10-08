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
import { XmlKeys } from '../lib/formConsts';
import { loadFormController } from './loader';
import { getFieldFromContentType, readValueFromSnapshot } from './fieldPaths';
import type { FormController, FormControllerMode, FormControllerRelevanceContext } from './types';

// Single relevance contract for every form. `isFieldRelevant` always runs before `initialize`, on a
// read-only snapshot built by `createRelevanceContext`: once when a form opens, and once when a
// parent validates a component that was never opened this session. A commit keeps that session's
// deny-list, so the parent does not judge the new value object again.

/**
 * Save still requires these, so `isFieldRelevant` is never asked to hide them.
 * A hidden empty `internal-name` would otherwise block save with an alert for a field the author cannot see.
 */
export const SAVE_MINIMUM_FIELD_IDS = new Set<string>([XmlKeys.fileName, XmlKeys.internalName]);

/** Top-level fields plus one level of repeat subfields, addressed by qualified path. */
export function collectRelevanceTargets(fields: ContentTypeField[]): Array<{ path: string; field: ContentTypeField }> {
	const targets: Array<{ path: string; field: ContentTypeField }> = [];
	for (const field of fields) {
		if (SAVE_MINIMUM_FIELD_IDS.has(field.id)) continue;
		targets.push({ path: field.id, field });
		if (field.type === 'repeat' && field.fields) {
			for (const subField of Object.values(field.fields)) {
				if (SAVE_MINIMUM_FIELD_IDS.has(subField.id)) continue;
				targets.push({ path: `${field.id}.${subField.id}`, field: subField });
			}
		}
	}
	return targets;
}

export interface RelevanceContextArgs {
	siteId: string;
	contentType: ContentType;
	/** Values as loaded, before `initialize`. Not copied: the snapshot must not be mutated. */
	values: Record<string, unknown>;
	path: string | undefined;
	mode: FormControllerMode;
	isEmbedded: boolean;
}

const relevanceSideEffectWarning =
	'Form controller isFieldRelevant must not write, subscribe or notify. The call was ignored.';

/**
 * The only context `isFieldRelevant` ever receives. Typed as {@link FormControllerRelevanceContext};
 * the inert write/subscribe/notify stubs only exist so untyped controllers get a warning, not a throw.
 */
export function createRelevanceContext({
	siteId,
	contentType,
	values,
	path,
	mode,
	isEmbedded
}: RelevanceContextArgs): FormControllerRelevanceContext {
	const warn = () => console.warn(relevanceSideEffectWarning);
	const ctx: FormControllerRelevanceContext = {
		siteId,
		contentType,
		path,
		mode,
		isEmbedded,
		getValues() {
			return { ...values };
		},
		getValue(fieldId) {
			return readValueFromSnapshot(values, fieldId);
		},
		getField(fieldId) {
			return getFieldFromContentType(contentType, fieldId);
		}
	};
	return Object.assign(ctx, {
		setValue: warn,
		notify: warn,
		onFieldChange() {
			warn();
			return () => undefined;
		}
	});
}

export interface FieldRelevanceResult {
	/** Qualified paths the controller rejected. */
	denied: Set<string>;
	/** Fields whose hook threw. They fail open (stay visible and validated). */
	failedCount: number;
}

/**
 * Awaits `isFieldRelevant` for each target. A field whose hook throws fails open and is logged;
 * the caller decides whether to surface `failedCount`.
 */
export async function resolveFieldRelevance(
	controller: FormController,
	ctx: FormControllerRelevanceContext,
	targets: Array<{ path: string; field: ContentTypeField }>
): Promise<FieldRelevanceResult> {
	const denied = new Set<string>();
	let failedCount = 0;
	await Promise.all(
		targets.map(async ({ path, field }) => {
			try {
				const relevant = await controller.isFieldRelevant!(field, ctx);
				if (relevant === false) denied.add(path);
			} catch (error) {
				failedCount += 1;
				console.error(
					`Form controller isFieldRelevant for field "${path}" failed. The field will remain visible and validated.`,
					error
				);
			}
		})
	);
	return { denied, failedCount };
}

/**
 * Keyed by controller, then by component value, then by item path. A controller edit clears the
 * loader cache and the next load yields a new controller object, so verdicts from the previous code
 * are never reused. The controller is per site and type, so it also scopes the entry. Values update
 * immutably, so a new component object is a new resolution and an unchanged one is free.
 */
const componentRelevanceByController = new WeakMap<
	FormController,
	WeakMap<object, Map<string, Promise<FieldRelevanceResult>>>
>();

function getComponentRelevanceCache(controller: FormController, component: object) {
	let byComponent = componentRelevanceByController.get(controller);
	if (!byComponent) {
		byComponent = new WeakMap();
		componentRelevanceByController.set(controller, byComponent);
	}
	let byPath = byComponent.get(component);
	if (!byPath) {
		byPath = new Map();
		byComponent.set(component, byPath);
	}
	return byPath;
}

/**
 * Relevance for an existing embedded component, from that component's own type controller.
 * An existing component is always judged in `edit` mode, as it would open.
 * Returns `null` when the type has no controller or no `isFieldRelevant` hook. Those fast paths are
 * not cached: a later load of the controller must still be able to run.
 * An open form passes the `controller` it already loaded, so the verdict comes from the same code
 * its `initialize` runs. Parent validation of a component this session already committed does not
 * call this; it uses {@link readCommittedRelevance}.
 */
export async function resolveComponentRelevance({
	siteId,
	contentType,
	component,
	path,
	controller: loadedController
}: {
	siteId: string;
	contentType: ContentType;
	component: Record<string, unknown>;
	path: string | undefined;
	controller?: FormController;
}): Promise<FieldRelevanceResult | null> {
	if (!contentType?.hasJsController) return null;
	if (component == null || typeof component !== 'object') return null;
	let controller = loadedController;
	if (!controller) {
		const loadResult = await loadFormController(siteId, contentType.id);
		if (loadResult.status !== 'loaded') return null;
		controller = loadResult.controller;
	}
	if (!controller.isFieldRelevant) return null;
	const byPath = getComponentRelevanceCache(controller, component);
	const pathKey = path ?? '';
	const cached = byPath.get(pathKey);
	if (cached) return cached;
	const ctx = createRelevanceContext({
		siteId,
		contentType,
		values: component,
		path: path || undefined,
		mode: 'edit',
		isEmbedded: true
	});
	const pending = resolveFieldRelevance(
		controller,
		ctx,
		collectRelevanceTargets(Object.values(contentType.fields ?? {}))
	);
	byPath.set(pathKey, pending);
	return pending;
}

/**
 * Deny-list from the form session that produced `component`, valid only for that controller object.
 * A commit stores it so parent validation matches the fields the child showed, including a hide that
 * depended on `create` mode or on values that have since changed. Relevance
 * stays bootstrap-only: the parent does not re-run the hook on the committed object.
 * Not a field value. A WeakMap entry is not copied by spread or written by the XML serializer.
 * A new controller object (the file was saved) does not match, so the component is judged again.
 */
const committedRelevanceByComponent = new WeakMap<object, { controller: FormController; denied: Set<string> }>();

export function rememberCommittedRelevance(component: object, controller: FormController, denied: Set<string>): void {
	committedRelevanceByComponent.set(component, { controller, denied });
}

/** Drops a stored list. Opening the component starts a new session, which judges it again. */
export function forgetCommittedRelevance(component: object): void {
	committedRelevanceByComponent.delete(component);
}

/**
 * Copies a session deny-list from one component value object to another.
 * Used when an immutable nested `setValue` shallow-copies or replaces a component so
 * {@link createEmbeddedRelevanceResolver} still finds the committed list. The source entry is
 * retained because older snapshots or pending validation may still reference that object.
 */
export function transferCommittedRelevance(from: object, to: object): void {
	if (from === to) return;
	const entry = committedRelevanceByComponent.get(from);
	if (!entry) return;
	committedRelevanceByComponent.set(to, entry);
}

/**
 * The session deny-list when `controller` is the one that produced it.
 * A different controller object drops the list (the file was saved; judge again).
 * `controller === null` (the file failed to load just now) still returns the stored list, so a
 * hidden required field does not become invalid because this validation could not reload the file.
 */
export function readCommittedRelevance(component: object, controller: FormController | null): Set<string> | undefined {
	const entry = committedRelevanceByComponent.get(component);
	if (!entry) return undefined;
	if (controller && entry.controller !== controller) {
		committedRelevanceByComponent.delete(component);
		return undefined;
	}
	return entry.denied;
}

/**
 * Embedded-component resolver handed to validators. A component committed from an open form this
 * session keeps that session's deny-list. Anything else is judged now (edit mode, values as stored).
 * Validation fails open and only logs (inside {@link resolveFieldRelevance}): a snackbar here would
 * fire on every revalidation.
 */
export function createEmbeddedRelevanceResolver(
	siteId: string
): (contentType: ContentType, component: Record<string, unknown>, path?: string) => Promise<Set<string> | null> {
	return async (contentType, component, path) => {
		if (!contentType?.hasJsController) return null;
		if (component == null || typeof component !== 'object') return null;
		const loadResult = await loadFormController(siteId, contentType.id);
		const controller = loadResult.status === 'loaded' ? loadResult.controller : null;
		// This file no longer hides fields. Drop a list stored for an older controller.
		if (controller && !controller.isFieldRelevant) {
			forgetCommittedRelevance(component);
			return null;
		}
		const remembered = readCommittedRelevance(component, controller);
		// An empty set is a real verdict (nothing hidden). Only a miss is `undefined`.
		if (remembered !== undefined) return remembered;
		if (!controller) return null;
		const result = await resolveComponentRelevance({ siteId, contentType, component, path, controller });
		return result?.denied ?? null;
	};
}
