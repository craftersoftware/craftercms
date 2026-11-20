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

import { EnhancedDialog, EnhancedDialogProps } from '../EnhancedDialog';
import { FormattedMessage } from 'react-intl';
import React, { useEffect } from 'react';
import { DuplicateSiteState, Views } from '../../models';
import DuplicateSiteDialogContainer from './DuplicateSiteDialogContainer';
import useSpreadState from '../../hooks/useSpreadState';
import { dialogClasses } from '@mui/material/Dialog';
import { onSubmittingAndOrPendingChangeProps } from '../../hooks/useEnhancedDialogState';
import useWithPendingChangesCloseRequest from '../../hooks/useWithPendingChangesCloseRequest';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import useOnClose from '../../hooks/useOnClose';

const siteInitialState: DuplicateSiteState = {
	sourceSiteId: '',
	siteId: '',
	siteName: '',
	siteIdExist: false,
	siteNameExist: false,
	invalidSiteId: false,
	description: '',
	gitBranch: '',
	submitted: false,
	selectedView: 0,
	readOnlyBlobStores: true,
	singleBranch: true,
	enableStaging: false
};

interface DuplicateSiteDialogProps extends EnhancedDialogProps {
	siteId?: string;
	onGoBack?(): void;
	updateSubmittingOrHasPendingChanges(value: onSubmittingAndOrPendingChangeProps): void;
}

export function DuplicateSiteDialog(props: DuplicateSiteDialogProps) {
	const { siteId, updateSubmittingOrHasPendingChanges, onClose, onGoBack, ...dialogProps } = props;
	const [site, setSite] = useSpreadState({
		...siteInitialState,
		...(siteId && { sourceSiteId: siteId })
	});
	const onCloseHandler = useOnClose({
		onClose: !dialogProps.isSubmitting && onClose,
		disableBackdropClick: dialogProps.isSubmitting,
		disableEscapeKeyDown: dialogProps.isSubmitting
	});
	const pendingChangesCloseRequest = useWithPendingChangesCloseRequest(onCloseHandler);
	const fnRefs = useUpdateRefs({ updateSubmittingOrHasPendingChanges });

	useEffect(() => {
		if (siteId) {
			setSite({ sourceSiteId: siteId });
		}
	}, [siteId, setSite]);

	useEffect(() => {
		const { sourceSiteId, siteId, siteName, description, gitBranch } = site;
		const dialogHasChanges =
			Boolean(sourceSiteId) || Boolean(siteId) || Boolean(siteName) || Boolean(description) || Boolean(gitBranch);
		fnRefs.current.updateSubmittingOrHasPendingChanges({ hasPendingChanges: dialogHasChanges });
	}, [site, fnRefs]);

	const views: Views = {
		0: {
			title: <FormattedMessage defaultMessage="Duplicate Project" />,
			subtitle: <FormattedMessage defaultMessage="The new project will be an exact copy of the chosen project" />
		},
		1: {
			title: <FormattedMessage defaultMessage="Finish" />,
			subtitle: <FormattedMessage defaultMessage="Review set up summary and duplicate the project" />
		}
	};

	return (
		<EnhancedDialog
			title={views[site.selectedView].title}
			dialogHeaderProps={{ subtitle: views[site.selectedView].subtitle }}
			maxWidth="lg"
			sx={{
				[`& .${dialogClasses.paper}`]: { height: 'calc(100% - 100px)', maxHeight: '1200px' }
			}}
			data-dialog-id="create-site-dialog"
			updateSubmittingOrHasPendingChanges={updateSubmittingOrHasPendingChanges}
			onWithPendingChangesCloseRequest={pendingChangesCloseRequest}
			onClosed={() => setSite(siteInitialState)}
			{...dialogProps}
			onClose={onCloseHandler}
		>
			<DuplicateSiteDialogContainer
				site={site}
				setSite={setSite}
				handleClose={onClose}
				onGoBack={onGoBack}
				isSubmitting={dialogProps.isSubmitting}
			/>
		</EnhancedDialog>
	);
}

export default DuplicateSiteDialog;
