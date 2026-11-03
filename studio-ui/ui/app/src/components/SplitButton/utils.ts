/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import type { MutableRefObject, ReactNode } from 'react';

export interface SplitButtonOption {
	id: string;
	label: string;
	callback(e): void;
	icon?: ReactNode;
	color?: 'primary' | 'warning';
}

export interface SplitButtonProps {
	options: SplitButtonOption[];
	defaultSelected?: string;
	/** When set, the highlighted action comes from the parent instead of internal state. */
	selectedId?: string;
	/** Fires for a dropdown pick, with that option's id. */
	onSelect?: (id: string) => void;
	/** Main segment click. When set, the option callback is not used for that click. */
	onClick?: (e) => void;
	disablePortal?: boolean;
	disabled?: boolean;
	loading?: boolean;
	storageKey?: string;
	fullWidth?: boolean;
}

export interface SplitButtonUIProps {
	options: SplitButtonOption[];
	disablePortal?: boolean;
	loading?: boolean;
	disabled?: boolean;
	anchorRef: MutableRefObject<HTMLDivElement>;
	selectedIndex: number;
	fullWidth?: SplitButtonProps['fullWidth'];
	open: boolean;
	handleClick(e): void;
	handleToggle(e): void;
	handleClose(e): void;
	handleMenuItemClick(e, index): void;
}

/** Index of the option named by `id`, or 0 when no option has it. */
export function indexOfOption(options: readonly Pick<SplitButtonOption, 'id'>[], id: string | undefined): number {
	const index = options.findIndex((option) => option.id === id);
	return index !== -1 ? index : 0;
}

/**
 * The highlighted option. A parent that passes `selectedId` owns it, and an unknown id falls back to the first
 * option. Otherwise it is the component's own state, which starts at `defaultSelected` (the first option when absent).
 */
export function resolveSelectedIndex(args: {
	options: readonly Pick<SplitButtonOption, 'id'>[];
	selectedId?: string;
	stateIndex: number;
}): number {
	return args.selectedId !== undefined ? indexOfOption(args.options, args.selectedId) : args.stateIndex;
}

/**
 * What a dropdown pick does. While disabled or loading the pick is ignored: the menu may still be open from before.
 * Only the uncontrolled button keeps the pick in its own state, and persists it when it has a `storageKey`.
 * Either way the pick is reported through `onSelect` and the option's own callback.
 */
export function planMenuPick(args: {
	disabled?: boolean;
	loading?: boolean;
	controlled: boolean;
	storageKey?: string;
}): {
	ignore: boolean;
	remember: boolean;
	persist: boolean;
} {
	if (args.disabled || args.loading) return { ignore: true, remember: false, persist: false };
	return { ignore: false, remember: !args.controlled, persist: !args.controlled && Boolean(args.storageKey) };
}

/** Palette colour for the button and the option's icon. Options without one keep the primary look. */
export function optionColor(
	option: Pick<SplitButtonOption, 'color'> | undefined
): NonNullable<SplitButtonOption['color']> {
	return option?.color ?? 'primary';
}
