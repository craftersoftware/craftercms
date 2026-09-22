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

import React, { useEffect, useRef, useState } from 'react';
import DialogHeader from '../DialogHeader/DialogHeader';
import DialogBody from '../DialogBody/DialogBody';
import { fetchContentXML, lock, writeContent } from '../../services/content';
import { ConditionalLoadingState } from '../LoadingState/LoadingState';
import AceEditor from '../AceEditor/AceEditor';
import { useDispatch } from 'react-redux';
import Skeleton from '@mui/material/Skeleton';
import ListSubheader from '@mui/material/ListSubheader';
import DialogFooter from '../DialogFooter/DialogFooter';
import SecondaryButton from '../SecondaryButton';
import { FormattedMessage, useIntl } from 'react-intl';
import { showSystemNotification } from '../../state/actions/system';
import translations from './translations';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import LookupTable from '../../models/LookupTable';
import { isItemLockedForMe, isLockedState } from '../../utils/content';
import { useContentTypes } from '../../hooks/useContentTypes';
import { useActiveUser } from '../../hooks/useActiveUser';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { useReferences } from '../../hooks/useReferences';
import { getHostToGuestBus } from '../../utils/subjects';
import { associateTemplate, reloadRequest } from '../../state/actions/preview';
import { CodeEditorDialogContainerProps, getContentModelSnippets } from './utils';
import { MultiChoiceSaveButton } from '../MultiChoiceSaveButton';
import useUpToDateRefs from '../../hooks/useUpdateRefs';
import { EnhancedDialog, useEnhancedDialogContext } from '../EnhancedDialog';
import { writeConfiguration } from '../../services/configuration';
import { forkJoin, switchMap } from 'rxjs';
import { cancelPackages, fetchAffectedPackages } from '../../services/workflow';
import { PublishPackage } from '../../models';
import Alert, { alertClasses } from '@mui/material/Alert';
import { pushDialog } from '../../state/actions/dialogStack';
import { createComponentId, pushErrorDialog } from '../../utils/system';
import { useContentItem } from '../../hooks/useContentItem';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextFieldWithMax from '../TextFieldWithMax';
import { Typography } from '@mui/material';
import useSpreadState from '../../hooks/useSpreadState';
import { getFileNameFromPath } from '../../utils/path';
import { fetchContentItem } from '../../state/actions/content';

export function CodeEditorDialogContainer(props: CodeEditorDialogContainerProps) {
	const {
		path,
		onMinimize,
		onClose,
		mode,
		readonly,
		contentType,
		isNew: isNewProp,
		associateTemplateOnSave,
		onFullScreen,
		onSuccess
	} = props;
	const { open, isSubmitting } = useEnhancedDialogContext();
	const item = useContentItem(path);
	const site = useActiveSiteId();
	const user = useActiveUser();
	const [loading, setLoading] = useState(false);
	const [content, setContent] = useState(null);
	const [isNew, setIsNew] = useState(Boolean(isNewProp));
	const itemLoaded = Boolean(item); // isLocked and isLockedForMe only hold accurate value if item was already loaded.
	const isLocked = isLockedState(item?.state);
	// Do not treat a missing/unloaded item as locked-for-me (isItemLockedForMe returns true when item is null),
	// or the editor stays read-only until/unless the item appears in the store — e.g. right after creating a new file.
	const isLockedForMe = !isNew && itemLoaded && isItemLockedForMe(item, user.username);
	const shouldPerformLock = open && itemLoaded && !readonly && !isLockedForMe && !isLocked && !isNew;
	const editorRef = useRef<any>(undefined);
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const contentTypes = useContentTypes();
	const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
	const [snippets, setSnippets] = useState<LookupTable<{ label: string; value: string }>>({});
	const [contentModelSnippets, setContentModelSnippets] = useState<Array<{ label: string; value: string }>>(null);
	const [affectedPackages, setAffectedPackages] = useState<PublishPackage[]>(undefined);
	const { updateSubmittingOrHasPendingChanges } = useEnhancedDialogContext();
	const storedId = 'codeEditor';
	const {
		'craftercms.freemarkerCodeSnippets': freemarkerCodeSnippets,
		'craftercms.groovyCodeSnippets': groovyCodeSnippets
	} = useReferences() ?? {};
	const onChangeTimeoutRef = useRef<any>(null);
	const [saveWithCommentState, setSaveWithCommentState] = useSpreadState<{
		saveWithComment: boolean;
		openDialog: boolean;
		comment: string;
		saveType: 'save' | 'saveAndClose' | 'saveAndMinimize';
	}>({
		saveWithComment: false,
		openDialog: false,
		comment: '',
		saveType: null
	});
	const isConfig = path.startsWith('/config');
	const fileName = getFileNameFromPath(path);

	const onEditorChanges = () => {
		clearTimeout(onChangeTimeoutRef.current);
		onChangeTimeoutRef.current = setTimeout(() => {
			updateSubmittingOrHasPendingChanges({ hasPendingChanges: content !== editorRef.current.getValue() });
		}, 150);
	};

	const save = (callback?: () => void, cancelPackagesComment: string = '') => {
		if (!isLockedForMe && !readonly) {
			updateSubmittingOrHasPendingChanges({ isSubmitting: true });
			const value = editorRef.current.getValue();
			const module = isConfig ? (path.split('/')[2] as 'studio') : null;
			// New files under /config are created via writeContent (same as createFile); subsequent saves use writeConfiguration.
			const service$ =
				isConfig && !isNew
					? writeConfiguration(site, path.replace(`/config/${module}`, ''), module, value)
					: writeContent(site, path, value, {
							unlock: false,
							...(saveWithCommentState.saveWithComment && { comment: saveWithCommentState.comment })
						});
			// If item is in packages in active workflow, before saving we need to cancel the packages.
			const preWriteAction$ = affectedPackages?.length
				? cancelPackages(site, {
						packageIds: affectedPackages.map((p) => p.id),
						comment: cancelPackagesComment
					}).pipe(switchMap(() => service$))
				: service$;

			preWriteAction$.subscribe({
				next() {
					if (isNew) {
						if (associateTemplateOnSave && contentType) {
							dispatch(associateTemplate({ contentTypeId: contentType, displayTemplate: path }));
						}
						setIsNew(false);
						// Load the newly created item so lock state / title resolve correctly for continued editing.
						dispatch(fetchContentItem({ path }));
					}
					updateSubmittingOrHasPendingChanges({ isSubmitting: false, hasPendingChanges: false });
					dispatch(showSystemNotification({ message: formatMessage(translations.saved) }));
					setTimeout(callback);
					getHostToGuestBus().next(reloadRequest());
					onSuccess?.();
				},
				error({ response }) {
					updateSubmittingOrHasPendingChanges({ isSubmitting: false });
					dispatch(pushErrorDialog({ props: { error: response } }));
				}
			});
		}
	};

	const checkItemWorkflow = (callback?: () => void) => {
		// Before saving, check if the item is part of a package in active workflow. If so, show a dialog to review the
		// packages before continuing with the cancellation of the packages and saving the item.
		if (affectedPackages?.length) {
			dispatch(
				pushDialog({
					component: createComponentId('ViewPackagesDialog'),
					props: {
						item,
						cancelPackagesInitialComment: formatMessage(
							{ defaultMessage: 'Cancel packages to write on "{path}"' },
							{ path }
						),
						onContinue: (cancelPackagesUpdatedComment: string) => {
							save(callback, cancelPackagesUpdatedComment);
						}
					}
				})
			);
		} else {
			save(callback);
		}
	};

	const onSaveButtonClick = () => {
		checkItemWorkflow(() => setContent(editorRef.current.getValue()));
	};

	const onAddSnippet = (event) => {
		setAnchorEl(event.currentTarget);
	};

	const closeSnippets = () => {
		setAnchorEl(null);
	};

	const onSnippetSelected = (snippet: { label: string; value: string }) => {
		const cursorPosition = editorRef.current.getCursorPosition();
		editorRef.current.session.insert(cursorPosition, snippet.value);
		editorRef.current.focus();
		closeSnippets();
	};

	const onCloseButtonClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		fnRefs.current.onClose(e, null);
	};

	const saveChoiceSelection = (type) => {
		switch (type) {
			case 'save':
				onSaveButtonClick();
				break;
			case 'saveAndClose':
				checkItemWorkflow(() => onCloseButtonClick(null));
				break;
			case 'saveAndMinimize':
				checkItemWorkflow(() => {
					setContent(editorRef.current.getValue());
					onMinimize?.();
				});
				break;
		}
	};

	const onMultiChoiceSaveButtonClick = (e, type) => {
		if (saveWithCommentState.saveWithComment) {
			setSaveWithCommentState({ openDialog: true, saveType: type });
		} else {
			saveChoiceSelection(type);
		}
	};

	const onAceInit = (editor: AceAjax.Editor) => {
		editor.commands.addCommand({
			name: 'saveToCrafter',
			bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
			exec: () => fnRefs.current.onSaveButtonClick(),
			readOnly: false
		});
	};

	const fnRefs = useUpToDateRefs({ onSaveButtonClick, onClose });

	// add content model variables
	useEffect(() => {
		if (contentTypes && (item || (isNew && contentType))) {
			const _contentType = contentType
				? contentType
				: Object.values(contentTypes).find((contentType) => contentType.displayTemplate === item.path)?.id;
			if (mode === 'ftl') {
				let { contentVariable, ...rest } = freemarkerCodeSnippets;
				setSnippets(rest);
				if (contentVariable && _contentType) {
					setContentModelSnippets(getContentModelSnippets(contentVariable, contentTypes[_contentType].fields));
				}
			} else if (mode === 'groovy') {
				let { accessContentModel, ...rest } = groovyCodeSnippets;
				setSnippets(rest);
				if (accessContentModel && _contentType) {
					setContentModelSnippets(getContentModelSnippets(accessContentModel, contentTypes[_contentType].fields));
				}
			}
		}
	}, [contentTypes, contentType, mode, item, isNew, freemarkerCodeSnippets, groovyCodeSnippets]);

	useEffect(() => {
		if (content === null) {
			if (isNew) {
				setContent('');
				setAffectedPackages([]);
				setLoading(false);
				return;
			}
			setLoading(true);
			updateSubmittingOrHasPendingChanges({ isSubmitting: true });
			const subscription = forkJoin([fetchContentXML(site, path), fetchAffectedPackages(site, path)]).subscribe(
				([xml, affectedPackages]) => {
					setContent(xml);
					setAffectedPackages(affectedPackages);
					setLoading(false);
					updateSubmittingOrHasPendingChanges({ isSubmitting: false });
				}
			);
			return () => {
				subscription.unsubscribe();
			};
		}
	}, [content, dispatch, path, site, isNew, updateSubmittingOrHasPendingChanges]);

	useEffect(() => {
		if (shouldPerformLock) {
			lock(site, path).subscribe();
		}
	}, [path, shouldPerformLock, site]);

	return (
		<>
			<DialogHeader
				title={item ? item.label : isNew ? fileName : <Skeleton width="120px" />}
				subtitle={
					affectedPackages?.length ? (
						<Alert
							variant="outlined"
							severity="warning"
							sx={{
								p: 0,
								border: 'none',
								[`& .${alertClasses.icon}, & .${alertClasses.message}`]: {
									p: 0
								},
								[`& .${alertClasses.action}`]: {
									py: 0
								}
							}}
							action={
								<Button
									color="inherit"
									size="small"
									sx={{ p: 0 }}
									onClick={() => {
										dispatch(pushDialog({ component: createComponentId('ViewPackagesDialog'), props: { item } }));
									}}
								>
									<FormattedMessage defaultMessage="Review" />
								</Button>
							}
						>
							<FormattedMessage defaultMessage="The item is part of one or more publishing packages. Editing it will cancel the packages." />
						</Alert>
					) : null
				}
				onCloseButtonClick={onCloseButtonClick}
				onMinimizeButtonClick={onMinimize}
				onFullScreenButtonClick={onFullScreen}
				disabled={isSubmitting}
			/>
			<DialogBody
				sx={{
					height: '60vh',
					padding: 0,
					'.MuiDialogTitle-root + &': {
						pt: 0
					}
				}}
			>
				<ConditionalLoadingState isLoading={loading} sxs={{ root: { flexGrow: 1 } }}>
					<AceEditor
						ref={editorRef}
						autoFocus={!readonly}
						mode={`ace/mode/${mode}`}
						value={content ?? ''}
						onChange={onEditorChanges}
						readOnly={isLockedForMe || readonly}
						sxs={{ editorRoot: { position: 'absolute' } }}
						enableBasicAutocompletion
						enableSnippets
						enableLiveAutocompletion
						onInit={onAceInit}
					/>
				</ConditionalLoadingState>
			</DialogBody>
			{!readonly && (
				<DialogFooter>
					<Button
						onClick={onAddSnippet}
						endIcon={<ExpandMoreRoundedIcon />}
						sx={{ marginRight: 'auto' }}
						disabled={isSubmitting || isLockedForMe}
					>
						<FormattedMessage id="codeEditor.insertCode" defaultMessage="Insert Code" />
					</Button>
					{!isConfig && (
						<FormControlLabel
							control={
								<Checkbox
									size="small"
									checked={saveWithCommentState.saveWithComment}
									onChange={(e) => setSaveWithCommentState({ saveWithComment: e.target.checked })}
								/>
							}
							label={
								<Typography variant="body2">
									<FormattedMessage defaultMessage="Save with comment" />
								</Typography>
							}
						/>
					)}
					<SecondaryButton onClick={onCloseButtonClick} sx={{ mr: '8px' }} disabled={isSubmitting}>
						<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
					</SecondaryButton>
					<MultiChoiceSaveButton
						loading={isSubmitting}
						disabled={isLockedForMe}
						storageKey={storedId}
						onClick={onMultiChoiceSaveButtonClick}
					/>
				</DialogFooter>
			)}
			<Menu anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={closeSnippets}>
				{contentModelSnippets && (
					<ListSubheader disableSticky={true}>
						<FormattedMessage id="codeEditor.contentModel" defaultMessage="Content model" />
					</ListSubheader>
				)}
				{contentModelSnippets?.map((snippet, i) => (
					<MenuItem key={i} onClick={() => onSnippetSelected(snippet)} dense>
						{snippet.label}
					</MenuItem>
				))}
				<ListSubheader>
					<FormattedMessage id="words.snippets" defaultMessage="Snippets" />
				</ListSubheader>
				{Object.values(snippets).map((snippet, i) => (
					<MenuItem key={i} onClick={() => onSnippetSelected(snippet)} dense>
						{snippet.label}
					</MenuItem>
				))}
			</Menu>
			<EnhancedDialog
				open={saveWithCommentState.openDialog}
				onClose={() => setSaveWithCommentState({ openDialog: false })}
				maxWidth="sm"
				fullWidth
				title={<FormattedMessage defaultMessage="Save with Comment" />}
			>
				<DialogBody>
					<TextFieldWithMax
						autoFocus
						margin="dense"
						label={<FormattedMessage defaultMessage="Comment" />}
						type="text"
						fullWidth
						multiline
						minRows={2}
						value={saveWithCommentState.comment}
						onChange={(e) => setSaveWithCommentState({ comment: e.target.value })}
						disabled={loading}
					/>
				</DialogBody>
				<DialogFooter>
					<Button
						onClick={() => setSaveWithCommentState({ openDialog: false, comment: '', saveType: null })}
						disabled={loading}
					>
						<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
					</Button>
					<Button
						onClick={() => {
							setSaveWithCommentState({ openDialog: false });
							saveChoiceSelection(saveWithCommentState.saveType);
						}}
						disabled={loading || !saveWithCommentState.comment.trim()}
						variant="contained"
						color="primary"
					>
						<FormattedMessage id="words.save" defaultMessage="Save" />
					</Button>
				</DialogFooter>
			</EnhancedDialog>
		</>
	);
}

export default CodeEditorDialogContainer;
