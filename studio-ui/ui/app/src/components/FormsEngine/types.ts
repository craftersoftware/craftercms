/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import { ContentTypeField } from '../../models';
import ContentType from '../../models/ContentType';
import { createStore } from 'jotai';
import type { RESET } from 'jotai/utils';
import type { WritableAtom } from 'jotai/vanilla';
import type { ResolvedDataSources } from './dataSources/types';

/**
 * A control value type erased for registries and maps that hold controls of different value types.
 * A `ComponentType<ControlProps<string>>` is not assignable to `ComponentType<ControlProps<unknown>>`,
 * so storage and lookup use this instead. Authors type their controls with a concrete `V`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyValue = any;

/**
 * Props every FE2 control receives. Public contract for plugin controls.
 * `V` types the control's value, e.g. `ControlProps<string>` or `ControlProps<NodeSelectorItem[]>`.
 */
export interface ControlProps<V = unknown> {
	value: V;
	setValue(newValue: V): void;
	/** The field definition. Read only: a control never changes it. */
	field: Readonly<ContentTypeField>;
	/** The content type that owns the field. Read only. */
	contentType: Readonly<ContentType>;
	readonly: boolean;
	autoFocus: boolean;
	/**
	 * Host-generated id, unique per field instance. The default field wrapper's label points here (`htmlFor`),
	 * so put it on the focusable input element.
	 */
	inputId: string;
	/** Host-generated id of the field wrapper's label. Use it for `aria-labelledby` or a MUI `labelId`. */
	labelId: string;
	dataSources?: ResolvedDataSources;
}

export type JotaiStore = ReturnType<typeof createStore>;

// Jotai hides this type, so we need to redefine it here.
export type SetStateActionWithReset<Value> = Value | typeof RESET | ((prev: Value) => Value | typeof RESET);

export type AtomWithStorage<T = boolean> = WritableAtom<T, [SetStateActionWithReset<T>], T>;
