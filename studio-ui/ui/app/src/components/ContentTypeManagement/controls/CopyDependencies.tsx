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
import { FormattedMessage } from 'react-intl';
import TextField from '@mui/material/TextField';
import Card from '@mui/material/Card';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import Box from '@mui/material/Box';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';

interface Dependency {
	pattern: string;
	target: string;
}

export interface CopyDependenciesProps extends ControlProps {
	value: {
		'copy-dependency': Dependency[];
	};
}

export function CopyDependencies(props: CopyDependenciesProps) {
	const { field, value, setValue } = props;
	const copyDependencies = value?.['copy-dependency'] ?? [];
	const htmlId = useId();

	const handleChange = (
		e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
		prop: 'pattern' | 'target',
		index: number
	) => {
		const nextArr = copyDependencies.slice();
		nextArr[index] = {
			...copyDependencies[index],
			[prop]: e.currentTarget.value
		};
		setValue({ 'copy-dependency': nextArr });
	};

	const addDependency = () => {
		setValue({ 'copy-dependency': [...copyDependencies, { pattern: '', target: '' }] });
	};

	const removeDependency = (index: number) => {
		const nextArr = copyDependencies.filter((_, i) => i !== index);
		setValue({ 'copy-dependency': nextArr });
	};

	return (
		<FormsEngineField htmlFor={htmlId} field={field}>
			{copyDependencies?.map((dependency, index) => (
				<Card key={index} variant="outlined" sx={{ display: 'flex', flexDirection: 'row', my: 1, p: 1.5, gap: 1 }}>
					<Box sx={{ gap: 2, display: 'flex', flexDirection: 'column', flex: 1 }}>
						<TextField
							fullWidth
							label={<FormattedMessage defaultMessage="Pattern" />}
							value={dependency.pattern}
							variant="outlined"
							onChange={(e) => handleChange(e, 'pattern', index)}
						/>
						<TextField
							fullWidth
							label={<FormattedMessage defaultMessage="Target" />}
							value={dependency.target}
							variant="outlined"
							onChange={(e) => handleChange(e, 'target', index)}
						/>
					</Box>
					<Box display="flex" alignItems="center">
						<Tooltip title={<FormattedMessage defaultMessage="Remove Reference" />}>
							<IconButton onClick={() => removeDependency(index)}>
								<RemoveCircleOutlineRoundedIcon />
							</IconButton>
						</Tooltip>
					</Box>
				</Card>
			))}
			<Box display="flex" justifyContent="center">
				<Tooltip title={<FormattedMessage defaultMessage="Add Reference" />}>
					<IconButton onClick={() => addDependency()}>
						<AddCircleOutlineRoundedIcon />
					</IconButton>
				</Tooltip>
			</Box>
		</FormsEngineField>
	);
}

export default CopyDependencies;
