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

import ArrowDown from '@mui/icons-material/ArrowDropDownRounded';
import Button, { ButtonProps, ButtonTypeMap } from '@mui/material/Button';
import React, { ReactNode, useMemo } from 'react';
import Menu, { menuClasses } from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import { SvgIconTypeMap } from '@mui/material/SvgIcon';
import { OverridableComponent } from '@mui/material/OverridableComponent';
import Tooltip from '@mui/material/Tooltip';
import { FullSxRecord, PartialSxRecord } from '../../models/CustomRecord';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';
import { useIntl } from 'react-intl';

export type ConfirmDropdownClassKey = 'button' | 'menuPaper' | 'helperText';

export type ConfirmDropdownFullSx = FullSxRecord<ConfirmDropdownClassKey>;

export type ConfirmDropdownPartialSx = PartialSxRecord<ConfirmDropdownClassKey>;

interface ConfirmDropdownProps {
	text?: ReactNode;
	cancelText: ReactNode;
	confirmText: ReactNode;
	confirmHelperText?: ReactNode;
	disabled?: boolean;
	buttonVariant?: ButtonTypeMap['props']['variant'];
	classes?: Partial<Record<ConfirmDropdownClassKey, string>>;
	sx?: ConfirmDropdownPartialSx;
	size?: IconButtonProps['size'];
	icon?: OverridableComponent<SvgIconTypeMap>;
	iconColor?: IconButtonProps['color'];
	iconTooltip?: React.ReactNode;
	/**
	 * The accessible name of the icon button. Defaults to `iconTooltip` when it is a string, otherwise to "Confirm".
	 * Pass the item in the name (e.g. "Delete {name}") when the dropdown repeats on a page.
	 **/
	iconLabel?: string;
	buttonProps?: ButtonProps;
	onConfirm(): any;
	onCancel?(): any;
}

function getStyles(sx: ConfirmDropdownPartialSx): ConfirmDropdownFullSx {
	return {
		button: {
			...sx?.button
		},
		menuPaper: {
			maxWidth: '250px',
			...sx?.menuPaper
		},
		helperText: {
			py: 1,
			px: 2,
			...sx?.helperText
		}
	} as Record<ConfirmDropdownClassKey, SxProps<Theme>>;
}

export function ConfirmDropdown(props: ConfirmDropdownProps) {
	const [anchorEl, setAnchorEl] = React.useState(null);
	const sx = getStyles(props.sx);
	const {
		onConfirm,
		onCancel,
		text,
		cancelText,
		confirmText,
		confirmHelperText,
		disabled = false,
		buttonVariant = 'outlined',
		icon: Icon,
		iconColor,
		iconTooltip,
		iconLabel,
		size = 'medium',
		buttonProps = {}
	} = props;
	const { formatMessage } = useIntl();

	const handleClose = () => {
		setAnchorEl(null);
	};

	const handleConfirm = () => {
		handleClose();
		onConfirm();
	};

	const handleCancel = () => {
		handleClose();
		onCancel?.();
	};

	const iconAriaLabel =
		iconLabel ?? (typeof iconTooltip === 'string' ? iconTooltip : formatMessage({ defaultMessage: 'Confirm' }));

	// Not memorizing causes the menu to get misplaced upon opening.
	const iconButton = useMemo(
		() =>
			Icon ? (
				<IconButton
					color={iconColor}
					onClick={(e) => setAnchorEl(e.currentTarget)}
					size={size}
					disabled={disabled}
					aria-label={iconAriaLabel}
				>
					<Icon />
				</IconButton>
			) : null,
		[Icon, disabled, iconColor, size, iconAriaLabel]
	);

	return (
		<>
			{Icon ? (
				iconTooltip ? (
					<Tooltip title={disabled ? '' : iconTooltip}>{iconButton}</Tooltip>
				) : (
					iconButton
				)
			) : (
				<Button
					variant={buttonVariant}
					{...buttonProps}
					className={props.classes?.button}
					sx={sx.button}
					onClick={(e) => setAnchorEl(e.currentTarget)}
					disabled={disabled}
					endIcon={<ArrowDown />}
				>
					{text}
				</Button>
			)}
			<Menu
				anchorEl={anchorEl}
				classes={{ paper: props.classes?.menuPaper }}
				sx={{
					[`& .${menuClasses['paper']}`]: {
						...sx.menuPaper
					}
				}}
				open={Boolean(anchorEl)}
				onClose={handleClose}
				anchorOrigin={{
					vertical: 'bottom',
					horizontal: 'right'
				}}
				transformOrigin={{
					vertical: 'top',
					horizontal: 'right'
				}}
			>
				{confirmHelperText && (
					<Typography variant="body1" sx={sx.helperText} className={props.classes?.helperText}>
						{confirmHelperText}
					</Typography>
				)}
				<MenuItem onClick={handleCancel}>{cancelText}</MenuItem>
				<MenuItem onClick={handleConfirm}>{confirmText}</MenuItem>
			</Menu>
		</>
	);
}

export default ConfirmDropdown;
