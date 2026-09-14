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
import { createStore } from 'jotai/index';
import type { RESET } from 'jotai/utils';
import type { WritableAtom } from 'jotai/vanilla';
import type { ResolvedDataSources } from './dataSources/types';

export interface ControlProps {
	value: unknown;
	setValue(newValue: unknown): void;
	field: ContentTypeField;
	contentType: ContentType;
	readonly: boolean;
	autoFocus: boolean;
	dataSources?: ResolvedDataSources;
}

export type JotaiStore = ReturnType<typeof createStore>;

// Jotai hides this type, so we need to redefine it here.
export type SetStateActionWithReset<Value> = Value | typeof RESET | ((prev: Value) => Value | typeof RESET);

export type AtomWithStorage<T = boolean> = WritableAtom<T, [SetStateActionWithReset<T>], T>;
