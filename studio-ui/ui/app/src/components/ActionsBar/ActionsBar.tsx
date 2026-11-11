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

import { useIntl } from 'react-intl';
import Checkbox, { CheckboxProps } from '@mui/material/Checkbox';
import React, { ReactElement } from 'react';
import { getPossibleTranslation } from '../../utils/i18n';
import Button, { ButtonProps } from '@mui/material/Button';
import TranslationOrText from '../../models/TranslationOrText';
import Skeleton from '@mui/material/Skeleton';
import { rand } from '../PathNavigator/utils';
import Box, { BoxProps } from '@mui/material/Box';

export interface ActionsBarAction {
	id: string;
	label: TranslationOrText;
}

interface ActionsBarProps {
	options: ActionsBarAction[];
	noSelectionContent?: ReactElement;
	numOfSkeletonItems?: number;
	isLoading?: boolean;
	isIndeterminate: boolean;
	showCheckbox?: boolean;
	isChecked: boolean;
	classes?: Partial<Record<'root' | 'container' | 'checkbox' | 'button', string>>;
	onOptionClicked(optionId: string): void;
	onCheckboxChange: CheckboxProps['onChange'];
	buttonProps?: Omit<ButtonProps, 'onClick'>;
	sxs?: Partial<{
		root: BoxProps['sx'];
		checkbox: BoxProps['sx'];
		button: BoxProps['sx'];
		container: BoxProps['sx'];
	}>;
	disabled?: boolean;
}

export function ActionsBar(props: ActionsBarProps) {
	const { formatMessage } = useIntl();
	const {
		options,
		noSelectionContent,
		onOptionClicked,
		isIndeterminate,
		onCheckboxChange,
		showCheckbox = true,
		isChecked,
		isLoading = false,
		numOfSkeletonItems = 5,
		buttonProps,
		sxs,
		disabled = false
	} = props;
	return (
		<Box className={props.classes?.root} sx={{ bgcolor: 'background.paper', ...sxs?.root }}>
			<Box sx={{ bgcolor: 'action.selected', ...sxs?.container }}>
				{showCheckbox && (
					<Checkbox
						disabled={disabled}
						sx={{ width: 48, ...sxs?.checkbox }}
						color="primary"
						indeterminate={isIndeterminate}
						checked={isChecked}
						className={props.classes?.checkbox}
						onChange={onCheckboxChange}
						slotProps={{ input: { 'aria-label': formatMessage({ defaultMessage: 'Select all' }) } }}
					/>
				)}
				{!isLoading && !isIndeterminate && !isChecked && noSelectionContent}
				{isLoading
					? new Array(numOfSkeletonItems).fill(null).map((nothing, index) => (
							<Button
								key={index}
								color="primary"
								className={props.classes?.button}
								sx={sxs?.button}
								disabled={disabled}
								{...buttonProps}
							>
								<Skeleton animation="pulse" height="12px" width={`${rand(40, 60)}px`} />
							</Button>
						))
					: options?.map((option: ActionsBarAction) => (
							<Button
								key={option.id}
								color="primary"
								variant="text"
								className={props.classes?.button}
								sx={sxs?.button}
								disabled={disabled}
								{...buttonProps}
								onClick={() => onOptionClicked(option.id)}
							>
								{getPossibleTranslation(option.label, formatMessage)}
							</Button>
						))}
			</Box>
		</Box>
	);
}

export default ActionsBar;
