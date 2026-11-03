/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import FormHelperText from '@mui/material/FormHelperText';
import { siteIdMaxLength, siteInputMaxLength, siteNameMaxLength } from './utils';
import React from 'react';
import { renderSiteFormHelperText } from './BlueprintForm';
import { defineMessages, useIntl } from 'react-intl';
import { DuplicateSiteState, LookupTable, SiteState } from '../../models';

const messages = defineMessages({
	siteId: {
		id: 'createSiteDialog.siteId',
		defaultMessage: 'Project ID'
	},
	siteName: {
		id: 'createSiteDialog.siteName',
		defaultMessage: 'Project Name'
	},
	description: {
		id: 'createSiteDialog.description',
		defaultMessage: 'Description'
	},
	siteFormat: {
		id: 'createSiteDialog.siteFormat',
		defaultMessage: 'Max length: 50 characters, consisting of: lowercase letters, numbers & dash (-).'
	},
	idExist: {
		id: 'createSiteDialog.idExist',
		defaultMessage: 'The ID already exists.'
	},
	nameExist: {
		id: 'createSiteDialog.nameExist',
		defaultMessage: 'The name already exists.'
	},
	fieldMaxLength: {
		id: 'createSiteDialog.fieldMaxLength',
		defaultMessage: 'Max length: {maxLength} characters.'
	},
	required: {
		id: 'createSiteDialog.required',
		defaultMessage: '{name} is required.'
	},
	cantStart: {
		id: 'createSiteDialog.cantStart',
		defaultMessage: 'Project names may not start with zeros, dashes (-) or underscores (_).'
	},
	gitBranch: {
		id: 'createSiteDialog.gitBranch',
		defaultMessage: 'Git Branch'
	},
	gitBranchDescription: {
		id: 'createSiteDialog.gitBranchDescription',
		defaultMessage: 'Name of the branch this project will track. Pull operations will be done against this branch.'
	},
	enableStaging: {
		id: 'createSiteDialog.enableStaging',
		defaultMessage: 'Enable staging'
	},
	enableStagingHelp: {
		id: 'createSiteDialog.enableStagingHelp',
		defaultMessage: 'Staging cannot be turned off later. Removing it means recreating the project.'
	},
	enableStagingHelpSource: {
		id: 'createSiteDialog.enableStagingHelpSource',
		defaultMessage:
			'The new project uses this setting, not the source project. Staging cannot be turned off later. Removing it means recreating the project.'
	}
});

export interface BaseSiteFormProps {
	inputs: SiteState | DuplicateSiteState;
	fieldsErrorsLookup: LookupTable<boolean>;
	checkSites(event: any): void;
	checkSiteNames(event: any): void;
	handleInputChange(event: any, type?: string): void;
	onKeyPress(event: React.KeyboardEvent): void;
	onBlur?(event: React.FocusEvent): void;
	sourceProjectStagingHelp?: boolean;
}

export function BaseSiteForm(props: BaseSiteFormProps) {
	const {
		inputs,
		checkSites,
		checkSiteNames,
		handleInputChange,
		onKeyPress,
		fieldsErrorsLookup,
		onBlur,
		sourceProjectStagingHelp
	} = props;
	const { formatMessage } = useIntl();

	return (
		<>
			<Grid size={12} data-field-id="siteName">
				<TextField
					id="siteName"
					name="siteName"
					label={formatMessage(messages.siteName)}
					placeholder={formatMessage({ defaultMessage: 'e.g. Corporate Website' })}
					required
					autoFocus
					fullWidth
					onBlur={(event) => checkSiteNames(event)}
					onKeyPress={onKeyPress}
					onKeyUp={(event) => checkSiteNames(event)}
					onChange={(event) => handleInputChange(event)}
					value={inputs.siteName}
					slotProps={{
						htmlInput: { maxLength: siteNameMaxLength }
					}}
					error={inputs.submitted && fieldsErrorsLookup['siteName']}
					helperText={
						inputs.submitted && !inputs.siteName
							? formatMessage(messages.required, { name: formatMessage(messages.siteName) })
							: inputs.siteNameExist
								? formatMessage(messages.nameExist)
								: formatMessage(messages.fieldMaxLength, { maxLength: siteNameMaxLength })
					}
				/>
			</Grid>
			<Grid size={12} data-field-id="siteId">
				<TextField
					id="siteId"
					name="siteId"
					label={formatMessage(messages.siteId)}
					placeholder="e.g. corporate-website"
					required
					fullWidth
					onBlur={onBlur}
					onKeyPress={onKeyPress}
					onKeyUp={(event) => checkSites(event)}
					onChange={(event) => handleInputChange(event)}
					value={inputs.siteId}
					slotProps={{
						htmlInput: { maxLength: siteIdMaxLength }
					}}
					error={inputs.submitted && fieldsErrorsLookup['siteId']}
					helperText={renderSiteFormHelperText(
						formatMessage(messages.siteId),
						inputs.siteId,
						formatMessage(messages.siteFormat),
						true,
						inputs.submitted,
						inputs.siteIdExist
					)}
				/>
			</Grid>
			<Grid size={12} data-field-id="description">
				<TextField
					id="description"
					fullWidth
					name="description"
					label={formatMessage(messages.description)}
					multiline
					onChange={(event) => handleInputChange(event)}
					value={inputs.description}
					slotProps={{
						htmlInput: { maxLength: siteInputMaxLength }
					}}
					helperText={formatMessage(messages.fieldMaxLength, { maxLength: siteInputMaxLength })}
				/>
			</Grid>
			<Grid size={12} data-field-id="gitBranch">
				<TextField
					id="sandboxBranch"
					name="gitBranch"
					label={formatMessage(messages.gitBranch)}
					fullWidth
					onKeyPress={onKeyPress}
					onChange={(event) => handleInputChange(event)}
					placeholder="master"
					value={inputs.gitBranch}
					helperText={formatMessage(messages.gitBranchDescription)}
				/>
			</Grid>
			<Grid size={12} data-field-id="enableStaging">
				<FormControlLabel
					control={
						<Checkbox
							id="enableStaging"
							name="enableStaging"
							color="primary"
							checked={inputs.enableStaging}
							onChange={(event) => handleInputChange(event)}
						/>
					}
					label={formatMessage(messages.enableStaging)}
				/>
				<FormHelperText>
					{formatMessage(sourceProjectStagingHelp ? messages.enableStagingHelpSource : messages.enableStagingHelp)}
				</FormHelperText>
			</Grid>
		</>
	);
}

export default BaseSiteForm;
