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

import { MergeStrategy, Repository } from '../../../models/Repository';
import RepoGridUI from './RepoGridUI';
import React, { useState } from 'react';
import PullDialog from '../PullDialog';
import { defineMessages, FormattedMessage, useIntl, type MessageValue } from 'react-intl';
import PushDialog from '../PushDialog';
import { deleteRemote as deleteRemoteService, PullResponse } from '../../../services/repositories';
import { showSystemNotification } from '../../../state/actions/system';
import { useDispatch } from 'react-redux';
import { useActiveSiteId } from '../../../hooks/useActiveSiteId';
import { useEnhancedDialogState } from '../../../hooks/useEnhancedDialogState';
import SnackbarContent, { snackbarContentClasses } from '@mui/material/SnackbarContent';
import InputBase from '@mui/material/InputBase';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { useSnackbar } from 'notistack';
import { copyToClipboard, pushErrorDialog } from '../../../utils/system';
import PublishCommitDialog from '../PublishCommitDialog/PublishCommitDialog';
import useSpreadState from '../../../hooks/useSpreadState';
import RepoGridSkeleton from './RepoGridSkeleton';
import { ApiResponse } from '../../../models';

export interface RepoGridProps {
	repositories: Array<Repository>;
	disableActions: boolean;
	onPullSuccess(result: PullResponse): void;
	onPullError(response: ApiResponse): void;
	fetchRepositories(): void;
}

const messages = {
	...defineMessages({
		mergeStrategyNone: {
			id: 'repositories.mergeStrategyNone',
			defaultMessage: 'None'
		},
		mergeStrategyOurs: {
			id: 'repositories.mergeStrategyOurs',
			defaultMessage: 'Accept Ours'
		},
		mergeStrategyTheirs: {
			id: 'repositories.mergeStrategyTheirs',
			defaultMessage: 'Accept Theirs'
		},
		remoteDeleteSuccessMessage: {
			id: 'repositories.remoteDeleteSuccessMessage',
			defaultMessage: 'Remote repository deleted successfully.'
		},
		pullSuccessNoChangesMessage: {
			id: 'repositories.pullSuccessNoChangesMessage',
			defaultMessage: 'Pull successful: already up to date.'
		},
		pushSuccessMessage: {
			id: 'repositories.pushSuccessMessage',
			defaultMessage: 'Successfully pushed.'
		}
	}),
	...defineMessages<{
		pullSuccessMessage: { readonly numberOfCommits: MessageValue };
	}>({
		pullSuccessMessage: {
			id: 'repositories.pullSuccessMessage',
			defaultMessage: 'Successfully pulled {numberOfCommits} commits. Would you like to publish this now?'
		}
	})
};

export function RepoGrid(props: RepoGridProps) {
	const { repositories, disableActions, onPullSuccess: onPullSuccessProp, onPullError, fetchRepositories } = props;
	const [repositoriesPushDialogBranches, setRepositoriesPushDialogBranches] = useState([]);
	const [pullRemoteName, setPullRemoteName] = useState(null);
	const [pushRemoteName, setPushRemoteName] = useState(null);
	const { formatMessage } = useIntl();
	const mergeStrategies: MergeStrategy[] = [
		{
			key: 'none',
			value: formatMessage(messages.mergeStrategyNone)
		},
		{
			key: 'ours',
			value: formatMessage(messages.mergeStrategyOurs)
		},
		{
			key: 'theirs',
			value: formatMessage(messages.mergeStrategyTheirs)
		}
	];
	const siteId = useActiveSiteId();
	const dispatch = useDispatch();
	const pushToRemoteDialogState = useEnhancedDialogState();
	const pullFromRemoteDialogState = useEnhancedDialogState();
	const { enqueueSnackbar } = useSnackbar();
	const publishCommitDialogState = useEnhancedDialogState();
	const [postPullState, setPostPullState] = useSpreadState({
		openPostPullSnack: false,
		mergeCommitId: '',
		commitsMerged: 0
	});

	const onClickPull = (remoteName: string, branches: string[]) => {
		setPullRemoteName(remoteName);
		pullFromRemoteDialogState.onOpen();
	};

	const onClickPush = (remoteName: string, branches: string[]) => {
		setRepositoriesPushDialogBranches(branches);
		setPushRemoteName(remoteName);
		pushToRemoteDialogState.onOpen();
	};

	const onPullSuccess = (result: PullResponse) => {
		onPullSuccessProp(result);
		pullFromRemoteDialogState.onClose();
		if (result.mergeCommitId) {
			setPostPullState({ openPostPullSnack: true, ...result });
		} else {
			dispatch(
				showSystemNotification({
					message: formatMessage(messages.pullSuccessNoChangesMessage)
				})
			);
		}
	};

	const handlePullError = (response: ApiResponse) => {
		onPullError?.(response);
		pullFromRemoteDialogState.onClose();
	};

	const onPushSuccess = () => {
		pushToRemoteDialogState.onResetState();
		dispatch(
			showSystemNotification({
				message: formatMessage(messages.pushSuccessMessage)
			})
		);
	};

	const onPushError = (response) => {
		pushToRemoteDialogState.onClose();
		dispatch(pushErrorDialog({ props: { error: response } }));
	};

	const deleteRemote = (remoteName: string) => {
		deleteRemoteService(siteId, remoteName).subscribe(
			() => {
				fetchRepositories();
				dispatch(
					showSystemNotification({
						message: formatMessage(messages.remoteDeleteSuccessMessage)
					})
				);
			},
			({ response }) => {
				dispatch(pushErrorDialog({ props: { error: response } }));
			}
		);
	};

	const onClosePostPullSnack = () => setPostPullState({ openPostPullSnack: false });

	return (
		<>
			{repositories ? (
				<RepoGridUI
					repositories={repositories}
					disableActions={disableActions}
					onPullClick={onClickPull}
					onPushClick={onClickPush}
					onDeleteRemote={deleteRemote}
				/>
			) : (
				<RepoGridSkeleton />
			)}
			<Snackbar
				autoHideDuration={10000}
				onClose={onClosePostPullSnack}
				open={postPullState.openPostPullSnack}
				sx={{ maxWidth: '500px' }}
			>
				<SnackbarContent
					sx={{ [`.${snackbarContentClasses.message}`]: { width: '100%' } }}
					message={
						<>
							{formatMessage(messages.pullSuccessMessage, { numberOfCommits: postPullState.commitsMerged })}
							<InputBase
								sx={{ display: 'block', mt: 1, borderRadius: 1, pr: 0.5, pl: 0.5 }}
								autoFocus
								value={postPullState.mergeCommitId}
								readOnly
								onClick={(e) => {
									(e.target as HTMLInputElement).select();
									copyToClipboard(postPullState.mergeCommitId).then(function () {
										enqueueSnackbar('Copied');
									});
								}}
							/>
						</>
					}
					action={
						<>
							<Button
								size="small"
								onClick={() => {
									publishCommitDialogState.onOpen();
									setPostPullState({ openPostPullSnack: false });
								}}
							>
								<FormattedMessage id="words.yes" defaultMessage="Yes" />
							</Button>
							<Button size="small" onClick={onClosePostPullSnack}>
								<FormattedMessage id="words.no" defaultMessage="No" />
							</Button>
						</>
					}
				/>
			</Snackbar>
			{/* region PullDialog */}
			<PullDialog
				open={pullFromRemoteDialogState.open}
				onClose={pullFromRemoteDialogState.onClose}
				remoteName={pullRemoteName}
				mergeStrategies={mergeStrategies}
				onPullSuccess={onPullSuccess}
				onPullError={handlePullError}
				isMinimized={pullFromRemoteDialogState.isMinimized}
				isSubmitting={pullFromRemoteDialogState.isSubmitting}
				hasPendingChanges={pullFromRemoteDialogState.hasPendingChanges}
			/>
			{/* endregion */}
			{/* region PushDialog */}
			<PushDialog
				open={pushToRemoteDialogState.open}
				branches={repositoriesPushDialogBranches}
				remoteName={pushRemoteName}
				onClose={pushToRemoteDialogState.onClose}
				onPushSuccess={onPushSuccess}
				onPushError={onPushError}
				isMinimized={pushToRemoteDialogState.isMinimized}
				isSubmitting={pushToRemoteDialogState.isSubmitting}
				hasPendingChanges={pushToRemoteDialogState.hasPendingChanges}
				onSubmittingChange={pushToRemoteDialogState.onSubmittingChange}
			/>
			{/* endregion */}
			<PublishCommitDialog
				commitId={postPullState.mergeCommitId}
				open={publishCommitDialogState.open}
				hasPendingChanges={publishCommitDialogState.hasPendingChanges}
				onSubmittingAndOrPendingChange={publishCommitDialogState.onSubmittingAndOrPendingChange}
				onClose={publishCommitDialogState.onClose}
			/>
		</>
	);
}

export default RepoGrid;
