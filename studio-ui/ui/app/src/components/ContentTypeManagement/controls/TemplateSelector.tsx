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
import React from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import IconButton from '@mui/material/IconButton';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import Tooltip from '@mui/material/Tooltip';
import { FormattedMessage } from 'react-intl';
import { useDispatch } from 'react-redux';
import { popDialog, pushDialog } from '../../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { createTypeTemplate, editTypeTemplate, TypeBuilderControl } from '../utils';

export type TemplateSelectorProps = TypeBuilderControl<string>;

/**
 * Enables template selection through the BrowseFilesDialog. It also allows template edition.
 */
export function TemplateSelector(props: TemplateSelectorProps) {
	const { field, value, setValue, autoFocus } = props;
	const basePath = '/templates/web';
	const dispatch = useDispatch();

	const handleChange: OutlinedInputProps['onChange'] = (e) => setValue(e.currentTarget.value);

	const onOpenBrowseTemplate = () => {
		const id = nanoid();
		dispatch(
			pushDialog({
				id,
				component: 'craftercms.components.BrowseFilesDialog',
				props: {
					path: basePath,
					allowUpload: false,
					onClose: () => dispatch(popDialog({ id })),
					onSuccess: (item) => {
						setValue(item.path);
						dispatch(popDialog({ id }));
					}
				}
			})
		);
	};

	const onEditTemplate = () => {
		if (value) {
			editTypeTemplate(value, dispatch);
		} else {
			createTypeTemplate(basePath, dispatch, (item) => {
				const templatePath = `${item.path}/${item.fileName}`;
				setValue(templatePath);
				editTypeTemplate(templatePath, dispatch);
			});
		}
	};

	return (
		<FormsEngineField field={field}>
			<OutlinedInput
				autoFocus={autoFocus}
				fullWidth
				value={value}
				onChange={handleChange}
				disabled
				endAdornment={
					<>
						<Tooltip title={<FormattedMessage defaultMessage="Select template" />}>
							<IconButton onClick={() => onOpenBrowseTemplate()}>
								<SearchRoundedIcon />
							</IconButton>
						</Tooltip>
						<Tooltip title={<FormattedMessage defaultMessage="Edit template" />}>
							<IconButton onClick={() => onEditTemplate()}>
								<EditRoundedIcon />
							</IconButton>
						</Tooltip>
					</>
				}
			/>
		</FormsEngineField>
	);
}

export default TemplateSelector;
