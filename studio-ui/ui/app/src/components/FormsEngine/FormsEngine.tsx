/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { FormattedMessage, useIntl } from 'react-intl';
import { useDispatch } from 'react-redux';
import useActiveSite from '../../hooks/useActiveSite';
import useContentTypes from '../../hooks/useContentTypes';
import React, {
	createElement,
	type RefCallback,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { ContentTypeField, PublishPackage } from '../../models';
import {
	FormsEngineAtoms,
	FormsEngineEditContextProps,
	FormsEngineFormApiContextProps,
	FormsEngineFormContextApi,
	FormsEngineGlobalApiContextProps,
	FormsEngineItemMetaContextProps,
	ItemContext,
	ItemMetaContext,
	RenamedPathContext,
	StableFormContext,
	StableFormContextProps,
	StableGlobalContext,
	StableGlobalContextProps
} from './lib/formsEngineContext';
import { fetchContentItemComplete } from '../../state/actions/content';
import { catchError, of } from 'rxjs';
import LoadingState from '../LoadingState';
import Paper, { paperClasses } from '@mui/material/Paper';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Drawer, { drawerClasses, DrawerProps } from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import MinimizeIconRounded from '@mui/icons-material/RemoveRounded';
import MaximiseIcon from '@mui/icons-material/OpenInFullRounded';
import CloseFullscreenOutlined from '@mui/icons-material/CloseFullscreenOutlined';
import Close from '@mui/icons-material/Close';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import { createErrorStatePropsFromApiResponse } from '../ApiResponseErrorState';
import Button, { ButtonProps } from '@mui/material/Button';
import { StickyBox } from './components/StickyBox';
import MenuRounded from '@mui/icons-material/MenuRounded';
import { EnhancedDialogProps } from '../EnhancedDialog';
import useEnhancedDialogContext from '../EnhancedDialog/useEnhancedDialogContext';
import { EditOffOutlined } from '@mui/icons-material';
import LookupTable from '../../models/LookupTable';
import { RepeatItem } from './controls/Repeat';
import SecondaryButton from '../SecondaryButton';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { Fade } from '@mui/material';
import AlertTitle from '@mui/material/AlertTitle';
import { pushDialog } from '../../state/actions/dialogStack';
import useFetchContentItems from '../../hooks/useFetchContentItems';
import ErrorBoundary from '../ErrorBoundary';
import { debounceTime } from 'rxjs/operators';
import { atom, createStore, Provider, useAtom, useAtomValue, useStore as useJotaiStore } from 'jotai';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import useSelection from '../../hooks/useSelection';
import ApiResponse from '../../models/ApiResponse';
import { PrimitiveAtom } from 'jotai/index';
import { AjaxError } from 'rxjs/ajax';
import { ViewPackagesDialogProps } from '../ViewPackagesDialog';
import {
	buildSectionExpandedStateAtoms,
	createFileNameAtom,
	createFormsEngineAtoms,
	createFormStackData,
	createObjectWithSystemProps,
	createReadonlyAtom,
	createStackedFormKey,
	displayFormBeingSavedSnack,
	fetchUpdateRequirements,
	generateDefaultChangesComment,
	generateDefaultCreationComment,
	getAdditionalFieldsIdsFromDescriptor,
	resolveControlDescriptors,
	getCurrentChildFormStateSummary,
	getScrollContainer,
	getTargetHeight,
	internalLockContentService,
	internalUnlockContentService,
	prepareEmbeddedItemForm,
	produceCreationMessage,
	setFieldAtoms,
	useUnlockOnClose,
	useValidateFormProps
} from './lib/formUtils';
import { renderFieldControl } from './lib/controlHelpers';
import {
	ContentTypeNotFoundError,
	ItemNotFoundError,
	stackFormCountAtom,
	UnknownError,
	XmlKeys
} from './lib/formConsts';
import FormLayout from './components/FormLayout';
import TableOfContents from './components/TableOfContents';
import CreateModeHeader from './components/CreateModeHeader';
import RepeatModeHeader from './components/RepeatModeHeader';
import EditModeHeader from './components/EditModeHeader';
import SaveCard from './components/SaveCard';
import SectionAccordion from './components/SectionAccordion';
import useSaveForm from './lib/useSaveForm';
import { FormPrepError } from './components/FormPrepError';
import { createParsedValuesObject } from './lib/valueRetrievers';
import { fromString } from '../../utils/xml';
import { displayWithPendingChangesConfirm } from '../../utils/ui';
import useActiveUser from '../../hooks/useActiveUser';
import FormBackToTop from './components/FormBackToTop';
import { createComponentId } from '../../utils/system';
import {
	workflowEventApprove,
	workflowEventCancel,
	workflowEventDirectPublish,
	workflowEventReject,
	workflowEventSubmit
} from '../../state/actions/system';
import { getHostToHostBus } from '../../utils/subjects';
import { fetchAffectedPackages } from '../../services/workflow';
import useMount from '../../hooks/useMount';
import { nnou, nou } from '../../utils/object';
import { buildContentXml } from './lib/valueSerializers';
import { processPathMacros } from '../../utils/path';

export interface FormSavePromiseResult {
	close: boolean;
}

export interface BaseProps extends Partial<UpdateModeProps & RepeatModeProps & CreateModeProps> {
	stackIndex?: number;
	stackTransitionEnded?: boolean;
	readonly?: boolean;
	/** Whether the form is rendered in a dialog. Causes various layout adjustments. **/
	isDialog?: boolean;
	onClose?: EnhancedDialogProps['onClose'];
	onMinimize?: EnhancedDialogProps['onMinimize'];
	onFullScreen?: EnhancedDialogProps['onFullScreen'];
	onCancelFullScreen?: EnhancedDialogProps['onCancelFullScreen'];
	/** The form will render only the specified fields from the main content type being worked with */
	fieldsToRender?: ContentTypeField[];
	// Controls like the Item Selector and Repeat use the onSave to update once the form they opened is "saved".
	// Executing the onClose without the "timeout", causes values set at the control prior to closing to get lost somehow.
	// The promise works as a timeout and allows the control to do async operations before the form acts on its result.
	onSave?(result: {
		// The `dom` and `xml` properties are not applicable for repeat forms
		dom?: Document | Element;
		xml?: string;
		values: LookupTable<unknown>;
		versionComment: string;
		path?: string;
	}): Promise<FormSavePromiseResult> | void;
}

export interface UpdateModeProps {
	update: {
		path: string;
		modelId?: string;
		values?: LookupTable<unknown>;
		changeTypeId?: string; // Allows specifying a different content type for the item being updated, overriding the current item's content type.
	};
}

export interface RepeatModeProps {
	repeat: {
		fieldId: string;
		index?: number;
		values?: RepeatItem;
	};
}

export interface CreateModeProps {
	create: {
		path: string;
		contentTypeId: string;
		embedded?: boolean;
	};
}

export type FormsEngineProps = BaseProps & (UpdateModeProps | RepeatModeProps | CreateModeProps);

// Entry point for the form engine. It validates the props and continues if valid.
function FormGuard(props: FormsEngineProps) {
	try {
		useValidateFormProps(props);
	} catch (e) {
		if (typeof e !== 'symbol') {
			console.error(e);
		}
		return <FormPrepError error={e} />;
	}
	return createElement(GlobalFormsState, props);
}

// It sets up the Jotai store and the global form context.
function GlobalFormsState(props: FormsEngineProps) {
	const store = useMemo(() => createStore(), []); // TODO: Use stable memo?
	const stableGlobalContextRef = useRef<StableGlobalContextProps>(undefined);
	if (!stableGlobalContextRef.current) {
		stableGlobalContextRef.current = {
			api: null,
			formsStackData: [createFormStackData({ props })]
		};
	}
	stableGlobalContextRef.current.api = useMemo<FormsEngineGlobalApiContextProps>(() => {
		const setCount = (factor: 1 | -1) => {
			const currentCount = store.get(stackFormCountAtom);
			store.set(stackFormCountAtom, currentCount + factor);
		};
		const api: FormsEngineGlobalApiContextProps = {
			pushForm(props) {
				stableGlobalContextRef.current.formsStackData.push(createFormStackData({ props }));
				setCount(1);
			},
			popForm() {
				stableGlobalContextRef.current.formsStackData.pop();
				setCount(-1);
			},
			updateProps(stackIndex, formProps) {
				stableGlobalContextRef.current.formsStackData[stackIndex].props = formProps;
			},
			setStateCache(stackIndex, state) {
				stableGlobalContextRef.current.formsStackData[stackIndex].state = state;
			}
		};
		return api;
	}, [store]);
	return (
		<ErrorBoundary>
			<StableGlobalContext.Provider value={stableGlobalContextRef.current}>
				<Provider store={store}>{createElement(FormBootstrap, props)}</Provider>
			</StableGlobalContext.Provider>
		</ErrorBoundary>
	);
}

// Fetches the requirements for the form and sets up various contexts.
function FormBootstrap(props: FormsEngineProps) {
	// When creating a new item. If we save the form, and do not close it, we need to update the 'mode' from create to update, using the path of the created item.
	// effectiveProps are the props that are used to render the form, considering the scenario mentioned above.
	const [savedCreatePath, setSavedCreatePath] = useState<string | null>(null);
	const effectiveProps = useMemo((): FormsEngineProps => {
		if (!savedCreatePath) return props;
		const { create: _create, ...rest } = props;
		return { ...rest, update: { path: savedCreatePath } };
	}, [props, savedCreatePath]);
	const { create, update, repeat, fieldsToRender, readonly: readonlyProp, stackIndex = 0, isDialog } = effectiveProps;
	const siteId = useActiveSiteId();
	const dispatch = useDispatch();
	const contentTypesById = useContentTypes();
	const [contentTypesLoaded, setContentTypesLoaded] = useState(Boolean(contentTypesById));
	const { formsStackData, api } = useContext(StableGlobalContext);
	const [itemMeta, setItemMeta] = useState<FormsEngineItemMetaContextProps>(formsStackData[stackIndex].itemMeta);
	const [ready, setReady] = useState(false);
	const [prepError, setPrepError] = useState<symbol>();
	const store = useJotaiStore();
	const theme = useTheme();
	const { isFullScreen = false } = useEnhancedDialogContext() ?? {};
	const username = useActiveUser()?.username;
	const effectRefs = useUpdateRefs({ contentTypesById, username });
	const stableFormContextRef = useRef<StableFormContextProps>(formsStackData[stackIndex]);
	const [renamedPath, setRenamedPath] = useState<string | null>(null);
	const [reloadNonce, setReloadNonce] = useState(0);
	const triggerReload = useCallback(() => setReloadNonce((nonce) => nonce + 1), []);
	const effectiveUpdatePath = renamedPath ?? update?.path;
	const customControls = useSelection((state) => state.uiConfig.controls);
	const { formatMessage } = useIntl();

	const contextApi = useMemo<FormsEngineFormApiContextProps>(() => {
		const getInitialValues = () => stableFormContextRef.current.originalValues;
		const rollbackAtom = (atom: PrimitiveAtom<unknown>, value: unknown) => store.set(atom, value);
		const internalRollbackValue = (initialValues: LookupTable<unknown>, fieldId: string) => {
			const value = initialValues[fieldId];
			const atom = stableFormContextRef.current.atoms.valueByFieldId[fieldId];
			rollbackAtom(atom, value);
		};
		const api: FormsEngineFormApiContextProps = {
			rollback() {
				const initialValues = getInitialValues();
				Object.keys(initialValues).forEach((fieldId) => {
					internalRollbackValue(initialValues, fieldId);
				});
			},
			rollbackField(fieldId: string) {
				internalRollbackValue(getInitialValues(), fieldId);
			},
			setValuesCheckpoint(values: LookupTable<unknown>) {
				stableFormContextRef.current.originalValues = values;
				stableFormContextRef.current.changedFieldIds.clear();
			}
		};
		return api;
	}, [store]);

	const liveUpdatedItem = useSelection((state) =>
		// If we're in create mode, there's no item yet. If updating, we can get the path from props or parent props in the case of repeat mode.
		create
			? null
			: state.content.itemsByPath[effectiveUpdatePath ?? formsStackData[stackIndex - 1]?.props?.update?.path]
	);

	api.updateProps(stackIndex, effectiveProps);

	useEffect(() => {
		if (!create && !repeat && !liveUpdatedItem) setReady(false);
	}, [liveUpdatedItem, create, repeat]);

	useEffect(() => {
		contentTypesById && setContentTypesLoaded(true);
	}, [contentTypesById]);

	// Fetch/prepare requirements
	useEffect(() => {
		// Guard statement: If content types are not loaded, we can't proceed.
		if (!contentTypesLoaded) return;
		// TODO: If props are changed, things can be left off... previous item locked, edits get lost, etc. Not sure how much support for prop changes we should implement.
		const isChildForm = stackIndex > 0;
		// In the form stack, the present form being opened would be in the last position [length-1], the parent form state would be on [length-2] if it is nested (e.g. Root => Component(L1) => Repeat(L2)|Component(L2)). Otherwise,the parent should be the root.
		const parentStackData = isChildForm ? formsStackData[stackIndex - 1] : null;
		const parentAtoms = isChildForm ? parentStackData.atoms : null;
		const {
			id: parentId,
			contentType: parentContentType,
			pathInSite: parentPathInSite,
			path: parentPath
		} = parentStackData?.itemMeta ?? {};
		const initializeState = (
			atoms: FormsEngineAtoms,
			values: LookupTable<unknown>,
			itemMeta: FormsEngineItemMetaContextProps
		) => {
			stableFormContextRef.current.atoms = atoms;
			stableFormContextRef.current.originalValues = values;
			stableFormContextRef.current.itemMeta = itemMeta;
			setItemMeta(stableFormContextRef.current.itemMeta);
			setReady(true);
		};
		if (
			// A repeat group is being opened as a stacked form.
			isChildForm &&
			repeat?.fieldId
		) {
			const contentType = parentContentType ? effectRefs.current.contentTypesById[parentContentType.id] : undefined;
			if (!contentType) return setPrepError(ContentTypeNotFoundError);
			const parentLockResult = store.get(parentAtoms.lockResult);
			const isParentLocked = parentLockResult.locked;
			const isCreate = nou(parentPath);
			const lockResultAtom = atom<FormsEngineEditContextProps>({
				locked: isCreate ? true : isParentLocked,
				lockError: parentLockResult.lockError,
				affectedPackages: parentLockResult.affectedPackages
			});
			const atoms = createFormsEngineAtoms(effectRefs.current.username, {
				lockResult: lockResultAtom,
				readonly: createReadonlyAtom(lockResultAtom),
				expandedStateBySectionId: buildSectionExpandedStateAtoms(contentType.sections),
				fileName: atom('')
			});
			const atomValueCreator: Parameters<typeof createParsedValuesObject>[3] = (fieldId, value, isAdditional) => {
				setFieldAtoms(
					stableFormContextRef,
					contentType,
					contentType.fields[repeat.fieldId].fields,
					fieldId,
					atoms,
					value,
					{ siteId, contentTypesById: effectRefs.current.contentTypesById },
					isAdditional
				);
			};
			const values = repeat.values
				? { ...repeat.values }
				: createParsedValuesObject(
						fieldsToRender,
						{},
						effectRefs.current.contentTypesById,
						atomValueCreator,
						customControls
					);

			const descriptors = resolveControlDescriptors(customControls);
			const additionalFieldsIds: string[] = [];
			// If repeat.values was provided, `createCleanValuesObject` didn't run; hence, atomValueCreator needs to be run manually.
			if (repeat.values) {
				// First gather all additional fields ids from the provided values
				(fieldsToRender ?? []).forEach((field) => {
					const descriptor = descriptors[field.type];
					if (!descriptor) return;
					additionalFieldsIds.push(...getAdditionalFieldsIdsFromDescriptor(field.id, descriptor));
				});
				// Ensure descriptor additional fields exist in values so atoms are created
				additionalFieldsIds.forEach((additionalFieldId) => {
					if (!(additionalFieldId in values)) {
						values[additionalFieldId] = undefined;
					}
				});
				// Run atomValueCreator for each field considering the additional fields
				Object.keys(values).forEach((fieldId) => {
					const isAdditional = additionalFieldsIds.includes(fieldId);
					atomValueCreator(fieldId, values[fieldId], isAdditional);
				});
			}

			const xmlDoc = fromString(parentStackData.itemMeta.contentXml ?? '');
			const fieldId = repeat.fieldId;
			const index = repeat.index ?? 0;
			const element = xmlDoc?.querySelector(`:scope > ${fieldId}`)?.children[index];
			const contentObject =
				(parentStackData.itemMeta.contentObject[fieldId] as { item: Array<LookupTable<unknown>> })?.item?.[index] ?? {};

			initializeState(atoms, values, {
				id: parentId,
				path: parentPath,
				sourceMap: null,
				pathInSite: parentPathInSite,
				contentType: parentContentType,
				contentObject,
				contentXml: element?.outerHTML ?? ''
			});
		} else if (
			// An embedded component is being opened as a stacked form.
			isChildForm &&
			update?.modelId
		) {
			const contentType = effectRefs.current.contentTypesById[update.values[XmlKeys.contentTypeId] as string];
			if (!contentType) return setPrepError(ContentTypeNotFoundError);
			const isParentReadonly = store.get(parentAtoms.readonly);
			const readonly = readonlyProp ?? isParentReadonly;
			const parentLockResult = store.get(parentAtoms.lockResult);
			const isParentLocked = parentLockResult.locked;
			const invokePrepareFn = (locked: boolean, lockError: ApiResponse, affectedPackages: PublishPackage[]) => {
				const requirements = prepareEmbeddedItemForm({
					username,
					contentType,
					locked,
					lockError,
					affectedPackages,
					update,
					parentStackData,
					stableFormContextRef,
					parentPathInSite,
					siteId,
					contentTypesById: effectRefs.current.contentTypesById,
					customControls
				});
				initializeState(requirements.atoms, requirements.values, requirements.itemMeta);
			};
			if (readonly === isParentReadonly) {
				invokePrepareFn(isParentLocked, parentLockResult.lockError, parentLockResult.affectedPackages);
			} else {
				const sub = internalLockContentService(siteId, update.path).subscribe((result) => {
					invokePrepareFn(result.locked, result.lockError, result.affectedPackages);
				});
				return () => sub.unsubscribe();
			}
		} else if (
			create // Create mode (stacked or not)
		) {
			const contentTypesById = effectRefs.current.contentTypesById;
			const contentType = contentTypesById[create.contentTypeId];
			if (!contentType) {
				return setPrepError(ContentTypeNotFoundError);
			}
			const lockResultAtom = atom<FormsEngineEditContextProps>({
				locked: false,
				lockError: null,
				affectedPackages: null
			});
			const atoms: FormsEngineAtoms = createFormsEngineAtoms(effectRefs.current.username, {
				lockResult: lockResultAtom,
				readonly: atom(false),
				expandedStateBySectionId: buildSectionExpandedStateAtoms(contentType.sections),
				fileName: atom(''),
				// Default version comment for new content.
				versionComment: atom(produceCreationMessage('', formatMessage))
			});
			const contentObject = createObjectWithSystemProps(contentType);
			const values = createParsedValuesObject(
				contentType.fields,
				contentObject,
				contentTypesById,
				(fieldId, value, isAdditional) => {
					setFieldAtoms(
						stableFormContextRef,
						contentType,
						contentType.fields,
						fieldId,
						atoms,
						value,
						{ siteId, contentTypesById },
						isAdditional
					);
				},
				customControls
			);
			const { [XmlKeys.fileName]: _, ...valuesWithoutFileName } = values;

			const objectId = contentObject[XmlKeys.modelId] as string;
			initializeState(atoms, values, {
				id: objectId,
				// TODO: Should/could we somehow deduce the target path?
				path: null,
				// TODO: Sourcemap? How can we determine what would be inherited by this content? New API?
				sourceMap: null,
				pathInSite: processPathMacros({
					path: create.path,
					objectId,
					fullParentPath: '',
					useUUID: false
				}),
				contentType,
				contentObject,
				contentXml: buildContentXml(valuesWithoutFileName, contentTypesById)
			});
		} /* if (isUpdateMode) */ else {
			const subscription = fetchUpdateRequirements({
				siteId,
				path: renamedPath ?? update?.path,
				modelId: update.modelId,
				readonly: readonlyProp,
				contentTypesById: effectRefs.current.contentTypesById,
				changeTypeId: update.changeTypeId
			})
				.pipe(
					catchError((error: AjaxError | symbol) => {
						if (typeof error === 'symbol') {
							return of(error);
						}
						switch (error.status) {
							case 404:
								return of(ItemNotFoundError);
							default:
								console.error(error);
								return of(UnknownError);
						}
					})
				)
				.subscribe((requirements) => {
					if (typeof requirements === 'symbol') {
						return setPrepError(requirements);
					}
					dispatch(fetchContentItemComplete({ item: requirements.item }));
					const lockResultAtom = atom<FormsEngineEditContextProps>({
						locked: requirements.locked,
						lockError: requirements.lockError,
						affectedPackages: requirements.affectedPackages
					});
					const atoms = createFormsEngineAtoms(effectRefs.current.username, {
						lockResult: lockResultAtom,
						readonly: createReadonlyAtom(lockResultAtom),
						expandedStateBySectionId: buildSectionExpandedStateAtoms(requirements.contentType.sections),
						fileName: createFileNameAtom(requirements.item.path)
					});
					const values = createParsedValuesObject(
						requirements.contentType.fields,
						requirements.contentObject,
						effectRefs.current.contentTypesById,
						(fieldId, value, isAdditional) => {
							setFieldAtoms(
								stableFormContextRef,
								requirements.contentType,
								requirements.contentType.fields,
								fieldId,
								atoms,
								value,
								{ siteId, contentTypesById },
								isAdditional
							);
						},
						customControls
					);

					initializeState(atoms, values, {
						id: values[XmlKeys.modelId] as string,
						path: requirements.item.path,
						// TODO: Sourcemap? How can we determine what would be inherited by this content? New API?
						sourceMap: requirements.sourceMap,
						pathInSite: requirements.pathInSite,
						contentType: requirements.contentType,
						contentXml: requirements.contentXml,
						contentObject: requirements.contentObject
					});
				});
			return () => subscription.unsubscribe();
		}
	}, [
		contentTypesLoaded,
		create,
		customControls,
		dispatch,
		effectRefs,
		fieldsToRender,
		formsStackData,
		readonlyProp,
		repeat,
		siteId,
		stackIndex,
		store,
		update,
		username,
		renamedPath,
		reloadNonce
	]);

	if (prepError) {
		return <FormPrepError error={prepError} />;
	} else if (
		ready &&
		// Create doesn't need the liveUpdateItem, but otherwise, it should be preset before proceeding to rendering a form
		(create || repeat || liveUpdatedItem)
	) {
		return (
			<FormsEngineFormContextApi.Provider value={contextApi}>
				<StableFormContext.Provider value={stableFormContextRef.current}>
					<ItemContext.Provider value={liveUpdatedItem}>
						<ItemMetaContext.Provider value={itemMeta}>
							<RenamedPathContext.Provider
								value={{ renamedPath, setRenamedPath, reloadNonce, triggerReload, setSavedCreatePath }}
							>
								{createElement(FormOrchestrator, effectiveProps)}
							</RenamedPathContext.Provider>
						</ItemMetaContext.Provider>
					</ItemContext.Provider>
				</StableFormContext.Provider>
			</FormsEngineFormContextApi.Provider>
		);
	} else {
		return (
			<LoadingState
				sx={{ height: getTargetHeight(isDialog, isFullScreen, theme) }}
				title={<FormattedMessage defaultMessage="Please wait" />}
				subtitle={<FormattedMessage defaultMessage="Gathering content information" />}
			/>
		);
	}
}

// Sets up the UI and renders the form.
function FormOrchestrator(props: FormsEngineProps) {
	// region const {...} = props
	const {
		create,
		update,
		repeat,
		stackIndex = 0,
		stackTransitionEnded,
		fieldsToRender,
		isDialog = false,
		onSave,
		onClose: onCloseProp
	} = props;
	// endregion

	const theme = useTheme();
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const activeSite = useActiveSite();
	const siteId = activeSite.id;
	const containerRef = useRef<HTMLDivElement>(undefined);
	const {
		isFullScreen = false,
		updateSubmittingOrHasPendingChanges,
		onClose: enhancedDialogOnClose
	} = useEnhancedDialogContext() ?? {};
	const store = useJotaiStore();
	const { api: contextApi, formsStackData } = useContext(StableGlobalContext);
	const stableFormContext = useContext(StableFormContext);
	const formContextApi = useContext(FormsEngineFormContextApi);
	const item = useContext(ItemContext);
	const { contentType, sourceMap, pathInSite } = useContext(ItemMetaContext);
	const { fieldUpdates$, changedFieldIds, atoms } = stableFormContext;
	const [disableStackedFormDrawerAutoFocus, setDisableStackedFormDrawerAutoFocus] = useState(true);
	const [enablingEditInProgress, setEnablingEditInProgress] = useState(false);
	const [openDrawerSidebar, setOpenDrawerSidebar] = useAtom(atoms.tableOfContentsDrawerOpen);
	const isSubmitting = useAtomValue(atoms.isSubmitting);
	const [hasPendingChanges, setHasPendingChanges] = useAtom(atoms.hasPendingChanges);
	const readonly = useAtomValue(atoms.readonly);
	const [lockStatus, setLockStatus] = useAtom(atoms.lockResult);
	const stackFormCount = useAtomValue(stackFormCountAtom);
	const isStackedForm = stackIndex > 0;
	const hasStackedForms = !isStackedForm && stackFormCount > 0;
	const isEmbedded = Boolean(update?.modelId) || Boolean(create?.embedded);
	const isCreateMode = Boolean(create?.path);
	const isRepeatMode = Boolean(repeat?.fieldId);
	const affectedPackages = lockStatus.affectedPackages?.length > 0;
	const contentTypeFields = contentType.fields;
	const contentTypeSections = useMemo(() => {
		if (!isEmbedded) return contentType.sections;
		// If the item is embedded, exclude the 'file-name' field from the sections.
		// Embedded components don't have any path/file-name, so excluding the field from the sections will prevent it from
		// being rendered in the ToC and the form.
		return contentType.sections.map((section) => ({
			...section,
			fields: section.fields.filter((fieldId) => fieldId !== XmlKeys['fileName'])
		}));
	}, [contentType.sections, isEmbedded]);
	const useCollapsedToC = useAtomValue(atoms.useCollapsedToC);
	const tableOfContents = <TableOfContents fieldsToRender={fieldsToRender} containerRef={containerRef} />;
	const effectRefs = useUpdateRefs({
		fieldsToRender,
		versionCommentAtom: stableFormContext.atoms.versionComment,
		fileNameAtom: stableFormContext.atoms.fileName,
		lockStatus
	});
	// Holds the create mode comment generated last, so that a comment written by the user isn't overwritten. Starts off
	// with the default comment the version comment atom was created with.
	const lastCreationCommentRef = useRef(produceCreationMessage('', formatMessage));
	const [collapseHeader, setCollapseHeader] = useState(false);
	const [saveAsDraftAction, setSaveAsDraftAction] = useState(false);
	const [invalidForm, setInvalidForm] = useState(false);
	const jotai = useJotaiStore();

	useMount(() => {
		// If 'update.changeTypeId' has content, it means the content type has changed, so we set pending changes to true
		// to be able to enable the save button and allow users to save immediately if that's all they want to do.
		if (update?.changeTypeId) {
			setHasPendingChanges(true);
		}
		const checkValidationState = async () => {
			const validityStates = await Promise.all(
				Object.values(stableFormContext.atoms.validationByFieldId).map((validityDataAtom) =>
					jotai.get(validityDataAtom)
				)
			);
			setInvalidForm(validityStates.some((state) => !state.isValid));
		};
		void checkValidationState();
		const subscription = stableFormContext.fieldUpdates$
			.pipe(debounceTime(300))
			.subscribe(() => void checkValidationState());
		return () => subscription.unsubscribe();
	});

	// Changes comment generation & change detection/tracking
	useEffect(() => {
		const sub = fieldUpdates$.pipe(debounceTime(300)).subscribe(() => {
			// String-type fields have auto-rollback detection; the fieldUpdates$ will emit anyway. Checking if the fieldId
			// emitted is in changedFieldIds should tell if the field was rolled back.
			setHasPendingChanges(changedFieldIds.size > 0);
			const versionCommentAtom = effectRefs.current.versionCommentAtom;
			// Create mode bases the comment off of the page URL (file-name) instead of the fields changed. Note that any
			// field update re-runs this since every field's validation depends on the file name.
			if (isCreateMode) {
				const newMessage = generateDefaultCreationComment(
					store.get(effectRefs.current.fileNameAtom),
					store.get(versionCommentAtom).trim(),
					lastCreationCommentRef.current,
					formatMessage
				);
				if (newMessage) {
					lastCreationCommentRef.current = newMessage;
					store.set(versionCommentAtom, newMessage);
				}
				return;
			}
			const newMessage = generateDefaultChangesComment(
				contentType.fields,
				effectRefs.current.fieldsToRender,
				changedFieldIds,
				store.get(versionCommentAtom).trim()
			);
			if (newMessage) store.set(versionCommentAtom, newMessage);
		});
		return () => {
			sub.unsubscribe();
		};
	}, [
		changedFieldIds,
		contentType.fields,
		effectRefs,
		setHasPendingChanges,
		fieldUpdates$,
		store,
		isCreateMode,
		formatMessage
	]);

	const sourceMapPaths = useMemo(() => Object.values(sourceMap ?? []).sort(), [sourceMap]);
	useFetchContentItems(sourceMapPaths);

	// If rendered in a dialog, update the dialog's isSubmitting and hasPendingChanges. Only the root form.
	// Stacked forms have their own changes and submit state management.
	useEffect(() => {
		if (!isStackedForm) updateSubmittingOrHasPendingChanges?.({ isSubmitting, hasPendingChanges });
	}, [isSubmitting, hasPendingChanges, isStackedForm, updateSubmittingOrHasPendingChanges]);

	// Unlock content when the form is closed.
	useUnlockOnClose({
		...props,
		saveAsDraft: saveAsDraftAction,
		invalidForm,
		itemSavedAsDraft: Boolean(item?.savedAsDraft)
	});

	// region Workflow item updates
	useEffect(() => {
		const events = [
			workflowEventSubmit.type,
			workflowEventDirectPublish.type,
			workflowEventApprove.type,
			workflowEventReject.type,
			workflowEventCancel.type
		];

		const hostToHost$ = getHostToHostBus();
		const subscription = hostToHost$.subscribe(({ type }) => {
			if (!item || !events.includes(type)) return;
			fetchAffectedPackages(siteId, item.path).subscribe({
				next(packages) {
					setLockStatus({
						...effectRefs.current.lockStatus,
						affectedPackages: packages
					});
				},
				error({ response }) {
					console.error(response);
				}
			});
		});

		return () => {
			subscription.unsubscribe();
		};
	}, [effectRefs, item, setLockStatus, siteId]);

	const handleOpenDrawerSidebar = () => {
		const scroller = getScrollContainer(containerRef.current);
		scroller.style.setProperty('--scroll-top', `${containerRef.current.scrollTop}px`);
		scroller.style.overflowY = 'hidden';
		setOpenDrawerSidebar(true);
	};
	const handleCloseDrawerSidebar: DrawerProps['onClose'] = () => {
		containerRef.current.style.overflowY = '';
		setOpenDrawerSidebar(false);
	};
	const handleCloseDrawerForm: DrawerProps['onClose'] = () => {
		if (!hasStackedForms) return;
		const childState = getCurrentChildFormStateSummary(store, formsStackData);
		// Note: This is executed in the context of the parent form.
		// Executed in the case of escape, backdrop click or form close button click.
		const doClose = () => {
			// The child form item unlocking should be getting done by the FormOrchestrator of the unmounting form via useUnlockOnClose hook.
			const childProps = formsStackData[formsStackData.length - 1].props;
			// Only unlock scroll if this is the last item in the forms stack
			childProps.stackIndex === 0 && (containerRef.current.style.overflowY = '');
			contextApi.popForm();
		};
		if (childState.isSubmitting) {
			displayFormBeingSavedSnack(dispatch, formatMessage);
		} else if (childState.hasPendingChanges) {
			displayWithPendingChangesConfirm(dispatch, doClose);
		} else {
			doClose();
		}
	};

	const currentStackedFormProps = hasStackedForms ? formsStackData[formsStackData.length - 1].props : null;
	const stackedFormKey = hasStackedForms ? createStackedFormKey(currentStackedFormProps, stackFormCount) : undefined;

	const updateEditEnablement = (enableEdit: boolean, callback?: (lockResult: FormsEngineEditContextProps) => void) => {
		if (enablingEditInProgress || isCreateMode) return;
		const doEditEnablement = (restoreValues: boolean = false) => {
			// TODO: Re-fetch content when enabling edit? Or monitor changes and auto-reload?
			setEnablingEditInProgress(true);
			const service = enableEdit ? internalLockContentService : internalUnlockContentService;
			service(siteId, item.path).subscribe((lockResult) => {
				setEnablingEditInProgress(false);
				setHasPendingChanges(false);
				if (restoreValues) formContextApi.rollback();
				setLockStatus({
					locked: lockResult.locked,
					lockError: lockResult.lockError,
					affectedPackages: lockResult?.affectedPackages ?? null
				});
				callback?.(lockResult);
			});
		};
		// If hasPendingChanges, should prompt user to save before enabling edit.
		if (!enableEdit && hasPendingChanges) {
			return displayWithPendingChangesConfirm(
				dispatch,
				() => doEditEnablement(true),
				<FormattedMessage defaultMessage="Discard unsaved changes?" />
			);
		}
		doEditEnablement();
	};

	const onCloseHandler = isStackedForm ? onCloseProp : enhancedDialogOnClose;

	const saveFn = useSaveForm({
		onSave,
		isEmbedded,
		isCreateMode,
		isRepeatMode,
		createPath: Boolean(create?.path) ? pathInSite : undefined, // pathInSite is the result of processing the create path with macros.
		onClose: () => onCloseHandler(null, null),
		onMinimize: () => props.onMinimize?.()
	});

	// If not on a dialog or the prop is not provided, there's no need to handle the close. The form is running in a standalone mode.
	const handleClose: ButtonProps['onClick'] = (e) => {
		if (isSubmitting) {
			displayFormBeingSavedSnack(dispatch, formatMessage);
		} else {
			// If `hasPendingChanges`, we're still calling close assuming the EnhancedDialog will handle showing the close without saving confirm.
			onCloseHandler?.(e, null);
		}
	};

	const [mainContent, setMainContent] = useState(null);
	const collapseHeaderAllowed = useRef(false);
	const sentinelRef = useRef<HTMLDivElement>(null);

	const mainContentRefCallback: RefCallback<HTMLDivElement> = (element) => {
		setMainContent(element);
		if (!mainContent && nnou(element)) {
			// First time the main content is set, if the scrollHeight is not 100px larger than clientHeight, we don't allow collapsing the header.
			collapseHeaderAllowed.current = element.scrollHeight - element.clientHeight > 100;
		}
	};

	// Monitor when sentinel element crosses the threshold
	useEffect(() => {
		if (!mainContent || !sentinelRef.current) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				// When sentinel is NOT intersecting (scrolled past 60px, sentinel's top position), collapse header
				if (collapseHeaderAllowed.current) {
					setCollapseHeader(!entry.isIntersecting);
				}
			},
			{
				root: mainContent,
				threshold: 0,
				rootMargin: '0px'
			}
		);

		observer.observe(sentinelRef.current);

		return () => {
			observer?.disconnect();
		};
	}, [mainContent]);

	const bodyFragment = (
		<FormLayout
			stackIndex={stackIndex}
			containerRef={containerRef}
			sentinelRef={sentinelRef}
			mainContentRefCallback={mainContentRefCallback}
			hasStackedForms={hasStackedForms}
			// If the form is rendered in/as a dialog, take up the whole screen minus
			// top/bottom margins (2 top, 2 bottom). If not a dialog, take up the whole screen.
			targetHeight={getTargetHeight(isDialog, isFullScreen, theme)}
			headerFragment={
				<Box id="header" sx={{ minHeight: 50 }}>
					<Box component={Container} display="flex" alignItems="center" justifyContent="space-between" pt={2}>
						<Typography variant="body2" color="textSecondary">
							<span title={siteId}>{activeSite.name}</span> / <span title={contentType.id}>{contentType.name}</span>
						</Typography>
						<Box sx={[isDialog && { position: 'absolute', top: theme.spacing(1), right: theme.spacing(1) }]}>
							{props.onMinimize && (
								<Tooltip title={<FormattedMessage defaultMessage="Miminize" />}>
									<IconButton size="small" onClick={props.onMinimize}>
										<MinimizeIconRounded />
									</IconButton>
								</Tooltip>
							)}
							{(props.onCancelFullScreen || props.onFullScreen) && (
								<Tooltip title={<FormattedMessage defaultMessage="Maximize" />}>
									<IconButton size="small" onClick={isFullScreen ? props.onCancelFullScreen : props.onFullScreen}>
										{isFullScreen ? <CloseFullscreenOutlined /> : <MaximiseIcon fontSize="small" />}
									</IconButton>
								</Tooltip>
							)}
							{handleClose && (
								<Tooltip title={<FormattedMessage defaultMessage="Close" />}>
									<IconButton size="small" onClick={handleClose}>
										<Close />
									</IconButton>
								</Tooltip>
							)}
						</Box>
					</Box>
					{isRepeatMode ? (
						<RepeatModeHeader repeat={repeat} collapse={collapseHeader} />
					) : isCreateMode ? (
						<CreateModeHeader path={Boolean(create?.path) ? pathInSite : undefined} collapse={collapseHeader} />
					) : (
						<EditModeHeader isEmbedded={isEmbedded} collapse={collapseHeader} />
					)}
				</Box>
			}
			mainContentGrid={
				<>
					<Grid size={useCollapsedToC ? 'auto' : 'grow'}>
						<StickyBox data-area-id="stickySidebar" sx={{ height: 'auto' }}>
							{useCollapsedToC ? (
								<IconButton size="small" onClick={handleOpenDrawerSidebar}>
									<MenuRounded />
								</IconButton>
							) : (
								tableOfContents
							)}
						</StickyBox>
					</Grid>
					<Grid size={useCollapsedToC ? 8.3 : 7} className="space-y" data-area-id="formBody">
						{affectedPackages && (
							<Alert
								severity="warning"
								variant="outlined"
								action={
									<Button
										color="inherit"
										size="small"
										onClick={() => {
											dispatch(
												pushDialog({
													component: createComponentId('ViewPackagesDialog'),
													props: { item } as ViewPackagesDialogProps
												})
											);
										}}
									>
										Review
									</Button>
								}
							>
								<AlertTitle>
									<FormattedMessage defaultMessage="Publish Cancellation Warning" />
								</AlertTitle>
								<FormattedMessage defaultMessage="The item is part of a publishing package. Editing it will cancel the entire package." />
							</Alert>
						)}
						{lockStatus.lockError && (
							<Alert severity="error">
								{createErrorStatePropsFromApiResponse(lockStatus.lockError, formatMessage).message}
							</Alert>
						)}
						{fieldsToRender ? (
							// Renders the specified set of fields only
							<Paper sx={{ p: 2 }}>
								{fieldsToRender.map((field, index) =>
									renderFieldControl(field, stableFormContext.atoms.valueByFieldId, index === 0, readonly, contentType)
								)}
							</Paper>
						) : (
							// Renders the full form, all sections
							contentTypeSections.map((section, sectionIndex) => (
								<SectionAccordion
									key={sectionIndex}
									section={section}
									renderControl={(fieldId, fieldIndex) =>
										renderFieldControl(
											contentTypeFields[fieldId],
											stableFormContext.atoms.valueByFieldId,
											sectionIndex === 0 && fieldIndex === 0,
											readonly,
											contentType
										)
									}
								/>
							))
						)}
						{/* Spacer & back to top */}
						<FormBackToTop containerRef={containerRef} />
					</Grid>
					<Grid size="grow">
						<StickyBox className="space-y" sx={{ height: 'auto' }}>
							{readonly ? (
								<>
									<Alert severity="info" variant="outlined" icon={<EditOffOutlined />}>
										<FormattedMessage defaultMessage="Readonly mode" />
									</Alert>
									<SecondaryButton
										fullWidth
										variant="outlined"
										onClick={() => updateEditEnablement(true)}
										loading={enablingEditInProgress}
									>
										<FormattedMessage defaultMessage="Edit" />
									</SecondaryButton>
								</>
							) : (
								<>
									<SaveCard
										isEmbedded={isEmbedded}
										isStackedForm={isStackedForm}
										isRepeatMode={isRepeatMode}
										setSaveAsDraft={setSaveAsDraftAction}
										invalidForm={invalidForm}
										onSave={(e, draft) => saveFn(draft)}
									/>
									{!isCreateMode && // There's no locking on create mode
										(!isRepeatMode || (isRepeatMode && repeat.values)) && // No point in the "unlock" button for new repeat items
										!(isEmbedded && isStackedForm) && ( // For embedded components, only allow releasing the lock if it's the top form.
											<SecondaryButton
												fullWidth
												variant="outlined"
												onClick={() => updateEditEnablement(false)}
												loading={enablingEditInProgress}
											>
												<FormattedMessage defaultMessage="Release Lock" />
											</SecondaryButton>
										)}
								</>
							)}
							{handleClose && (
								<Button fullWidth variant="outlined" disabled={enablingEditInProgress} onClick={handleClose}>
									<FormattedMessage defaultMessage="Close" />
								</Button>
							)}
						</StickyBox>
					</Grid>
				</>
			}
		>
			{/* region Stacked Form Drawer */}
			{stackIndex === 0 && (
				<Drawer
					open={hasStackedForms}
					anchor="right"
					variant="temporary"
					disablePortal
					data-area-id="stackedFormDrawer"
					onClose={handleCloseDrawerForm}
					// Autofocus combined with absolute positioning (as opposed to the default fixed) causes the
					// scroll position to jump off the page (where the drawer panel is shown at) and looks like it
					// is the background element the one that's moving/animating in a jittery fashion.
					disableAutoFocus={disableStackedFormDrawerAutoFocus}
					onTransitionExited={() => {
						setDisableStackedFormDrawerAutoFocus(true);
					}}
					onTransitionEnd={
						// onTransitionEnd keeps triggering after the Drawer transition has finished on certain interactions (e.g. when hovering buttons)
						// This callback is also invoked during other transitions other than the Drawer's open transition.
						disableStackedFormDrawerAutoFocus
							? (e) => {
									// Make sure it is the drawer paper that finished transitioning before considering the transition complete.
									if ((e.target as HTMLElement).getAttribute('data-area-id') !== 'stackedFormDrawerPaper') return;
									const paper = containerRef.current.querySelector(
										`[data-area-id="stackedFormDrawer"] .${drawerClasses.paper}`
									) as HTMLDivElement;
									// TODO: Could paper ever be null here?
									// Check that the focus was moved inside the paper by the autoFocus prop in the control.
									// If focus is not on the paper, move it to it.
									if (!paper.contains(document.activeElement)) {
										paper.focus();
									}
									setDisableStackedFormDrawerAutoFocus(false);
								}
							: undefined
					}
					sx={{
						top: 'var(--scroll-top)',
						position: 'absolute',
						[`& > .${paperClasses.root}`]: {
							top: 0,
							width: 'calc(var(--container-width) - 100px)',
							height: isDialog ? `var(--container-height)` : '100vh',
							position: 'absolute'
						}
					}}
					PaperProps={{ 'data-area-id': 'stackedFormDrawerPaper' }}
				>
					{hasStackedForms && (
						<FormBootstrap
							key={stackedFormKey}
							stackIndex={formsStackData.length - 1}
							{...currentStackedFormProps}
							stackTransitionEnded={!disableStackedFormDrawerAutoFocus}
							isDialog={isDialog}
							onClose={handleCloseDrawerForm}
						/>
					)}
				</Drawer>
			)}
			{/* endregion */}
			{/* region ToC Drawer */}
			<Drawer
				open={openDrawerSidebar}
				variant="temporary"
				disablePortal
				// The transitionDuration is set to 0 for when closing so it doesn't impede the scrollIntoView
				// in case a section/field was clicked. Ideally, the transition would still occur in the case of
				// closing the drawer without a section/field clicked (i.e. escape key or backdrop click), but
				// that would require an additional piece of state, so leaving like this for now.
				transitionDuration={openDrawerSidebar ? undefined : 0}
				onClose={handleCloseDrawerSidebar}
				sx={{
					position: 'absolute',
					[`& > .${paperClasses.root}`]: {
						p: 2,
						top: 'var(--scroll-top)',
						width: 300,
						height: isDialog ? `var(--container-height)` : '100vh',
						position: 'absolute'
					}
				}}
			>
				{tableOfContents}
			</Drawer>
			{/* endregion */}
		</FormLayout>
	);

	return (
		// TODO: The transition doesn't seem to be carried out. Check forwarding the style prop.
		// The Fade provides some transitioning for the stacked forms that show without the Slide transition since the Drawer is already open and there's only one.
		isStackedForm ? <Fade mountOnEnter in={stackTransitionEnded} children={bodyFragment} /> : bodyFragment
	);
}

export { FormGuard as FormsEngine };

export default FormGuard;

// TODO:
//  - Need Jotai store per form so fields with same id across forms don't collide. Same goes for sections (or other UI state) that could collide across forms.
//  - On editorial, saving home observed orderDefault_f get lost. Why? Also objectGroupId. Do we need to keep objectGroupId?
//  - Folder name getting added for components
//  - Reconcile/consolidate rte settings for form & XB
//  - Implement default value & default value checks
//  - Carry/implement current attributes (no-default, remote, others?). See valueSerializers => prepareValuesForXmlSerialising
// 	- Consider API that provides all form requirements: form def xml, context xml, sandbox/detailed item, affected workflow, lock(?)
//  - Russ: "Some people push the save button just to have the modified date changed"
//  - Implement the various constraints/validation checks
//  - PathNav and other areas to open new edit form
//  - Store collapsed ToC state & add to preference manager
//  - Enabling editing (from read only to edit mode) for embedded components considering deeper nesting that 1 too
//  - Docs notes:
//    - Controls should manage autoFocus; make sure their internal controls reacts to changes in autoFocus or use effect to focus programmatically
//    - Should test controls in a root form and in a nested form
//  - Use the "cdata config" to apply cdata
//  - Where do we put the "config" to determine whether to use new or old form engine?
//  - Form controller loading and execution
//  - FOR LATER...
//    - Allow overriding/extending validators, retrievers, [and maybe] controlMap through plugins
//    - Inherited non overridable if not in the model
//    - AI
//    - Edit template & controller
//    - Update Audience Targeting panel to use new form engine controls
//    - Field diff
//    - View/edit content type
//    - AI to summarise changes for the save comment
//    - API to retrieve inherited props from an item that doesn't yet exist (is being created)
//    - Rollback confirm with diff
//    - Settings:
//       - Enable tabbing through control menu button
//       - Permanently hide ToC (though also controlled by the tab bar button)
//       - Colour blind mode:
//          - required field indicators to show check instead of asterisk when valid
//       - Flush control cache?
//       - Close after saving & options
//       - Whether to open node selector items in edit if the main item area (instead of edit button) is clicked
