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

import { createElement, forwardRef, use } from 'react';
import type {
	FormsEngineField as FormsEngineFieldComponent,
	FormsEngineFieldProps
} from '../components/FormsEngineField';
import type { useFieldValue as useFieldValueHook } from './formsEngineContext';

/**
 * Members of the `craftercms.formsEngine.controls` host that are the heavy part of FE2: the field chrome
 * (`FormsEngineField`) and the hook over the form's atoms (`useFieldValue`). `craftercms.ts` builds the host at
 * Studio startup, so this module is deliberately light: it holds thin stand-ins and loads the real members
 * (`hostMembersImpl`) the first time one of them is used, instead of dragging FE2 and Type Builder into the
 * startup bundle. Plugins keep using `craftercms.formsEngine.controls.FormsEngineField` / `.useFieldValue` as before.
 *
 * Whenever a form renders, `renderControl` has already evaluated `hostMembersImpl`, which installs the real
 * members below. In that case (the only one a plugin control can render in) the stand-ins render the real member
 * synchronously, with no extra Suspense. The lazy load is only a fallback for the member being used before any
 * form has rendered; the stand-in then suspends until the chunk arrives.
 */
interface HostMembers {
	FormsEngineField: typeof FormsEngineFieldComponent;
	useFieldValue: typeof useFieldValueHook;
}

let installed: HostMembers | undefined;
let loading: Promise<HostMembers> | undefined;

/** Called by `hostMembersImpl` when it is evaluated. Not part of the plugin API. */
export function installHostMembers(members: HostMembers): void {
	installed = members;
}

function loadHostMembers(): Promise<HostMembers> {
	return (loading ??= import('./hostMembersImpl').then(
		() => installed,
		(error) => {
			// Don't cache a failed chunk load, so a later render can retry.
			loading = undefined;
			throw error;
		}
	));
}

export const FormsEngineField = forwardRef<HTMLDivElement, FormsEngineFieldProps>(
	function FormsEngineField(props, ref) {
		const members = installed ?? use(loadHostMembers());
		return createElement(members.FormsEngineField, { ...props, ref });
	}
) as typeof FormsEngineFieldComponent;

export function useFieldValue<T = unknown>(fieldId: string): [T | undefined, (value: T) => void, boolean] {
	const members = installed ?? use(loadHostMembers());
	return members.useFieldValue<T>(fieldId);
}
