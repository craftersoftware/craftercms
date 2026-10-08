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

import OutlinedInput, { OutlinedInputProps } from '@mui/material/OutlinedInput';
import React, { useId } from 'react';
import { applyContentNameRules } from '../../../utils/content';
import { FormsEngineField } from '../components/FormsEngineField';
import InputAdornment from '@mui/material/InputAdornment';
import { ControlProps } from '../types';
import { useItemMetaContext, useStableFormContext } from '../lib/formsEngineContext';
import { PrimitiveAtom, useAtom } from 'jotai';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { FormattedMessage } from 'react-intl';
import { useDispatch } from 'react-redux';
import { popDialog, pushDialog } from '../../../state/actions/dialogStack';
import { createComponentId } from '../../../utils/system';
import { nanoid } from 'nanoid';
import { nnou } from '../../../utils/object';
import { getBasePath, getFileNameValueFromPath, isFieldReadOnly } from '../lib/formUtils';
import { ensureSingleSlash } from '../../../utils/string';
import type { Dispatch } from 'redux';
import useLoadableAtom from '../lib/useLoadableAtom';
import { isPagePath } from '../../../utils/path';

export function FileName(props: ControlProps) {
	const { field, readonly: formReadonly, autoFocus } = props;
	const { path: initialPath, pathInSite } = useItemMetaContext();
	const formContext = useStableFormContext();
	const atoms = formContext.atoms;
	const isNewForm = nnou(formContext.props?.create);
	const htmlId = useId();
	if (field.id === 'fileName') {
		throw new Error('Detected field ID "fileName" instead "file-name" at the "FileName" Control.');
	}
	const isPage = isPagePath(initialPath);
	const [value, setValue] = useAtom(atoms.fileName as PrimitiveAtom<string>);
	const validityData = useLoadableAtom(atoms.validationByFieldId['file-name']);
	const isValid = validityData.state === 'hasData' ? validityData.data.isValid : true;
	const webUrlRoot = ensureSingleSlash(`${pathInSite.replace('/site/website', '/')}/`);
	const dispatch = useDispatch();
	const readonly: boolean = isFieldReadOnly(field, formReadonly);

	const handleChange: OutlinedInputProps['onChange'] = (e) => {
		const newValue = applyContentNameRules(e.currentTarget.value);
		setValue(newValue);
	};

	const handleEdit = () => {
		const itemValue = isPage ? `${value}/index.xml` : `${value}.xml`;
		const itemInitialValue = getFileNameValueFromPath(initialPath, isPage);
		const itemPath = getBasePath(initialPath, isPage);
		const id = nanoid();

		showRenameDialog(
			id,
			itemPath,
			itemValue,
			itemInitialValue,
			(newName: string) => {
				const updatedName = newName.replace(isPage ? '/index.xml' : '.xml', '');
				setValue(updatedName);
				dispatch(popDialog({ id }));
			},
			dispatch
		);
	};

	return (
		<FormsEngineField
			isValid={isValid}
			htmlFor={htmlId}
			field={field}
			max={field.validations?.maxLength?.value}
			length={value.length}
		>
			<OutlinedInput
				autoFocus={autoFocus}
				fullWidth
				id={htmlId}
				value={value}
				onChange={handleChange}
				disabled={!isNewForm || readonly}
				startAdornment={
					<InputAdornment position="start" title={webUrlRoot} sx={{ mr: 0 }}>
						{webUrlRoot}
					</InputAdornment>
				}
				endAdornment={
					!isNewForm && (
						<Tooltip title={<FormattedMessage defaultMessage="Edit" />}>
							<IconButton onClick={handleEdit} disabled={readonly}>
								<EditOutlinedIcon />
							</IconButton>
						</Tooltip>
					)
				}
			/>
		</FormsEngineField>
	);
}

function showRenameDialog(
	id: string,
	path: string,
	value: string,
	validRenameValue: string,
	onRenamed: (newName: string) => void,
	dispatch: Dispatch
) {
	dispatch(
		pushDialog({
			id,
			component: createComponentId('RenameContentDialog'),
			props: { path, value, validRenameValue, onRenamed }
		})
	);

	return null;
}

export default FileName;

/*
	TODO:
	 - UM to put config.xml values in form-definition
*/
