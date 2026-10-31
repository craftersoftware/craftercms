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

import { useState, useLayoutEffect } from 'react';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import Grow from '@mui/material/Grow';
import Paper from '@mui/material/Paper';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Popper from '@mui/material/Popper';
import { SplitButtonUIProps } from './utils';

export function SplitButtonUI(props: SplitButtonUIProps) {
	const {
		options,
		disablePortal,
		disabled,
		anchorRef,
		selectedIndex,
		handleClick,
		open,
		handleToggle,
		handleClose,
		handleMenuItemClick,
		loading,
		fullWidth
	} = props;

	// Store the width of the anchor element (ButtonGroup) if fullWidth is true
	const [popperWidth, setPopperWidth] = useState<number | undefined>(undefined);

	useLayoutEffect(() => {
		if (fullWidth && anchorRef?.current) {
			setPopperWidth(anchorRef.current.offsetWidth);
		} else {
			setPopperWidth(undefined);
		}
	}, [fullWidth, anchorRef, open]);

	return (
		<>
			<ButtonGroup
				disabled={disabled}
				variant="contained"
				color={options[selectedIndex]?.color ?? 'primary'}
				ref={anchorRef}
				aria-label="split button"
				fullWidth={fullWidth}
			>
				<Button
					color={options[selectedIndex]?.color ?? 'primary'}
					variant="contained"
					loading={loading}
					startIcon={options[selectedIndex]?.icon}
					onClick={handleClick}
				>
					{options[selectedIndex].label}
				</Button>
				{options.length > 1 && (
					<Button
						disabled={loading}
						color={options[selectedIndex]?.color ?? 'primary'}
						size="small"
						aria-controls={open ? 'split-button-menu' : undefined}
						aria-expanded={open ? 'true' : undefined}
						aria-label="select option"
						aria-haspopup="menu"
						onClick={handleToggle}
						sx={{ flex: fullWidth ? 1 : 'unset' }}
					>
						<ArrowDropDownIcon />
					</Button>
				)}
			</ButtonGroup>
			<Popper
				open={open}
				anchorEl={() => anchorRef.current}
				role={undefined}
				transition
				disablePortal={disablePortal}
				sx={{ zIndex: 2 }}
			>
				{({ TransitionProps, placement }) => (
					<Grow
						{...TransitionProps}
						style={{
							transformOrigin: placement === 'bottom' ? 'center top' : 'center bottom'
						}}
					>
						<Paper style={popperWidth ? { minWidth: popperWidth } : undefined}>
							<ClickAwayListener onClickAway={handleClose}>
								<MenuList id="split-button-menu">
									{options.map((option, index) => (
										<MenuItem
											key={option.label}
											disabled={disabled || loading}
											selected={index === selectedIndex}
											onClick={(event) => handleMenuItemClick(event, index)}
										>
											{option.icon ? (
												<ListItemIcon
													sx={option.color ? (theme) => ({ color: theme.palette[option.color].main }) : undefined}
												>
													{option.icon}
												</ListItemIcon>
											) : null}
											{option.label}
										</MenuItem>
									))}
								</MenuList>
							</ClickAwayListener>
						</Paper>
					</Grow>
				)}
			</Popper>
		</>
	);
}

export default SplitButtonUI;
