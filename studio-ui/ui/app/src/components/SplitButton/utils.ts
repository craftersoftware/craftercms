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

import { MutableRefObject } from 'react';

export interface SplitButtonOption {
	id: string;
	label: string;
	callback(e): void;
}

export interface SplitButtonProps {
	options: SplitButtonOption[];
	defaultSelected?: string;
	disablePortal?: boolean;
	disabled?: boolean;
	loading?: boolean;
	storageKey?: string;
	fullWidth?: boolean;
	/** Id of visible text that explains why the button is unavailable. */
	describedBy?: string;
}

export interface SplitButtonUIProps {
	options: SplitButtonOption[];
	disablePortal?: boolean;
	loading?: boolean;
	disabled?: boolean;
	anchorRef: MutableRefObject<HTMLDivElement>;
	selectedIndex: number;
	fullWidth?: SplitButtonProps['fullWidth'];
	describedBy?: string;
	open: boolean;
	handleClick(e): void;
	handleToggle(e): void;
	handleClose(e): void;
	handleMenuItemClick(e, index): void;
}
