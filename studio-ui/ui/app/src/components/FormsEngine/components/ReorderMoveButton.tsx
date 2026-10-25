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

import { ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import { visuallyHidden } from '@mui/utils';

// Explicit keyboard focus indicator. MUI shows only a faint ripple on focus-visible (about 1.5:1 on a light surface),
// and none at all when the user turns "animations" off (CrafterThemeProvider then sets disableRipple globally).
const focusVisibleSx = {
	'&.Mui-focusVisible': { outline: '2px solid', outlineColor: (theme) => theme.palette.primary.main }
} as const;

export type ReorderControl = 'up' | 'down' | 'top' | 'bottom';

export interface ReorderMoveButtonProps {
	name: string;
	control: ReorderControl;
	index: number;
	disabled?: boolean;
	onClick(): void;
	children: ReactNode;
	color?: IconButtonProps['color'];
	size?: IconButtonProps['size'];
}

/**
 * Icon-only reorder control. The visible tooltip is the short action ("Move up").
 * The accessible name starts with that text and adds the item, so speech input can
 * use the visible label (WCAG 2.5.3). `describeChild` keeps the tooltip from
 * replacing the name while it is open.
 */
export function ReorderMoveButton({
	name,
	control,
	index,
	disabled = false,
	onClick,
	children,
	color,
	size = 'small'
}: ReorderMoveButtonProps) {
	const { formatMessage } = useIntl();
	const label =
		control === 'up'
			? formatMessage({ defaultMessage: 'Move up: {name}' }, { name })
			: control === 'down'
				? formatMessage({ defaultMessage: 'Move down: {name}' }, { name })
				: control === 'top'
					? formatMessage({ defaultMessage: 'Move to top: {name}' }, { name })
					: formatMessage({ defaultMessage: 'Move to bottom: {name}' }, { name });
	const tooltip =
		control === 'up' ? (
			<FormattedMessage defaultMessage="Move up" />
		) : control === 'down' ? (
			<FormattedMessage defaultMessage="Move down" />
		) : control === 'top' ? (
			<FormattedMessage defaultMessage="Move to top" />
		) : (
			<FormattedMessage defaultMessage="Move to bottom" />
		);
	const button = (
		<IconButton
			size={size}
			color={color}
			disabled={disabled}
			sx={focusVisibleSx}
			aria-label={label}
			data-reorder-index={index}
			data-reorder-control={control}
			onPointerDown={(event) => event.stopPropagation()}
			onMouseDown={(event) => event.stopPropagation()}
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
		>
			{children}
			<Box component="span" sx={visuallyHidden}>
				{label}
			</Box>
		</IconButton>
	);
	return (
		<Tooltip describeChild title={tooltip}>
			{disabled ? <span>{button}</span> : button}
		</Tooltip>
	);
}
