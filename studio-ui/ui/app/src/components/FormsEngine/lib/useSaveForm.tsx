/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

import { useDispatch, useStore as useReduxStore } from 'react-redux';
import GlobalState from '../../../models/GlobalState';
import { FormattedMessage, useIntl } from 'react-intl';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import React, { useContext } from 'react';
import {
	FormsEngineFormContextApi,
	ItemContext,
	ItemMetaContext,
	RenamedPathContext,
	StableFormContext,
	StableGlobalContext
} from './formsEngineContext';
import {
	commitFormVisibility,
	composePathForType,
	createObjectWithSystemProps,
	extractAtomValues,
	getBasePath,
	getFileNameValueFromPath,
	readInvalidFieldIds,
	showAlert
} from './formUtils';
import { FormSavePromiseResult, FormsEngineProps } from '../FormsEngine';
import { contentFormSaveAction } from '../../../utils/contentFormLaunch';
import { applySaveGate, childFields, draftFlagAfterBeforeSave, repositorySaveFollowUp } from './formVisibility';
import { clearStackPendingFlags, repeatItemInValues } from './repeatItemForm';
import { XmlKeys } from './formConsts';
import { fromString } from '../../../utils/xml';
import {
	moveAndUpdateContent,
	updateEmbeddedComponent,
	writeContent,
	WriteContentResponse
} from '../../../services/content';
import { AjaxError, AjaxResponse } from 'rxjs/ajax';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { buildContentXml } from './valueSerializers';
import { flushSync } from 'react-dom';
import LookupTable from '../../../models/LookupTable';
import { checkMinimumSaveRequirementsFulfilled, isInternalNameValid } from './validators';
import ContentType from '../../../models/ContentType';
import { cancelPackages } from '../../../services/workflow';
import { switchMap } from 'rxjs';
import { validateActionPolicy } from '../../../services/sites';
import { createComponentId, pushConfirmDialog } from '../../../utils/system';
import { nanoid } from 'nanoid';
import { popDialog, pushDialog } from '../../../state/actions/dialogStack';
import { reloadContentItem } from '../../../state/actions/content';
import { useAtomValue, useSetAtom, useStore as useJotaiStore } from 'jotai';
import { showSystemNotification } from '../../../state/actions/system';
import {
	AffectedPluginControlField,
	collectAffectedPluginControlFields,
	preloadControlPluginsForFields
} from './controlPluginLoader';
import { runFormControllerBeforeSave } from '../formControllers/runtime';
import { rememberCommittedRelevance } from '../formControllers/relevance';
import { applySavedRenameToLock } from './unlockOnClose';
export interface UseSaveFormProps {
	createPath?: string;
	isRepeatMode: boolean;
	isCreateMode: boolean;
	isEmbedded: boolean;
	/** True when this form was opened via pushForm on top of another form. */
	isStackedForm?: boolean;
	onBeforeSave?: FormsEngineProps['onSave'];
	onSave?: FormsEngineProps['onSave'];
	onClose?(): void;
	onMinimize?(): void;
}

const wrapOnSaveProp: (onSaveProp: FormsEngineProps['onSave']) => FormsEngineProps['onSave'] = (onSaveProp) => (args) =>
	onSaveProp?.(args) ?? Promise.resolve({ close: false });

/** What `save` tells the Save card. A plugin or policy block returns void instead. */
export type SaveFormResult = 'revealed' | 'invalid' | 'saved';

export function useSaveForm(props: UseSaveFormProps) {
	const jotai = useJotaiStore();
	const store = useReduxStore<GlobalState>();
	const dispatch = useDispatch();
	// A connected socket delivers this user's contentEvent (or moveContentEvent). Those epics
	// refetch an item already in the store, which is the address-bar item. When the socket is
	// down the event never arrives, so reload once. Skip it while connected to avoid a second fetch.
	const refreshSavedItem = (savedPath: string) => {
		if (!savedPath || store.getState().env.socketConnected) return;
		dispatch(reloadContentItem({ path: savedPath }));
	};
	const { formatMessage } = useIntl();
	const siteId = useActiveSiteId();
	const { isEmbedded, isStackedForm = false, isRepeatMode, isCreateMode, onClose, onMinimize, createPath } = props;
	const { id, contentType, contentObject, path: itemPath } = useContext(ItemMetaContext);
	const isPage = contentType.type === 'page';
	const stableFormContext = useContext(StableFormContext);
	const { formsStackData } = useContext(StableGlobalContext);
	const { affectedPackages } = useAtomValue(stableFormContext.atoms.lockResult);
	const formContextApi = useContext(FormsEngineFormContextApi);
	const setIsSubmitting = useSetAtom(stableFormContext.atoms.isSubmitting);
	const setVersionComment = useSetAtom(stableFormContext.atoms.versionComment);
	const setHasPendingChanges = useSetAtom(stableFormContext.atoms.hasPendingChanges);
	const onSave = wrapOnSaveProp(props.onSave);
	const { setRenamedPath, triggerReload, setSavedCreatePath } = useContext(RenamedPathContext);
	const initialFileName = itemPath ? getFileNameValueFromPath(itemPath, isPage) : '';
	const item = useContext(ItemContext);
	const repeatFieldId = isRepeatMode ? stableFormContext.props?.repeat?.fieldId : undefined;
	const readCurrentValidity = async () => {
		// Out-of-scope fields stay in this list. Only controller-irrelevant fields are skipped.
		const invalidFieldIds = await readInvalidFieldIds(
			jotai,
			stableFormContext.atoms.validationByFieldId,
			stableFormContext.formControllerState?.irrelevantFieldPaths,
			repeatFieldId
		);
		return { isFormInvalid: invalidFieldIds.length > 0, invalidFieldIds };
	};
	const save = async (draft?: boolean | 'auto'): Promise<SaveFormResult | void> => {
		// isSubmitting stays set through preload, onBeforeSave, and the repository write.
		// SaveCard ignores a dropdown pick while this flag, or its in-flight ref, is set.
		if (jotai.get(stableFormContext.atoms.isSubmitting)) {
			return;
		}
		setIsSubmitting(true);

		const showSaveError = (error: AjaxError | Error) => {
			setIsSubmitting(false);
			const message =
				error instanceof AjaxError
					? (error.response?.response?.message ?? error.response?.message)
					: (error as Error).message;
			showAlert({
				dispatch,
				children: (
					<Box>
						<Typography sx={{ marginBottom: 1 }}>
							<FormattedMessage defaultMessage="An error occurred trying to save the form" />
						</Typography>
						<Typography variant="body2" color="textSecondary">
							{message}
						</Typography>
					</Box>
				)
			});
		};

		// Validity first. preloadAndWrite is plugin preload and onBeforeSave, and it runs only for a write.
		let saveAsDraft = false;
		const preloadAndWrite = async (nextSaveAsDraft: boolean) => {
			saveAsDraft = nextSaveAsDraft;
			// Read at save time. A render snapshot is stale when the parent save runs right after an item edit.
			const versionComment = jotai.get(stableFormContext.atoms.versionComment);
			const closeAfterSave = jotai.get(stableFormContext.atoms.closeAfterSave);
			const minimizeAfterSave = jotai.get(stableFormContext.atoms.minimizeAfterSave);
			try {
				const fieldListMessage = (fields: AffectedPluginControlField[]) =>
					fields.map((field) => `"${field.fieldName}" (${field.fieldId})`).join(', ');
				const blockSaveForBootstrapPluginFailures = (fields: AffectedPluginControlField[]) => {
					return showAlert({
						dispatch,
						message: formatMessage(
							{
								defaultMessage:
									'Cannot save: one or more control plugins failed to load when the form opened ({fields}). Reload the form and try again. If the problem continues, contact your administrator.'
							},
							{ fields: fieldListMessage(fields) }
						)
					});
				};
				const blockSaveForPluginFailures = (fields: AffectedPluginControlField[]) => {
					const fieldList = fields.map((field) => `"${field.fieldName}" (${field.fieldId})`).join(', ');
					return showAlert({
						dispatch,
						message: formatMessage(
							{
								defaultMessage:
									'Cannot save: one or more control plugins failed to load ({fields}). If the problem continues, contact your administrator.'
							},
							{ fields: fieldList }
						)
					});
				};
				// Bootstrap failures mean values may have been parsed without the plugin valueRetriever.
				// Do not clear them for an in-place import retry — a successful load would still let
				// valueSerializer see raw shapes. Require a form reload so bootstrap re-parses correctly.
				const bootstrapAffectedFields = stableFormContext.affectedPluginControlFields.filter(
					(field) => field.fromBootstrap
				);
				if (bootstrapAffectedFields.length) {
					setIsSubmitting(false);
					return blockSaveForBootstrapPluginFailures(bootstrapAffectedFields);
				}
				// Prior save-time failures are safe to clear; `controlPluginCache` drops failed entries so retry works.
				stableFormContext.affectedPluginControlFields = [];
				let values = extractAtomValues(jotai, stableFormContext.atoms.valueByFieldId);

				const onSavePromiseHandler = ({ close }: FormSavePromiseResult) => {
					if (saveAsDraft) {
						// Show a snack indicating that the item was saved as draft.
						dispatch(
							showSystemNotification({
								options: { variant: 'warning' },
								message: formatMessage({
									id: 'item.savedAsDraft',
									defaultMessage: 'Draft saved. Required fields left blank may cause errors when previewed or deployed.'
								})
							})
						);
					}

					flushSync(() => {
						setIsSubmitting(false);
						setHasPendingChanges(false);
						// TODO: What would `setValuesCheckpoint` do if called on a repeat group form?
						!isRepeatMode && formContextApi.setValuesCheckpoint(values);
					});
					// Selected-fields edits that match this save are already in the parent.
					// An edit made after the snapshot keeps its pending flag. A full-mode or pencil item does too.
					if (!isRepeatMode) {
						const entries = formsStackData.map((entry) => {
							const repeat = entry.props?.repeat;
							return {
								selected: entry.itemFormMode ? jotai.get(entry.itemFormMode) === 'selected' : false,
								changedFieldIds: entry.changedFieldIds,
								fieldId: repeat?.fieldId,
								savedItem: repeatItemInValues(values, repeat?.fieldId, repeat?.index),
								currentItem: entry.atoms ? extractAtomValues(jotai, entry.atoms.valueByFieldId) : undefined,
								setCheckpoint(next: Record<string, unknown>) {
									entry.originalValues = next;
								},
								setPending(value: boolean) {
									if (entry.atoms) jotai.set(entry.atoms.hasPendingChanges, value);
								}
							};
						});
						clearStackPendingFlags(entries, stableFormContext.changedFieldIds);
						if (entries.some((entry) => entry.selected && entry.changedFieldIds.size > 0)) {
							setHasPendingChanges(true);
						}
					}
					const followUp = repositorySaveFollowUp({
						resultClose: close,
						closeAfterSave,
						minimizeAfterSave
					});
					if (followUp === 'close') {
						onClose?.();
					} else if (followUp === 'minimize') {
						setVersionComment('');
						onMinimize?.();
					}
				};

				const contentTypesById = store.getState().contentTypes.byId;
				// Re-walk current values (incl. embeds added after open) so serializers exist before XML build.
				// Runs before the repeat early-return so a failed bootstrap preload can retry on save in
				// repeat stacked forms as well as create/edit/embedded.
				// Repeat mode: that field's children. Root/embedded: the whole content type.
				const fieldsForPluginPreload = isRepeatMode
					? childFields(contentType.fields[repeatFieldId])
					: contentType.fields;
				const preloadPluginsOrBlock = async (currentValues: LookupTable<unknown>) => {
					const pluginPreloadFailures = await preloadControlPluginsForFields(
						siteId,
						fieldsForPluginPreload,
						currentValues,
						contentTypesById
					);
					if (!pluginPreloadFailures.length) {
						return true;
					}
					const affected = collectAffectedPluginControlFields(
						fieldsForPluginPreload,
						pluginPreloadFailures,
						currentValues,
						contentTypesById
					);
					const fields =
						affected.length > 0
							? affected
							: // Defensive: import failed but no field mapped — still block save.
								pluginPreloadFailures.map((failure) => ({
									fieldId: failure.plugin.name,
									fieldName: failure.plugin.name
								}));
					stableFormContext.affectedPluginControlFields = fields;
					blockSaveForPluginFailures(fields);
					setIsSubmitting(false);
					return false;
				};
				if (!(await preloadPluginsOrBlock(values))) {
					return;
				}

				// A reveal or cannot-proceed already returned, before preload. The controller may still
				// veto a save that is going to write. Repeat entries store no controller, so this is
				// a no-op for in-memory repeat commits.
				const hadBeforeSaveHook = Boolean(stableFormContext.formControllerState?.controller?.onBeforeSave);
				const beforeSave = await runFormControllerBeforeSave(stableFormContext, dispatch, formatMessage);
				if (!beforeSave.allowed) {
					setIsSubmitting(false);
					if (beforeSave.message) {
						dispatch(
							showSystemNotification({
								message: beforeSave.message,
								options: { variant: 'error' }
							})
						);
					}
					return;
				}

				// onBeforeSave may have mutated atoms via setValue (incl. new embeds); refresh before serialize/onSave.
				if (hadBeforeSaveHook) {
					values = extractAtomValues(jotai, stableFormContext.atoms.valueByFieldId);
					if (!(await preloadPluginsOrBlock(values))) {
						return;
					}
					// Re-read only to refresh the draft flag. Do not reveal or block again.
					const afterHook = await readCurrentValidity();
					saveAsDraft = draftFlagAfterBeforeSave(
						draft ?? false,
						afterHook.isFormInvalid,
						jotai.get(stableFormContext.atoms.saveAsDraft) === true
					);
				}

				// `onBeforeSave` may have changed `file-name`; the render-time snapshot is stale from here on.
				const currentFileName = jotai.get(stableFormContext.atoms.fileName);

				// Repeat handled here. If true, execution ends inside if statement.
				if (isRepeatMode) {
					(onSave?.({ values, versionComment }) as Promise<FormSavePromiseResult>)?.then(
						onSavePromiseHandler,
						showSaveError
					);
					return 'saved';
				}

				// Repository writes report the checkbox action and whether the item was stored as a draft.
				const repositorySaveArgs = (savedPath: string, dom: Document | Element, xml: string) => ({
					dom,
					xml,
					values,
					versionComment,
					path: savedPath,
					action: contentFormSaveAction({ close: closeAfterSave, minimize: minimizeAfterSave }),
					draft: saveAsDraft
				});

				complementValuesWithSystemProps(id, values, contentObject, contentType, saveAsDraft);
				const { [XmlKeys.fileName]: _, ...valuesWithoutFileName } = values;
				const xml = buildContentXml(valuesWithoutFileName, contentTypesById);
				// Embedded handled here. If true, execution ends inside if statement.
				if (isEmbedded) {
					// Validate minimum embedded requirements to save as draft. Execution stops if minimum reqs aren't fulfilled.
					if (!isInternalNameValid(values)) {
						setIsSubmitting(false);
						return showAlert({
							dispatch,
							message: formatMessage(
								{ defaultMessage: 'You need an {internalName} at a minimum to save content.' },
								{ internalName: contentType.fields[XmlKeys.internalName].name }
							)
						});
					}

					const dom = fromString(xml);

					// Stacked embedded: hand values back to the parent form (e.g. NodeSelector merges in memory).
					if (isStackedForm) {
						// Same object the parent will validate. Keep this session's deny-list on it so a
						// field hidden at bootstrap — or only in create mode — is not re-judged and then
						// required. Callers pass `values` through; copying it would drop the association.
						const committed = stableFormContext.formControllerState;
						if (committed?.controller && committed.irrelevantFieldPaths) {
							rememberCommittedRelevance(values, committed.controller, committed.irrelevantFieldPaths);
						}
						(onSave?.({ dom, xml, values, versionComment }) as Promise<FormSavePromiseResult>)?.then(
							onSavePromiseHandler,
							showSaveError
						);
						return 'saved';
					}

					// Root embedded: merge the component into the parent document and write the parent.
					// The callback path is that parent, so a component inside a page reports the page path.
					const path = itemPath;
					const saveEmbeddedContent = (cancelPackagesComment: string = '') => {
						const writeService$ = updateEmbeddedComponent(siteId, path, id, xml, { comment: versionComment });
						const saveOrCancel$ = affectedPackages?.length
							? cancelPackages(siteId, {
									packageIds: affectedPackages.map((pkg) => pkg.id),
									comment: cancelPackagesComment
								}).pipe(switchMap(() => writeService$))
							: writeService$;

						saveOrCancel$.subscribe({
							async next(ajaxResponse: AjaxResponse<WriteContentResponse>) {
								try {
									const isAmended = ajaxResponse.response?.items?.[0]?.amended;
									refreshSavedItem(path);
									const result = ((await onSave?.(repositorySaveArgs(path, dom, xml))) ?? {
										close: false
									}) as FormSavePromiseResult;
									const shouldClose =
										repositorySaveFollowUp({ resultClose: result.close, closeAfterSave, minimizeAfterSave }) ===
										'close';
									if (!shouldClose && isAmended) {
										triggerReload();
									}
									onSavePromiseHandler(result);
								} catch (error) {
									showSaveError(error as AjaxError | Error);
								}
							},
							error: showSaveError
						});
					};

					if (affectedPackages?.length) {
						const dialogId = nanoid();
						dispatch(
							pushDialog({
								id: dialogId,
								component: createComponentId('ViewPackagesDialog'),
								props: {
									item,
									cancelPackagesInitialComment: formatMessage(
										{ defaultMessage: 'Cancel packages to write on "{path}"' },
										{ path }
									),
									onContinue: (cancelPackagesUpdatedComment) => {
										saveEmbeddedContent(cancelPackagesUpdatedComment);
										dispatch(popDialog({ id: dialogId }));
									},
									onClose: () => {
										setIsSubmitting(false);
										dispatch(popDialog({ id: dialogId }));
									}
								}
							})
						);
					} else {
						saveEmbeddedContent();
					}
					return 'saved';
				}
				let path: string;
				let renamePath: string;
				const isRename = !isCreateMode && currentFileName !== initialFileName;
				if (isCreateMode) {
					path = composePathForType(createPath, currentFileName, contentType);
				} /* is a plain update (page or component) */ else {
					if (isRename) {
						const basePath = getBasePath(itemPath, isPage);
						path = composePathForType(basePath, currentFileName, contentType);
						renamePath = path;
					} else {
						path = itemPath;
					}
				}

				const saveActionCallbacks = {
					async next(ajaxResponse: AjaxResponse<WriteContentResponse>) {
						try {
							// The move carries the lock. Record the new path before close so unmount unlocks that path.
							if (isRename && renamePath) {
								const lockAtom = stableFormContext.atoms.lockResult;
								const currentLock = jotai.get(lockAtom);
								const followed = applySavedRenameToLock(currentLock, renamePath);
								if (followed) jotai.set(lockAtom, { ...currentLock, ...followed });
							}
							const isAmended = ajaxResponse.response?.items?.[0]?.amended;
							const dom = fromString(xml);
							refreshSavedItem(path);
							const result = ((await onSave?.(repositorySaveArgs(path, dom, xml))) ?? {
								close: false
							}) as FormSavePromiseResult;
							const shouldClose =
								repositorySaveFollowUp({ resultClose: result.close, closeAfterSave, minimizeAfterSave }) === 'close';
							if (!shouldClose) {
								if (isCreateMode) {
									setSavedCreatePath(path);
								} else if (isRename) {
									setRenamedPath(renamePath);
								} else if (isAmended) {
									triggerReload();
								}
							}
							onSavePromiseHandler(result);
						} catch (error) {
							showSaveError(error as AjaxError | Error);
						}
					},
					error: showSaveError
				};

				// Validate minimum requirements to save as draft. Execution stops if minimum reqs aren't fulfilled.
				const minimumRequirementsFullfilled = await checkMinimumSaveRequirementsFulfilled(
					jotai.get(stableFormContext.atoms.validationByFieldId[XmlKeys['fileName']]),
					values
				);
				if (!minimumRequirementsFullfilled) {
					setIsSubmitting(false);
					return showAlert({
						dispatch,
						message: formatMessage(
							{ defaultMessage: 'You need a valid {fileName} and {internalName} at a minimum to save content.' },
							{
								fileName: contentType.fields[XmlKeys.fileName].name,
								internalName: contentType.fields[XmlKeys.internalName].name
							}
						)
					});
				}

				// TODO: write-content url on FE1 sends phase, path, fileName, contentType QSAs. Important?
				const saveContent = (cancelPackagesComment: string = '') => {
					const saveOrMoveService$ = isRename
						? moveAndUpdateContent(siteId, itemPath, path, xml)
						: writeContent(siteId, path, xml, { comment: versionComment });
					const saveOrCancel$ = affectedPackages?.length
						? cancelPackages(siteId, {
								packageIds: affectedPackages.map((pkg) => pkg.id),
								comment: cancelPackagesComment
							}).pipe(
								switchMap(() => {
									return saveOrMoveService$;
								})
							)
						: saveOrMoveService$;

					saveOrCancel$.subscribe(saveActionCallbacks);
				};

				// If there are affected packages, show ViewPackagesDialog dialog first, to let user know that packages will be cancelled
				const checkWorkflow = () => {
					if (affectedPackages?.length) {
						const dialogId = nanoid();
						dispatch(
							pushDialog({
								id: dialogId,
								component: createComponentId('ViewPackagesDialog'),
								props: {
									item,
									cancelPackagesInitialComment: formatMessage(
										{ defaultMessage: 'Cancel packages to write on "{path}"' },
										{ path }
									),
									onContinue: (cancelPackagesUpdatedComment) => {
										saveContent(cancelPackagesUpdatedComment);
										dispatch(popDialog({ id: dialogId }));
									},
									onClose: () => {
										setIsSubmitting(false);
										dispatch(popDialog({ id: dialogId }));
									}
								}
							})
						);
					} else {
						saveContent();
					}
				};

				// Validate site policy, if allowed, proceed to check workflow
				const dialogId = nanoid();
				validateActionPolicy(siteId, {
					type: 'CREATE',
					target: path,
					contentMetadata: { contentType: contentType.id }
				}).subscribe({
					next({ allowed, modifiedValue }) {
						if (allowed) {
							if (modifiedValue) {
								dispatch(
									pushConfirmDialog({
										id: dialogId,
										props: {
											body: formatMessage(
												{
													defaultMessage:
														'The {originalPath} path goes against project policies. Suggested modified path is: "{path}". Would you like to use the suggested path?'
												},
												{
													originalPath: path,
													path: modifiedValue
												}
											),
											onOk: () => {
												dispatch(popDialog({ id: dialogId }));
												checkWorkflow();
											},
											onCancel: () => {
												setIsSubmitting(false);
												dispatch(popDialog({ id: dialogId }));
											}
										}
									})
								);
							} else {
								checkWorkflow();
							}
						} else {
							setIsSubmitting(false);
							dispatch(
								pushConfirmDialog({
									id: dialogId,
									props: {
										body: formatMessage({ defaultMessage: 'This content goes against project policies.' }),
										onOk: () => dispatch(popDialog({ id: dialogId }))
									}
								})
							);
						}
					},
					error: showSaveError
				});
				return 'saved';
			} catch (error) {
				showSaveError(error as AjaxError | Error);
			}
		};
		try {
			const outcome = await applySaveGate({
				draft: draft ?? false,
				saveAsDraft: jotai.get(stableFormContext.atoms.saveAsDraft) === true,
				visibility: jotai.get(stableFormContext.atoms.formVisibility),
				sectionOrder: isRepeatMode
					? childFields(contentType.fields[repeatFieldId]).map((field) => field.id)
					: (contentType.sections?.flatMap((section) => section.fields) ?? []),
				irrelevantFieldPaths: stableFormContext.formControllerState?.irrelevantFieldPaths,
				parentPath: repeatFieldId,
				readValidity: readCurrentValidity,
				onReveal(reveal) {
					commitFormVisibility(jotai.set, stableFormContext.atoms, reveal.state, reveal.fieldId);
				},
				preloadAndWrite
			});
			if (outcome === 'revealed' || outcome === 'invalid') setIsSubmitting(false);
			return outcome;
		} catch (error) {
			setIsSubmitting(false);
			throw error;
		}
	};

	return { save };
}

function complementValuesWithSystemProps(
	id: string,
	values: LookupTable<unknown>,
	contentObject: LookupTable<unknown>,
	contentType: ContentType,
	saveAsDraft: boolean
): void {
	const systemProps = createObjectWithSystemProps(contentType, {
		[XmlKeys.modelId]: id,
		[XmlKeys.internalName]: values[XmlKeys.internalName] as string,
		[XmlKeys.dateCreated]: contentObject[XmlKeys.dateCreated] as string,
		[XmlKeys.dateCreatedDt]: contentObject[XmlKeys.dateCreatedDt] as string,
		[XmlKeys.savedAsDraft]: saveAsDraft
	});

	// Do not overwrite any existing value.
	for (const key in systemProps) {
		if (!(key in values)) {
			values[key] = systemProps[key];
		}
	}
}

export default useSaveForm;
