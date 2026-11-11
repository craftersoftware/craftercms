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
import { defineMessages, useIntl } from 'react-intl';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

export type ReorderControl = 'up' | 'down' | 'top' | 'bottom';

const messages = defineMessages({
	upLabel: { defaultMessage: 'Move up: {name}' },
	upTooltip: { defaultMessage: 'Move up' },
	downLabel: { defaultMessage: 'Move down: {name}' },
	downTooltip: { defaultMessage: 'Move down' },
	topLabel: { defaultMessage: 'Move to top: {name}' },
	topTooltip: { defaultMessage: 'Move to top' },
	bottomLabel: { defaultMessage: 'Move to bottom: {name}' },
	bottomTooltip: { defaultMessage: 'Move to bottom' }
});

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
	const label = formatMessage(messages[`${control}Label`], { name });
	const button = (
		<IconButton
			size={size}
			color={color}
			disabled={disabled}
			aria-label={label}
			data-reorder-index={index}
			data-reorder-control={control}
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
		>
			{children}
		</IconButton>
	);
	return (
		<Tooltip describeChild title={formatMessage(messages[`${control}Tooltip`])}>
			{disabled ? <span>{button}</span> : button}
		</Tooltip>
	);
}
