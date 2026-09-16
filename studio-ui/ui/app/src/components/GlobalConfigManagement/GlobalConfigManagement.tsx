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

import GlobalAppToolbar from '../GlobalAppToolbar';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import React, { useRef, useState } from 'react';
import { Box } from '@mui/material';
import { fetchConfigurationXML, writeConfiguration } from '../../services/configuration';
import AceEditor from '../AceEditor/AceEditor';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import { forkJoin } from 'rxjs';
import { ConditionalLoadingState } from '../LoadingState/LoadingState';
import ConfigurationSamplePreviewDialog from '../ConfigurationSamplePreviewDialog';
import ConfirmDropdown from '../ConfirmDropdown';
import { useDispatch } from 'react-redux';
import { showSystemNotification } from '../../state/actions/system';
import { useMount } from '../../hooks/useMount';
import Paper from '@mui/material/Paper';
import { MAX_CONFIG_SIZE } from '../../utils/constants';
import { MaxLengthCircularProgress } from '../MaxLengthCircularProgress';
import useUnmount from '../../hooks/useUnmount';
import useActiveUser from '../../hooks/useActiveUser';
import { useBeforeUnload, useNavigate } from 'react-router';
import { GlobalRoutes } from '../../env/routes';
import { popDialog } from '../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { pushConfirmDialog } from '../../utils/system';

const translations = defineMessages({
	configSaved: {
		id: 'globalConfig.configSaved',
		defaultMessage: 'Configuration saved successfully.'
	},
	documentError: {
		id: 'globalConfig.documentError',
		defaultMessage: 'The document contains errors. Check for error markers on side of the editor.'
	}
});

export function GlobalConfigManagement() {
	const [content, setContent] = useState('');
	const [sample, setSample] = useState('');
	const [lastSavedContent, setLastSavedContent] = useState('');
	const [enable, setEnable] = useState(true);
	const [viewSample, setViewSample] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);
	const hasChangesRef = useRef(hasChanges);
	hasChangesRef.current = hasChanges;
	const [contentSize, setContentSize] = useState(0);
	const aceEditorRef = useRef<any>(undefined);
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const { username } = useActiveUser();
	const navigate = useNavigate();
	const sessionStorageKey = `craftercms.${username}.globalConfigContent`;

	useMount(() => {
		const requests = [
			fetchConfigurationXML('studio_root', '/configuration/samples/sample-studio-config-override.yaml', 'studio'),
			fetchConfigurationXML('studio_root', '/configuration/studio-config-override.yaml', 'studio')
		];

		forkJoin(requests).subscribe(([sample, content]) => {
			const sessionContent = sessionStorage.getItem(sessionStorageKey);

			setLastSavedContent(content);
			if (sessionContent) {
				setContent(sessionContent);
				setContentSize(sessionContent.length);
				setHasChanges(true);
				sessionStorage.removeItem(sessionStorageKey);
			} else {
				setContent(content);
				setContentSize(content.length);
			}
			setSample(sample);
			setEnable(false);
		});
	});

	useUnmount(() => {
		if (hasChangesRef.current) {
			sessionStorage.setItem(sessionStorageKey, aceEditorRef.current.getValue());
			const dialogId = nanoid();
			dispatch(
				pushConfirmDialog({
					id: dialogId,
					props: {
						body: <FormattedMessage defaultMessage="You left unsaved changes. Go back and continue editing?" />,
						onCancel: () => {
							dispatch(popDialog({ id: dialogId }));
							sessionStorage.removeItem(sessionStorageKey);
						},
						onOk: () => {
							dispatch(popDialog({ id: dialogId }));
							navigate(GlobalRoutes.GlobalConfig);
						},
						okButtonText: <FormattedMessage defaultMessage="Continue editing" />,
						cancelButtonText: <FormattedMessage defaultMessage="Discard changes" />
					}
				})
			);
		}
	});

	useBeforeUnload((event) => {
		if (hasChangesRef.current) {
			event.preventDefault();
		}
	});

	const onUseSampleClick = (type: 'replace' | 'append') => {
		if (type === 'replace') {
			setContent(sample);
		} else {
			const currentContent = aceEditorRef.current.getValue();
			setContent(currentContent + sample);
		}
		setViewSample(false);
	};

	const onResetClick = () => {
		aceEditorRef.current.setValue(lastSavedContent, -1); // sets cursor in position 0, avoiding all editor content selection
		aceEditorRef.current.focus();
	};

	const onSaveClick = () => {
		const value = aceEditorRef.current.getValue();
		const errors = aceEditorRef.current
			.getSession()
			.getAnnotations()
			.filter((annotation) => {
				return annotation.type === 'error';
			});

		if (errors.length) {
			dispatch(
				showSystemNotification({
					message: formatMessage(translations.documentError),
					options: {
						variant: 'error'
					}
				})
			);
		} else {
			writeConfiguration('studio_root', '/configuration/studio-config-override.yaml', 'studio', value).subscribe(
				() => {
					setLastSavedContent(value);
					setHasChanges(false);
					dispatch(
						showSystemNotification({
							message: formatMessage(translations.configSaved)
						})
					);
				},
				({ response: { response } }) => {
					dispatch(
						showSystemNotification({
							message: response.message,
							options: {
								variant: 'error'
							}
						})
					);
				}
			);
			setHasChanges(false);
		}
	};

	const onChange = () => {
		const currentEditorValue = aceEditorRef.current.getValue();
		const hasChanges = lastSavedContent !== currentEditorValue;
		setContentSize(currentEditorValue.length);
		setHasChanges(hasChanges);
	};

	const onAceInit = (editor: AceAjax.Editor) => {
		editor.commands.addCommand({
			name: 'saveToCrafter',
			bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
			exec: () => onSaveClick(),
			readOnly: false
		});
	};

	return (
        <Paper elevation={0}>
            <GlobalAppToolbar
				title={<FormattedMessage id="globalMenu.globalConfigEntryLabel" defaultMessage="Global Config" />}
			/>
            <ConditionalLoadingState isLoading={enable}>
				<Box
					component="section"
					sx={{
						borderRadius: 0,
						minHeight: '400px',
						height: 'calc(100vh - 121px)',
						borderBottom: (theme) => `1px solid ${theme.palette.divider}`
					}}
				>
					<AceEditor
						ref={aceEditorRef}
						onChange={onChange}
						sxs={{
							editorRoot: {
								margin: '0',
								width: '100%',
								height: '100%',
								borderRadius: 0,
								border: 0
							}
						}}
						value={content}
						mode="ace/mode/yaml"
						theme="ace/theme/textmate"
						autoFocus={true}
						readOnly={enable}
						onInit={onAceInit}
					/>
					<Box
                        sx={{
                            p: "10px",
                            display: "flex",
                            justifyContent: "space-between"
                        }}>
						<SecondaryButton onClick={() => setViewSample(true)}>
							<FormattedMessage id="globalConfig.viewSample" defaultMessage="View Sample" />
						</SecondaryButton>
						<ConfirmDropdown
							disabled={!hasChanges}
							sx={{ button: { marginLeft: 'auto', marginRight: '15px' } }}
							text={<FormattedMessage id="words.reset" defaultMessage="Reset" />}
							cancelText={<FormattedMessage id="words.cancel" defaultMessage="Cancel" />}
							confirmText={<FormattedMessage id="words.ok" defaultMessage="Ok" />}
							confirmHelperText={
								<FormattedMessage id="globalConfig.confirmHelper" defaultMessage="Discard unsaved changes?" />
							}
							onConfirm={onResetClick}
						/>
						<PrimaryButton disabled={!hasChanges || contentSize > MAX_CONFIG_SIZE} onClick={onSaveClick}>
							<FormattedMessage id="words.save" defaultMessage="Save" />
						</PrimaryButton>
						<MaxLengthCircularProgress
							sxs={{ root: { ml: 1 }, circularProgress: { width: '35px !important', height: '35px !important' } }}
							max={MAX_CONFIG_SIZE}
							current={contentSize}
							renderThresholdPercentage={90}
						/>
					</Box>
				</Box>
			</ConditionalLoadingState>
            <ConfigurationSamplePreviewDialog
				onUseSampleClick={onUseSampleClick}
				open={viewSample}
				onClose={() => setViewSample(false)}
				onClosed={() => aceEditorRef.current.focus()}
				content={sample}
			/>
        </Paper>
    );
}

export default GlobalConfigManagement;
