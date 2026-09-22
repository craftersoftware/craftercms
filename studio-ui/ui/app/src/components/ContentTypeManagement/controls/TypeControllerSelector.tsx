/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import OutlinedInput from '@mui/material/OutlinedInput';
import React, { useId } from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import Tooltip from '@mui/material/Tooltip';
import { FormattedMessage } from 'react-intl';
import { useDispatch } from 'react-redux';
import IconButton from '@mui/material/IconButton';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useStableFormContext } from '../../FormsEngine/lib/formsEngineContext';
import { editTypeController, TypeBuilderControl } from '../utils';
import { getPropertyValue } from '../../FormsEngine/lib/formUtils';

export interface TypeControllerSelectorProps extends TypeBuilderControl {
	value: string;
}

/**
 * Allows the selection and edition of a controller for a content type.
 * If the controller file does not exist, the editor opens empty and creates/associates it on Save.
 */
export function TypeControllerSelector(props: TypeControllerSelectorProps) {
	const { field, autoFocus, setValue } = props;
	const htmlId = useId();
	const dispatch = useDispatch();
	const basePath = '/config/studio/content-types';
	const stableFormContext = useStableFormContext();
	// stableFormContext.originalValues is of type `ContentType`, and `id` is the current contentTypeId.
	const contentTypeId: string = stableFormContext.originalValues.id as string;
	const type: 'javascript' | 'groovy' = getPropertyValue(field.properties, 'type', 'javascript') as
		| 'javascript'
		| 'groovy';
	const isJavascript = type === 'javascript';
	const fileName = isJavascript ? 'form-controller.js' : 'controller.groovy';

	const onEditController = () => {
		editTypeController(basePath, contentTypeId, dispatch, type, () => {
			setValue(true);
		});
	};

	return (
		<FormsEngineField htmlFor={htmlId} field={field}>
			<OutlinedInput
				autoFocus={autoFocus}
				id={htmlId}
				fullWidth
				value={fileName}
				disabled
				endAdornment={
					<Tooltip title={<FormattedMessage defaultMessage="Edit Controller" />}>
						<IconButton onClick={onEditController}>
							<EditRoundedIcon />
						</IconButton>
					</Tooltip>
				}
			/>
		</FormsEngineField>
	);
}

export default TypeControllerSelector;
