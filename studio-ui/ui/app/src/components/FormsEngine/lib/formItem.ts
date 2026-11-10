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

import { useContext } from 'react';
import type { ContentItem } from '../../../models';
import useSelection from '../../../hooks/useSelection';
import { FormItemKeyContext } from './formsEngineContext';

/**
 * Subscribes to the form's content item through a selector, so the caller re-renders only when what it selected
 * changes (compared with `equalityFn`, `Object.is` by default). The selector receives the item stored under the form's
 * key, or null when the form has no item (create mode) or the store has none yet.
 *
 * Use it in the component that renders the data. Code that only needs the item when a callback or effect runs should
 * call `StableFormContext.getItem()` instead, which doesn't subscribe.
 */
export function useFormItemSelector<T>(
	selector: (item: ContentItem | null) => T,
	equalityFn?: (left: T, right: T) => boolean
): T {
	const key = useContext(FormItemKeyContext);
	return useSelection((state) => selector((key ? state.content.itemsByPath[key] : null) ?? null), equalityFn);
}

/** The whole item. For leaf components that render item metadata; anything else should select what it reads. */
export function useFormItem(): ContentItem | null {
	return useFormItemSelector((item) => item);
}

export function useFormItemPath(): string | null {
	return useFormItemSelector((item) => item?.path ?? null);
}

export function useFormItemLabel(): string | null {
	return useFormItemSelector((item) => item?.label ?? null);
}
