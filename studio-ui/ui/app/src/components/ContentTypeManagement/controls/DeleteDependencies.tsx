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

import React, { ChangeEvent, useId } from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import { ControlProps } from '../../FormsEngine/types';
import { FormattedMessage, useIntl } from 'react-intl';
import TextField from '@mui/material/TextField';
import Card from '@mui/material/Card';
import { Switch } from '@mui/material';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import Box from '@mui/material/Box';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';

interface Dependency {
	pattern: string;
	'remove-empty-folder': boolean;
}

export interface DeleteDependenciesProps extends ControlProps {
	value: {
		'delete-dependency': Dependency[];
	};
}

export function DeleteDependencies(props: DeleteDependenciesProps) {
	const { field, value, setValue } = props;
	const deleteDependencies = value?.['delete-dependency'] ?? [];
	const htmlId = useId();
	const { formatMessage } = useIntl();

	const handleChange = (
		e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
		prop: 'pattern' | 'remove-empty-folder',
		index: number
	) => {
		const nextArr = deleteDependencies.slice();
		nextArr[index] = {
			...deleteDependencies[index],
			[prop]: prop === 'pattern' ? e.currentTarget.value : (e.target as HTMLInputElement).checked
		};
		setValue({ 'delete-dependency': nextArr });
	};

	const addDependency = () => {
		setValue({
			'delete-dependency': [...deleteDependencies, { pattern: '', 'remove-empty-folder': false }]
		});
	};

	const removeDependency = (index: number) => {
		const nextArr = deleteDependencies.filter((_, i) => i !== index);
		setValue({ 'delete-dependency': nextArr });
	};

	return (
		<FormsEngineField htmlFor={htmlId} field={field}>
			{deleteDependencies?.map((dependency, index) => (
				<Card key={index} variant="outlined" sx={{ display: 'flex', flexDirection: 'row', my: 1, p: 1.5, gap: 1 }}>
					<Box sx={{ gap: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
						<TextField
							fullWidth
							label={<FormattedMessage defaultMessage="Pattern" />}
							value={dependency.pattern}
							variant="outlined"
							onChange={(e) => handleChange(e, 'pattern', index)}
						/>
						<FormControlLabel
							control={
								<Switch
									checked={dependency['remove-empty-folder'] ?? false}
									onChange={(e) => handleChange(e, 'remove-empty-folder', index)}
								/>
							}
							label={<FormattedMessage defaultMessage="Remove empty folder" />}
						/>
					</Box>
					<Box display="flex" alignItems="center">
						<Tooltip title={<FormattedMessage defaultMessage="Remove Reference" />}>
							<IconButton
								aria-label={formatMessage({ defaultMessage: 'Remove Reference' })}
								onClick={() => removeDependency(index)}
							>
								<RemoveCircleOutlineRoundedIcon />
							</IconButton>
						</Tooltip>
					</Box>
				</Card>
			))}
			<Box display="flex" justifyContent="center">
				<Tooltip title={<FormattedMessage defaultMessage="Add Reference" />}>
					<IconButton aria-label={formatMessage({ defaultMessage: 'Add Reference' })} onClick={() => addDependency()}>
						<AddCircleOutlineRoundedIcon />
					</IconButton>
				</Tooltip>
			</Box>
		</FormsEngineField>
	);
}

export default DeleteDependencies;
