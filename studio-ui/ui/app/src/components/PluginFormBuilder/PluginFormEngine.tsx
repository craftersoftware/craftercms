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

import React from 'react';
import { MarketplacePluginParameter } from '../../models/MarketplacePlugin';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import { defineMessages, useIntl, type MessageValue } from 'react-intl';
import PasswordTextField from '../PasswordTextField/PasswordTextField';

export interface PluginFormEngineProps {
	parameters: [MarketplacePluginParameter];
	submitted: boolean;
	fields: {
		[key: string]: string;
	};
	handleInputChange(event: React.ChangeEvent, type?: string): any;
	onKeyPress?(event: React.KeyboardEvent): any;
}

const messages = defineMessages<{
	required: { readonly name: MessageValue };
}>({
	required: {
		id: 'createSiteDialog.required',
		defaultMessage: '{name} is required.'
	}
});

export function PluginFormEngine(props: PluginFormEngineProps) {
	const { parameters, handleInputChange, submitted, fields, onKeyPress } = props;
	const { formatMessage } = useIntl();

	function renderHelperText(
		name: string,
		value: string = '',
		helperText: string,
		required: boolean,
		submitted: boolean
	) {
		if (required && !value && submitted) {
			return formatMessage(messages.required, { name: name });
		} else {
			return helperText;
		}
	}

	function renderParameters(parameters: [MarketplacePluginParameter]) {
		return parameters.map((parameter, index) => {
			return (
				<Grid size={12} key={index} data-field-id={parameter.name} sx={{ pt: 3 }}>
					{parameter.type === 'STRING' ? (
						<TextField
							id={parameter.name}
							fullWidth
							name={parameter.name}
							label={parameter.label}
							required={parameter.required}
							onKeyPress={onKeyPress}
							placeholder={parameter.defaultValue}
							onChange={(event) => handleInputChange(event, 'fields')}
							value={fields[parameter.name] ? fields[parameter.name] : ''}
							error={parameter.required && submitted && !fields[parameter.name]}
							helperText={renderHelperText(
								parameter.label,
								fields[parameter.name],
								parameter.description,
								parameter.required,
								submitted
							)}
						/>
					) : (
						<PasswordTextField
							id={parameter.name}
							fullWidth
							name={parameter.name}
							label={parameter.label}
							required={parameter.required}
							onKeyPress={onKeyPress}
							onChange={(event: React.ChangeEvent) => handleInputChange(event, 'fields')}
							value={fields[parameter.name] ? fields[parameter.name] : ''}
							error={parameter.required && submitted && !fields[parameter.name]}
							helperText={renderHelperText(
								parameter.label,
								fields[parameter.name],
								parameter.description,
								parameter.required,
								submitted
							)}
						/>
					)}
				</Grid>
			);
		});
	}

	return (
		<Grid
			container
			spacing={0}
			sx={{
				px: 3,
				width: '100%',
				'& .MuiGrid-item': {
					'&:last-child': {
						paddingBottom: '12px'
					}
				}
			}}
		>
			{renderParameters(parameters)}
		</Grid>
	);
}

export default PluginFormEngine;
