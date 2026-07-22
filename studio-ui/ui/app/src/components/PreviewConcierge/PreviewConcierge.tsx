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

import React, { MutableRefObject, PropsWithChildren, useEffect, useRef, useState } from 'react';
import {
	allowedContentTypesUpdate,
	changeCurrentUrl,
	clearSelectedZones,
	clearSelectForEdit,
	contentTypeDropTargetsResponse,
	contentTypesResponse,
	deleteItemOperation,
	deleteItemOperationComplete,
	deleteItemOperationFailed,
	duplicateItemOperation,
	duplicateItemOperationComplete,
	duplicateItemOperationFailed,
	errorPageCheckIn,
	fetchContentTypes,
	fetchGuestModel,
	fetchGuestModelComplete,
	fetchGuestModelsComplete,
	fetchPrimaryGuestModelComplete,
	guestCheckIn,
	guestCheckOut,
	guestModelUpdated,
	guestSiteLoad,
	hostCheckIn,
	hotKey,
	iceZoneSelected,
	initPreviewConfig,
	initRichTextEditorConfig,
	insertComponentOperation,
	InsertComponentOperationPayload,
	insertItemOperation,
	insertItemOperationComplete,
	insertItemOperationFailed,
	insertOperationComplete,
	insertOperationFailed,
	instanceDragBegun,
	instanceDragEnded,
	moveItemOperation,
	moveItemOperationComplete,
	moveItemOperationFailed,
	reloadRequest,
	requestEdit,
	requestWorkflowCancellationDialog,
	requestWorkflowCancellationDialogOnResult,
	selectForEdit,
	setContentTypeDropTargets,
	setItemBeingDragged,
	setPreviewEditMode,
	showEditDialog as showEditDialogAction,
	snackGuestMessage,
	sortItemOperation,
	sortItemOperationComplete,
	sortItemOperationFailed,
	toggleEditModePadding,
	trashed,
	updateFieldValueOperation,
	updateFieldValueOperationComplete,
	updateFieldValueOperationFailed,
	updateRteConfig
} from '../../state/actions/preview';
import {
	deleteItem,
	duplicateItem,
	fetchContentInstance,
	fetchContentInstanceDescriptor,
	fetchContentItem as fetchContentItemService,
	fetchContentItems,
	insertComponent,
	insertInstance,
	insertItem,
	moveItem,
	sortItem,
	updateField,
	writeInstance
} from '../../services/content';
import { filter, map, switchMap, take, takeUntil } from 'rxjs/operators';
import { BehaviorSubject, forkJoin, Observable, of } from 'rxjs';
import { FormattedMessage, useIntl } from 'react-intl';
import { getGuestToHostBus, getHostToGuestBus, getHostToHostBus } from '../../utils/subjects';
import { useDispatch, useStore } from 'react-redux';
import { getPersonFullName, nnou } from '../../utils/object';
import { findParentModelId, getModelIdFromInheritedField, isInheritedField } from '../../utils/model';
import RubbishBin from '../RubbishBin/RubbishBin';
import { useSnackbar } from 'notistack';
import {
	getStoredClipboard,
	getStoredEnabledKeyboardShortcutsState,
	getStoredEditModeChoice,
	getStoredEditModePadding,
	getStoredHighlightModeChoice,
	getStoredOutdatedXBValidationDate,
	removeStoredClipboard,
	setStoredOutdatedXBValidationDate
} from '../../utils/state';
import {
	fetchContentItem,
	reloadContentItem,
	restoreClipboard,
	unlockItem,
	updateItemsByPath
} from '../../state/actions/content';
import EditFormPanel from '../EditFormPanel/EditFormPanel';
import {
	createModelHierarchyDescriptorMap,
	getInheritanceParentIdsForField,
	getNumOfMenuOptionsForItem,
	isItemLockedForMe,
	normalizeModel,
	normalizeModelsLookup,
	parseContentXML
} from '../../utils/content';
import moment from 'moment-timezone';
import ContentInstance from '../../models/ContentInstance';
import IconButton from '@mui/material/IconButton';
import { useSelection } from '../../hooks/useSelection';
import { usePreviewState } from '../../hooks/usePreviewState';
import { useContentTypes } from '../../hooks/useContentTypes';
import { useActiveUser } from '../../hooks/useActiveUser';
import { usePreviewNavigation } from '../../hooks/usePreviewNavigation';
import { useActiveSite } from '../../hooks/useActiveSite';
import { getPathFromPreviewURL, processPathMacros, withIndex } from '../../utils/path';
import {
	closeItemMegaMenu,
	imageEditCancelled,
	imageEdited,
	itemMegaMenuClosed,
	rtePickerActionResult,
	showImageEditorDialog,
	showItemMegaMenu,
	showRtePickerActions,
	type ShowRtePickerActionsPayload
} from '../../state/actions/dialogs';
import { UNDEFINED } from '../../utils/constants';
import { useCurrentPreviewItem } from '../../hooks/useCurrentPreviewItem';
import { useSiteUIConfig } from '../../hooks/useSiteUIConfig';
import { useRTEConfig } from '../../hooks/useRTEConfig';
import { guestMessages } from '../../assets/guestMessages';
import { GlobalState, HighlightMode } from '../../models/GlobalState';
import { useEnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import KeyboardShortcutsDialog from '../KeyboardShortcutsDialog';
import { previewKeyboardShortcuts } from '../../assets/keyboardShortcuts';
import {
	contentEvent,
	contentTypeCreated,
	contentTypeDeleted,
	contentTypeUpdated,
	lockContentEvent,
	pluginInstalled,
	pluginUninstalled,
	showSystemNotification
} from '../../state/actions/system';
import useSpreadState from '../../hooks/useSpreadState';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { useHotkeys } from 'react-hotkeys-hook';
import { batchActions, dispatchDOMEvent, editContentTypeTemplate } from '../../state/actions/misc';
import SocketEventBase from '../../models/SocketEvent';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import { useTheme } from '@mui/material/styles';
import { createCustomDocumentEventListener } from '../../utils/dom';
import BrowseFilesDialog from '../BrowseFilesDialog';
import { ContentItem, MediaItem } from '../../models';
import DataSourcesActionsList, { DataSourcesActionsListProps } from '../DataSourcesActionsList/DataSourcesActionsList';
import { editControllerActionCreator, itemActionDispatcher } from '../../utils/itemActions';
import useEnv from '../../hooks/useEnv';
import { getOffsetLeft, getOffsetTop } from '@mui/material/Popover';
import { isSameDay } from '../../utils/datetime';
import compatibilityList from './compatibilityList';
import ContentType from '../../models/ContentType';
import { Dispatch } from 'redux';
import { ActionCreatorWithOptionalPayload } from '@reduxjs/toolkit';
import { ItemMegaMenuStateProps } from '../ItemMegaMenu';
import StandardAction from '../../models/StandardAction';
import { createComponentId, pickShowContentFormAction } from '../../utils/system';
import { popDialog, pushDialog } from '../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { ImageRestrictionSubtitle } from '../FormsEngine/lib/controlHelpers';

const issueDescriptorRequest = (props: {
	site: string;
	path: string;
	contentTypes: Record<string, ContentType>;
	requestedSourceMapPaths: MutableRefObject<Record<string, boolean>>;
	flatten?: boolean;
	dispatch: Dispatch;
	completeActionCreator: ActionCreatorWithOptionalPayload<any>;
	permissions: string[];
}) => {
	const {
		site,
		path,
		contentTypes,
		requestedSourceMapPaths,
		flatten = true,
		dispatch,
		completeActionCreator,
		permissions
	} = props;
	const hostToGuest$ = getHostToGuestBus();
	const guestToHost$ = getGuestToHostBus();

	fetchContentInstanceDescriptor(site, path, { flatten }, contentTypes)
		.pipe(
			// If another check in comes while loading, this request should be cancelled.
			// This may happen if navigating rapidly from one page to another (guest-side).
			takeUntil(guestToHost$.pipe(filter(({ type }) => [guestCheckIn.type, guestCheckOut.type].includes(type)))),
			switchMap((modelResponse) => {
				let requests: Array<Observable<ContentInstance>> = [];
				const contentItemPaths = []; // Used to collect the paths to fetch the sandbox items corresponding to the Content Instances.
				const contentItemPathLookup = {};
				Object.values(modelResponse.modelLookup).forEach((model) => {
					if (model.craftercms.path) {
						contentItemPaths.push(model.craftercms.path);
						contentItemPathLookup[model.craftercms.path] = true;
						Object.values(model.craftercms.sourceMap).forEach((path) => {
							if (!contentItemPathLookup[path]) {
								contentItemPathLookup[path] = true;
								contentItemPaths.push(path);
							}
							if (!requestedSourceMapPaths.current[path]) {
								requestedSourceMapPaths.current[path] = true;
								requests.push(fetchContentInstance(site, path, contentTypes));
							}
						});
					}
				});
				Object.keys(modelResponse.unflattenedPaths).forEach((path) => {
					contentItemPaths.push(path);
					requests.push(fetchContentInstance(site, path, contentTypes));
				});
				return forkJoin({
					contentItems: fetchContentItems(site, contentItemPaths),
					modelResponse: requests.length
						? forkJoin(requests).pipe(
								map((response) => {
									response.forEach((contentInstance) => {
										if (contentInstance.craftercms.path in modelResponse.unflattenedPaths) {
											// Complete the object reference with the freshly-fetched instance and add it to the modelLookup.
											// This relies on object references inside the lookup objects being referenced by the unflattenedPaths.
											// i.e. unflattenedPaths is a shortcut to the objects withing the guts of the models on the modelLookup.
											modelResponse.modelLookup[contentInstance.craftercms.id] = Object.assign(
												modelResponse.unflattenedPaths[contentInstance.craftercms.path],
												contentInstance
											);
										} else {
											modelResponse.modelLookup[contentInstance.craftercms.id] = contentInstance;
										}
									});
									return modelResponse;
								})
							)
						: of(modelResponse)
				});
			})
		)
		.subscribe(({ contentItems, modelResponse }) => {
			const { model, modelLookup } = modelResponse;
			const normalizedModels = normalizeModelsLookup(modelLookup);
			const hierarchyMap = createModelHierarchyDescriptorMap(normalizedModels, contentTypes);
			const normalizedModel = normalizedModels[model.craftercms.id];
			const modelIdByPath = {};
			Object.values(modelLookup).forEach((model) => {
				if (
					// Embedded components don't have a path.
					model.craftercms.path &&
					// Items that weren't flattened and their path doesn't contain their id, would come with a `null` id.
					model.craftercms.id &&
					// Not-flattened items whose file name is their id, would have id/path filled up but the rest of props null.
					// Technically, just this line might be sufficient. Could evaluate remove the id check.
					model.craftercms.contentTypeId
				) {
					modelIdByPath[model.craftercms.path] = model.craftercms.id;
				}
			});

			dispatch(
				batchActions([
					completeActionCreator({
						model: normalizedModel,
						modelLookup: normalizedModels,
						modelIdByPath: modelIdByPath,
						hierarchyMap
					}),
					updateItemsByPath({ items: contentItems })
				])
			);
			hostToGuest$.next(
				fetchGuestModelComplete({
					path,
					model: normalizedModel,
					modelLookup: normalizedModels,
					hierarchyMap,
					modelIdByPath: modelIdByPath,
					contentItems,
					permissions
				})
			);
		});
};

const dataSourceActionsListInitialState = {
	show: false,
	rect: null,
	items: []
};

export function PreviewConcierge(props: PropsWithChildren<{}>) {
	const dispatch = useDispatch();
	const store = useStore<GlobalState>();
	const { id: siteId, uuid } = useActiveSite() ?? {};
	const user = useActiveUser();
	const username = user?.username;
	const { guest, editMode, highlightMode, editModePadding, icePanelWidth, toolsPanelWidth, hostSize, showToolsPanel } =
		usePreviewState();
	const item = useCurrentPreviewItem();
	const { currentUrlPath } = usePreviewNavigation();
	const contentTypes = useContentTypes();
	const contentTypes$Ref = useRef<BehaviorSubject<Record<string, ContentType>>>(undefined);
	const { authoringBase, guestBase, xsrfArgument } = useSelection((state) => state.env);
	const priorState = useRef({ site: siteId });
	const { enqueueSnackbar } = useSnackbar();
	const { formatMessage } = useIntl();
	const dialogs = useSelection((state) => state.dialogs);
	const stack = useSelection((state) => state.dialogStack);
	const keyboardShortcutsEnabled = useSelection((state) => state.preview.keyboardShortcutsEnabled);
	const models = guest?.models;
	const modelIdByPath = guest?.modelIdByPath;
	const hierarchyMap = guest?.hierarchyMap;
	const requestedSourceMapPaths = useRef({});
	const currentItemPath = guest?.path;
	const uiConfig = useSiteUIConfig();
	const { cdataEscapedFieldPatterns } = uiConfig;
	const rteConfig = useRTEConfig();
	const keyboardShortcutsDialogState = useEnhancedDialogState();
	const theme = useTheme();
	const browseFilesDialogState = useEnhancedDialogState();
	const [browseFilesDialogPath, setBrowseFilesDialogPath] = useState('/');
	const [browseFilesDialogMimeTypes, setBrowseFilesDialogMimeTypes] = useState([]);
	const [dataSourceActionsListState, setDataSourceActionsListState] = useSpreadState<DataSourcesActionsListProps>(
		dataSourceActionsListInitialState
	);
	const toggleEditMode = (nextHighlightMode?: HighlightMode) => {
		dispatch(
			setPreviewEditMode({
				// If switching from highlight modes (all vs move), we just want to switch modes without turning off edit mode.
				editMode: nextHighlightMode !== highlightMode ? true : !editMode,
				highlightMode: nextHighlightMode
			})
		);
	};
	const env = useEnv();
	const upToDateRefs = useUpdateRefs({
		store,
		item,
		theme,
		guest,
		models,
		user,
		siteId,
		dispatch,
		guestBase,
		rteConfig,
		contentTypes,
		xsrfArgument,
		hierarchyMap,
		highlightMode,
		modelIdByPath,
		formatMessage,
		authoringBase,
		currentUrlPath,
		enqueueSnackbar,
		editModePadding,
		cdataEscapedFieldPatterns,
		toggleEditMode,
		keyboardShortcutsDialogState,
		setDataSourceActionsListState,
		showToolsPanel,
		toolsPanelWidth,
		browseFilesDialogState,
		dialogs,
		stack,
		keyboardShortcutsEnabled,
		onShortCutKeypress(event: KeyboardEvent) {
			const openDialogs: boolean =
				Object.values(upToDateRefs.current.dialogs).some((dialog) => dialog.open) ||
				Boolean(upToDateRefs.current.stack.ids?.length);
			if (openDialogs || !upToDateRefs.current.keyboardShortcutsEnabled) return;

			const key = event.key;
			switch (key) {
				case 'e':
					upToDateRefs.current.toggleEditMode('all');
					break;
				case 'm':
					upToDateRefs.current.toggleEditMode('move');
					break;
				case 'p':
					upToDateRefs.current.dispatch(toggleEditModePadding());
					break;
				case '?':
					upToDateRefs.current.keyboardShortcutsDialogState.onOpen();
					break;
				case 'r':
					getHostToGuestBus().next(reloadRequest());
					getHostToHostBus().next(reloadRequest());
					break;
				case 'E':
					upToDateRefs.current.item &&
						dispatch(
							pickShowContentFormAction({
								site: upToDateRefs.current.siteId,
								path: upToDateRefs.current.guest.path,
								readonly:
									!upToDateRefs.current.item.availableActionsMap.edit ||
									isItemLockedForMe(upToDateRefs.current.item, upToDateRefs.current.user.username),
								authoringBase: upToDateRefs.current.authoringBase
							})
						);
					break;
				case 'a':
					{
						if (store.getState().dialogs.itemMegaMenu.open) {
							dispatch(closeItemMegaMenu());
						} else if (upToDateRefs.current.item) {
							let top, left;
							let menuButton = document.querySelector('#previewAddressBarActionsMenuButton');
							if (menuButton) {
								let anchorRect = menuButton.getBoundingClientRect();
								top = anchorRect.top + getOffsetTop(anchorRect, 'top');
								left = anchorRect.left + getOffsetLeft(anchorRect, 'left');
							} else {
								top = 80;
								left = (upToDateRefs.current.showToolsPanel ? upToDateRefs.current.toolsPanelWidth : 0) + 20;
							}
							let path = upToDateRefs.current.item.path;
							if (path === '/site/website') {
								path = withIndex(path);
							}
							dispatch(
								showItemMegaMenu({
									path: path,
									anchorReference: 'anchorPosition',
									anchorPosition: { top, left },
									loaderItems: getNumOfMenuOptionsForItem(item)
								})
							);
						}
					}
					break;
			}
		},
		env,
		xbCompatConsoleWarningPrinted: false,
		contentTypes$: contentTypes$Ref.current
	});

	const onRtePickerResult = (payload?: { path: string; name: string }) => {
		const hostToGuest$ = getHostToGuestBus();
		hostToGuest$.next({
			type: rtePickerActionResult.type,
			payload
		});
	};

	useEffect(() => {
		if (nnou(uiConfig.xml)) {
			const storedEditMode = getStoredEditModeChoice(username, uuid);
			const storedHighlightMode = getStoredHighlightModeChoice(username, uuid);
			const storedPaddingMode = getStoredEditModePadding(username);
			const storedEnabledKeyboardShortcuts = getStoredEnabledKeyboardShortcutsState(username);
			dispatch(
				initPreviewConfig({
					configXml: uiConfig.xml,
					storedEditMode,
					storedHighlightMode,
					storedPaddingMode,
					storedEnabledKeyboardShortcuts
				})
			);
		}
	}, [uiConfig.xml, username, uuid, dispatch]);

	// Legacy Guest pencil repaint - When the guest screen size changes, pencils need to be repainted.
	useEffect(() => {
		if (editMode) {
			let timeout = setTimeout(() => {
				getHostToGuestBus().next({ type: 'REPAINT_PENCILS' });
			}, 500);
			return () => {
				clearTimeout(timeout);
			};
		}
	}, [icePanelWidth, toolsPanelWidth, hostSize, editMode, showToolsPanel]);

	// Send editMode changes to guest
	useEffect(() => {
		// FYI. Path navigator refresh triggers this effect too due to item changing.
		if (item) {
			getHostToGuestBus().next(setPreviewEditMode({ editMode }));
		}
	}, [item, editMode]);

	// Fetch active item
	useEffect(() => {
		if (currentItemPath && siteId) {
			dispatch(fetchContentItem({ path: currentItemPath }));
		}
	}, [dispatch, currentItemPath, siteId]);

	// Update rte config
	useEffect(() => {
		if (rteConfig) {
			// @ts-ignore - TODO: type action accordingly
			getHostToGuestBus().next(updateRteConfig({ rteConfig }));
		}
	}, [rteConfig]);

	// Retrieve stored site clipboard, retrieve stored tools panel page.
	useEffect(() => {
		const localClipboard = getStoredClipboard(uuid, username);
		if (localClipboard) {
			let hours = moment().diff(moment(localClipboard.timestamp), 'hours');
			if (hours >= 24) {
				removeStoredClipboard(uuid, username);
			} else {
				dispatch(
					restoreClipboard({
						type: localClipboard.type,
						includeChildren: localClipboard.includeChildren,
						sourcePath: localClipboard.sourcePath
					})
				);
			}
		}
	}, [dispatch, uuid, username]);

	// Post content types
	useEffect(() => {
		contentTypes && getHostToGuestBus().next(contentTypesResponse({ contentTypes: Object.values(contentTypes) }));
		if (!contentTypes$Ref.current) contentTypes$Ref.current = new BehaviorSubject(contentTypes);
		contentTypes$Ref.current.next(contentTypes);
	}, [contentTypes]);

	// region guestToHost$ subscription
	useEffect(() => {
		const hostToGuest$ = getHostToGuestBus();
		const guestToHost$ = getGuestToHostBus();
		const hostToHost$ = getHostToHostBus();
		const updatedModifiedItem = (path: string) => {
			upToDateRefs.current.dispatch(
				reloadContentItem({
					path
				})
			);
		};
		const guestToHostSubscription = guestToHost$.subscribe((action) => {
			// region const { ... } = upToDateRefs.current
			const {
				siteId,
				models,
				dispatch,
				guestBase,
				contentTypes,
				hierarchyMap,
				authoringBase,
				formatMessage,
				modelIdByPath,
				enqueueSnackbar,
				user,
				env
			} = upToDateRefs.current;
			// endregion
			const { type, payload } = action;
			const permissions = user?.permissionsBySite[siteId];
			const contentTypes$ = upToDateRefs.current.contentTypes$.pipe(
				filter((contentTypes) => Boolean(contentTypes)),
				take(1)
			);
			switch (type) {
				case guestSiteLoad.type:
				case guestCheckIn.type:
					if (type === guestCheckIn.type) {
						const guestVersionStr = payload.version?.slice(0, 5);
						if (guestVersionStr && env?.version) {
							const stdVersionStr = env.version.slice(0, 5);
							if (
								// Only show once per tab session (full reload)
								!upToDateRefs.current.xbCompatConsoleWarningPrinted &&
								parseInt(stdVersionStr.replaceAll('.', '')) > parseInt(guestVersionStr.replaceAll('.', ''))
							) {
								upToDateRefs.current.xbCompatConsoleWarningPrinted = true;
								console.log(
									`%c(i) Please update your @craftercms/experience-builder package to \`${stdVersionStr}\`.\n` +
										`  - yarn add @craftercms/experience-builder@${stdVersionStr}\n` +
										`  - npm i @craftercms/experience-builder@${stdVersionStr}`,
									'color: #00f'
								);
							}
						}
						if (!compatibilityList.includes(guestVersionStr)) {
							const xbOutdatedValidationDate = getStoredOutdatedXBValidationDate(siteId, user.username);
							// If message has not been shown today or not shown at all
							if (!xbOutdatedValidationDate || !isSameDay(xbOutdatedValidationDate, new Date())) {
								enqueueSnackbar(formatMessage(guestMessages.outdatedExpBuilderVersion), { variant: 'warning' });
								setStoredOutdatedXBValidationDate(siteId, user.username, new Date());
							}
						}
					}
					break;
			}
			switch (type) {
				// region Legacy preview sites messages
				case guestSiteLoad.type: {
					const { url, location } = payload;
					const path = getPathFromPreviewURL(url);
					dispatch(guestCheckIn({ location, site: siteId, path }));
					contentTypes$.subscribe((contentTypes) => {
						issueDescriptorRequest({
							site: siteId,
							path,
							contentTypes,
							requestedSourceMapPaths,
							dispatch,
							completeActionCreator: fetchPrimaryGuestModelComplete,
							permissions
						});
					});
					break;
				}
				case 'ICE_ZONE_ON': {
					dispatch(
						pickShowContentFormAction({
							path: payload.itemId,
							authoringBase,
							site: siteId,
							iceGroupId: payload.iceId || UNDEFINED,
							modelId: payload.embeddedItemId || UNDEFINED,
							isHidden: Boolean(payload.embeddedItemId)
						})
					);
					break;
				}
				case 'IS_REVIEWER': {
					getHostToGuestBus().next({ type: 'REPAINT_PENCILS' });
					break;
				}
				case 'CHECK_OUT_GUEST': {
					const path = getPathFromPreviewURL(payload.url);
					dispatch(guestCheckOut({ path }));
					break;
				}
				// endregion
				case guestCheckIn.type: {
					getHostToGuestBus().next(
						hostCheckIn({
							editMode: false,
							username: upToDateRefs.current.user.username,
							highlightMode: upToDateRefs.current.highlightMode,
							authoringBase: upToDateRefs.current.authoringBase,
							site: upToDateRefs.current.siteId,
							editModePadding: upToDateRefs.current.editModePadding,
							rteConfig: upToDateRefs.current.rteConfig ?? {}
						})
					);
					dispatch(guestCheckIn(payload));

					if (payload.__CRAFTERCMS_GUEST_LANDING__) {
						nnou(siteId) && dispatch(changeCurrentUrl('/'));
					} else {
						const path = payload.path;

						contentTypes$.subscribe((contentTypes) => {
							hostToGuest$.next(contentTypesResponse({ contentTypes: Object.values(contentTypes) }));
							issueDescriptorRequest({
								site: siteId,
								path,
								contentTypes,
								requestedSourceMapPaths,
								dispatch,
								completeActionCreator: fetchPrimaryGuestModelComplete,
								permissions
							});
						});
					}
					break;
				}
				case fetchGuestModel.type: {
					if (payload.path?.startsWith('/')) {
						contentTypes$.subscribe((contentTypes) => {
							issueDescriptorRequest({
								site: siteId,
								path: payload.path,
								contentTypes,
								requestedSourceMapPaths,
								dispatch,
								completeActionCreator: fetchGuestModelsComplete,
								permissions
							});
						});
					} else {
						return console.warn(`Ignoring FETCH_GUEST_MODEL request since "${payload.path}" is not a valid path.`);
					}
					break;
				}
				case guestCheckOut.type: {
					requestedSourceMapPaths.current = {};
					dispatch(action);
					break;
				}
				case sortItemOperation.type: {
					const { fieldId, currentIndex, targetIndex } = payload;
					let { modelId, parentModelId } = payload;
					const path = models[modelId ?? parentModelId].craftercms.path;
					if (isInheritedField(models[modelId], fieldId)) {
						modelId = getModelIdFromInheritedField(models[modelId], fieldId, upToDateRefs.current.modelIdByPath);
						parentModelId = findParentModelId(modelId, upToDateRefs.current.hierarchyMap, models);
					}

					sortItem(
						siteId,
						modelId,
						fieldId,
						currentIndex,
						targetIndex,
						models[parentModelId ? parentModelId : modelId].craftercms.path
					).subscribe({
						next({ updatedDocument }) {
							const updatedModels = {};
							parseContentXML(
								updatedDocument,
								parentModelId ? models[parentModelId].craftercms.path : models[modelId].craftercms.path,
								contentTypes,
								updatedModels
							);
							dispatch(guestModelUpdated({ model: normalizeModel(updatedModels[modelId]) }));

							issueDescriptorRequest({
								site: siteId,
								path: path ?? models[parentModelId].craftercms.path,
								contentTypes,
								requestedSourceMapPaths,
								dispatch,
								completeActionCreator: fetchGuestModelsComplete,
								permissions
							});
							hostToHost$.next(sortItemOperationComplete(payload));
							updatedModifiedItem(path);
							enqueueSnackbar(formatMessage(guestMessages.sortOperationComplete));
						},
						error(error) {
							console.error(`${type} failed`, error);
							hostToHost$.next(sortItemOperationFailed());
							// If write operation fails the items remains locked, so we need to dispatch unlockItem
							dispatch(unlockItem({ path }));
							enqueueSnackbar(formatMessage(guestMessages.sortOperationFailed), { variant: 'error' });
						}
					});
					break;
				}
				case insertComponentOperation.type: {
					const {
						fieldId,
						targetIndex,
						instance,
						shared = false,
						create = false
					} = payload as InsertComponentOperationPayload;
					let { modelId, parentModelId } = payload;
					const model = models[parentModelId ?? modelId];
					const path = models[modelId ?? parentModelId].craftercms.path;
					const instanceContentType = contentTypes[instance.craftercms.contentTypeId];
					const parentContentType = contentTypes[model.craftercms.contentTypeId];

					if (isInheritedField(models[modelId], fieldId)) {
						modelId = getModelIdFromInheritedField(models[modelId], fieldId, modelIdByPath);
						parentModelId = findParentModelId(modelId, hierarchyMap, models);
					}

					const shouldSerializeFn = (instanceFieldId) =>
						upToDateRefs.current.cdataEscapedFieldPatterns.some((pattern) => Boolean(instanceFieldId.match(pattern)));

					// Cases:
					// - Shared new - shared: true, create: true -> insertComponent
					// - Shared existing - shared: true, create: false -> insertInstance
					// - Embedded new - shared: false, create: true -> insertComponent
					// * Embedded existing - shared: false, create: false -> insertInstance <- This case doesn't go through here, it goes by the move/sort operation.
					let serviceObservable = create
						? // region insertComponent
							insertComponent(
								siteId,
								models[parentModelId ? parentModelId : modelId].craftercms.path,
								modelId,
								fieldId,
								targetIndex,
								parentContentType,
								instance,
								instanceContentType,
								shared,
								shouldSerializeFn
							)
						: // endregion
							// region insertInstance
							insertInstance(
								siteId,
								models[parentModelId ? parentModelId : modelId].craftercms.path,
								modelId,
								fieldId,
								targetIndex,
								parentContentType,
								instance
							);
					// endregion

					// Writing the xml document for the component being inserted only applies to new & shared.
					if (shared && create) {
						let postWriteObs = serviceObservable;
						serviceObservable = writeInstance(siteId, instance, instanceContentType, shouldSerializeFn).pipe(
							switchMap(() => postWriteObs)
						);
					}

					serviceObservable.subscribe({
						next() {
							issueDescriptorRequest({
								site: siteId,
								path: path ?? models[parentModelId].craftercms.path,
								contentTypes,
								requestedSourceMapPaths,
								dispatch,
								completeActionCreator: fetchGuestModelsComplete,
								permissions
							});
							hostToGuest$.next(
								insertOperationComplete({
									...payload,
									currentFullUrl: `${guestBase}${upToDateRefs.current.currentUrlPath}`
								})
							);
							updatedModifiedItem(path);
							enqueueSnackbar(formatMessage(guestMessages.insertOperationComplete));
						},
						error(error) {
							console.error(`${type} failed`, error);
							hostToGuest$.next(insertOperationFailed());
							// If write operation fails the items remains locked, so we need to dispatch unlockItem
							dispatch(unlockItem({ path }));
							enqueueSnackbar(formatMessage(guestMessages.insertOperationFailed), { variant: 'error' });
						}
					});
					break;
				}
				case insertItemOperation.type: {
					const { modelId, parentModelId, fieldId, index, instance } = payload;
					const path = models[parentModelId ?? modelId].craftercms.path;
					insertItem(siteId, modelId, fieldId, index, instance, path, (instanceFieldId) =>
						upToDateRefs.current.cdataEscapedFieldPatterns.some((pattern) => Boolean(instanceFieldId.match(pattern)))
					).subscribe({
						next() {
							hostToGuest$.next(insertItemOperationComplete());
							enqueueSnackbar(formatMessage(guestMessages.insertItemOperationComplete));
						},
						error(error) {
							console.error(`${type} failed`, error);
							hostToGuest$.next(insertItemOperationFailed());
							// If write operation fails the items remains locked, so we need to dispatch unlockItem
							dispatch(unlockItem({ path }));
							enqueueSnackbar(formatMessage(guestMessages.insertItemOperationFailed), { variant: 'error' });
						}
					});
					break;
				}
				case duplicateItemOperation.type: {
					const { modelId, parentModelId, fieldId, index } = payload;
					const path = models[parentModelId ?? modelId].craftercms.path;
					duplicateItem(siteId, modelId, fieldId, index, path).subscribe({
						next({ newItem }) {
							issueDescriptorRequest({
								site: siteId,
								path: newItem.path,
								contentTypes,
								requestedSourceMapPaths,
								dispatch,
								completeActionCreator: fetchPrimaryGuestModelComplete,
								permissions
							});
							hostToGuest$.next(duplicateItemOperationComplete());
							enqueueSnackbar(formatMessage(guestMessages.duplicateItemOperationComplete));
						},
						error(error) {
							console.error(`${type} failed`, error);
							hostToGuest$.next(duplicateItemOperationFailed());
							// If write operation fails the items remains locked, so we need to dispatch unlockItem
							dispatch(unlockItem({ path }));
							enqueueSnackbar(formatMessage(guestMessages.duplicateItemOperationFailed), { variant: 'error' });
						}
					});
					break;
				}
				case moveItemOperation.type: {
					const { originalFieldId, originalIndex, targetFieldId, targetIndex } = payload;
					let { originalModelId, originalParentModelId, targetModelId, targetParentModelId } = payload;
					const originPath = models[originalParentModelId ? originalParentModelId : originalModelId].craftercms.path;
					const targetPath = models[targetParentModelId ? targetParentModelId : targetModelId].craftercms.path;

					if (isInheritedField(models[originalModelId], originalFieldId)) {
						originalModelId = getModelIdFromInheritedField(models[originalModelId], originalFieldId, modelIdByPath);
						originalParentModelId = findParentModelId(originalModelId, hierarchyMap, models);
					}

					if (isInheritedField(models[targetModelId], targetFieldId)) {
						targetModelId = getModelIdFromInheritedField(models[targetModelId], targetFieldId, modelIdByPath);
						targetParentModelId = findParentModelId(targetModelId, hierarchyMap, models);
					}

					moveItem(
						siteId,
						originalModelId,
						originalFieldId,
						originalIndex,
						targetModelId,
						targetFieldId,
						targetIndex,
						originPath,
						targetPath
					).subscribe({
						next() {
							hostToGuest$.next(moveItemOperationComplete());
							dispatch(
								batchActions([
									reloadContentItem({
										path: originPath
									}),
									reloadContentItem({
										path: targetPath
									})
								])
							);
							enqueueSnackbar(formatMessage(guestMessages.moveOperationComplete));
						},
						error(error) {
							console.error(`${type} failed`, error);
							hostToGuest$.next(moveItemOperationFailed());
							// If write operation fails the items remains locked, so we need to dispatch unlockItem
							dispatch(batchActions([unlockItem({ path: originPath }), unlockItem({ path: targetPath })]));
							enqueueSnackbar(formatMessage(guestMessages.moveOperationFailed), { variant: 'error' });
						}
					});
					break;
				}
				case deleteItemOperation.type: {
					const { fieldId, index } = payload;
					let { modelId, parentModelId } = payload;
					const path = models[modelId ?? parentModelId].craftercms.path;

					({ modelId, parentModelId } = getInheritanceParentIdsForField(
						fieldId,
						models,
						modelId,
						parentModelId,
						modelIdByPath,
						hierarchyMap
					));

					deleteItem(
						siteId,
						modelId,
						fieldId,
						index,
						models[parentModelId ? parentModelId : modelId].craftercms.path
					).subscribe({
						next: () => {
							issueDescriptorRequest({
								site: siteId,
								path: path ?? models[parentModelId].craftercms.path,
								contentTypes,
								requestedSourceMapPaths,
								dispatch,
								completeActionCreator: fetchGuestModelsComplete,
								permissions
							});

							hostToHost$.next(deleteItemOperationComplete(payload));
							updatedModifiedItem(path);
							enqueueSnackbar(formatMessage(guestMessages.deleteOperationComplete));
						},
						error: (error) => {
							console.error(`${type} failed`, error);
							hostToHost$.next(deleteItemOperationFailed());
							// If write operation fails the items remains locked, so we need to dispatch unlockItem
							dispatch(unlockItem({ path }));
							enqueueSnackbar(formatMessage(guestMessages.deleteOperationFailed), { variant: 'error' });
						}
					});
					break;
				}
				case updateFieldValueOperation.type: {
					const { fieldId, index, value } = payload;
					let { modelId, parentModelId } = payload;
					let path = models[parentModelId ? parentModelId : modelId].craftercms.path;

					if (isInheritedField(models[modelId], fieldId)) {
						modelId = getModelIdFromInheritedField(models[modelId], fieldId, modelIdByPath);
						path = models[modelId].craftercms.path;
					}

					updateField(
						siteId,
						modelId,
						fieldId,
						index,
						path,
						value,
						upToDateRefs.current.cdataEscapedFieldPatterns.some((pattern) => Boolean(fieldId.match(pattern)))
					)
						.pipe(switchMap(() => fetchContentItemService(siteId, path)))
						.subscribe({
							next(item) {
								hostToGuest$.next(updateFieldValueOperationComplete({ item }));
								updatedModifiedItem(path);
								enqueueSnackbar(formatMessage(guestMessages.updateOperationComplete));
							},
							error(error) {
								console.error(`${type} failed`, error);
								dispatch(unlockItem({ path }));
								hostToGuest$.next(updateFieldValueOperationFailed());
								enqueueSnackbar(formatMessage(guestMessages.updateOperationFailed), { variant: 'error' });
							}
						});
					break;
				}
				case iceZoneSelected.type: {
					dispatch(selectForEdit(payload));
					break;
				}
				case clearSelectedZones.type: {
					dispatch(clearSelectForEdit());
					break;
				}
				case instanceDragBegun.type:
				case instanceDragEnded.type: {
					dispatch(setItemBeingDragged(type === instanceDragBegun.type ? payload : null));
					break;
				}
				case contentTypeDropTargetsResponse.type: {
					dispatch(setContentTypeDropTargets(payload));
					break;
				}
				case snackGuestMessage.type: {
					enqueueSnackbar(
						payload.id in guestMessages
							? formatMessage(guestMessages[payload.id], payload.values ?? {})
							: (payload.message ?? payload.id),
						{
							variant: payload.level
								? payload.level === 'required'
									? 'error'
									: payload.level === 'suggestion'
										? 'warning'
										: 'info'
								: null
						}
					);
					break;
				}
				case hotKey.type: {
					upToDateRefs.current.onShortCutKeypress(payload);
					break;
				}
				case showEditDialogAction.type: {
					dispatch(
						pickShowContentFormAction({
							authoringBase,
							path: upToDateRefs.current.guest.path,
							selectedFields: payload.selectedFields,
							site: siteId
						})
					);
					break;
				}
				case updateRteConfig.type: {
					// @ts-ignore - TODO: type action accordingly
					getHostToGuestBus().next(updateRteConfig({ rteConfig: upToDateRefs.current.rteConfig ?? {} }));
					break;
				}
				case requestEdit.type: {
					let { store } = upToDateRefs.current;
					const { modelId, parentModelId, fields, typeOfEdit: type, index } = payload;
					const path = models[parentModelId ? parentModelId : modelId].craftercms.path;
					let item = store.getState().content.itemsByPath[path];
					const model = models[modelId] as ContentInstance;
					const contentType = contentTypes[model.craftercms.contentTypeId];
					if (type === 'content') {
						// Not quite sure if it ever happens that the item isn't already loaded.
						(item ? (of(item) as Observable<ContentItem>) : fetchContentItemService(siteId, path)).subscribe((item) => {
							itemActionDispatcher({
								item,
								site: siteId,
								option: 'edit',
								dispatch,
								authoringBase,
								formatMessage,
								extraPayload: {
									modelId: parentModelId ? modelId : null,
									selectedFields: fields,
									index
								}
							});
						});
					} else if (type === 'template') {
						dispatch(editContentTypeTemplate({ contentTypeId: contentType.id }));
					} else {
						dispatch(editControllerActionCreator(contentType.type, contentType.id));
					}
					break;
				}
				case requestWorkflowCancellationDialog.type: {
					dispatch(
						pushDialog({
							component: createComponentId('ViewPackagesDialog'),
							props: {
								item: payload.item,
								onClosed: () => dispatch(requestWorkflowCancellationDialogOnResult({ type: 'close' })),
								onContinue: (cancelPackagesComment) =>
									dispatch(requestWorkflowCancellationDialogOnResult({ type: 'continue', cancelPackagesComment }))
							}
						})
					);
					break;
				}
				case showItemMegaMenu.type: {
					const extendedAction = action as StandardAction<Partial<ItemMegaMenuStateProps>>;
					const iframe: HTMLIFrameElement = document.querySelector('#crafterCMSPreviewIframe');
					const iframeRect = iframe.getBoundingClientRect();
					const id = 'xbItemMegaMenuClosed';
					extendedAction.payload.anchorPosition.top += iframeRect.top;
					extendedAction.payload.anchorPosition.left += iframeRect.left;
					extendedAction.payload.onClosed = batchActions([itemMegaMenuClosed(), dispatchDOMEvent({ id })]);
					createCustomDocumentEventListener(id, () => iframe.contentWindow.focus());
					dispatch(action);
					break;
				}
				case showImageEditorDialog.type: {
					const id = nanoid();
					const { path, restrictions, writeContent, fileName, recordId, uploadPath } = action.payload;
					dispatch(
						pushDialog({
							id,
							component: createComponentId('ImageEditorDialog'),
							props: {
								path,
								subtitle: restrictions ? <ImageRestrictionSubtitle restrictions={restrictions} /> : undefined,
								restrictions,
								writeContent,
								onCrop: (blob: Blob, newPath: string) => {
									dispatch(popDialog({ id }));
									hostToGuest$.next({
										type: imageEdited.type,
										payload: { blob, newPath, fileName, recordId, uploadPath }
									});
								},
								onClose: () => {
									dispatch(popDialog({ id }));
									hostToGuest$.next({
										type: imageEditCancelled.type,
										payload: { fileName, recordId, uploadPath }
									});
								}
							}
						})
					);
					break;
				}
				// region actions whitelisted
				case unlockItem.type:
				case errorPageCheckIn.type:
				case allowedContentTypesUpdate.type: {
					dispatch(action);
					break;
				}
				// endregion
				case showRtePickerActions.type: {
					const typedPayload: ShowRtePickerActionsPayload = payload;
					const { setDataSourceActionsListState, showToolsPanel, toolsPanelWidth, browseFilesDialogState } =
						upToDateRefs.current;
					const onShowSingleFileUploadDialog = (path: string, type: 'image' | 'audio' | 'video') => {
						setDataSourceActionsListState(dataSourceActionsListInitialState);

						if (path) {
							const dialogId = nanoid();
							dispatch(
								pushDialog({
									id: dialogId,
									component: createComponentId('SingleFileUploadDialog'),
									props: {
										site: siteId,
										path,
										fileTypes: type === 'image' ? ['image/*'] : type === 'video' ? ['video/*'] : ['audio/*'],
										onClose: () => {
											onRtePickerResult();
											dispatch(popDialog({ id: dialogId }));
										},
										onUploadComplete: ({ successful: response }) => {
											const file = response[0];
											const filePath = `${file.meta.path}${file.meta.path.endsWith('/') ? '' : '/'}${file.meta.name}`;
											onRtePickerResult({ path: filePath, name: file.meta.name });
											dispatch(popDialog({ id: dialogId }));
										}
									}
								})
							);
						} else {
							dispatch(
								showSystemNotification({
									message: formatMessage(guestMessages.noPathSetInDataSource)
								})
							);
						}
					};

					const onShowBrowseFilesDialog = (path: string, type: 'image' | 'audio' | 'video' | 'file') => {
						const mimeTypes =
							type === 'image'
								? ['image/png', 'image/jpeg', 'image/gif', 'image/jpg']
								: type === 'video'
									? ['video/mp4']
									: type === 'audio'
										? ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav']
										: null;
						setDataSourceActionsListState(dataSourceActionsListInitialState);

						if (path) {
							setBrowseFilesDialogPath(path);
							setBrowseFilesDialogMimeTypes(mimeTypes);
							browseFilesDialogState.onOpen();
						} else {
							dispatch(
								showSystemNotification({
									message: formatMessage(guestMessages.noPathSetInDataSource)
								})
							);
						}
					};

					const dataSourcesByType = {
						image: ['allowImageUpload', 'allowImagesFromRepo'],
						media: ['allowVideoUpload', 'allowVideosFromRepo', 'allowAudioUpload', 'allowAudioFromRepo'],
						file: ['allowFilesFromRepo']
					};

					// Tinymce handles both audio and video as 'media' types. This lookup is used to determine which type of media to handle.
					const mediaTypes = {
						allowAudioUpload: 'audio',
						allowAudioFromRepo: 'audio',
						allowVideoUpload: 'video',
						allowVideosFromRepo: 'video',
						allowFilesFromRepo: 'file'
					};

					// filter data sources to only the ones that match the type
					const dataSourcesKeys = Object.keys(typedPayload.datasources).filter((datasourceId) =>
						dataSourcesByType[typedPayload.type]?.includes(datasourceId)
					);

					// directly open corresponding dialog
					if (dataSourcesKeys.length === 1) {
						// determine if upload or browse
						const key = dataSourcesKeys[0];
						const processedPath = processPathMacros({
							path: typedPayload.datasources[key].value,
							objectId: typedPayload.model.craftercms.id,
							objectGroupId: typedPayload.model.objectGroupId
						});
						if (key === 'allowImageUpload' || key === 'allowVideoUpload' || key === 'allowAudioUpload') {
							onShowSingleFileUploadDialog(processedPath, mediaTypes[key] ?? typedPayload.type);
						} else {
							onShowBrowseFilesDialog(processedPath, mediaTypes[key] ?? typedPayload.type);
						}
					} else if (dataSourcesKeys.length > 1) {
						// create items for DataSourcesActionsList
						const dataSourcesItems = [];
						dataSourcesKeys.forEach((dataSourceKey) => {
							dataSourcesItems.push({
								label: formatMessage(guestMessages[dataSourceKey]),
								path: processPathMacros({
									path: typedPayload.datasources[dataSourceKey].value,
									objectId: typedPayload.model.objectId,
									objectGroupId: typedPayload.model.objectGroupId
								}),
								action:
									dataSourceKey === 'allowImageUpload' ||
									dataSourceKey === 'allowVideoUpload' ||
									dataSourceKey === 'allowAudioUpload'
										? onShowSingleFileUploadDialog
										: onShowBrowseFilesDialog,
								type: mediaTypes[dataSourceKey] ?? typedPayload.type
							});
						});

						const { left, top, height } = typedPayload.rect;
						setDataSourceActionsListState({
							show: true,
							items: dataSourcesItems,
							rect: {
								...typedPayload.rect,
								left: left + (showToolsPanel ? toolsPanelWidth : 0),
								top: top + height * 3 // To position correctly under the button
							}
						});
					} else if (dataSourcesKeys.length === 0) {
						dispatch(
							showSystemNotification({
								message: formatMessage(guestMessages.noDataSourcesSet)
							})
						);
					}
				}
			}
		});
		return () => {
			guestToHostSubscription.unsubscribe();
		};
	}, [upToDateRefs]);

	// hostToHost$ subscription
	useEffect(() => {
		const hostToHost$ = getHostToHostBus();
		const hostToGuest$ = getHostToGuestBus();
		const hostToHostSubscription = hostToHost$.subscribe(({ type, payload }) => {
			const { guest, user, enqueueSnackbar, formatMessage } = upToDateRefs.current;
			switch (type) {
				case pluginUninstalled.type:
				case contentTypeCreated.type:
				case contentTypeUpdated.type:
				case contentTypeDeleted.type:
				case pluginInstalled.type: {
					dispatch(fetchContentTypes());
					break;
				}
				case contentEvent.type: {
					const { user: person, targetPath } = payload as SocketEventBase;
					const { theme } = upToDateRefs.current;
					if (
						person.username !== user.username &&
						guest &&
						(guest.path === targetPath || guest.modelIdByPath[targetPath])
					) {
						enqueueSnackbar(
							formatMessage(guestMessages.contentWasChangedByAnotherUser, {
								name: getPersonFullName(person)
							}),
							{
								action: (
									<IconButton
										size="small"
										onClick={() => hostToGuest$.next(reloadRequest())}
										sx={{ color: `common.${theme.palette.mode === 'light' ? 'white' : 'black'}` }}
									>
										<RefreshRounded />
									</IconButton>
								),
								autoHideDuration: 10000
							}
						);
					}
					break;
				}
				case lockContentEvent.type: {
					const { user: person, targetPath, locked } = payload as SocketEventBase & { locked: boolean };
					if (locked && guest?.path === targetPath && person.username !== user.username) {
						enqueueSnackbar(
							formatMessage(guestMessages.contentWasLockedByAnotherUser, {
								name: getPersonFullName(person)
							})
						);
					}
					break;
				}
			}
		});
		return () => {
			hostToHostSubscription.unsubscribe();
		};
	}, [dispatch, upToDateRefs]);

	// Guest detection
	useEffect(() => {
		if (priorState.current.site !== siteId) {
			priorState.current.site = siteId;
			if (guest) {
				// Changing the site will force-reload the iFrame and 'beforeunload'
				// event won't trigger withing; guest won't be submitting it's own checkout
				// in such cases.
				dispatch(guestCheckOut({ path: guest.path }));
			}
		}
	}, [siteId, guest, dispatch]);

	// Initialize RTE config
	useEffect(() => {
		if (nnou(uiConfig.xml) && !rteConfig) {
			dispatch(initRichTextEditorConfig({ configXml: uiConfig.xml, siteId }));
		}
	}, [uiConfig.xml, siteId, rteConfig, dispatch]);

	// Host hotkeys
	useHotkeys(
		'a,r,e,m,p,shift+slash,shift+e',
		(e) => {
			upToDateRefs.current.onShortCutKeypress(e);
		},
		{ keyup: true, keydown: false }
	);

	// Guest hotkeys
	useHotkeys(
		'z',
		(e) => {
			getHostToGuestBus().next(
				hotKey({ key: e.key, type: e.type as 'keyup', shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey })
			);
		},
		{ keyup: true, keydown: true }
	);

	return (
		<>
			{props.children}
			<RubbishBin
				open={nnou(guest?.itemBeingDragged)}
				onTrash={() => getHostToGuestBus().next({ type: trashed.type, payload: guest.itemBeingDragged })}
			/>
			<EditFormPanel
				open={nnou(guest?.selected)}
				onDismiss={() => {
					dispatch(clearSelectForEdit());
					getHostToGuestBus().next(clearSelectedZones());
				}}
			/>
			<KeyboardShortcutsDialog
				open={keyboardShortcutsDialogState.open}
				onClose={keyboardShortcutsDialogState.onClose}
				isMinimized={keyboardShortcutsDialogState.isMinimized}
				hasPendingChanges={keyboardShortcutsDialogState.hasPendingChanges}
				shortcuts={previewKeyboardShortcuts}
				isSubmitting={keyboardShortcutsDialogState.isSubmitting}
			/>
			<BrowseFilesDialog
				open={browseFilesDialogState.open}
				path={browseFilesDialogPath}
				mimeTypes={browseFilesDialogMimeTypes}
				onSuccess={(response: MediaItem) => {
					browseFilesDialogState.onClose();
					onRtePickerResult({ path: response.path, name: response.name });
				}}
				onClose={() => {
					browseFilesDialogState.onClose();
					onRtePickerResult();
				}}
				hasPendingChanges={browseFilesDialogState.hasPendingChanges}
				isMinimized={browseFilesDialogState.isMinimized}
				isSubmitting={browseFilesDialogState.isSubmitting}
			/>
			<DataSourcesActionsList
				{...dataSourceActionsListState}
				onClose={() => setDataSourceActionsListState({ show: false })}
			/>
		</>
	);
}

export default PreviewConcierge;
