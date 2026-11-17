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

import { SiteState } from '../../models/Site';
import { EnhancedDialogProps } from '../EnhancedDialog';
import React from 'react';

interface NewRemoteRepositoryBaseProps {}

export interface NewRemoteRepositoryDialogProps extends NewRemoteRepositoryBaseProps, EnhancedDialogProps {
	onCreateSuccess?(): void;
	onCreateError?(e): void;
}

export interface NewRemoteRepositoryDialogContainerProps
	extends
		NewRemoteRepositoryBaseProps,
		Pick<NewRemoteRepositoryDialogProps, 'isSubmitting' | 'onClose' | 'onCreateError' | 'onCreateSuccess'> {}

export interface NewRemoteRepositoryDialogUIProps {
	inputs: Partial<SiteState>;
	isSubmitting: boolean;
	isValid: boolean;
	setInputs(inputs): void;
	onCloseButtonClick(e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
	onCreate(): void;
}

export const inputsInitialState: Partial<SiteState> & { remoteName: string; remoteUrl: string } = {
	authenticationType: 'none',
	expanded: {
		basic: false,
		token: false,
		private_key: false
	},
	repoAuthentication: 'none',
	repoUsername: '',
	repoToken: '',
	repoPassword: '',
	repoKey: '',
	remoteName: '',
	remoteUrl: '',
	submitted: false
};

export const isFormValid = (inputs) => {
	if (!inputs.remoteName || !inputs.remoteUrl) {
		return false;
	} else if (inputs.repoAuthentication === 'none') {
		return true;
	} else if (inputs.repoAuthentication === 'basic' && inputs.repoUsername !== '' && inputs.repoPassword !== '') {
		return true;
	} else if (inputs.repoAuthentication === 'token' && inputs.repoToken !== '') {
		return true;
	} else return !!(inputs.repoAuthentication === 'private_key' && inputs.repoKey);
};
