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
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import { SiteState } from '../../models/Site';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import GitAuthForm from '../GitAuthForm';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

interface GitFormProps {
	inputs: SiteState;

	handleInputChange(event: React.ChangeEvent): any;

	onKeyPress(event: any): any;

	setInputs(state: any): any;
}

const cloneMessages = defineMessages({
	clone_url_label: {
		id: 'createSiteDialog.clone_url_label',
		defaultMessage: 'The git repository URL to clone from.'
	},
	clone_remoteBranch_label: {
		id: 'createSiteDialog.clone_remoteBranch_label',
		defaultMessage:
			'The project will get created cloning that branch of the repo. You may switch between branches later too.'
	},
	clone_remoteName_label: {
		id: 'createSiteDialog.clone_remoteName_label',
		defaultMessage:
			'Name the remote that will refer to the source repo to pull from. Typically named “upstream” or “origin”.'
	}
});

const messages = defineMessages({
	userName: {
		id: 'common.userName',
		defaultMessage: 'Username'
	},
	password: {
		id: 'common.password',
		defaultMessage: 'Password'
	},
	token: {
		id: 'common.token',
		defaultMessage: 'Token'
	},
	privateKey: {
		id: 'common.privateKey',
		defaultMessage: 'Private Key'
	},
	repoUrl: {
		id: 'createSiteDialog.repoUrl',
		defaultMessage: 'Git Repo URL'
	},
	authenticationNoRequired: {
		id: 'createSiteDialog.authenticationNoRequired',
		defaultMessage: 'Authentication not required (public URL)'
	},
	usernameAndPassword: {
		id: 'common.usernameAndPassword',
		defaultMessage: 'Username & Password'
	},
	remoteName: {
		id: 'common.remoteName',
		defaultMessage: 'Git Remote Name'
	},
	required: {
		id: 'createSiteDialog.required',
		defaultMessage: '{name} is required.'
	},
	createAsOrphan: {
		id: 'createSiteDialog.createAsOrphan',
		defaultMessage: 'Create the project from a remote repository as orphan (no git history)'
	},
	createAsOrphanHelpText: {
		id: 'createSiteDialog.createAsOrphanHelpText',
		defaultMessage:
			'Creating the project as an orphan will dissociate the project from the source git repository and remove all history.'
	}
});

function GitForm(props: GitFormProps) {
	const { inputs, setInputs, handleInputChange, onKeyPress } = props;
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

	return (
        <>
            <Grid size={12}>
				<FormControlLabel
					control={
						<Switch
							name="singleBranch"
							checked={inputs.singleBranch}
							onChange={(event) => handleInputChange(event)}
							color="primary"
						/>
					}
					label={<FormattedMessage defaultMessage="Single Branch" />}
				/>
				<Typography
                    variant="caption"
                    component="small"
                    sx={{
                        color: "text.secondary",
                        display: 'block',
                        mb: 2,
                        ml: 2
                    }}>
					<FormattedMessage defaultMessage="If checked, only the branch specified above will be cloned. Otherwise, all branches in the repository will be cloned." />
				</Typography>
			</Grid>
            <Grid size={12} data-field-id="repoUrl">
				<TextField
					id="repoUrl"
					name="repoUrl"
					label={formatMessage(messages.repoUrl)}
					slotProps={{ inputLabel: { shrink: true } }}
					required
					fullWidth
					placeholder={'e.g. https://github.com/craftercms/craftercms-react-blueprint.git'}
					onKeyPress={onKeyPress}
					onChange={handleInputChange}
					value={inputs.repoUrl}
					error={inputs.submitted && !inputs.repoUrl}
					helperText={renderHelperText(
						formatMessage(messages.repoUrl),
						inputs.repoUrl,
						formatMessage(cloneMessages.clone_url_label),
						true,
						inputs.submitted
					)}
				/>
			</Grid>
            <Grid size={12} data-field-id="repoRemoteName">
				<TextField
					id="repoRemoteName"
					name="repoRemoteName"
					label={formatMessage(messages.remoteName)}
					slotProps={{
						inputLabel: { shrink: true }
					}}
					placeholder="origin"
					fullWidth
					onKeyPress={onKeyPress}
					onChange={handleInputChange}
					value={inputs.repoRemoteName}
					helperText={formatMessage(cloneMessages.clone_remoteName_label)}
				/>
			</Grid>
            <Grid size={12}>
				<Box
					sx={{
						width: '100%',
						'& .MuiFormGroup-root': {
							marginLeft: '10px'
						}
					}}
				>
					<GitAuthForm
						inputs={inputs}
						setInputs={setInputs}
						handleInputChange={handleInputChange}
						onKeyPress={onKeyPress}
					/>
				</Box>
			</Grid>
            <Grid size={12} sx={{ mb: 2 }}>
				<FormControlLabel
					control={
						<Switch
							name="createAsOrphan"
							checked={inputs.createAsOrphan}
							onChange={(event) => handleInputChange(event)}
							color="primary"
						/>
					}
					label={formatMessage(messages.createAsOrphan)}
				/>
				<Typography
					variant="subtitle2"
					component="small"
					sx={[
						{
							transition: `color .5s`,
							display: 'block',
							marginBottom: (theme) => theme.spacing(2)
						},
						!inputs.createAsOrphan && { color: 'text.secondary' }
					]}
				>
					{formatMessage(messages.createAsOrphanHelpText)}
				</Typography>
			</Grid>
        </>
    );
}

export default GitForm;
