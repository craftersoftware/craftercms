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

import React, { useState } from 'react';
import Dialog, { type DialogProps } from '@mui/material/Dialog';
import { withoutIndex } from '../../utils/path';
import StandardAction from '../../models/StandardAction';
import TranslationOrText from '../../models/TranslationOrText';
import { useUnmount } from '../../hooks/useUnmount';
import { usePossibleTranslation } from '../../hooks/usePossibleTranslation';
import { FormattedMessage, useIntl } from 'react-intl';
import DialogBody from '../DialogBody/DialogBody';
import DialogFooter from '../DialogFooter/DialogFooter';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import DialogHeader from '../DialogHeader';
import FolderBrowserTreeView from '../FolderBrowserTreeView';
import PathSelectionInput from '../PathSelectionInput';
import KeyboardArrowLeftRoundedIcon from '@mui/icons-material/KeyboardArrowLeftRounded';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import BasePathSelector from '../BasePathSelector';
import { UNDEFINED } from '../../utils/constants';
import { useDispatch } from 'react-redux';
import { popDialog, pushDialog } from '../../state/actions/dialogStack';
import { createComponentId } from '../../utils/system';
import { nanoid } from 'nanoid';

export interface PathSelectionDialogBaseProps {
	open: boolean;
	title?: TranslationOrText;
	rootPath?: string;
	initialPath?: string;
	allowSwitchingRootPath?: boolean;
	showCreateFolderOption?: boolean;
	stripXmlIndex?: boolean;
	onTransitionExited?: DialogProps['onTransitionExited'];
}

export interface PathSelectionDialogCallbacks {
	onClose(): void;
	onClosed?(): void;
	onOk?(response: { path: string }): void;
}

export type PathSelectionDialogProps = PathSelectionDialogBaseProps & PathSelectionDialogCallbacks;

export interface PathSelectionDialogStateProps extends PathSelectionDialogBaseProps {
	onClose?: StandardAction;
	onClosed?: StandardAction;
	onOk?: StandardAction;
}

export function PathSelectionDialog(props: PathSelectionDialogProps) {
	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			fullWidth
			maxWidth="sm"
			onTransitionExited={props.onTransitionExited}
		>
			<PathSelectionDialogContainer {...props} />
		</Dialog>
	);
}

export function PathSelectionDialogContainer(props: PathSelectionDialogProps) {
	const {
		onClosed,
		onClose,
		onOk,
		rootPath = '',
		initialPath,
		showCreateFolderOption = true,
		stripXmlIndex = true,
		allowSwitchingRootPath = true
	} = props;
	const [root, setRoot] = useState(rootPath);
	const [currentPath, setCurrentPath] = useState(initialPath ?? root);
	const title = usePossibleTranslation(props.title);
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();

	useUnmount(onClosed);

	const onCreateFolder = () => {
		const dialogId = nanoid();
		dispatch(
			pushDialog({
				id: dialogId,
				component: createComponentId('CreateFolderDialog'),
				props: {
					title: <FormattedMessage id="newFolder.title" defaultMessage="Create a New Folder" />,
					path: currentPath,
					onCreated: ({ path, name }: { path: string; name: string }) => {
						dispatch(popDialog({ id: dialogId }));
						const id = `${path}/${name}`;
						setCurrentPath(id);
					}
				}
			})
		);
	};

	const onPathChanged = (path: string) => {
		setCurrentPath(path);
	};

	return (
		<>
			<DialogHeader
				title={title ?? <FormattedMessage id="pathSelectionDialog.title" defaultMessage="Select Path" />}
				onCloseButtonClick={onClose}
			/>
			<DialogBody sx={{ minHeight: '60vh' }}>
				{root && root !== '/' ? (
					<>
						<PathSelectionInput
							rootPath={root}
							onChange={onPathChanged}
							currentPath={currentPath}
							startAdornment={
								allowSwitchingRootPath ? (
									<Tooltip
										title={formatMessage({
											id: 'pathSelectionDialog.changeRootButtonLabel',
											defaultMessage: 'Change root'
										})}
									>
										<IconButton
											sx={{ mr: 0.5 }}
											onClick={() => {
												setRoot('');
												setCurrentPath('');
											}}
										>
											<KeyboardArrowLeftRoundedIcon />
										</IconButton>
									</Tooltip>
								) : (
									UNDEFINED
								)
							}
						/>
						<FolderBrowserTreeView rootPath={root} onPathSelected={onPathChanged} selectedPath={currentPath} />
					</>
				) : (
					<BasePathSelector
						value=""
						onChange={(e) => {
							const path = e.target.value;
							setRoot(path);
							setCurrentPath(path);
						}}
					/>
				)}
			</DialogBody>
			<DialogFooter>
				{showCreateFolderOption && (
					<SecondaryButton onClick={onCreateFolder} sx={{ marginRight: 'auto' }}>
						<FormattedMessage id="pathSelectionDialog.createFolderButtonLabel" defaultMessage="Create Folder" />
					</SecondaryButton>
				)}
				<SecondaryButton onClick={onClose}>
					<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
				</SecondaryButton>
				<PrimaryButton onClick={() => onOk?.({ path: stripXmlIndex ? withoutIndex(currentPath) : currentPath })}>
					<FormattedMessage id="words.accept" defaultMessage="Accept" />
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

export default PathSelectionDialog;
