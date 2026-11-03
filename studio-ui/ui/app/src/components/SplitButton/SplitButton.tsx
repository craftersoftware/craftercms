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

import React, { useEffect } from 'react';
import SplitButtonUI from './SplitButtonUI';
import { indexOfOption, planMenuPick, resolveSelectedIndex, SplitButtonProps } from './utils';
import {
	getStoredSaveButtonSubAction,
	removeStoredSaveButtonSubAction,
	setStoredSaveButtonSubAction
} from '../../utils/state';
import useActiveUser from '../../hooks/useActiveUser';

export function SplitButton(props: SplitButtonProps) {
	const {
		options,
		defaultSelected = options?.[0].id,
		selectedId,
		onSelect,
		onClick,
		disablePortal = true,
		disabled,
		loading,
		storageKey,
		fullWidth
	} = props;
	const controlled = selectedId !== undefined;
	const [open, setOpen] = React.useState(false);
	const user = useActiveUser();
	const anchorRef = React.useRef<HTMLDivElement>(null);

	const [selectedIndexState, setSelectedIndex] = React.useState(() => indexOfOption(options, defaultSelected));
	const selectedIndex = resolveSelectedIndex({ options, selectedId, stateIndex: selectedIndexState });

	useEffect(() => {
		if (controlled || !storageKey) return;
		const storedValue = getStoredSaveButtonSubAction(user.username, storageKey);
		if (storedValue) {
			const index = options.findIndex((option) => option.id === storedValue);
			if (index !== -1) {
				setSelectedIndex(index);
			} else {
				removeStoredSaveButtonSubAction(user.username, storageKey);
			}
		}
	}, [controlled, storageKey, options, user.username]);

	const handleClick = (e) => {
		if (onClick) onClick(e);
		else options[selectedIndex]?.callback(e);
	};

	const handleMenuItemClick = (event: React.MouseEvent<Element, MouseEvent>, index: number) => {
		// A save can start with this menu still open. Ignore the pick so it cannot change that save.
		const pick = planMenuPick({ disabled, loading, controlled, storageKey });
		if (pick.ignore) {
			setOpen(false);
			return;
		}
		if (pick.remember) setSelectedIndex(index);
		if (pick.persist) setStoredSaveButtonSubAction(user.username, storageKey, options[index].id);
		onSelect?.(options[index].id);
		setOpen(false);
		options[index]?.callback(event);
	};

	const handleToggle = () => {
		setOpen((prevOpen) => !prevOpen);
	};

	const handleClose = (event: MouseEvent | TouchEvent) => {
		if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
			return;
		}

		setOpen(false);
	};

	return (
		<SplitButtonUI
			options={options}
			loading={loading}
			disablePortal={disablePortal}
			disabled={disabled}
			anchorRef={anchorRef}
			selectedIndex={selectedIndex}
			handleClick={handleClick}
			open={open}
			handleToggle={handleToggle}
			handleClose={handleClose}
			handleMenuItemClick={handleMenuItemClick}
			fullWidth={fullWidth}
		/>
	);
}

export default SplitButton;
