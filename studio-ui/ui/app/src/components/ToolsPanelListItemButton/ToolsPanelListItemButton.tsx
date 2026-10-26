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

import ListItemButton, { ListItemButtonProps } from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import ChevronRounded from '@mui/icons-material/ChevronRightRounded';
import React from 'react';
import { useIntl } from 'react-intl';
import SystemIcon, { SystemIconDescriptor } from '../SystemIcon';
import { usePossibleTranslation } from '../../hooks/usePossibleTranslation';
import TranslationOrText from '../../models/TranslationOrText';
import ListItem from '@mui/material/ListItem';

export interface ToolsPanelListItemButtonProps extends Omit<ListItemButtonProps, 'title'> {
	title: TranslationOrText;
	subtitle?: string;
	icon?: SystemIconDescriptor;
	secondaryActionIcon?: React.ReactNode;
	/** Accessible name for the trailing action. Defaults to "Open {title}". */
	secondaryActionLabel?: string;
	onSecondaryActionClick?(): void;
}

export function ToolsPanelListItemButton(props: ToolsPanelListItemButtonProps) {
	const {
		icon,
		title,
		subtitle,
		onClick,
		sx,
		className,
		secondaryActionIcon = <ChevronRounded />,
		secondaryActionLabel,
		onSecondaryActionClick,
		...listItemButtonProps
	} = props;
	const { formatMessage } = useIntl();
	const translatedTitle = usePossibleTranslation(title);
	const trailingActionLabel =
		secondaryActionLabel ?? formatMessage({ defaultMessage: 'Open {title}' }, { title: translatedTitle });
	return (
		<ListItem
			disablePadding
			className={className}
			sx={sx}
			secondaryAction={
				onSecondaryActionClick ? (
					<IconButton
						size="small"
						aria-label={trailingActionLabel}
						onClick={(event) => {
							event.stopPropagation();
							onSecondaryActionClick();
						}}
					>
						{secondaryActionIcon}
					</IconButton>
				) : null
			}
		>
			<ListItemButton {...listItemButtonProps} onClick={onClick}>
				{icon && (
					<ListItemIcon>
						<SystemIcon icon={icon} fontIconProps={{ fontSize: 'small' }} />
					</ListItemIcon>
				)}
				<ListItemText
					primary={translatedTitle}
					secondary={subtitle}
					slotProps={{
						primary: { noWrap: true },
						secondary: { noWrap: true }
					}}
				/>
				{!onSecondaryActionClick && <ChevronRounded />}
			</ListItemButton>
		</ListItem>
	);
}

export default ToolsPanelListItemButton;
