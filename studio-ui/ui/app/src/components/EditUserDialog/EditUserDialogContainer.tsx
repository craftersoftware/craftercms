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

import { useDispatch } from 'react-redux';
import { defineMessages, useIntl } from 'react-intl';
import User from '../../models/User';
import React, { useEffect, useMemo, useState } from 'react';
import LookupTable from '../../models/LookupTable';
import { disable, enable, fetchRolesBySite, update } from '../../services/users';
import { showSystemNotification } from '../../state/actions/system';
import { EditUserDialogUI } from './EditUserDialogUI';
import { useSpreadState } from '../../hooks/useSpreadState';
import { useSitesBranch } from '../../hooks/useSitesBranch';
import { EditUserDialogContainerProps } from './utils';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { isInvalidEmail, validateFieldMinLength } from '../UserManagement/utils';
import { pluckProps } from '../../utils/object';
import { pushErrorDialog } from '../../utils/system';
import { useEnhancedDialogContext } from '../EnhancedDialog';

const translations = defineMessages({
	userUpdated: {
		id: 'userInfoDialog.userUpdated',
		defaultMessage: 'User updated successfully'
	},
	userEnabled: {
		id: 'userInfoDialog.userEnabled',
		defaultMessage: 'User enabled successfully'
	},
	userDisabled: {
		id: 'userInfoDialog.userDisabled',
		defaultMessage: 'User disabled successfully'
	}
});

export function EditUserDialogContainer(props: EditUserDialogContainerProps) {
	const { open, onClose, onUserEdited, passwordRequirementsMinComplexity, isSubmitting } = props;
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const [user, setUser] = useSpreadState<User>({
		id: null,
		firstName: '',
		lastName: '',
		email: '',
		username: '',
		enabled: false,
		externallyManaged: false
	});
	const [submitOk, setSubmitOk] = useState(false);
	const sites = useSitesBranch();
	const sitesById = sites.byId;
	const mySites = useMemo(() => Object.values(sitesById), [sitesById]);
	const [lastSavedUser, setLastSavedUser] = useState(null);
	const [rolesBySite, setRolesBySite] = useState<LookupTable<string[]>>({});
	const [dirty, setDirty] = useState(false);
	const [openResetPassword, setOpenResetPassword] = useState(false);
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();
	const fnRefs = useUpdateRefs({ updateSubmittingOrHasPendingChanges, onUserEdited });

	const editMode = !props.user?.externallyManaged;

	const onInputChange = (value: object) => {
		setDirty(true);
		setUser(value);
	};

	const onCancelForm = () => {
		if (lastSavedUser) {
			setUser(lastSavedUser);
		} else {
			setUser(props.user);
		}
		setDirty(false);
	};

	const onEnableChange = (value) => {
		setUser(value);
		if (value.enabled) {
			enable(user.username).subscribe({
				next() {
					dispatch(
						showSystemNotification({
							message: formatMessage(translations.userEnabled)
						})
					);
					fnRefs.current.onUserEdited();
				},
				error({ response: { response } }) {
					dispatch(pushErrorDialog({ props: { error: response } }));
				}
			});
		} else {
			disable(user.username).subscribe({
				next() {
					dispatch(
						showSystemNotification({
							message: formatMessage(translations.userDisabled)
						})
					);
					fnRefs.current.onUserEdited();
				},
				error({ response: { response } }) {
					dispatch(pushErrorDialog({ props: { error: response } }));
				}
			});
		}
	};

	const onSave = () => {
		if (!editMode) {
			return;
		}
		updateSubmittingOrHasPendingChanges({
			isSubmitting: true
		});
		update(pluckProps(user, 'id', 'firstName', 'lastName', 'email', 'enabled')).subscribe({
			next() {
				dispatch(
					showSystemNotification({
						message: formatMessage(translations.userUpdated)
					})
				);
				setDirty(false);
				setLastSavedUser(user);
				fnRefs.current.onUserEdited();
				fnRefs.current.updateSubmittingOrHasPendingChanges({
					isSubmitting: false
				});
			},
			error({ response: { response } }) {
				dispatch(pushErrorDialog({ props: { error: response } }));
				fnRefs.current.updateSubmittingOrHasPendingChanges({
					isSubmitting: false
				});
			}
		});
	};

	const onCloseResetPasswordDialog = () => {
		setOpenResetPassword(false);
	};

	const onResetPassword = (value: boolean) => {
		setOpenResetPassword(value);
	};

	useEffect(() => {
		if (open) {
			setUser(props.user);
		}
	}, [props.user, open, setUser]);

	useEffect(() => {
		if (mySites.length && props.user?.username) {
			fetchRolesBySite(props.user.username, mySites).subscribe((response) => {
				setRolesBySite(response);
			});
		}
	}, [mySites, props.user?.username]);

	const refs = useUpdateRefs({
		validateFieldMinLength
	});

	useEffect(() => {
		setSubmitOk(
			Boolean(
				user.firstName.trim() &&
				!validateFieldMinLength('firstName', user.firstName) &&
				user.lastName.trim() &&
				!validateFieldMinLength('lastName', user.lastName) &&
				!isInvalidEmail(user.email)
			)
		);
	}, [user, refs]);
	useEffect(() => {
		updateSubmittingOrHasPendingChanges({
			hasPendingChanges: dirty
		});
	}, [dirty, updateSubmittingOrHasPendingChanges]);

	return (
		<EditUserDialogUI
			user={user}
			openResetPassword={openResetPassword}
			inProgress={isSubmitting}
			submitOk={submitOk}
			dirty={dirty}
			sites={mySites}
			rolesBySite={rolesBySite}
			passwordRequirementsMinComplexity={passwordRequirementsMinComplexity}
			onSave={onSave}
			onCloseButtonClick={(e) => onClose(e, null)}
			onCloseResetPasswordDialog={onCloseResetPasswordDialog}
			onInputChange={onInputChange}
			onEnableChange={onEnableChange}
			onCancelForm={onCancelForm}
			onResetPassword={onResetPassword}
		/>
	);
}

export default EditUserDialogContainer;
