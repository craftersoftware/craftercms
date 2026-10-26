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

import React, { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import { SiteState } from '../../models/Site';
import { MarketplacePlugin, MarketplacePluginParameter } from '../../models/MarketplacePlugin';
import { defineMessages, useIntl } from 'react-intl';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import palette from '../../styles/palette';
import Box from '@mui/material/Box';

interface BlueprintReviewProps {
	inputs: SiteState;
	blueprint: MarketplacePlugin;

	onGoTo(step: number): any;
}

function blueprintParameterLabelId(name: string) {
	return `blueprint-parameter-${name.replace(/\s+/g, '-')}`;
}

const messages = defineMessages({
	siteInfo: {
		id: 'createSiteDialog.siteInfo',
		defaultMessage: 'Project Info'
	},
	blueprintStrategy: {
		id: 'createSiteDialog.blueprintStrategy',
		defaultMessage: 'Create from plugin'
	},
	gitStrategy: {
		id: 'createSiteDialog.gitStrategy',
		defaultMessage: 'Existing remote git repo clone'
	},
	creationStrategy: {
		id: 'createSiteDialog.creationStrategy',
		defaultMessage: 'Creation Strategy'
	},
	additionalOptions: {
		id: 'createSiteDialog.additionalOptions',
		defaultMessage: 'Additional Options'
	},
	remoteName: {
		id: 'createSiteDialog.remoteName',
		defaultMessage: 'Git Remote Name'
	},
	remoteURL: {
		id: 'createSiteDialog.remoteURL',
		defaultMessage: 'Git Repo URL'
	},
	siteId: {
		id: 'createSiteDialog.siteId',
		defaultMessage: 'Project ID'
	},
	siteName: {
		id: 'createSiteDialog.siteName',
		defaultMessage: 'Project Name'
	},
	gitBranch: {
		id: 'createSiteDialog.gitBranch',
		defaultMessage: 'Git Branch'
	},
	userNameAndPassword: {
		id: 'createSiteDialog.userNameAndPassword',
		defaultMessage: 'Username & Password'
	},
	token: {
		id: 'createSiteDialog.token',
		defaultMessage: 'Token'
	},
	privateKey: {
		id: 'createSiteDialog.privateKey',
		defaultMessage: 'Private Key'
	},
	authentication: {
		id: 'createSiteDialog.authentication',
		defaultMessage: 'Authentication'
	},
	noDescription: {
		id: 'createSiteDialog.noDescription',
		defaultMessage: 'No description supplied'
	},
	description: {
		id: 'createSiteDialog.description',
		defaultMessage: 'Description'
	},
	blueprint: {
		id: 'createSiteDialog.plugin',
		defaultMessage: 'Blueprint'
	},
	blueprintParameters: {
		id: 'createSiteDialog.blueprintParameters',
		defaultMessage: 'Blueprint Parameters'
	},
	useDefaultValue: {
		id: 'createSiteDialog.useDefaultValue',
		defaultMessage: 'use default value'
	}
});

function BlueprintReview(props: BlueprintReviewProps) {
	const { onGoTo, inputs, blueprint } = props;
	const [passwordFields, setPasswordFields] = useState(null);
	const { formatMessage } = useIntl();

	useEffect(() => {
		if (blueprint.parameters) {
			let fields: any = {};
			blueprint.parameters.forEach((parameter: MarketplacePluginParameter) => {
				if (parameter.type === 'PASSWORD') {
					fields[parameter.name] = false;
				}
			});
			setPasswordFields(fields);
		}
	}, [blueprint]);

	function renderAuth(type: string) {
		if (type === 'basic') {
			return formatMessage(messages.userNameAndPassword);
		} else if (type === 'token') {
			return formatMessage(messages.token);
		} else {
			return formatMessage(messages.privateKey);
		}
	}

	function showPassword(parameter: MarketplacePluginParameter) {
		setPasswordFields({ ...passwordFields, [parameter.name]: !passwordFields[parameter.name] });
	}

	function renderSingleParameter(parameter: MarketplacePluginParameter) {
		if (inputs.blueprintFields[parameter.name] && parameter.type === 'STRING') {
			return inputs.blueprintFields[parameter.name];
		} else if (parameter.type === 'STRING') {
			return parameter.defaultValue;
		} else if (inputs.blueprintFields[parameter.name] && parameter.type === 'PASSWORD') {
			return (
				<span>
					{passwordFields && passwordFields[parameter.name] ? inputs.blueprintFields[parameter.name] : '********'}
					<IconButton
						edge="end"
						sx={{
							color: (theme) => theme.palette.primary.main,
							padding: '1px',
							marginLeft: '5px',
							'& svg': {
								fontSize: '1rem'
							}
						}}
						aria-pressed={Boolean(passwordFields?.[parameter.name])}
						aria-describedby={blueprintParameterLabelId(parameter.name)}
						aria-label={formatMessage({
							id: 'passwordTextField.toggleVisibilityButtonText',
							defaultMessage: 'Show password'
						})}
						onClick={() => {
							showPassword(parameter);
						}}
						size="large"
					>
						{passwordFields && passwordFields[parameter.name] ? <VisibilityOff /> : <Visibility />}
					</IconButton>
				</span>
			);
		} else {
			return '********';
		}
	}

	function renderBlueprintParameters() {
		return blueprint.parameters.map((parameter, index) => {
			return (
				<Typography variant="body2" gutterBottom key={index}>
					<Box component="span" id={blueprintParameterLabelId(parameter.name)} sx={{ fontWeight: 'bold' }}>
						{parameter.label}:{' '}
					</Box>
					{renderSingleParameter(parameter)}
				</Typography>
			);
		});
	}

	function renderGitOptions() {
		return (
			<div>
				{inputs.repoUrl && (
					<Typography variant="body2" gutterBottom>
						<Box component="span" sx={{ fontWeight: 'bold' }}>
							{formatMessage(messages.remoteURL)}:{' '}
						</Box>{' '}
						{inputs.repoUrl}
					</Typography>
				)}
				<Typography variant="body2" gutterBottom>
					<Box component="span" sx={{ fontWeight: 'bold' }}>
						{formatMessage(messages.remoteName)}:
					</Box>
					{` ${inputs.repoRemoteName ? inputs.repoRemoteName : 'origin'}`}
				</Typography>
				{inputs.repoAuthentication !== 'none' && (
					<Typography variant="body2" gutterBottom>
						<Box component="span" sx={{ fontWeight: 'bold' }}>
							{formatMessage(messages.authentication)}:
						</Box>{' '}
						{renderAuth(inputs.repoAuthentication)}
					</Typography>
				)}
			</div>
		);
	}

	return (
		<Box sx={{ maxWidth: '600px', margin: 'auto' }}>
			<Grid container spacing={3}>
				<Grid size={12}>
					<Box sx={{ display: 'flex', alignItems: 'center' }}>
						<Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
							{formatMessage(messages.creationStrategy)}
						</Typography>
						<IconButton
							aria-label={formatMessage(
								{ defaultMessage: 'Edit {section}' },
								{ section: formatMessage(messages.creationStrategy) }
							)}
							sx={{
								color: (theme) => theme.palette.primary.main,
								'& svg': {
									fontSize: '1.2rem'
								}
							}}
							onClick={() => onGoTo(0)}
							size="large"
						>
							<EditIcon />
						</IconButton>
					</Box>
					{blueprint.id !== 'GIT' ? (
						<div>
							<Typography variant="body2" gutterBottom>
								{formatMessage(messages.blueprintStrategy)}
							</Typography>
							<Typography variant="body2" gutterBottom>
								<Box component="span" sx={{ fontWeight: 'bold' }}>
									{formatMessage(messages.blueprint)}:{' '}
								</Box>{' '}
								{blueprint && blueprint.name}
							</Typography>
						</div>
					) : (
						<div>
							<Typography variant="body2" gutterBottom>
								{formatMessage(messages.gitStrategy)}
							</Typography>
						</div>
					)}
				</Grid>
				<Grid size={12}>
					<Box sx={{ display: 'flex', alignItems: 'center' }}>
						<Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
							{formatMessage(messages.siteInfo)}
						</Typography>
						<IconButton
							aria-label={formatMessage(
								{ defaultMessage: 'Edit {section}' },
								{ section: formatMessage(messages.siteInfo) }
							)}
							sx={{
								color: (theme) => theme.palette.primary.main,
								'& svg': {
									fontSize: '1.2rem'
								}
							}}
							onClick={() => onGoTo(1)}
							size="large"
						>
							<EditIcon />
						</IconButton>
					</Box>
					<Typography variant="body2" gutterBottom noWrap>
						<Box component="span" sx={{ fontWeight: 'bold' }}>
							{formatMessage(messages.siteName)}:{' '}
						</Box>{' '}
						{inputs.siteName}
					</Typography>
					<Typography variant="body2" gutterBottom>
						<Box component="span" sx={{ fontWeight: 'bold' }}>
							{formatMessage(messages.siteId)}:{' '}
						</Box>{' '}
						{inputs.siteId}
					</Typography>
					<Typography variant="body2" gutterBottom>
						<Box component="span" sx={{ fontWeight: 'bold' }}>
							{formatMessage(messages.description)}:
						</Box>
						{` `}
						{inputs.description ? (
							inputs.description
						) : (
							<Box component="span" sx={{ color: palette.gray.medium2 }}>
								({formatMessage(messages.noDescription)})
							</Box>
						)}
					</Typography>
					<Typography variant="body2" gutterBottom>
						<Box component="span" sx={{ fontWeight: 'bold' }}>
							{formatMessage(messages.gitBranch)}:
						</Box>
						{` ${inputs.gitBranch ? inputs.gitBranch : 'master'}`}
					</Typography>
					{blueprint.source !== 'GIT' && blueprint.id === 'GIT' && renderGitOptions()}
				</Grid>
				{blueprint.parameters && !!blueprint.parameters.length && (
					<Grid size={12}>
						<Box sx={{ display: 'flex', alignItems: 'center' }}>
							<Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
								{formatMessage(messages.blueprintParameters)}
							</Typography>
							<IconButton
								aria-label={formatMessage(
									{ defaultMessage: 'Edit {section}' },
									{ section: formatMessage(messages.blueprintParameters) }
								)}
								sx={{
									color: (theme) => theme.palette.primary.main,
									'& svg': {
										fontSize: '1.2rem'
									}
								}}
								onClick={() => onGoTo(1)}
								size="large"
							>
								<EditIcon />
							</IconButton>
						</Box>
						{renderBlueprintParameters()}
					</Grid>
				)}
			</Grid>
		</Box>
	);
}

export default BlueprintReview;
