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

import React, { ReactNode, useEffect, useId, useRef, useState } from 'react';
import Paper from '@mui/material/Paper';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import DialogHeader from '../DialogHeader/DialogHeader';
import DialogFooter from '../DialogFooter/DialogFooter';
import palette from '../../styles/palette';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Collapse from '@mui/material/Collapse';
import ListItemText from '@mui/material/ListItemText';
import PublishOnDemandForm from '../PublishOnDemandForm';
import { PublishFormData, PublishOnDemandMode } from '../../models/Publishing';
import { nnou, nou } from '../../utils/object';
import Typography from '@mui/material/Typography';
import { fetchPublishingTargets, publish } from '../../services/publishing';
import { showSystemNotification } from '../../state/actions/system';
import { useDispatch } from 'react-redux';
import Link from '@mui/material/Link';
import { useSpreadState } from '../../hooks/useSpreadState';
import { isBlank } from '../../utils/string';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import { onSubmittingAndOrPendingChangeProps } from '../../hooks/useEnhancedDialogState';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { hasInitialPublish as hasInitialPublishService } from '../../services/sites';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import useContentItem from '../../hooks/useContentItem';
import usePermissionsBySite from '../../hooks/usePermissionsBySite';
import { StandardAction } from '../../models';
import Checkbox from '@mui/material/Checkbox';
import Alert, { alertClasses } from '@mui/material/Alert';
import { popDialog, pushDialog } from '../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { createComponentId, pushConfirmDialog, pushErrorDialog } from '../../utils/system';
import { extractErrorPayload } from '../../utils/ajax';

const messages = defineMessages({
	publishStudioWarning: {
		defaultMessage:
			"This will force publish all items that match the pattern requested including their references, and it may take a long time depending on the number of items. Please make sure that all modified items (including potentially someone's work in progress) are ready to be published before continuing."
	},
	warningLabel: {
		id: 'words.warning',
		defaultMessage: 'Warning'
	},
	publishStudioNote: {
		id: 'publishingDashboard.studioNote',
		defaultMessage:
			'Publishing by path should be used to publish changes made in Studio via the UI. For changes made via direct git actions, please <a>publish by commit or tag</a>.'
	},
	publishSuccess: {
		id: 'publishingDashboard.publishSuccess',
		defaultMessage: 'Published successfully.'
	},
	bulkPublishStarted: {
		id: 'publishingDashboard.bulkPublishStarted',
		defaultMessage: 'Bulk Publish process has been started.'
	},
	invalidForm: {
		id: 'publishingDashboard.invalidForm',
		defaultMessage: 'You cannot publish until form requirements are satisfied.'
	}
});

const initialPublishStudioFormData = {
	path: '',
	publishingTarget: '',
	title: '',
	comment: ''
};

const initialPublishGitFormData = {
	commitIds: '',
	publishingTarget: '',
	title: '',
	comment: ''
};

const initialPublishEverythingFormData = {
	publishingTarget: '',
	title: '',
	comment: ''
};

interface PublishOnDemandWidgetProps {
	siteId: string;
	mode?: PublishOnDemandMode | PublishOnDemandMode[];
	showHeader?: boolean;
	onSubmittingAndOrPendingChange?(value: onSubmittingAndOrPendingChangeProps): void;
	onCancel?: StandardAction;
	onSuccess?: StandardAction;
}

const pickMode = (mode: PublishOnDemandWidgetProps['mode']) => {
	if (!mode) {
		return null;
	} else if (Array.isArray(mode)) {
		// If only one mode in the array, pre-select that. If more than one, don't pre-select anything.
		return mode.length === 1 ? mode[0] : null;
	} else {
		return mode;
	}
};

export function PublishOnDemandWidget(props: PublishOnDemandWidgetProps) {
	const {
		siteId,
		onSubmittingAndOrPendingChange,
		mode,
		showHeader = true,
		onCancel: onCancelProp,
		onSuccess: onSuccessProp
	} = props;
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const [selectedMode, setSelectedMode] = useState<PublishOnDemandMode>(() => pickMode(mode));
	const [isSubmitting, setIsSubmitting] = useState(false);
	const permissionsBySite = usePermissionsBySite();
	const hasPublishPermission = permissionsBySite[siteId]?.includes('publish_approve');
	const [hasInitialPublish, setHasInitialPublish] = useState(false);
	const initialPublishItem = useContentItem('/site/website/index.xml');
	const [initialPublishingTarget, setInitialPublishingTarget] = useState(null);
	const [publishingTargets, setPublishingTargets] = useState(null);
	const [publishingTargetsError, setPublishingTargetsError] = useState(null);
	const [publishEverythingAck, setPublishEverythingAck] = useState(false);
	const [publishGitFormData, setPublishGitFormData] = useSpreadState<PublishFormData>(initialPublishGitFormData);
	const publishGitFormValid =
		!isBlank(publishGitFormData.publishingTarget) &&
		!isBlank(publishGitFormData.title) &&
		!isBlank(publishGitFormData.comment) &&
		publishGitFormData.commitIds.replace(/\s/g, '') !== '';
	const [publishStudioFormData, setPublishStudioFormData] =
		useSpreadState<PublishFormData>(initialPublishStudioFormData);
	const publishStudioFormValid =
		!isBlank(publishStudioFormData.publishingTarget) &&
		!isBlank(publishStudioFormData.title) &&
		!isBlank(publishStudioFormData.comment) &&
		publishStudioFormData.path.replace(/\s/g, '') !== '';
	const [publishEverythingFormData, setPublishEverythingFormData] = useSpreadState<PublishFormData>(
		initialPublishEverythingFormData
	);
	const publishEverythingFormValid =
		publishEverythingFormData.publishingTarget !== '' &&
		!isBlank(publishEverythingFormData.comment) &&
		!isBlank(publishEverythingFormData.title) &&
		publishEverythingAck;
	const fnRefs = useUpdateRefs({ onSubmittingAndOrPendingChange });
	// region currentFormData
	const currentFormData =
		selectedMode === 'studio'
			? publishStudioFormData
			: selectedMode === 'git'
				? publishGitFormData
				: publishEverythingFormData;
	const refs = useUpdateRefs({ currentFormData });
	// endregion
	// region currentSetFormData
	const currentSetFormData =
		selectedMode === 'studio'
			? setPublishStudioFormData
			: selectedMode === 'git'
				? setPublishGitFormData
				: setPublishEverythingFormData;
	// endregion
	// region currentFormValid
	const currentFormValid =
		selectedMode === 'studio'
			? publishStudioFormValid
			: selectedMode === 'git'
				? publishGitFormValid
				: publishEverythingFormValid;
	// endregion
	// region hasChanges
	const hasChanges =
		selectedMode === 'studio'
			? publishStudioFormData.path !== initialPublishStudioFormData.path ||
				publishStudioFormData.comment !== initialPublishStudioFormData.comment ||
				publishStudioFormData.publishingTarget !== initialPublishingTarget
			: selectedMode === 'git'
				? publishGitFormData.commitIds !== initialPublishGitFormData.commitIds ||
					publishGitFormData.comment !== initialPublishGitFormData.comment ||
					publishGitFormData.publishingTarget !== initialPublishingTarget
				: publishEverythingFormData.comment !== initialPublishEverythingFormData.comment ||
					publishEverythingFormData.publishingTarget !== initialPublishingTarget;
	// endregion

	useEffect(() => {
		const formData = refs.current.currentFormData;

		if (formData.comment === '') {
			if (selectedMode === 'everything' && formData.publishingTarget) {
				currentSetFormData({
					comment: formatMessage(
						{ defaultMessage: 'Publish all changes on the repo to {target}' },
						{ target: formData.publishingTarget }
					)
				});
			} else if (selectedMode === 'studio') {
				currentSetFormData({
					comment: formatMessage({ defaultMessage: 'Publish changes made in Studio via the UI' })
				});
			} else if (selectedMode === 'git') {
				currentSetFormData({
					comment: formatMessage({ defaultMessage: 'Publish by tags or commit ids' })
				});
			}
		}
	}, [selectedMode, refs, currentSetFormData, formatMessage]);

	const bottomElId = useId();

	const setDefaultPublishingTarget = (targets, clearData?) => {
		if (targets.length) {
			const stagingEnv = targets.find((target) => target.name === 'staging');
			const publishingTarget = stagingEnv?.name ?? targets[0].name;
			setInitialPublishingTarget(publishingTarget);
			setPublishGitFormData({
				...(clearData && initialPublishGitFormData),
				publishingTarget
			});
			setPublishStudioFormData({
				...(clearData && initialPublishStudioFormData),
				publishingTarget
			});
			setPublishEverythingFormData({
				...(clearData && initialPublishEverythingFormData),
				publishingTarget
			});
		}
	};

	useEffect(() => {
		fnRefs.current.onSubmittingAndOrPendingChange?.({
			hasPendingChanges: hasChanges,
			isSubmitting
		});
	}, [isSubmitting, hasChanges, fnRefs]);

	useEffect(() => {
		hasInitialPublishService(siteId).subscribe({
			next(response) {
				setHasInitialPublish(response);
			},
			error(error) {
				dispatch(pushErrorDialog({ props: { error } }));
			}
		});
		fetchPublishingTargets(siteId).subscribe({
			next({ publishingTargets: targets }) {
				setPublishingTargets(targets);
				// Set pre-selected environment.
				setDefaultPublishingTarget(targets);
			},
			error(error) {
				setPublishingTargetsError(error);
			}
		});
		// We only want to re-fetch the publishingTargets when the site changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [siteId]);

	const onSubmitPublishBy = () => {
		setIsSubmitting(true);
		const { commitIds, publishingTarget, title, comment } = publishGitFormData;
		const ids = commitIds.replace(/\s/g, '').split(',');

		publish(siteId, {
			publishingTarget,
			commitIds: ids,
			title,
			comment
		}).subscribe({
			next() {
				setIsSubmitting(false);
				dispatch(
					showSystemNotification({
						message: formatMessage(messages.publishSuccess)
					})
				);
				setPublishGitFormData({ ...initialPublishGitFormData, publishingTarget });
				nou(mode) && setSelectedMode(null);
				setSelectedMode(pickMode(mode));

				if (onSuccessProp) {
					dispatch(onSuccessProp);
				}
			},
			error(error) {
				setIsSubmitting(false);
				dispatch(pushErrorDialog({ props: { error: extractErrorPayload(error) } }));
			}
		});
	};

	const onSubmitBulkPublish = () => {
		const studioNote = formatMessage(messages.publishStudioNote, { a: (msg) => msg[0] });
		const dialogId = nanoid();
		dispatch(
			pushConfirmDialog({
				id: dialogId,
				props: {
					body: `${formatMessage(messages.publishStudioWarning)} ${studioNote}`,
					onCancel: () => {
						dispatch(popDialog({ id: dialogId }));
					},
					onOk: () => {
						dispatch(popDialog({ id: dialogId }));
						setIsSubmitting(true);
						const { path, publishingTarget, title, comment } = publishStudioFormData;

						publish(siteId, {
							publishingTarget,
							paths: [{ path, includeChildren: true, includeSoftDeps: false }],
							title,
							comment
						}).subscribe({
							next() {
								setIsSubmitting(false);
								setPublishStudioFormData({ ...initialPublishStudioFormData, publishingTarget });
								setSelectedMode(pickMode(mode));
								dispatch(
									showSystemNotification({
										message: formatMessage(messages.bulkPublishStarted)
									})
								);
								if (onSuccessProp) {
									dispatch(onSuccessProp);
								}
							},
							error(error) {
								setIsSubmitting(false);
								dispatch(pushErrorDialog({ props: { error: extractErrorPayload(error) } }));
							}
						});
					}
				}
			})
		);
	};

	const onSubmitPublishEverything = () => {
		setIsSubmitting(true);
		const { publishingTarget, title, comment } = publishEverythingFormData;
		publish(siteId, {
			publishingTarget,
			publishAll: true,
			title,
			comment
		}).subscribe({
			next() {
				setIsSubmitting(false);
				dispatch(
					showSystemNotification({
						message: formatMessage(messages.publishSuccess)
					})
				);
				setPublishEverythingFormData({ ...initialPublishEverythingFormData, publishingTarget });
				setSelectedMode(pickMode(mode));
				setPublishEverythingAck(false);
				if (onSuccessProp) {
					dispatch(onSuccessProp);
				}
			},
			error(error) {
				setIsSubmitting(false);
				dispatch(pushErrorDialog({ props: { error: extractErrorPayload(error) } }));
			}
		});
	};

	const onCancel = () => {
		setSelectedMode(pickMode(mode));
		setDefaultPublishingTarget(publishingTargets, true);
		setPublishEverythingAck(false);
		if (onCancelProp) {
			dispatch(onCancelProp);
		}
	};

	const scrollToBottom = () => document.getElementById(bottomElId).scrollIntoView({ behavior: 'smooth', block: 'end' });

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const newMode = (event.target as HTMLInputElement).value as PublishOnDemandMode;
		setSelectedMode(newMode);
		setTimeout(scrollToBottom);
	};

	const toggleMode = (e) => {
		e.preventDefault();
		setSelectedMode(selectedMode === 'studio' ? 'git' : 'studio');
	};

	const onSubmitForm = () => {
		if (currentFormValid) {
			switch (selectedMode) {
				case 'studio':
					onSubmitBulkPublish();
					break;
				case 'git':
					onSubmitPublishBy();
					break;
				case 'everything':
					onSubmitPublishEverything();
					break;
			}
		} else {
			dispatch(
				showSystemNotification({
					message: formatMessage(messages.invalidForm)
				})
			);
		}
	};

	const onInitialPublish = () => {
		const dialogId = nanoid();
		dispatch(
			pushDialog({
				id: dialogId,
				component: createComponentId('PublishDialog'),
				props: {
					items: [initialPublishItem],
					onSuccess: () => {
						setHasInitialPublish(true);
						dispatch(popDialog({ id: dialogId }));
					}
				}
			})
		);
	};

	return (
		<Paper elevation={2}>
			{showHeader && (
				<DialogHeader title={<FormattedMessage id="publishOnDemand.title" defaultMessage="Publish on Demand" />} />
			)}
			<Box sx={{ backgroundColor: (theme) => theme.palette.background.default, padding: '16px' }}>
				{hasInitialPublish ? (
					<>
						<Paper
							elevation={0}
							sx={{ padding: '10px 25px', border: `1px solid ${palette.gray.light7}`, borderRadius: '10px' }}
						>
							<form>
								<RadioGroup value={selectedMode ?? ''} onChange={handleChange}>
									{(nou(mode) || mode.includes('studio')) && (
										<FormControlLabel
											disabled={isSubmitting}
											value="studio"
											control={<Radio />}
											label={
												<ListItemText
													primary={
														<FormattedMessage
															id="publishOnDemand.pathModeDescription"
															defaultMessage="Publish changes made in Studio via the UI"
														/>
													}
													secondary={<FormattedMessage defaultMessage="By path" />}
												/>
											}
											sx={{ marginBottom: '10px' }}
										/>
									)}
									{(nou(mode) || mode.includes('git')) && (
										<FormControlLabel
											disabled={isSubmitting}
											value="git"
											control={<Radio />}
											label={
												<ListItemText
													primary={
														<FormattedMessage
															id="publishOnDemand.tagsModeDescription"
															defaultMessage="Publish changes made via direct git actions against the repository or pulled from a remote repository"
														/>
													}
													secondary={<FormattedMessage defaultMessage="By tags or commit ids" />}
												/>
											}
										/>
									)}
									{(nou(mode) || mode.includes('everything')) && (
										<FormControlLabel
											disabled={isSubmitting}
											value="everything"
											control={<Radio />}
											label={
												<ListItemText
													primary={
														<FormattedMessage
															id="publishOnDemand.publishAllDescription"
															defaultMessage="Publish everything"
														/>
													}
													secondary={
														<FormattedMessage defaultMessage="Publish all changes on the repo to the publishing target you choose" />
													}
												/>
											}
										/>
									)}
								</RadioGroup>
							</form>
						</Paper>
						<Collapse
							in={nnou(selectedMode)}
							timeout={300}
							unmountOnExit
							sx={{ marginTop: '20px' }}
							onEntered={scrollToBottom}
						>
							<PublishOnDemandForm
								disabled={isSubmitting}
								formData={currentFormData}
								setFormData={currentSetFormData}
								mode={selectedMode}
								publishingTargets={publishingTargets}
								publishingTargetsError={publishingTargetsError}
							/>
							{selectedMode === 'everything' ? (
								<Alert severity="warning" icon={false} sx={{ [`.${alertClasses.message}`]: { overflow: 'visible' } }}>
									<FormControlLabel
										control={
											<Checkbox
												checked={publishEverythingAck}
												color="primary"
												onChange={(e, checked) => setPublishEverythingAck(checked)}
											/>
										}
										label={<FormattedMessage defaultMessage="I understand the entire site will be published." />}
									/>
								</Alert>
							) : (
								<Box sx={{ textAlign: 'center', marginTop: '20px' }}>
									<Typography
										variant="caption"
										sx={{ color: (theme) => theme.palette.action.active, display: 'inline-block', maxWidth: '700px' }}
									>
										{selectedMode === 'studio' ? (
											<FormattedMessage
												id="publishingDashboard.studioNote"
												defaultMessage="Publishing by path should be used to publish changes made in Studio via the UI. For changes made via direct git actions, please <a>publish by commit or tag</a>."
												values={{
													a: (msg: ReactNode[]) => (
														<Link
															key="Link"
															href="#"
															onClick={toggleMode}
															sx={{ color: 'inherit', textDecoration: 'underline' }}
														>
															{msg[0]}
														</Link>
													)
												}}
											/>
										) : (
											<FormattedMessage
												id="publishingDashboard.gitNote"
												defaultMessage="Publishing by commit or tag must be used for changes made via direct git actions against the repository or pulled from a remote repository. For changes made via Studio on the UI, use please <a>publish by path</a>."
												values={{
													a: (msg: ReactNode[]) => (
														<Link
															key="Link"
															href="#"
															onClick={toggleMode}
															sx={{ color: 'inherit', textDecoration: 'underline' }}
														>
															{msg[0]}
														</Link>
													)
												}}
											/>
										)}
									</Typography>
								</Box>
							)}
						</Collapse>
					</>
				) : (
					<Box
						sx={(theme) => ({
							display: 'flex',
							alignItems: 'center',
							flexDirection: 'column',
							rowGap: theme.spacing(2),
							padding: theme.spacing(5)
						})}
					>
						<InfoOutlinedIcon sx={{ color: (theme) => theme.palette.text.secondary, fontSize: '1.75rem' }} />
						<Typography variant="body1" sx={{ maxWidth: '470px', textAlign: 'center' }}>
							<FormattedMessage
								id="publishOnDemand.noInitialPublish"
								defaultMessage="The project needs to undergo its initial publish before other publishing options become available"
							/>
						</Typography>
						{hasPublishPermission && (
							<PrimaryButton onClick={onInitialPublish}>
								<FormattedMessage id="publishOnDemand.publishEntireProject" defaultMessage="Publish Entire Project" />
							</PrimaryButton>
						)}
					</Box>
				)}
			</Box>
			{selectedMode && (
				<DialogFooter>
					<SecondaryButton onClick={onCancel} disabled={isSubmitting}>
						<FormattedMessage defaultMessage="Reset" />
					</SecondaryButton>
					<PrimaryButton loading={isSubmitting} disabled={!currentFormValid} onClick={onSubmitForm}>
						<FormattedMessage id="words.publish" defaultMessage="Publish" />
					</PrimaryButton>
				</DialogFooter>
			)}
			<div id={bottomElId} />
		</Paper>
	);
}

export default PublishOnDemandWidget;
