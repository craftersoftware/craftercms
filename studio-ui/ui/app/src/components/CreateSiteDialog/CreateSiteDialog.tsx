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
import Dialog, { dialogClasses } from '@mui/material/Dialog';
import { SiteState } from '../../models/Site';
import { nnou } from '../../utils/object';
import { useSpreadState } from '../../hooks/useSpreadState';
import CreateSiteDialogContainer from './CreateSiteDialogContainer';

const siteInitialState: SiteState = {
	blueprint: null,
	siteId: '',
	siteName: '',
	siteIdExist: false,
	siteNameExist: false,
	invalidSiteId: false,
	description: '',
	pushSite: false,
	useRemote: false,
	createAsOrphan: false,
	repoUrl: '',
	repoAuthentication: 'none',
	repoRemoteBranch: '',
	sandboxBranch: '',
	repoRemoteName: '',
	repoPassword: '',
	repoUsername: '',
	repoToken: '',
	repoKey: '',
	submitted: false,
	selectedView: 0,
	details: { blueprint: null, index: null },
	blueprintFields: {},
	expanded: {
		basic: false,
		token: false,
		private_key: false
	},
	showIncompatible: true,
	gitBranch: '',
	singleBranch: true
};

const searchInitialState = {
	searchKey: '',
	searchSelected: false
};

interface CreateSiteDialogProps {
	open: boolean;
	onClose?(): any;
	onShowDuplicate(): void;
}

function CreateSiteDialog(props: CreateSiteDialogProps) {
	const [disableEnforceFocus, setDisableEnforceFocus] = useState(false);
	const [dialog, setDialog] = useSpreadState({
		open: nnou(props.open) ? props.open : true,
		inProgress: false
	});
	const [site, setSite] = useSpreadState(siteInitialState);
	const [search, setSearch] = useState(searchInitialState);

	function cleanDialogState() {
		setDialog({ open: false, inProgress: false });
		setSite(siteInitialState);
		setSearch(searchInitialState);
	}

	useEffect(() => {
		setDialog({ open: props.open });
	}, [props.open, setDialog]);

	useEffect(() => {
		const loginListener = function (event: any) {
			if (event.detail.state === 'logged') {
				setDisableEnforceFocus(false);
			} else if (event.detail.state === 'reLogin') {
				setDisableEnforceFocus(true);
			}
		};
		document.addEventListener('login', loginListener, false);
		return () => {
			document.removeEventListener('login', loginListener, false);
		};
	}, []);

	function handleClose(event?: any, reason?: string) {
		const formInProgress = isFormInProgress();

		if (reason === 'escapeKeyDown' && site.details.blueprint) {
			setSite({ details: { blueprint: null, index: null } });
		} else if (
			(reason === 'escapeKeyDown' || reason === 'closeButton' || reason === 'backdropClick') &&
			formInProgress
		) {
			setDialog({ inProgress: true });
		} else {
			// call externalClose fn
			cleanDialogState();
			props.onClose?.();
		}
	}

	function isFormInProgress() {
		let inProgress = false;
		const keys = [
			'siteId',
			'description',
			'repoUrl',
			'repoAuthentication',
			'repoRemoteBranch',
			'sandboxBranch',
			'repoRemoteName',
			'repoPassword',
			'repoUsername',
			'repoToken',
			'repoKey'
		];

		keys.forEach((key: string) => {
			if (site[key] !== siteInitialState[key]) {
				inProgress = true;
			}
		});

		Object.keys(site.blueprintFields).forEach((key: string) => {
			if (site.blueprintFields[key] !== '') {
				inProgress = true;
			}
		});

		return inProgress;
	}

	return (
		<Dialog
			open={dialog.open}
			onClose={handleClose}
			aria-labelledby="create-site-dialog"
			fullWidth
			maxWidth="lg"
			sx={{
				[`& .${dialogClasses.scrollPaper}`]: {
					height: 'calc(100% - 100px)',
					maxHeight: '1200px'
				}
			}}
			disableEnforceFocus={disableEnforceFocus}
			data-dialog-id="create-site-dialog"
		>
			<CreateSiteDialogContainer
				site={site}
				setSite={setSite}
				search={search}
				setSearch={setSearch}
				handleClose={handleClose}
				dialog={dialog}
				setDialog={setDialog}
				disableEnforceFocus={disableEnforceFocus}
				onShowDuplicate={props.onShowDuplicate}
			/>
		</Dialog>
	);
}

export default CreateSiteDialog;
