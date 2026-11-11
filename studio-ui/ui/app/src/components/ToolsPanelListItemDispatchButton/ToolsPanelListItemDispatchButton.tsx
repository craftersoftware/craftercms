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

import { ListItemButtonProps } from '@mui/material/ListItemButton';
import React from 'react';
import { SystemIconDescriptor } from '../SystemIcon';
import TranslationOrText from '../../models/TranslationOrText';
import { useDispatch } from 'react-redux';
import StandardAction from '../../models/StandardAction';
import ToolsPanelListItemButton from '../ToolsPanelListItemButton';

export interface ToolsPanelListItemDispatchButtonProps extends Omit<ListItemButtonProps, 'title' | 'onClick'> {
	title: TranslationOrText;
	subtitle?: string;
	icon?: SystemIconDescriptor;
	secondaryActionIcon?: React.ReactNode;
	/** Accessible name for the trailing action. Defaults to "Open {title}". */
	secondaryActionLabel?: string;
	onClick?: StandardAction;
	onSecondaryActionClick?: StandardAction;
}

export function ToolsPanelListItemDispatchButton(props: ToolsPanelListItemDispatchButtonProps) {
	const {
		onClick: onClickProp,
		onSecondaryActionClick: onSecondaryActionClickProp,
		secondaryActionLabel,
		...otherProps
	} = props;
	const dispatch = useDispatch();
	const onClick = () => dispatch(onClickProp);
	const onSecondaryActionClick = () => dispatch(onSecondaryActionClickProp);
	return (
		<ToolsPanelListItemButton
			onClick={onClick}
			onSecondaryActionClick={onSecondaryActionClick}
			secondaryActionLabel={secondaryActionLabel}
			{...otherProps}
		/>
	);
}

export default ToolsPanelListItemDispatchButton;
