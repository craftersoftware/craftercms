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

import React, { useContext, useEffect, useRef, useState } from 'react';
import { fetchConfigurationXML, fetchSiteConfigurationFiles, writeConfiguration } from '../../services/configuration';
import { SiteConfigurationFileWithId } from '../../models/SiteConfigurationFile';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemText, { listItemTextClasses } from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import { FormattedMessage, useIntl } from 'react-intl';
import Skeleton from '@mui/material/Skeleton';
import EmptyState from '../EmptyState/EmptyState';
import { translations } from './translations';
import { getTranslation } from '../../utils/i18n';
import { LoadingState } from '../LoadingState/LoadingState';
import AceEditor from '../AceEditor/AceEditor';
import GlobalAppToolbar from '../GlobalAppToolbar';
import ResizeableDrawer from '../ResizeableDrawer/ResizeableDrawer';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import PrimaryButton from '../PrimaryButton';
import DialogFooter from '../DialogFooter/DialogFooter';
import SecondaryButton from '../SecondaryButton';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import informationGraphicUrl from '../../assets/information.svg';
import Typography from '@mui/material/Typography';
import { useDispatch } from 'react-redux';
import { fetchItemVersions } from '../../state/actions/versions';
import { fetchItemByPath } from '../../services/content';
import SearchBar from '../SearchBar/SearchBar';
import Alert, { alertClasses } from '@mui/material/Alert';
import { showHistoryDialog } from '../../state/actions/dialogs';
import { batchActions } from '../../state/actions/misc';
import { capitalize, stripCData } from '../../utils/string';
import { itemReverted, showSystemNotification } from '../../state/actions/system';
import { getHostToHostBus } from '../../utils/subjects';
import { filter, map } from 'rxjs/operators';
import { parseValidateDocument, serialize } from '../../utils/xml';
import { forkJoin } from 'rxjs';
import { encrypt } from '../../services/security';
import ResizeBar from '../ResizeBar';
import { useSelection } from '../../hooks/useSelection';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import useEnv from '../../hooks/useEnv';
import { useMount } from '../../hooks/useMount';
import { ConfirmDialogProps } from '../ConfirmDialog';
import { onSubmittingAndOrPendingChangeProps } from '../../hooks/useEnhancedDialogState';
import { findPendingEncryption } from './utils';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { MAX_CONFIG_SIZE, UNDEFINED } from '../../utils/constants';
import { ApiResponseErrorState } from '../ApiResponseErrorState';
import { nnou } from '../../utils/object';
import { MaxLengthCircularProgress } from '../MaxLengthCircularProgress';
import useUnmount from '../../hooks/useUnmount';
import useActiveUser from '../../hooks/useActiveUser';
import { ProjectToolsRoutes } from '../../env/routes';
import ListItemButton from '@mui/material/ListItemButton';
import { SiteToolsContext } from '../SiteTools/siteToolsContext';
import { nanoid } from 'nanoid';
import { popDialog } from '../../state/actions/dialogStack';
import { pushConfirmDialog, pushErrorDialog } from '../../utils/system';

interface SiteConfigurationManagementProps {
	embedded?: boolean;
	showAppsButton?: boolean;
	isSubmitting?: boolean;
	onSubmittingAndOrPendingChange?(value: onSubmittingAndOrPendingChangeProps): void;
}

export function SiteConfigurationManagement(props: SiteConfigurationManagementProps) {
	const { embedded, showAppsButton, onSubmittingAndOrPendingChange, isSubmitting } = props;
	const site = useActiveSiteId();
	const { username } = useActiveUser();
	const sessionStorageKey = `craftercms.${username}.projectToolsConfigurationData.${site}`;
	const baseUrl = useSelection<string>((state) => state.env.authoringBase);
	const { activeEnvironment: environment } = useEnv();
	const { formatMessage } = useIntl();
	const [files, setFiles] = useState<SiteConfigurationFileWithId[]>();
	const [selectedConfigFile, setSelectedConfigFile] = useState<SiteConfigurationFileWithId>(
		() => JSON.parse(sessionStorage.getItem(sessionStorageKey))?.selectedConfigFile ?? null
	);
	const [changesRecoveredOnMount] = useState<boolean>(() => selectedConfigFile !== null);
	const ignoreEnv = selectedConfigFile?.path === 'site-policy-config.xml';
	const [selectedConfigFileXml, setSelectedConfigFileXml] = useState(null);
	const [configError, setConfigError] = useState(null);
	const [selectedSampleConfigFileXml, setSelectedSampleConfigFileXml] = useState(null);
	const [loadingXml, setLoadingXml] = useState(true);
	const [encrypting, setEncrypting] = useState(false);
	const [loadingSampleXml, setLoadingSampleXml] = useState(false);
	const [sampleError, setSampleError] = useState(null);
	const [showSampleEditor, setShowSampleEditor] = useState(false);
	const [width, setWidth] = useState(240);
	const [openDrawer, setOpenDrawer] = useState(true);
	const [leftEditorWidth, setLeftEditorWidth] = useState<number>(null);
	const [disabledSaveButton, setDisabledSaveButton] = useState(true);
	const [confirmDialogProps, setConfirmDialogProps] = useState<ConfirmDialogProps>(null);
	const [keyword, setKeyword] = useState('');
	const dispatch = useDispatch();
	const setTool = useContext(SiteToolsContext)?.setTool;
	const refs = useUpdateRefs({
		disabledSaveButton,
		selectedConfigFile,
		setTool
	});
	const functionRefs = useUpdateRefs({
		onSubmittingAndOrPendingChange
	});
	const editorRef = useRef<any>({
		container: null
	});
	const [contentSize, setContentSize] = useState(0);

	useMount(() => {
		if (changesRecoveredOnMount) {
			dispatch(
				showSystemNotification({
					message: formatMessage({ defaultMessage: 'Unsaved changes were restored on to the editor.' }),
					options: { variant: 'info' }
				})
			);
		}
	});

	useUnmount(() => {
		if (!refs.current.disabledSaveButton) {
			sessionStorage.setItem(
				sessionStorageKey,
				JSON.stringify({
					content: editorRef.current.getValue(),
					selectedConfigFile: refs.current.selectedConfigFile
				})
			);
			const title = getTranslation(refs.current.selectedConfigFile.title, translations, formatMessage);
			const dialogId = nanoid();
			if (refs.current.setTool) {
				dispatch(
					pushConfirmDialog({
						id: dialogId,
						props: {
							body: formatMessage({ defaultMessage: 'You left unsaved changes on "{title}"' }, { title }),
							onCancel: () => {
								dispatch(popDialog({ id: dialogId }));
								sessionStorage.removeItem(sessionStorageKey);
							},
							onOk: () => {
								dispatch(popDialog({ id: dialogId }));
								refs.current.setTool(ProjectToolsRoutes.Configuration);
							},
							okButtonText: <FormattedMessage defaultMessage="Go back and recover changes" />,
							cancelButtonText: <FormattedMessage defaultMessage="Discard changes" />
						}
					})
				);
			} else {
				dispatch(
					pushConfirmDialog({
						id: dialogId,
						props: {
							body: formatMessage(
								{
									defaultMessage:
										'You left unsaved changes on "{title}". You may go back to configuration now if you wish to recover or ignore to discard changes.'
								},
								{ title }
							),
							onOk: () => {
								dispatch(popDialog({ id: dialogId }));
							}
						}
					})
				);
			}
		}
	});

	useEffect(() => {
		if (site && environment !== UNDEFINED) {
			fetchSiteConfigurationFiles(site, environment).subscribe({
				next(files) {
					setFiles(files.map((file) => ({ ...file, id: `${file.module}/${file.path}` })));
				},
				error({ response }) {
					dispatch(pushErrorDialog({ props: { error: response.response } }));
				}
			});
		}
	}, [environment, site, dispatch]);

	useEffect(() => {
		if (selectedConfigFile && environment) {
			setConfigError(null);
			const sessionData = JSON.parse(sessionStorage.getItem(sessionStorageKey));
			if (sessionData?.content) {
				setSelectedConfigFileXml(sessionData.content);
				setContentSize(sessionData.content.length);
				setDisabledSaveButton(false);
				sessionStorage.removeItem(sessionStorageKey);
				setLoadingXml(false);
			} else {
				fetchConfigurationXML(
					site,
					selectedConfigFile.path,
					selectedConfigFile.module,
					ignoreEnv ? null : environment
				).subscribe({
					next(xml) {
						setSelectedConfigFileXml(xml ?? '');
						setContentSize(xml?.length ?? 0);
						setLoadingXml(false);
					},
					error({ response }) {
						if (response.response.code === 7000) {
							setSelectedConfigFileXml('');
						} else {
							setConfigError(response.response);
						}
						setLoadingXml(false);
					}
				});
			}
		}
	}, [selectedConfigFile, environment, site, ignoreEnv, refs, sessionStorageKey]);

	// Item Revert Propagation
	useEffect(() => {
		const hostToHost$ = getHostToHostBus();
		const subscription = hostToHost$
			.pipe(filter((e) => itemReverted.type === e.type))
			.subscribe(({ type, payload }) => {
				if (payload.target.endsWith(selectedConfigFile.path)) {
					setSelectedConfigFile({ ...selectedConfigFile });
				}
			});
		return () => {
			subscription.unsubscribe();
		};
	}, [dispatch, selectedConfigFile]);

	const onToggleDrawer = () => {
		setOpenDrawer(!openDrawer);
	};

	const showXmlParseError = (error: string) => {
		dispatch(
			showSystemNotification({
				message: formatMessage(translations.xmlContainsErrors, {
					errors: error
				}),
				options: {
					variant: 'error'
				}
			})
		);
	};

	const onEncryptClick = () => {
		const content = editorRef.current.getValue();
		const doc = parseValidateDocument(content);
		if (typeof doc === 'string') {
			showXmlParseError(doc);
			return;
		}
		const tags = doc.querySelectorAll('[encrypted]');
		const items = findPendingEncryption(tags);
		if (items.length) {
			setEncrypting(true);
			forkJoin(
				items.map(({ tag, text }) => encrypt(stripCData(text), site).pipe(map((text) => ({ tag, text }))))
			).subscribe({
				next(encrypted) {
					encrypted.forEach(({ text, tag }) => {
						tag.innerHTML = `\${enc:${text}}`;
						tag.setAttribute('encrypted', 'true');
					});
					editorRef.current.setValue(serialize(doc), -1);
					setEncrypting(false);
				},
				error({ response: { response } }) {
					dispatch(pushErrorDialog({ props: { error: response } }));
				}
			});
		} else {
			setConfirmDialogProps({
				open: true,
				imageUrl: informationGraphicUrl,
				title: tags.length ? formatMessage(translations.allEncrypted) : formatMessage(translations.noEncryptItems),
				onOk: onConfirmDialogClose,
				onClose: onConfirmDialogClose,
				onClosed: onConfirmDialogClosed
			});
		}
	};

	const onEncryptHelpClick = () => {
		setConfirmDialogProps({
			open: true,
			maxWidth: 'sm',
			onOk: onConfirmDialogClose,
			onClose: onConfirmDialogClose,
			onClosed: onConfirmDialogClosed,
			imageUrl: informationGraphicUrl,
			children: (
				<Box
					component="section"
					sx={{
						textAlign: 'left',
						'& .text-margin': {
							marginBottom: '1em'
						}
					}}
				>
					<Typography className="text-margin" variant="subtitle1">
						{formatMessage(translations.encryptMarked)} asd
					</Typography>
					<Typography className="text-margin" variant="body2">
						{formatMessage(translations.encryptHintPt1)}
					</Typography>
					<Typography variant="body2">{formatMessage(translations.encryptHintPt2, bold)}</Typography>
					<Typography className="text-margin" variant="body2">
						{formatMessage(translations.encryptHintPt3, tags)}
					</Typography>
					<Typography variant="body2">{formatMessage(translations.encryptHintPt4, bold)}</Typography>
					<Typography className="text-margin" variant="body2">
						{formatMessage(translations.encryptHintPt5, tagsAndCurls)}
					</Typography>
					<Typography className="text-margin" variant="body2">
						{formatMessage(translations.encryptHintPt6)}
					</Typography>
					<ul>
						<li>
							<Typography variant="body2">{formatMessage(translations.encryptHintPt7)}</Typography>
						</li>
						<li>
							<Typography variant="body2">{formatMessage(translations.encryptHintPt8)}</Typography>
						</li>
						<li>
							<Typography variant="body2">{formatMessage(translations.encryptHintPt9)}</Typography>
						</li>
					</ul>
				</Box>
			)
		});
	};

	const onViewSampleClick = () => {
		if (showSampleEditor) {
			setLeftEditorWidth(null);
		}
		setLoadingSampleXml(true);
		setShowSampleEditor(!showSampleEditor);
		if (showSampleEditor === false) {
			setSampleError(null);
			fetchConfigurationXML(
				'studio_root',
				`/configuration/samples/${selectedConfigFile.samplePath}`,
				selectedConfigFile.module,
				environment
			).subscribe({
				next(xml) {
					setSelectedSampleConfigFileXml(xml);
					setLoadingSampleXml(false);
				},
				error({ response }) {
					setSampleError(response.response);
					setLoadingSampleXml(false);
				}
			});
		}
	};

	const onClean = () => {
		if (showSampleEditor) {
			setShowSampleEditor(false);
		}
		if (leftEditorWidth !== null) {
			setLeftEditorWidth(null);
		}
		if (encrypting !== null) {
			setEncrypting(false);
		}
		if (!disabledSaveButton) {
			setDisabledSaveButton(true);
		}
		functionRefs.current.onSubmittingAndOrPendingChange?.({ hasPendingChanges: false, isSubmitting: false });
	};

	const onListItemClick = (file: SiteConfigurationFileWithId) => {
		if (file.id !== selectedConfigFile?.id) {
			setLoadingXml(true);
			setSelectedConfigFile(file);
		}
		onClean();
	};

	const onUnsavedChangesOk = (file: SiteConfigurationFileWithId) => {
		setConfirmDialogProps({ ...confirmDialogProps, open: false });
		onListItemClick(file);
	};

	const onConfirmDialogClose = () => {
		setConfirmDialogProps({ ...confirmDialogProps, open: false });
	};

	const onConfirmDialogClosed = () => {
		setConfirmDialogProps(null);
	};

	const onEditorResize = (width: number) => {
		if (width > 240) {
			setLeftEditorWidth(width);
		}
	};

	const onEditorChanges = () => {
		const currentEditorValue = editorRef.current.getValue();
		if (selectedConfigFileXml !== currentEditorValue) {
			setDisabledSaveButton(false);
			functionRefs.current.onSubmittingAndOrPendingChange?.({ hasPendingChanges: true });
		} else {
			setDisabledSaveButton(true);
			functionRefs.current.onSubmittingAndOrPendingChange?.({ hasPendingChanges: false });
		}
		setContentSize(currentEditorValue.length);
	};

	const onShowHistory = () => {
		fetchItemByPath(site, `/config/${selectedConfigFile.module}/${selectedConfigFile.path}`).subscribe((item) => {
			dispatch(
				batchActions([
					fetchItemVersions({
						isConfig: true,
						environment: environment,
						module: selectedConfigFile.module,
						item
					}),
					showHistoryDialog({})
				])
			);
		});
	};

	const onCancel = () => {
		onClean();
		setSelectedConfigFile(null);
	};

	const showUnsavedChangesConfirm = (file: SiteConfigurationFileWithId) => {
		setConfirmDialogProps({
			open: true,
			title: <FormattedMessage id="siteConfigurationManagement.unsavedChangesTitle" defaultMessage="Unsaved changes" />,
			body: (
				<FormattedMessage
					id="siteConfigurationManagement.unsavedChangesSubtitle"
					defaultMessage="You have unsaved changes, do you want to leave?"
				/>
			),
			onClosed: onConfirmDialogClosed,
			onOk: () => onUnsavedChangesOk(file),
			onCancel: onConfirmDialogClose
		});
	};

	const onSave = () => {
		const content = editorRef.current.getValue();
		const doc = parseValidateDocument(content);
		if (typeof doc === 'string') {
			showXmlParseError(doc);
			return;
		}
		const unencryptedItems = findPendingEncryption(doc.querySelectorAll('[encrypted]'));
		const errors = editorRef.current
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
			if (unencryptedItems.length === 0) {
				functionRefs.current.onSubmittingAndOrPendingChange?.({ isSubmitting: true });
				writeConfiguration(
					site,
					selectedConfigFile.path,
					selectedConfigFile.module,
					content,
					ignoreEnv ? null : environment
				).subscribe({
					next: () => {
						functionRefs.current.onSubmittingAndOrPendingChange?.({ isSubmitting: false, hasPendingChanges: false });
						dispatch(
							showSystemNotification({
								message: formatMessage(translations.configSaved)
							})
						);

						setDisabledSaveButton(true);
						setSelectedConfigFileXml(content);
					},
					error: ({ response: { response } }) => {
						functionRefs.current.onSubmittingAndOrPendingChange?.({ isSubmitting: false });
						dispatch(pushErrorDialog({ props: { error: response } }));
					}
				});
			} else {
				let tags;
				if (unencryptedItems.length > 1) {
					tags = unencryptedItems.map((item) => {
						return formatMessage(translations.encryptionSingleDetail, {
							name: item.tag.tagName,
							value: item.text,
							br: <br key={item.text} />
						});
					});
				} else {
					tags = formatMessage(translations.encryptionSingleDetail, {
						name: unencryptedItems[0].tag.tagName,
						value: unencryptedItems[0].text,
						br: null
					});
				}

				setConfirmDialogProps({
					open: true,
					imageUrl: informationGraphicUrl,
					title: formatMessage(translations.pendingEncryption, {
						itemCount: unencryptedItems.length,
						tags,
						br: unencryptedItems.length ? <br key={unencryptedItems.length} /> : null
					}),
					onOk: onConfirmDialogClose,
					onClose: onConfirmDialogClose,
					onClosed: onConfirmDialogClosed
				});
			}
		}
	};

	const bold = {
		bold: (msg) => (
			<strong key={msg} className="bold">
				{msg}
			</strong>
		)
	};

	const tags = { lt: '<', gt: '>' };

	const tagsAndCurls = Object.assign({ lc: '{', rc: '}' }, tags);

	const onAceInit = (editor: AceAjax.Editor) => {
		editor.commands.addCommand({
			name: 'saveToCrafter',
			bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
			exec: () => onSave(),
			readOnly: false
		});
	};

	return (
		<Box
			component="section"
			sx={{
				display: 'flex',
				height: '100%',
				position: 'relative',
				flexDirection: 'column'
			}}
		>
			{!embedded && (
				<GlobalAppToolbar
					title={<FormattedMessage id="siteConfigurationManagement.title" defaultMessage="Configuration" />}
					showAppsButton={showAppsButton}
				/>
			)}
			<ResizeableDrawer
				belowToolbar
				open={openDrawer}
				width={width}
				sxs={{
					drawerPaper: {
						position: 'absolute',
						...(embedded ? { top: 0 } : {})
					}
				}}
				onWidthChange={setWidth}
			>
				<List
					sx={{
						width: '100%',
						overflow: 'auto',
						height: '100%'
					}}
					component="nav"
					dense
					subheader={
						<ListSubheader
							sx={(theme) => ({
								background: theme.palette.background.paper,
								padding: 0,
								borderBottom: `1px solid ${theme.palette.divider}`
							})}
						>
							{environment ? (
								<>
									<Tooltip
										placement="top"
										title={
											<FormattedMessage
												id="siteConfigurationManagement.environment"
												defaultMessage='The active environment is "{environment}"'
												values={{ environment }}
											/>
										}
									>
										<Alert
											severity="info"
											sx={{
												borderRadius: 0,
												[`& .${alertClasses.message}`]: {
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													whiteSpace: 'nowrap'
												}
											}}
										>
											<FormattedMessage
												id="siteConfigurationManagement.activeEnvironment"
												defaultMessage="{environment} Environment"
												values={{ environment: capitalize(environment) }}
											/>
										</Alert>
									</Tooltip>
									<SearchBar
										sxs={{
											root: {
												borderRadius: '0 !important',
												border: 0,
												'&.focus': {
													border: '0 !important',
													boxShadow: 'none'
												}
											}
										}}
										keyword={keyword}
										onChange={setKeyword}
										showActionButton={Boolean(keyword)}
										autoFocus
									/>
								</>
							) : (
								<Box
									component="section"
									sx={{
										display: 'flex',
										alignItems: 'center',
										flexDirection: 'column',
										padding: '10px'
									}}
								>
									<Skeleton height={34} width="100%" />
									<Skeleton height={34} width="100%" />
								</Box>
							)}
						</ListSubheader>
					}
				>
					{files
						? files
								.filter(
									(file) =>
										file.path.toLowerCase().includes(keyword) ||
										getTranslation(file.title, translations, formatMessage).toLowerCase().includes(keyword) ||
										getTranslation(file.description, translations, formatMessage).toLowerCase().includes(keyword)
								)
								.map((file, i) => (
									<ListItemButton
										selected={file.id === selectedConfigFile?.id}
										onClick={() => {
											if (!disabledSaveButton && file.id !== selectedConfigFile?.id) {
												showUnsavedChangesConfirm(file);
											} else {
												onListItemClick(file);
											}
										}}
										key={i}
										dense
										divider={i < files.length - 1}
									>
										<ListItemText
											sx={{
												[`& .${listItemTextClasses.primary}, & .${listItemTextClasses.secondary}`]: {
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													whiteSpace: 'nowrap'
												}
											}}
											primaryTypographyProps={{ title: getTranslation(file.title, translations, formatMessage) }}
											secondaryTypographyProps={{
												title: getTranslation(file.description, translations, formatMessage)
											}}
											primary={getTranslation(file.title, translations, formatMessage)}
											secondary={getTranslation(file.description, translations, formatMessage)}
										/>
									</ListItemButton>
								))
						: Array(15)
								.fill(null)
								.map((x, i) => (
									<ListItemButton key={i} dense divider={i < Array.length - 1}>
										<ListItemText
											primary={<Skeleton height={15} width="80%" />}
											secondary={<Skeleton height={15} width="60%" />}
											sx={{
												[`& .${listItemTextClasses.primary}, & .${listItemTextClasses.secondary}`]: {
													height: '20px'
												}
											}}
										/>
									</ListItemButton>
								))}
				</List>
			</ResizeableDrawer>
			{selectedConfigFile ? (
				<Box
					display="flex"
					flexGrow={1}
					flexDirection={loadingXml ? 'row' : 'column'}
					paddingLeft={openDrawer ? `${width}px` : 0}
				>
					{configError ? (
						<ApiResponseErrorState error={configError} sxs={{ root: { height: 'calc(100% - 65px)' } }} />
					) : loadingXml ? (
						<LoadingState />
					) : nnou(selectedConfigFileXml) ? (
						<>
							<GlobalAppToolbar
								sxs={{
									appBar: { paddingRight: '14.4px' },
									toolbar: { '& > section': {} }
								}}
								showHamburgerMenuButton={false}
								showAppsButton={false}
								startContent={
									<IconButton onClick={onToggleDrawer} size="large">
										{openDrawer ? <MenuOpenRoundedIcon /> : <MenuRoundedIcon />}
									</IconButton>
								}
								title={getTranslation(selectedConfigFile.title, translations, formatMessage)}
								subtitle={getTranslation(selectedConfigFile.description, translations, formatMessage)}
								rightContent={
									<>
										<ButtonGroup variant="outlined" sx={{ marginRight: '15px' }}>
											<SecondaryButton disabled={encrypting} onClick={onEncryptClick} loading={encrypting}>
												{formatMessage(translations.encryptMarked)}
											</SecondaryButton>
											<Button size="small" onClick={onEncryptHelpClick}>
												<HelpOutlineRoundedIcon />
											</Button>
										</ButtonGroup>
										<SecondaryButton onClick={onViewSampleClick}>
											{showSampleEditor ? (
												<FormattedMessage id="siteConfigurationManagement.hideSample" defaultMessage="Hide Sample" />
											) : (
												<FormattedMessage id="siteConfigurationManagement.viewSample" defaultMessage="View Sample" />
											)}
										</SecondaryButton>
									</>
								}
							/>
							<Box display="flex" flexGrow={1}>
								<AceEditor
									ref={editorRef}
									sxs={{
										root: {
											display: 'flex',
											width: leftEditorWidth ? `${leftEditorWidth}px` : 'auto',
											flexGrow: leftEditorWidth ? 0 : 1
										},
										editorRoot: {
											margin: 0,
											opacity: encrypting ? 0.5 : 1,
											border: 0,
											borderRadius: 0
										}
									}}
									mode="ace/mode/xml"
									theme="ace/theme/textmate"
									readOnly={encrypting}
									autoFocus={true}
									onChange={onEditorChanges}
									value={selectedConfigFileXml}
									onInit={onAceInit}
								/>
								{showSampleEditor && (
									<>
										<ResizeBar onWidthChange={onEditorResize} element={editorRef.current.container} />
										{sampleError ? (
											<ApiResponseErrorState
												error={sampleError}
												sxs={{
													root: {
														maxWidth: '50%',
														margin: '0 auto',
														'& p': {
															wordBreak: 'break-word'
														}
													}
												}}
											/>
										) : loadingSampleXml ? (
											<LoadingState />
										) : nnou(selectedSampleConfigFileXml) ? (
											<AceEditor
												sxs={{
													root: {
														display: 'flex',
														flex: '1 1 auto'
													},
													editorRoot: {
														border: 0,
														borderRadius: 0,
														margin: 0
													}
												}}
												mode="ace/mode/xml"
												theme="ace/theme/textmate"
												autoFocus={false}
												readOnly={true}
												value={selectedSampleConfigFileXml}
											/>
										) : (
											<></>
										)}
									</>
								)}
							</Box>
							<DialogFooter>
								<SecondaryButton disabled={encrypting} sx={{ marginRight: 'auto' }} onClick={onShowHistory}>
									<FormattedMessage id="siteConfigurationManagement.history" defaultMessage="History" />
								</SecondaryButton>
								<SecondaryButton disabled={encrypting} onClick={onCancel}>
									<FormattedMessage id="words.cancel" defaultMessage="Cancel" />
								</SecondaryButton>
								<PrimaryButton
									disabled={disabledSaveButton || encrypting || isSubmitting || contentSize > MAX_CONFIG_SIZE}
									onClick={onSave}
								>
									<FormattedMessage id="words.save" defaultMessage="Save" />
								</PrimaryButton>
								<MaxLengthCircularProgress
									sxs={{ circularProgress: { width: '35px !important', height: '35px !important' } }}
									max={MAX_CONFIG_SIZE}
									current={contentSize}
									renderThresholdPercentage={90}
								/>
							</DialogFooter>
						</>
					) : (
						<></>
					)}
				</Box>
			) : (
				<Box
					display="flex"
					alignItems="center"
					flexGrow={1}
					justifyContent="center"
					paddingLeft={openDrawer && `${width}px`}
				>
					<EmptyState
						title={
							<FormattedMessage
								id="siteConfigurationManagement.selectConfigFile"
								defaultMessage="Please choose a config file from the left."
							/>
						}
						image={`${baseUrl}/static-assets/images/choose_option.svg`}
					/>
				</Box>
			)}
			<ConfirmDialog open={false} {...confirmDialogProps} />
		</Box>
	);
}

export default SiteConfigurationManagement;
