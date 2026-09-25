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

import RadioGroup, { RadioGroupProps } from '@mui/material/RadioGroup';
import { defineMessages, useIntl } from 'react-intl';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import { capitalize } from '@mui/material';
import Typography from '@mui/material/Typography';
import React from 'react';

export interface BasePathDescriptor {
	id: string;
	path: string;
	label?: string;
}

export interface BasePathSelectorProps {
	value: string;
	basePaths?: Array<BasePathDescriptor>;
	onChange: RadioGroupProps['onChange'];
	sx?: RadioGroupProps['sx'];
}

const messages = defineMessages({
	content: {
		id: 'words.content',
		defaultMessage: 'Content'
	},
	assets: {
		id: 'words.assets',
		defaultMessage: 'Assets'
	},
	templates: {
		id: 'words.templates',
		defaultMessage: 'Templates'
	},
	scripts: {
		id: 'words.scripts',
		defaultMessage: 'Scripts'
	}
});

const defaultBasePaths: BasePathDescriptor[] = [
	{
		id: 'content',
		path: '/site'
	},
	{
		id: 'assets',
		path: '/static-assets'
	},
	{
		id: 'templates',
		path: '/templates'
	},
	{
		id: 'scripts',
		path: '/scripts'
	}
];

export function BasePathSelector(props: BasePathSelectorProps) {
	const { basePaths = defaultBasePaths, value = '', onChange, sx } = props;
	const { formatMessage } = useIntl();
	return (
		<FormControl sx={sx}>
			<RadioGroup value={value} onChange={onChange}>
				{basePaths.map((basePath) => (
					<FormControlLabel
						value={basePath.path}
						key={basePath.path}
						control={<Radio size="small" />}
						label={
							<>
								{basePath.label ??
									(messages[basePath.id] ? formatMessage(messages[basePath.id]) : capitalize(basePath.id))}
								:{' '}
								<Typography
									variant="body2"
									component="span"
									sx={{
										color: 'text.secondary'
									}}
								>
									{basePath.path}
								</Typography>
							</>
						}
					/>
				))}
			</RadioGroup>
		</FormControl>
	);
}

export default BasePathSelector;
