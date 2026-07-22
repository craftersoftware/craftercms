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

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import PasswordRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Divider from '@mui/material/Divider';
import DialogBody from '../DialogBody/DialogBody';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import { rand } from '../PathNavigator/utils';
import ResetPasswordDialog from '../ResetPasswordDialog';
import * as React from 'react';
import InputLabel from '@mui/material/InputLabel';
import { UserGroupMembershipEditor } from '../UserGroupMembershipEditor';
import { EditUserDialogUIProps } from './utils';
import TextField from '@mui/material/TextField';
import {
	isInvalidEmail,
	USER_EMAIL_MAX_LENGTH,
	USER_FIRST_NAME_MAX_LENGTH,
	USER_FIRST_NAME_MIN_LENGTH,
	USER_LAST_NAME_MAX_LENGTH,
	USER_LAST_NAME_MIN_LENGTH,
	validateFieldMinLength,
	validateRequiredField
} from '../UserManagement/utils';
import Box from '@mui/material/Box';

const translations = defineMessages({
	externallyManaged: {
		id: 'userInfoDialog.externallyManaged',
		defaultMessage: 'Managed externally'
	},
	siteName: {
		id: 'userInfoDialog.siteName',
		defaultMessage: 'Project name'
	},
	roles: {
		id: 'words.roles',
		defaultMessage: 'Roles'
	},
	invalidMinLength: {
		id: 'userInfoDialog.invalidMinLength',
		defaultMessage: 'Min {length} characters'
	}
});

export function EditUserDialogUI(props: EditUserDialogUIProps) {
	const { formatMessage } = useIntl();
	const managedInStudio = !props.user.externallyManaged;
	const {
		user,
		inProgress,
		submitOk,
		dirty,
		openResetPassword,
		sites,
		rolesBySite,
		passwordRequirementsMinComplexity,
		onSave,
		onCloseButtonClick,
		onCloseResetPasswordDialog,
		onInputChange,
		onEnableChange,
		onCancelForm,
		onResetPassword
	} = props;

	return (
		<>
			<Box component="header" sx={{ padding: '30px 40px', display: 'flex', alignItems: 'center' }}>
				<Avatar sx={{ marginRight: '30px', width: '90px', height: '90px' }}>
					{user.firstName.charAt(0)}
					{user.lastName?.charAt(0) ?? ''}
				</Avatar>
				<Box component="section" sx={{ maxWidth: '70%' }}>
					<Typography variant="h6" component="h2">
						{user.firstName} {user.lastName}
					</Typography>
					<Typography variant="subtitle1" noWrap title={user.username}>
						{user.username}
					</Typography>
				</Box>
				<Box component="section" sx={{ marginLeft: 'auto' }}>
					{managedInStudio ? (
						<>
							<Tooltip title={<FormattedMessage id="userInfoDialog.resetPassword" defaultMessage="Reset password" />}>
								<IconButton
									onClick={() => onResetPassword(true)}
									size="large"
									aria-label={formatMessage({ id: 'userInfoDialog.resetPassword', defaultMessage: 'Reset password' })}
								>
									<PasswordRoundedIcon />
								</IconButton>
							</Tooltip>
						</>
					) : (
						<Chip
							label={formatMessage(translations.externallyManaged)}
							size="small"
							sx={(theme) => ({
								background: theme.palette.info.main,
								color: theme.palette.text.primary,
								marginLeft: 'auto'
							})}
						/>
					)}
					<Tooltip title={<FormattedMessage id="userInfoDialog.close" defaultMessage="Close" />}>
						<IconButton
							edge="end"
							onClick={onCloseButtonClick}
							size="large"
							aria-label={formatMessage({ id: 'userInfoDialog.close', defaultMessage: 'Close' })}
						>
							<CloseRoundedIcon />
						</IconButton>
					</Tooltip>
				</Box>
			</Box>
			<Divider />
			<DialogBody sx={{ padding: 0 }}>
				<Grid container>
					<Grid size={{ sm: 6 }}>
						<Box component="section" sx={{ padding: '30px 40px' }}>
							<Typography variant="subtitle1" sx={{ textTransform: 'uppercase', marginBottom: '10px' }}>
								<FormattedMessage id="userInfoDialog.userDetails" defaultMessage="User Details" />
							</Typography>
							<Box
								component="form"
								sx={{
									'& > .row': {
										display: 'flex',
										padding: '10px 0',
										alignItems: 'center',
										'& .section-label': {
											flexBasis: '180px',
											'& + .MuiInputBase-root': {
												marginTop: '0 !important'
											}
										},
										'& .username': {
											width: '100%',
											display: 'flex',
											alignItems: 'center',
											overflow: 'hidden'
										}
									}
								}}
							>
								<div className="row">
									<Typography color="textSecondary" className="section-label">
										<FormattedMessage id="words.enabled" defaultMessage="Enabled" />
									</Typography>
									<Box sx={{ width: '100%', marginLeft: '-12px' }}>
										<Switch
											disabled={!managedInStudio}
											checked={user.enabled}
											onChange={(e) => onEnableChange({ enabled: e.target.checked })}
											color="primary"
											name="enabled"
											inputProps={{ 'aria-label': 'enabled checkbox' }}
										/>
									</Box>
								</div>
								<Divider />
								<div className="row">
									<Typography color="textSecondary" className="section-label">
										<FormattedMessage id="words.username" defaultMessage="Username" />
									</Typography>
									<Box component="section" className="username">
										<Typography noWrap title={user.username}>
											{user.username}
										</Typography>
									</Box>
								</div>
								<div className="row">
									<InputLabel htmlFor="firstName" className="section-label">
										<Typography color="textSecondary">
											<FormattedMessage id="words.firstName" defaultMessage="First name" />
										</Typography>
									</InputLabel>
									{managedInStudio ? (
										<TextField
											id="firstName"
											onChange={(e) => onInputChange({ firstName: e.currentTarget.value })}
											slotProps={{
												htmlInput: { maxLength: USER_FIRST_NAME_MAX_LENGTH }
											}}
											value={user.firstName}
											fullWidth
											error={
												validateRequiredField(user.firstName) || validateFieldMinLength('firstName', user.firstName)
											}
											helperText={
												validateRequiredField(user.firstName) ? (
													<FormattedMessage
														id="editUserDialog.firstNameRequired"
														defaultMessage="First Name is required"
													/>
												) : validateFieldMinLength('firstName', user.firstName) ? (
													formatMessage(translations.invalidMinLength, { length: USER_FIRST_NAME_MIN_LENGTH })
												) : null
											}
										/>
									) : (
										<Typography className="username" children={user.firstName} />
									)}
								</div>
								<div className="row">
									<InputLabel htmlFor="lastName" className="section-label">
										<Typography color="textSecondary">
											<FormattedMessage id="words.lastName" defaultMessage="Last name" />
										</Typography>
									</InputLabel>
									{managedInStudio ? (
										<TextField
											id="lastName"
											onChange={(e) => onInputChange({ lastName: e.currentTarget.value })}
											slotProps={{
												htmlInput: { maxLength: USER_LAST_NAME_MAX_LENGTH }
											}}
											value={user.lastName}
											fullWidth
											error={validateRequiredField(user.lastName) || validateFieldMinLength('lastName', user.lastName)}
											helperText={
												validateRequiredField(user.lastName) ? (
													<FormattedMessage
														id="editUserDialog.lastNameRequired"
														defaultMessage="Last Name is required"
													/>
												) : validateFieldMinLength('lastName', user.lastName) ? (
													formatMessage(translations.invalidMinLength, { length: USER_LAST_NAME_MIN_LENGTH })
												) : null
											}
										/>
									) : (
										<Typography className="username" children={user.lastName} />
									)}
								</div>
								<div className="row">
									<InputLabel htmlFor="email" className="section-label">
										<Typography color="textSecondary">
											<FormattedMessage id="words.email" defaultMessage="E-mail" />
										</Typography>
									</InputLabel>
									{managedInStudio ? (
										<TextField
											id="email"
											onChange={(e) => onInputChange({ email: e.currentTarget.value })}
											value={user.email}
											error={validateRequiredField(user.email) || isInvalidEmail(user.email)}
											fullWidth
											helperText={
												validateRequiredField(user.email) ? (
													<FormattedMessage id="editUserDialog.emailRequired" defaultMessage="Email is required" />
												) : isInvalidEmail(user.email) ? (
													<FormattedMessage id="editUserDialog.invalidEmail" defaultMessage="Email is invalid" />
												) : null
											}
											slotProps={{
												htmlInput: { maxLength: USER_EMAIL_MAX_LENGTH }
											}}
										/>
									) : (
										<Typography className="username" children={user.email} />
									)}
								</div>
								{managedInStudio && (
									<Box
										sx={{
											display: 'flex',
											paddingBottom: '20px',
											'& button:first-child': {
												marginLeft: 'auto',
												marginRight: '10px'
											}
										}}
									>
										<SecondaryButton disabled={!dirty || inProgress} onClick={onCancelForm}>
											<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
										</SecondaryButton>
										<PrimaryButton disabled={!dirty || !submitOk || inProgress} onClick={onSave} loading={inProgress}>
											<FormattedMessage id="words.save" defaultMessage="Save" />
										</PrimaryButton>
									</Box>
								)}
							</Box>
						</Box>
					</Grid>
					<Grid size={{ sm: 6 }}>
						<Box component="section" sx={{ padding: '30px 40px' }}>
							<UserGroupMembershipEditor username={user.username} />
						</Box>
					</Grid>
				</Grid>
				<Divider />
				<Box component="section" sx={{ padding: '30px 40px' }}>
					<Typography variant="subtitle1" sx={{ textTransform: 'uppercase', marginBottom: '10px' }}>
						<FormattedMessage id="userInfoDialog.siteRoles" defaultMessage="Roles per project" />
					</Typography>
					<Grid container spacing={2}>
						<Grid size={4}>
							{sites.map((site) => (
								<Typography key={site.id} variant="body2" sx={{ margin: '10px 0' }}>
									{site.name}
								</Typography>
							))}
						</Grid>
						<Grid size={8}>
							{sites.map((site, i) =>
								rolesBySite[site.id] ? (
									rolesBySite[site.id].length ? (
										<Typography key={site.id} variant="body2" sx={{ margin: '10px 0' }}>
											{rolesBySite[site.id].join(', ')}
										</Typography>
									) : (
										<Typography key={site.id} variant="body2" color="textSecondary" sx={{ margin: '10px 0' }}>
											(<FormattedMessage id="userInfoDialog.noRoles" defaultMessage="No roles" />)
										</Typography>
									)
								) : (
									<Skeleton key={i} variant="text" sx={{ margin: '10px 0' }} style={{ width: `${rand(50, 90)}%` }} />
								)
							)}
						</Grid>
					</Grid>
				</Box>
			</DialogBody>
			{managedInStudio && (
				<ResetPasswordDialog
					open={openResetPassword}
					passwordRequirementsMinComplexity={passwordRequirementsMinComplexity}
					user={user}
					onClose={onCloseResetPasswordDialog}
				/>
			)}
		</>
	);
}

export default EditUserDialogUI;
