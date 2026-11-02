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
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { PublishPackage } from '../../models';
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
import { atom, createStore, Provider, PrimitiveAtom, useAtom, useAtomValue, useStore as useJotaiStore } from 'jotai';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import useSelection from '../../hooks/useSelection';
import ApiResponse from '../../models/ApiResponse';
import { AjaxError } from 'rxjs/ajax';
import { ViewPackagesDialogProps } from '../ViewPackagesDialog';
import {
	buildSectionExpandedStateAtoms,
	createFileNameAtom,
	commitFormVisibility,
	createFormsEngineAtoms,
	extractAtomValues,
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
	isEmbeddedForm,
	readInvalidFieldIds,
	stackEntryAtoms,
	getScrollContainer,
	getTargetHeight,
	internalLockContentService,
	internalUnlockContentService,
	prepareEmbeddedItemForm,
	scrollToFieldWhenSettled,
	setFieldAtoms,
	useStackSubmitting,
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
import TableOfContents, { FieldScopeNotice } from './components/TableOfContents';
import CreateModeHeader from './components/CreateModeHeader';
import RepeatModeHeader from './components/RepeatModeHeader';
import EditModeHeader from './components/EditModeHeader';
import SaveCard from './components/SaveCard';
import SectionAccordion from './components/SectionAccordion';
import useSaveForm from './lib/useSaveForm';
import { FormPrepError } from './components/FormPrepError';
import { createParsedValuesObject } from './lib/valueRetrievers';
import {
	collectAffectedPluginControlFields,
	preloadControlPluginsForFields,
	type ControlPluginPreloadFailure
} from './lib/controlPluginLoader';
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
import {
	attachFormController,
	findAncestorFormControllerEntry,
	runFormControllerCleanup
} from './formControllers/runtime';
import { createEmbeddedRelevanceResolver } from './formControllers/relevance';
import {
	aggregateStackFlags,
	childFields,
	fieldVisibility,
	hasFormAtoms,
	validationErrorsAlert,
	itemLaunchBlocksParent,
	itemLaunchFrom,
	itemLaunchVisibleChildren,
	missedItemLaunch,
	parentBodyHiddenForItemLaunch,
	planSettledFieldScroll,
	repeatFormLock,
	revealField,
	showValidationError,
	selectedItemSavePlan,
	stackEntryFlagsAtom,
	stackedFormCloseAction,
	stackedFormsClosedByReload
} from './lib/formVisibility';
import { repeatItemFormProps, stackedRepeatItemAfterClose, writeItemToParent } from './lib/repeatItemForm';
import ValidationErrorsAlert from './components/ValidationErrorsAlert';
import { useInvalidFieldIds } from './lib/useInvalidFieldIds';

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
	/** Closes a stacked form after its own save. Does not restore selected-fields edits. */
	onCommittedClose?(): void;
	onMinimize?: EnhancedDialogProps['onMinimize'];
	onFullScreen?: EnhancedDialogProps['onFullScreen'];
	onCancelFullScreen?: EnhancedDialogProps['onCancelFullScreen'];
	/**
	 * Experience Builder `selectedFields`: show only these fields. Dotted ids (`articles_o.headline_s`)
	 * select the base field. Resolved against the content type once it is loaded.
	 */
	fieldIds?: string[];
	/**
	 * Repeat-item index from Experience Builder. Limits that repeat field to one item.
	 * Nested indexes such as `"1.2"` are not supported and are ignored.
	 */
	repeatIndex?: string | number;
	/** Id of a field the form should scroll into view once rendered. Expands the field's section if collapsed. */
	fieldToScroll?: string;
	/**
	 * Experience Builder item launch. The item form starts in selected-fields mode,
	 * including a whole item. The pencil and Add leave this unset.
	 */
	selectedItemForm?: boolean;
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
		/** Set on repository writes. In-memory repeat and stacked-embedded saves omit it. */
		action?: 'save' | 'saveAndClose' | 'saveAndMinimize';
		/** Set on repository writes. True when the item was stored as a draft. */
		draft?: boolean;
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

type RootFormActions = StableGlobalContextProps['rootFormActions'];

/** Writes the latest parent save into the stack's mutable slot. The slot is not React state. */
function publishRootFormActions(actions: RootFormActions, refs: { current: RootFormActions }) {
	actions.save = (draft) => refs.current.save(draft);
	actions.setSaveAsDraft = (value) => refs.current.setSaveAsDraft(value);
}

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
			formsStackData: [createFormStackData({ props })],
			rootFormActions: {
				save: () => Promise.resolve(),
				setSaveAsDraft: () => undefined
			}
		};
	}
	stableGlobalContextRef.current.api = useMemo<FormsEngineGlobalApiContextProps>(() => {
		const setCount = (factor: 1 | -1) => {
			const currentCount = store.get(stackFormCountAtom);
			store.set(stackFormCountAtom, currentCount + factor);
		};
		const api: FormsEngineGlobalApiContextProps = {
			pushForm(props) {
				stableGlobalContextRef.current.formsStackData.push(
					createFormStackData({
						props,
						itemFormMode: props.selectedItemForm ? atom<'selected' | 'full'>('selected') : null
					})
				);
				setCount(1);
			},
			popForm() {
				const stack = stableGlobalContextRef.current.formsStackData;
				runFormControllerCleanup(stack[stack.length - 1]);
				stack.pop();
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
	// Root engine unmount: clean up any remaining controllers (including the root entry).
	useEffect(() => {
		return () => {
			const stack = stableGlobalContextRef.current?.formsStackData;
			if (!stack) return;
			for (let i = stack.length - 1; i >= 0; i--) {
				runFormControllerCleanup(stack[i]);
			}
		};
	}, []);
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
	const { create, update, repeat, readonly: readonlyProp, stackIndex = 0, isDialog } = effectiveProps;
	const siteId = useActiveSiteId();
	const dispatch = useDispatch();
	const contentTypesById = useContentTypes();
	const [contentTypesLoaded, setContentTypesLoaded] = useState(Boolean(contentTypesById));
	const { formsStackData, api } = useContext(StableGlobalContext);
	const [itemMeta, setItemMeta] = useState<FormsEngineItemMetaContextProps>(formsStackData[stackIndex].itemMeta);
	const [ready, setReady] = useState(() =>
		Boolean(formsStackData[stackIndex]?.atoms?.valueByFieldId && formsStackData[stackIndex].itemMeta)
	);
	const [prepError, setPrepError] = useState<symbol>();
	const store = useJotaiStore();
	const theme = useTheme();
	const { isFullScreen = false } = useEnhancedDialogContext() ?? {};
	const username = useActiveUser()?.username;
	// `effectiveProps` is a new object on every render of the parent; keep it out of the prep effect's
	// deps (via ref) so that a re-render doesn't re-prep the form and discard in-memory edits.
	const effectRefs = useUpdateRefs({ contentTypesById, username, effectiveProps });
	const stableFormContextRef = useRef<StableFormContextProps>(formsStackData[stackIndex]);
	// The drawer mounts only the top stacked form. When a child is closed, this instance remounts
	// for the parent slot; skip full prep if that slot already has atoms so in-memory edits survive.
	const prepStartedRef = useRef(false);
	const [renamedPath, setRenamedPath] = useState<string | null>(null);
	const [reloadNonce, setReloadNonce] = useState(0);
	const triggerReload = useCallback(() => {
		// A reload replaces this entry's atoms. Close stacked forms first so they cannot keep the old ones.
		// The launch then opens a new item form on the new atoms.
		const closeCount = stackedFormsClosedByReload(formsStackData.length, stackIndex);
		for (let i = 0; i < closeCount; i++) api.popForm();
		setReloadNonce((nonce) => nonce + 1);
	}, [api, formsStackData, stackIndex]);
	const effectiveUpdatePath = renamedPath ?? update?.path;
	const customControls = useSelection((state) => state.uiConfig.controls);
	const { formatMessage } = useIntl();

	const contextApi = useMemo<FormsEngineFormApiContextProps>(() => {
		const getInitialValues = () => stableFormContextRef.current.originalValues;
		const rollbackAtom = (atom: PrimitiveAtom<unknown>, value: unknown) => store.set(atom, value);
		const internalRollbackValue = (initialValues: LookupTable<unknown>, fieldId: string) => {
			const valueAtom = stableFormContextRef.current.atoms?.valueByFieldId[fieldId];
			if (!valueAtom) return;
			rollbackAtom(valueAtom, initialValues[fieldId]);
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
		const stackEntry = formsStackData[stackIndex];
		const alreadyPrepared = Boolean(stackEntry?.atoms?.valueByFieldId && stackEntry.itemMeta);
		if (!prepStartedRef.current && alreadyPrepared) {
			prepStartedRef.current = true;
			setItemMeta(stackEntry.itemMeta);
			setReady(true);
			return;
		}
		prepStartedRef.current = true;
		let disposed = false;
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
			itemMeta: FormsEngineItemMetaContextProps,
			pluginPreloadFailures: ControlPluginPreloadFailure[] = []
		) => {
			stableFormContextRef.current.atoms = atoms;
			stableFormContextRef.current.originalValues = values;
			stableFormContextRef.current.itemMeta = itemMeta;
			stableFormContextRef.current.affectedPluginControlFields = (() => {
				const affected = collectAffectedPluginControlFields(
					itemMeta.contentType.fields,
					pluginPreloadFailures,
					values,
					effectRefs.current.contentTypesById
				);
				// If import failed but no field mapped (defensive), still surface something so save stays blocked.
				const fields =
					pluginPreloadFailures.length && !affected.length
						? pluginPreloadFailures.map((failure) => ({
								fieldId: failure.plugin.name,
								fieldName: failure.plugin.name
							}))
						: affected;
				// Tag as bootstrap so save will not clear them for an in-place import retry.
				return fields.map((field) => ({ ...field, fromBootstrap: true }));
			})();
			setItemMeta(stableFormContextRef.current.itemMeta);
			return attachFormController({
				siteId,
				store,
				stackEntry: stableFormContextRef.current,
				parentStackEntry: findAncestorFormControllerEntry(formsStackData, stackIndex),
				formProps: effectRefs.current.effectiveProps,
				dispatch,
				formatMessage,
				// Attach owns the teardown of its own `initialize` when this prep run is superseded.
				isStale: () => disposed
			})
				.catch((error) => {
					console.error('Form controller attach failed. The form will open without a custom controller.', error);
				})
				.then(() => {
					if (disposed) return;
					setReady(true);
				});
		};
		if (
			// A repeat group is being opened as a stacked form.
			isChildForm &&
			repeat?.fieldId
		) {
			const contentType = parentContentType ? effectRefs.current.contentTypesById[parentContentType.id] : undefined;
			if (!contentType) return setPrepError(ContentTypeNotFoundError);
			if (!parentAtoms) return setPrepError(UnknownError);
			const contentTypesById = effectRefs.current.contentTypesById;
			const sharedLock = repeatFormLock(parentAtoms);
			const repeatGroup = contentType.fields[repeat.fieldId];
			const repeatFieldsForLaunch = childFields(repeatGroup);
			const repeatFieldLookup = Object.fromEntries(repeatFieldsForLaunch.map((field) => [field.id, field]));
			const atoms = createFormsEngineAtoms(
				effectRefs.current.username,
				{
					lockResult: sharedLock.lockResult,
					readonly: sharedLock.readonly,
					expandedStateBySectionId: buildSectionExpandedStateAtoms(contentType.sections),
					fileName: createFileNameAtom('', stableFormContextRef)
				},
				effectRefs.current.effectiveProps.fieldIds?.length
					? { selectedFields: effectRefs.current.effectiveProps.fieldIds, fields: repeatFieldLookup }
					: undefined
			);
			const seedValues = repeat.values ? { ...repeat.values } : {};
			preloadControlPluginsForFields(siteId, repeatFieldsForLaunch, seedValues, contentTypesById).then((failures) => {
				if (disposed) return;
				const validatorsData = {
					siteId,
					contentTypesById,
					resolveEmbeddedRelevance: createEmbeddedRelevanceResolver(siteId)
				};
				const atomValueCreator: Parameters<typeof createParsedValuesObject>[3] = (fieldId, value, isAdditional) => {
					setFieldAtoms(
						stableFormContextRef,
						contentType,
						contentType.fields[repeat.fieldId].fields,
						fieldId,
						atoms,
						value,
						validatorsData,
						isAdditional
					);
				};
				const values = repeat.values
					? seedValues
					: createParsedValuesObject(repeatFieldsForLaunch, {}, contentTypesById, atomValueCreator, customControls);

				const descriptors = resolveControlDescriptors(customControls);
				const additionalFieldsIds: string[] = [];
				// If repeat.values was provided, `createCleanValuesObject` didn't run; hence, atomValueCreator needs to be run manually.
				if (repeat.values) {
					// First gather all additional fields ids from the provided values
					repeatFieldsForLaunch.forEach((field) => {
						const descriptor = descriptors[field.type];
						if (!descriptor) return;
						additionalFieldsIds.push(...getAdditionalFieldsIdsFromDescriptor(field.id, descriptor));
					});
					// Ensure descriptor additional fields exist in values so atoms are created
					additionalFieldsIds.forEach((additionalFieldId) => {
						if (!Object.prototype.hasOwnProperty.call(values, additionalFieldId)) {
							values[additionalFieldId] = undefined;
						}
					});
					// Run atomValueCreator for each field considering the additional fields
					Object.keys(values).forEach((fieldId) => {
						const isAdditional = additionalFieldsIds.includes(fieldId);
						atomValueCreator(fieldId, values[fieldId], isAdditional);
					});
				}

				// Repeat items are not saved as their own documents. A snapshot keyed by index
				// would belong to a different item after a reorder or delete, so it is not kept.
				const contentObject = {};

				initializeState(
					atoms,
					values,
					{
						id: parentId,
						path: parentPath,
						sourceMap: null,
						pathInSite: parentPathInSite,
						contentType: parentContentType,
						contentObject,
						contentXml: ''
					},
					failures
				);
			});
			return () => {
				disposed = true;
			};
		} else if (
			// An embedded component is being opened as a stacked form.
			isChildForm &&
			update?.modelId
		) {
			const contentType = effectRefs.current.contentTypesById[update.values[XmlKeys.contentTypeId] as string];
			if (!contentType) return setPrepError(ContentTypeNotFoundError);
			if (!parentAtoms) return setPrepError(UnknownError);
			const isParentReadonly = store.get(parentAtoms.readonly);
			const readonly = readonlyProp ?? isParentReadonly;
			const parentLockResult = store.get(parentAtoms.lockResult);
			const isParentLocked = parentLockResult.locked;
			const invokePrepareFn = (locked: boolean, lockError: ApiResponse, affectedPackages: PublishPackage[]) => {
				preloadControlPluginsForFields(
					siteId,
					contentType.fields,
					update.values,
					effectRefs.current.contentTypesById
				).then((failures) => {
					if (disposed) return;
					const requirements = prepareEmbeddedItemForm({
						username,
						contentType,
						locked,
						lockError,
						affectedPackages,
						fieldIds: effectRefs.current.effectiveProps.fieldIds,
						repeatIndex: effectRefs.current.effectiveProps.repeatIndex,
						update,
						parentStackData,
						stableFormContextRef,
						parentPathInSite,
						siteId,
						contentTypesById: effectRefs.current.contentTypesById,
						customControls
					});
					initializeState(requirements.atoms, requirements.values, requirements.itemMeta, failures);
				});
			};
			if (readonly === isParentReadonly) {
				invokePrepareFn(isParentLocked, parentLockResult.lockError, parentLockResult.affectedPackages);
				return () => {
					disposed = true;
				};
			} else {
				const sub = internalLockContentService(siteId, update.path).subscribe((result) => {
					invokePrepareFn(result.locked, result.lockError, result.affectedPackages);
				});
				return () => {
					disposed = true;
					sub.unsubscribe();
				};
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
			const atoms: FormsEngineAtoms = createFormsEngineAtoms(
				effectRefs.current.username,
				{
					lockResult: lockResultAtom,
					readonly: atom(false),
					expandedStateBySectionId: buildSectionExpandedStateAtoms(contentType.sections),
					fileName: createFileNameAtom('', stableFormContextRef),
					// Default version comment for new content.
					versionComment: atom(generateDefaultCreationComment('', formatMessage))
				},
				{
					selectedFields: effectRefs.current.effectiveProps.fieldIds,
					index: effectRefs.current.effectiveProps.repeatIndex,
					fields: contentType.fields
				}
			);
			const contentObject = createObjectWithSystemProps(contentType);
			const initCreateForm = (failures: ControlPluginPreloadFailure[] = []) => {
				if (disposed) return;
				const validatorsData = {
					siteId,
					contentTypesById,
					resolveEmbeddedRelevance: createEmbeddedRelevanceResolver(siteId)
				};
				const values = createParsedValuesObject(
					contentType.fields,
					contentObject,
					contentTypesById,
					(fieldId, value, isAdditional) => {
						// If the form is for an embedded component, we don't need to set the fileName atom.
						if (create.embedded && fieldId === XmlKeys.fileName) return;
						setFieldAtoms(
							stableFormContextRef,
							contentType,
							contentType.fields,
							fieldId,
							atoms,
							value,
							validatorsData,
							isAdditional
						);
					},
					customControls
				);
				const { [XmlKeys.fileName]: _, ...valuesWithoutFileName } = values;

				const objectId = contentObject[XmlKeys.modelId] as string;
				initializeState(
					atoms,
					create.embedded ? valuesWithoutFileName : values,
					{
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
					},
					failures
				);
			};
			preloadControlPluginsForFields(siteId, contentType.fields, contentObject, contentTypesById).then(initCreateForm);
			return () => {
				disposed = true;
			};
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
					const atoms = createFormsEngineAtoms(
						effectRefs.current.username,
						{
							lockResult: lockResultAtom,
							readonly: createReadonlyAtom(lockResultAtom),
							expandedStateBySectionId: buildSectionExpandedStateAtoms(requirements.contentType.sections),
							fileName: createFileNameAtom(requirements.item.path, stableFormContextRef)
						},
						{
							selectedFields: effectRefs.current.effectiveProps.fieldIds,
							index: effectRefs.current.effectiveProps.repeatIndex,
							fields: requirements.contentType.fields
						}
					);
					preloadControlPluginsForFields(
						siteId,
						requirements.contentType.fields,
						requirements.contentObject,
						effectRefs.current.contentTypesById
					).then((failures) => {
						if (disposed) return;
						const validatorsData = {
							siteId,
							contentTypesById: effectRefs.current.contentTypesById,
							resolveEmbeddedRelevance: createEmbeddedRelevanceResolver(siteId)
						};
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
									validatorsData,
									isAdditional
								);
							},
							customControls
						);

						initializeState(
							atoms,
							values,
							{
								id: values[XmlKeys.modelId] as string,
								path: requirements.item.path,
								// TODO: Sourcemap? How can we determine what would be inherited by this content? New API?
								sourceMap: requirements.sourceMap,
								pathInSite: requirements.pathInSite,
								contentType: requirements.contentType,
								contentXml: requirements.contentXml,
								contentObject: requirements.contentObject
							},
							failures
						);
					});
				});
			return () => {
				disposed = true;
				subscription.unsubscribe();
			};
		}
	}, [
		contentTypesLoaded,
		create,
		customControls,
		dispatch,
		effectRefs,
		formatMessage,
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
		hasFormAtoms(stableFormContextRef.current) &&
		// Create doesn't need the liveUpdateItem, but otherwise, it should be preset before proceeding to rendering a form
		(create || repeat || liveUpdatedItem)
	) {
		const readyEntry = stableFormContextRef.current;
		return (
			<FormsEngineFormContextApi.Provider value={contextApi}>
				<StableFormContext.Provider value={readyEntry}>
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
		fieldToScroll,
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
	const { api: contextApi, formsStackData, rootFormActions } = useContext(StableGlobalContext);
	const stableFormContext = useContext(StableFormContext);
	const formContextApi = useContext(FormsEngineFormContextApi);
	const item = useContext(ItemContext);
	const { contentType, sourceMap, pathInSite } = useContext(ItemMetaContext);
	const { fieldUpdates$, changedFieldIds, atoms, formControllerState } = stableFormContext;
	const irrelevantFieldPaths = formControllerState?.irrelevantFieldPaths ?? null;
	const formControllerFileMissing = Boolean(formControllerState?.fileMissing);
	const formControllerLoadFailed = Boolean(formControllerState?.loadFailed);
	const [disableStackedFormDrawerAutoFocus, setDisableStackedFormDrawerAutoFocus] = useState(true);
	const [itemLaunchEntering, setItemLaunchEntering] = useState(false);
	const [enablingEditInProgress, setEnablingEditInProgress] = useState(false);
	const [openDrawerSidebar, setOpenDrawerSidebar] = useAtom(atoms.tableOfContentsDrawerOpen);
	const isSubmitting = useAtomValue(atoms.isSubmitting);
	const [hasPendingChanges, setHasPendingChanges] = useAtom(atoms.hasPendingChanges);
	const readonly = useAtomValue(atoms.readonly);
	const [lockStatus, setLockStatus] = useAtom(atoms.lockResult);
	const stackFormCount = useAtomValue(stackFormCountAtom);
	const isStackedForm = stackIndex > 0;
	const hasStackedForms = !isStackedForm && stackFormCount > 0;
	const isEmbedded = isEmbeddedForm({ update, create });
	const isCreateMode = Boolean(create?.path);
	const isRepeatMode = Boolean(repeat?.fieldId);
	const affectedPackages = lockStatus.affectedPackages?.length > 0;
	const contentTypeFields = contentType.fields;
	// Re-render when the controller publishes a deny-list. The list itself lives on the stack entry.
	useAtomValue(atoms.relevanceVersion);
	const visibility = useAtomValue(atoms.formVisibility);
	const scopeFieldIds = visibility.active.fieldIds;
	const pendingItemFieldId = !isStackedForm && !isRepeatMode ? visibility.itemForm?.fieldId : undefined;
	const idlePendingValue = useMemo(() => atom<unknown>(undefined), []);
	const pendingRepeatValue = useAtomValue(
		(pendingItemFieldId ? atoms.valueByFieldId[pendingItemFieldId] : undefined) ?? idlePendingValue
	);
	const pendingItemLength = Array.isArray(pendingRepeatValue) ? pendingRepeatValue.length : null;
	// Hide the parent as soon as the item can open. Setting this in the launch effect flashes the body.
	const canOpenItemLaunch =
		pendingItemFieldId != null &&
		atoms.valueByFieldId[pendingItemFieldId] != null &&
		pendingItemLength != null &&
		itemLaunchFrom(visibility, pendingItemLength) != null;
	if (canOpenItemLaunch && !itemLaunchEntering) {
		setItemLaunchEntering(true);
	}
	const formSections = useMemo(() => {
		let sections = contentType.sections;
		if (isEmbedded) {
			// Embedded components don't have any path/file-name, so excluding the field from the sections will prevent it from
			// being rendered in the ToC and the form.
			sections = sections.map((section) => ({
				...section,
				fields: section.fields.filter((fieldId) => fieldId !== XmlKeys['fileName'])
			}));
		}
		return sections;
	}, [contentType.sections, isEmbedded]);
	const visibleSections = useMemo(
		() =>
			formSections
				.map((section) => ({
					...section,
					fields: section.fields.filter(
						(fieldId) =>
							fieldVisibility({ fieldId, irrelevantFieldPaths, parentPath: repeat?.fieldId, scopeFieldIds }) ===
							'visible'
					)
				}))
				.filter((section) => section.fields.length > 0),
		[formSections, irrelevantFieldPaths, repeat?.fieldId, scopeFieldIds]
	);
	const repeatOwnedFields = useMemo(
		() => (isRepeatMode ? childFields(contentType.fields[repeat?.fieldId]) : []),
		[contentType.fields, isRepeatMode, repeat?.fieldId]
	);
	const repeatFields = useMemo(
		() =>
			isRepeatMode
				? repeatOwnedFields.filter(
						(field) =>
							fieldVisibility({
								fieldId: field.id,
								irrelevantFieldPaths,
								parentPath: repeat?.fieldId,
								scopeFieldIds
							}) === 'visible'
					)
				: undefined,
		[irrelevantFieldPaths, isRepeatMode, repeat?.fieldId, repeatOwnedFields, scopeFieldIds]
	);
	const repeatFieldIdList = useMemo(() => repeatOwnedFields.map((field) => field.id), [repeatOwnedFields]);
	const countFieldIds = useMemo(
		() => (isRepeatMode ? repeatFieldIdList : formSections.flatMap((section) => section.fields)),
		[formSections, isRepeatMode, repeatFieldIdList]
	);
	const useCollapsedToC = useAtomValue(atoms.useCollapsedToC);
	const tableOfContents = (
		<TableOfContents
			fields={isRepeatMode ? repeatFields : undefined}
			sections={isRepeatMode ? undefined : visibleSections}
			countFieldIds={visibility.launch ? countFieldIds : undefined}
			containerRef={containerRef}
		/>
	);
	const effectRefs = useUpdateRefs({
		// Comments name every changed field, including ones the launch scope is hiding.
		commentFields: isRepeatMode ? repeatOwnedFields : Object.values(contentTypeFields),
		versionCommentAtom: stableFormContext.atoms.versionComment,
		fileNameAtom: stableFormContext.atoms.fileName,
		lockStatus
	});
	// Holds the create mode comment generated last, so that a comment written by the user isn't overwritten. Starts off
	// with the default comment the version comment atom was created with.
	const lastCreationCommentRef = useRef(generateDefaultCreationComment('', formatMessage));
	const [collapseHeader, setCollapseHeader] = useState(false);
	const [saveAsDraftAction, setSaveAsDraftAction] = useState(false);

	useMount(() => {
		// If 'update.changeTypeId' has content, it means the content type has changed, so we set pending changes to true
		// to be able to enable the save button and allow users to save immediately if that's all they want to do.
		if (update?.changeTypeId) {
			setHasPendingChanges(true);
		}
	});

	// Pending changes publish immediately. The version comment stays on the 300ms debounce.
	useEffect(() => {
		const pendingSub = fieldUpdates$.subscribe(() => {
			const pending = changedFieldIds.size > 0;
			setHasPendingChanges(pending);
			// The dialog reads its own flag. Publish it here so a dismiss in the same turn still sees the edit.
			if (!isStackedForm) {
				const stackedPending = Object.entries(store.get(stackEntryFlagsAtom)).some(
					([index, flag]) => Number(index) !== stackIndex && flag.pending
				);
				updateSubmittingOrHasPendingChanges?.({
					hasPendingChanges: pending || stackedPending,
					isSubmitting: store.get(atoms.isSubmitting)
				});
			}
		});
		const commentSub = fieldUpdates$.pipe(debounceTime(300)).subscribe(() => {
			const versionCommentAtom = effectRefs.current.versionCommentAtom;
			// Create mode bases the comment off of the page URL (file-name) instead of the fields changed. Note that any
			// field update re-runs this since every field's validation depends on the file name.
			if (isCreateMode) {
				const newMessage = generateDefaultCreationComment(
					store.get(effectRefs.current.fileNameAtom),
					formatMessage,
					store.get(versionCommentAtom).trim(),
					lastCreationCommentRef.current
				);
				if (newMessage) {
					lastCreationCommentRef.current = newMessage;
					store.set(versionCommentAtom, newMessage);
				}
				return;
			}
			const newMessage = generateDefaultChangesComment(
				contentType.fields,
				effectRefs.current.commentFields,
				changedFieldIds,
				store.get(versionCommentAtom).trim()
			);
			if (newMessage) store.set(versionCommentAtom, newMessage);
		});
		return () => {
			pendingSub.unsubscribe();
			commentSub.unsubscribe();
		};
	}, [
		atoms.isSubmitting,
		changedFieldIds,
		contentType.fields,
		effectRefs,
		setHasPendingChanges,
		fieldUpdates$,
		formatMessage,
		isCreateMode,
		isStackedForm,
		stackIndex,
		store,
		updateSubmittingOrHasPendingChanges
	]);

	const sourceMapPaths = useMemo(() => Object.values(sourceMap ?? []).sort(), [sourceMap]);
	useFetchContentItems(sourceMapPaths);

	const parentEntry = isStackedForm ? formsStackData[stackIndex - 1] : null;
	const parentAtoms = stackEntryAtoms(parentEntry);
	const idleItemMode = useMemo(() => atom<'selected' | 'full' | null>(null), []);
	const itemMode = useAtomValue(stableFormContext.itemFormMode ?? idleItemMode);
	const stackFlags = useAtomValue(stackEntryFlagsAtom);
	const stackSummary = aggregateStackFlags(stackFlags);
	const stackSubmitting = useStackSubmitting();
	// Publish this entry once its atoms exist. Entries that are still null never publish, so a push cannot crash.
	// A covered form unmounts, but its flag stays until the entry is popped. Width and dirty state
	// come from the whole stack, including an item sitting under a node selector.
	useEffect(() => {
		store.set(stackEntryFlagsAtom, (current) => ({
			...current,
			[stackIndex]: {
				pending: hasPendingChanges,
				submitting: isSubmitting,
				selected: itemMode === 'selected'
			}
		}));
		return () => {
			if (formsStackData[stackIndex] === stableFormContext) return;
			store.set(stackEntryFlagsAtom, (current) => {
				const next = { ...current };
				delete next[stackIndex];
				return next;
			});
		};
	}, [formsStackData, hasPendingChanges, isSubmitting, itemMode, stackIndex, stableFormContext, store]);
	// If rendered in a dialog, update the dialog's isSubmitting and hasPendingChanges. Only the root form.
	// Every stacked entry is included, so an item under another stacked form still counts.
	useEffect(() => {
		if (!isStackedForm)
			updateSubmittingOrHasPendingChanges?.({
				isSubmitting: stackSummary.submitting,
				hasPendingChanges: stackSummary.pending
			});
	}, [isStackedForm, stackSummary.pending, stackSummary.submitting, updateSubmittingOrHasPendingChanges]);

	// Live invalid ids. The first read is immediate; later edits wait out the pause in the hook,
	// so the alert's count is not rewritten on every keystroke.
	const localInvalidFieldIds = useInvalidFieldIds(
		atoms.validationByFieldId,
		irrelevantFieldPaths,
		repeat?.fieldId,
		fieldUpdates$
	);
	const invalidForm = localInvalidFieldIds.length > 0;
	const parentInvalidFieldIds = useInvalidFieldIds(
		parentAtoms?.validationByFieldId,
		parentEntry?.formControllerState?.irrelevantFieldPaths,
		undefined,
		parentEntry?.fieldUpdates$
	);

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

	// Freeze formMainContent (content scroller) and formContainer (hosts the absolute drawer) while the ToC drawer is open.
	// --scroll-top must live on formContainer so both drawers can inherit it.
	// Keyed on the atom, so every close path (Drawer onClose, section/field click, expansion toggle) releases the lock.
	useLayoutEffect(() => {
		if (!openDrawerSidebar) return;
		const root = containerRef.current;
		const scroller = getScrollContainer(root);
		const scrollTop = scroller.scrollTop;
		scroller.style.overflowY = 'hidden';
		root.style.overflowY = 'hidden';
		scroller.scrollTop = scrollTop;
		root.style.setProperty('--scroll-top', `${root.scrollTop}px`);
		return () => {
			scroller.style.overflowY = '';
			root.style.overflowY = '';
			root.style.removeProperty('--scroll-top');
		};
	}, [openDrawerSidebar]);
	const handleOpenDrawerSidebar = () => setOpenDrawerSidebar(true);
	const handleCloseDrawerSidebar: DrawerProps['onClose'] = () => setOpenDrawerSidebar(false);
	const popTopStackedForm = (restoreOpenedItem: boolean) => {
		const childEntry = formsStackData[formsStackData.length - 1];
		const childMode = childEntry?.itemFormMode ? store.get(childEntry.itemFormMode) : null;
		// The child form item unlocking should be getting done by the FormOrchestrator of the unmounting form via useUnlockOnClose hook.
		childEntry?.props.stackIndex === 0 && (containerRef.current.style.overflowY = '');
		if (restoreOpenedItem && childEntry) {
			const repeat = childEntry.props.repeat;
			const parentEntry = formsStackData[formsStackData.length - 2];
			const parentOfChild = stackEntryAtoms(parentEntry);
			const itemsAtom = repeat?.fieldId ? parentOfChild?.valueByFieldId[repeat.fieldId] : undefined;
			if (itemsAtom) {
				const current = store.get(itemsAtom);
				const parentList = repeat?.fieldId ? parentEntry?.originalValues?.[repeat.fieldId] : undefined;
				const next = stackedRepeatItemAfterClose({
					wasSelectedItemForm: childEntry.itemFormMode != null,
					items: Array.isArray(current) ? current : undefined,
					index: repeat?.index,
					checkpoint: childEntry.originalValues ?? undefined,
					parentCheckpoint: Array.isArray(parentList) ? parentList : undefined
				});
				if (next) store.set(itemsAtom, next);
			}
		}
		contextApi.popForm();
		// An item form that left selected-fields mode returns to the parent. Scroll to its repeat.
		if (childMode === 'full' && childEntry?.props.repeat?.fieldId) {
			const reveal = revealField(store.get(atoms.formVisibility), childEntry.props.repeat.fieldId);
			commitFormVisibility(store.set, atoms, reveal.state, reveal.fieldId);
		}
	};
	const handleCloseDrawerForm: DrawerProps['onClose'] = () => {
		if (!hasStackedForms) return;
		const childEntry = formsStackData[formsStackData.length - 1];
		const childMode = childEntry.itemFormMode ? store.get(childEntry.itemFormMode) : null;
		const childState = getCurrentChildFormStateSummary(store, formsStackData);
		const action = stackedFormCloseAction({
			mode: childMode,
			isRepeatItem: Boolean(childEntry.props.repeat),
			isSubmitting: childState.isSubmitting,
			stackSubmitting,
			hasPendingChanges: childState.hasPendingChanges
		});
		// Selected-fields mode closes the whole dialog. The dialog shows the one unsaved prompt.
		// Do not pop first: cancelling that prompt would have already dropped the item.
		if (action === 'closeDialog') {
			enhancedDialogOnClose?.(null, null);
			return;
		}
		if (action === 'wait') {
			displayFormBeingSavedSnack(dispatch, formatMessage);
		} else if (action === 'confirmPop') {
			displayWithPendingChangesConfirm(dispatch, () => popTopStackedForm(true));
		} else {
			// Nothing is pending, so the checkpoint is what the item form shows. Put that back.
			popTopStackedForm(true);
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

	const { save: saveFn } = useSaveForm({
		onSave,
		isEmbedded,
		isStackedForm,
		isCreateMode,
		isRepeatMode,
		createPath: Boolean(create?.path) ? pathInSite : undefined, // pathInSite is the result of processing the create path with macros.
		onClose: () => {
			// Done already wrote the item. Popping must not put the opened values back.
			if (props.onCommittedClose) {
				props.onCommittedClose();
				return;
			}
			onCloseHandler?.(null, null);
		},
		onMinimize: () => props.onMinimize?.()
	});

	// Published after paint layout, not during render. The refs stay current, so a click reads this save.
	const rootActionRefs = useUpdateRefs({ save: saveFn, setSaveAsDraft: setSaveAsDraftAction });
	useLayoutEffect(() => {
		if (stackIndex !== 0) return;
		// Stable mutable registry for the item form, not React state. Read .current when Save is clicked.
		publishRootFormActions(rootFormActions, rootActionRefs);
	}, [rootActionRefs, rootFormActions, stackIndex]);

	const itemLaunchStarted = useRef(false);
	const launchedForAtoms = useRef<FormsEngineAtoms | null>(null);
	useEffect(() => {
		if (launchedForAtoms.current !== atoms) {
			itemLaunchStarted.current = false;
			launchedForAtoms.current = atoms;
		}
		if (itemLaunchStarted.current || isStackedForm || isRepeatMode) return;
		const visibilityState = store.get(atoms.formVisibility);
		const repeatFieldId = visibilityState.itemForm?.fieldId;
		const valueAtom = repeatFieldId ? atoms.valueByFieldId[repeatFieldId] : undefined;
		const items = valueAtom ? store.get(valueAtom) : undefined;
		const launch = itemLaunchFrom(visibilityState, Array.isArray(items) ? items.length : 0);
		if (!launch || !valueAtom || !Array.isArray(items)) {
			// This launch will not open an item form. Scroll the parent to the repeat and drop the marker.
			const missed = missedItemLaunch(visibilityState, Array.isArray(items) ? items : null);
			if (missed) {
				itemLaunchStarted.current = true;
				console.warn(missed.warning);
				commitFormVisibility(store.set, atoms, missed.reveal.state, missed.reveal.fieldId);
			}
			return;
		}
		const visibleLaunch = itemLaunchVisibleChildren(launch, irrelevantFieldPaths);
		if (launch.fieldIds?.length && visibleLaunch.fieldIds == null) {
			console.warn(
				`Every selected field of "${launch.fieldId}" is hidden by the form controller. Opening the whole item.`
			);
		}
		itemLaunchStarted.current = true;
		store.set(atoms.formVisibility, { ...visibilityState, itemForm: null });
		// The marker is cleared in this same step. The parent body stays hidden until the drawer enters.
		contextApi.pushForm({
			...repeatItemFormProps({
				fieldId: visibleLaunch.fieldId,
				index: visibleLaunch.index,
				values: items[visibleLaunch.index] as Record<string, unknown>,
				fieldIds: visibleLaunch.fieldIds,
				getItems: () => (store.get(valueAtom) as Record<string, unknown>[]) ?? [],
				setItems: (next) => store.set(valueAtom, next)
			}),
			// A whole item uses the parent Save card too. The pencil and Add leave this unset.
			selectedItemForm: true,
			onMinimize: props.onMinimize
		});
	}, [atoms, contextApi, irrelevantFieldPaths, isRepeatMode, isStackedForm, props.onMinimize, store]);

	// Selected-fields mode writes the open item into the parent on entry and on each edit.
	// Full-mode edits are included by the write on entry, so Back to selected fields then Save keeps them.
	useEffect(() => {
		if (itemMode !== 'selected' || !parentAtoms || repeat?.index === undefined) return;
		const valueAtom = parentAtoms.valueByFieldId[repeat.fieldId];
		if (!valueAtom) return;
		const index = repeat.index;
		const write = () => {
			const current = store.get(valueAtom);
			if (!Array.isArray(current)) return;
			const next = writeItemToParent(current, index, extractAtomValues(store, atoms.valueByFieldId));
			if (next !== current) store.set(valueAtom, next);
		};
		write();
		const subscription = fieldUpdates$.subscribe(write);
		return () => subscription.unsubscribe();
	}, [atoms.valueByFieldId, fieldUpdates$, itemMode, parentAtoms, repeat?.fieldId, repeat?.index, store]);

	const parentFieldOrder = useMemo(
		() => parentEntry?.itemMeta.contentType.sections?.flatMap((section) => section.fields) ?? [],
		[parentEntry]
	);
	const validationErrors = validationErrorsAlert({
		localInvalidFieldIds,
		localSectionOrder: isRepeatMode ? repeatFieldIdList : countFieldIds,
		localIrrelevant: irrelevantFieldPaths,
		localParentPath: repeat?.fieldId,
		includeParent: itemMode === 'selected',
		openRepeatFieldId: repeat?.fieldId,
		parent: parentEntry
			? {
					invalidFieldIds: parentInvalidFieldIds,
					sectionOrder: parentFieldOrder,
					irrelevantFieldPaths: parentEntry.formControllerState?.irrelevantFieldPaths
				}
			: undefined
	});
	const validationFieldName = (() => {
		if (!validationErrors) return undefined;
		const fields =
			validationErrors.where === 'parent'
				? parentEntry?.itemMeta.contentType.fields
				: isRepeatMode
					? contentType.fields[repeat?.fieldId]?.fields
					: contentType.fields;
		return fields?.[validationErrors.fieldId]?.name;
	})();
	const useParentSaveCard = itemMode === 'selected' && parentAtoms != null;
	const showValidationField = () => {
		if (!validationErrors) return;
		if (validationErrors.where === 'local') {
			const reveal = showValidationError({
				visibility: store.get(atoms.formVisibility),
				fieldId: validationErrors.fieldId,
				irrelevantFieldPaths,
				parentPath: repeat?.fieldId
			});
			commitFormVisibility(store.set, atoms, reveal.state, reveal.fieldId);
			return;
		}
		if (!parentAtoms) return;
		const reveal = revealField(store.get(parentAtoms.formVisibility), validationErrors.fieldId);
		commitFormVisibility(store.set, parentAtoms, reveal.state, reveal.fieldId);
		contextApi.popForm();
	};
	const saveFromSelectedItem = async (_event: unknown, draft?: boolean) => {
		if (!parentAtoms || !parentEntry) return;
		const [itemInvalidFieldIds, parentInvalidNow] = await Promise.all([
			readInvalidFieldIds(store, atoms.validationByFieldId, irrelevantFieldPaths, repeat?.fieldId),
			readInvalidFieldIds(store, parentAtoms.validationByFieldId, parentEntry.formControllerState?.irrelevantFieldPaths)
		]);
		const plan = selectedItemSavePlan({
			draft: draft === true,
			itemVisibility: store.get(atoms.formVisibility),
			itemInvalidFieldIds,
			itemFieldOrder: repeatFieldIdList,
			parentVisibility: store.get(parentAtoms.formVisibility),
			parentInvalidFieldIds: parentInvalidNow,
			parentFieldOrder,
			itemIrrelevant: irrelevantFieldPaths,
			parentIrrelevant: parentEntry.formControllerState?.irrelevantFieldPaths,
			itemParentPath: repeat?.fieldId
		});
		if (plan.action === 'revealItem') {
			commitFormVisibility(store.set, atoms, plan.reveal.state, plan.reveal.fieldId);
			return 'revealed' as const;
		}
		if (plan.action === 'blocked') return 'invalid' as const;
		if (plan.action === 'revealParent') {
			commitFormVisibility(store.set, parentAtoms, plan.reveal.state, plan.reveal.fieldId);
			contextApi.popForm();
			return 'revealed' as const;
		}
		// SaveCard already set the root draft flag. Read save at click time.
		return rootFormActions.save(draft);
	};

	// If not on a dialog or the prop is not provided, there's no need to handle the close. The form is running in a standalone mode.
	const handleClose: ButtonProps['onClick'] = (e) => {
		if (isSubmitting) {
			displayFormBeingSavedSnack(dispatch, formatMessage);
		} else {
			// If `hasPendingChanges`, we're still calling close assuming the EnhancedDialog will handle showing the close without saving confirm.
			onCloseHandler?.(e, null);
		}
	};

	const [mainContent, setMainContent] = useState<HTMLDivElement | null>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const cancelFieldScrollRef = useRef<(() => void) | null>(null);
	const pendingFieldScrollRef = useRef<{ sectionId: string; start: () => void } | null>(null);

	const mainContentRefCallback: RefCallback<HTMLDivElement> = setMainContent;

	const beginSettledFieldScroll = useCallback((fieldId: string, focus: boolean) => {
		cancelFieldScrollRef.current?.();
		const root = containerRef.current;
		if (!root) return;
		cancelFieldScrollRef.current = scrollToFieldWhenSettled(root, fieldId, { focus });
	}, []);

	// Collapse when the sentinel (~60px) scrolls out of view. The header is a sibling of this scroll
	// root, so collapsing it grows clientHeight and can pull the sentinel back — only collapse when
	// overflow exceeds the header height plus the sentinel offset, which that growth can't eat into.
	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!mainContent || !sentinel) return;

		let isIntersecting = true;
		const checkThreshold = () => {
			const header = mainContent.parentElement?.querySelector<HTMLElement>('[data-area-id="formHeader"]');
			const overflow = mainContent.scrollHeight - mainContent.clientHeight;
			// Collapsing frees up to the header's height; scrollTop must still clear the sentinel's offset afterwards.
			const sentinelOffset = sentinel.offsetTop;
			setCollapseHeader(!isIntersecting && overflow > (header?.offsetHeight ?? 0) + sentinelOffset);
		};

		const intersectionObserver = new IntersectionObserver(
			([entry]) => {
				isIntersecting = entry.isIntersecting;
				checkThreshold();
			},
			{ root: mainContent, threshold: 0, rootMargin: '0px' }
		);
		intersectionObserver.observe(sentinel);

		// Re-check the same threshold when section content or the scroll root resizes (e.g. collapsing a
		// SectionAccordion, or the dialog/viewport changing mainContent.clientHeight). The intersection
		// observer alone won't fire for that, so collapseHeader could otherwise get stuck.
		const resizeObserver = new ResizeObserver(checkThreshold);
		const contentContainer = sentinel.nextElementSibling;
		if (contentContainer) resizeObserver.observe(contentContainer);
		resizeObserver.observe(mainContent);

		return () => {
			intersectionObserver.disconnect();
			resizeObserver.disconnect();
		};
	}, [mainContent]);

	const pendingScrollFieldId = useAtomValue(atoms.pendingScrollFieldId);
	const pendingScrollFocus = useAtomValue(atoms.pendingScrollFocus);
	// True between starting a scroll and the effect re-running because that start cleared
	// `pendingScrollFieldId`. That re-run has no target and must leave the observer in place.
	// A later run with no target (the scope changed and the field is gone) cancels it.
	const retainSettledScrollRef = useRef(false);
	// Set immediately before clearing pendingScrollFieldId, so the follow-up run does not
	// scroll to fieldToScroll and take the reveal's place.
	const clearingPendingRef = useRef(false);
	// fieldToScroll already scrolled. A later visibility change must not scroll it again.
	const lastFieldToScrollRef = useRef<string | null>(null);
	const cancelSettledScroll = useCallback(() => {
		cancelFieldScrollRef.current?.();
		cancelFieldScrollRef.current = null;
		pendingFieldScrollRef.current = null;
	}, []);
	// Scroll to a requested field once form body layout settles (lazy controls, RTEs, images).
	// `fieldToScroll` is a prop and does not move focus. `pendingScrollFieldId` is a reveal,
	// or the launch fallback scroll, which sets pendingScrollFocus false.
	useEffect(() => {
		const plan = planSettledFieldScroll({
			pendingScrollFieldId,
			fieldToScroll,
			clearingPending: clearingPendingRef.current,
			retainSettledScroll: retainSettledScrollRef.current,
			hasMainContent: Boolean(mainContent),
			focusPending: pendingScrollFocus,
			lastFieldToScroll: lastFieldToScrollRef.current
		});
		lastFieldToScrollRef.current = plan.rememberFieldToScroll;
		if (plan.action === 'keep') {
			clearingPendingRef.current = false;
			return;
		}
		retainSettledScrollRef.current = plan.retainSettledScroll;
		if (plan.action === 'idle') {
			if (plan.cancelInFlight) cancelSettledScroll();
			return;
		}
		cancelSettledScroll();
		const fieldId = plan.fieldId;
		const focus = Boolean(plan.focus);
		const sectionId = visibleSections.find((section) => section.fields.includes(fieldId))?.id;
		const expandedAtom = sectionId ? atoms.expandedStateBySectionId[sectionId] : null;
		const isExpanding = expandedAtom && !store.get(expandedAtom);
		if (isExpanding) {
			store.set(expandedAtom, true);
			pendingFieldScrollRef.current = {
				sectionId,
				start: () => beginSettledFieldScroll(fieldId, focus)
			};
		} else {
			beginSettledFieldScroll(fieldId, focus);
		}
		if (plan.clearPending) {
			clearingPendingRef.current = true;
			store.set(atoms.pendingScrollFieldId, null);
		}
	}, [
		pendingScrollFieldId,
		pendingScrollFocus,
		fieldToScroll,
		mainContent,
		visibleSections,
		atoms.expandedStateBySectionId,
		atoms.pendingScrollFieldId,
		store,
		beginSettledFieldScroll,
		cancelSettledScroll
	]);
	useEffect(() => cancelSettledScroll, [cancelSettledScroll]);

	// Hide the parent fields until the item drawer has entered. The layout and drawer stay mounted.
	const hideParentBody =
		!isStackedForm &&
		!isRepeatMode &&
		parentBodyHiddenForItemLaunch(itemLaunchBlocksParent(visibility, pendingItemLength), itemLaunchEntering);
	const finishStackedDrawerEnter = useCallback(() => {
		const paper = containerRef.current?.querySelector(
			`[data-area-id="stackedFormDrawer"] .${drawerClasses.paper}`
		) as HTMLDivElement | null;
		if (paper && !paper.contains(document.activeElement)) {
			paper.focus();
		}
		setDisableStackedFormDrawerAutoFocus(false);
		setItemLaunchEntering(false);
	}, []);

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
					<Box
						component={Container}
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							pt: 2
						}}
					>
						<Typography variant="body2" color="textSecondary">
							<span title={siteId}>{activeSite.name}</span> / <span title={contentType.id}>{contentType.name}</span>
						</Typography>
						<Box sx={[isDialog && { position: 'absolute', top: theme.spacing(1), right: theme.spacing(1) }]}>
							{props.onMinimize && (
								<Tooltip title={<FormattedMessage defaultMessage="Minimize" />}>
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
				hideParentBody ? (
					<Grid size={12}>
						<LoadingState
							title={<FormattedMessage defaultMessage="Please wait" />}
							subtitle={<FormattedMessage defaultMessage="Gathering content information" />}
						/>
					</Grid>
				) : (
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
							{useCollapsedToC && !openDrawerSidebar && <FieldScopeNotice countFieldIds={countFieldIds} />}
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
							{formControllerFileMissing && (
								<Alert severity="warning" variant="outlined">
									<AlertTitle>
										<FormattedMessage defaultMessage="Form controller missing" />
									</AlertTitle>
									<FormattedMessage defaultMessage="This content type has a client-side form controller enabled, but form-controller.js was not found. The form will open without a custom controller." />
								</Alert>
							)}
							{formControllerLoadFailed && (
								<Alert severity="warning" variant="outlined">
									<AlertTitle>
										<FormattedMessage defaultMessage="Form controller failed to load" />
									</AlertTitle>
									<FormattedMessage defaultMessage="This content type has a client-side form controller, but it could not be loaded. Check form-controller.js for syntax or export errors. The form will open without a custom controller." />
								</Alert>
							)}
							{isRepeatMode ? (
								// Repeat-item editor: subfields are not grouped into sections.
								<Paper sx={{ p: 2 }}>
									{(repeatFields ?? []).map((field, index) =>
										renderFieldControl(
											field,
											stableFormContext.atoms.valueByFieldId,
											index === 0,
											readonly,
											contentType
										)
									)}
								</Paper>
							) : (
								visibleSections.map((section, sectionIndex) => (
									<SectionAccordion
										key={section.id}
										section={section}
										slotProps={{
											transition: {
												onEntered: () => {
													const pending = pendingFieldScrollRef.current;
													if (pending?.sectionId === section.id) {
														pending.start();
														pendingFieldScrollRef.current = null;
													}
												}
											}
										}}
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
							<FormBackToTop containerRef={containerRef} getScrollContainer={getScrollContainer} />
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
										{validationErrors && (
											<ValidationErrorsAlert
												count={validationErrors.count}
												fieldName={validationFieldName}
												onShow={showValidationField}
											/>
										)}
										<SaveCard
											isEmbedded={useParentSaveCard ? isEmbeddedForm(parentEntry?.props ?? {}) : isEmbedded}
											isStackedForm={useParentSaveCard ? false : isStackedForm}
											isRepeatMode={useParentSaveCard ? false : isRepeatMode}
											atoms={useParentSaveCard ? parentAtoms : undefined}
											setSaveAsDraft={useParentSaveCard ? rootFormActions.setSaveAsDraft : setSaveAsDraftAction}
											onSave={useParentSaveCard ? saveFromSelectedItem : (_event, draft) => saveFn(draft)}
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
				)
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
						setItemLaunchEntering(false);
					}}
					onTransitionEnd={
						// onTransitionEnd keeps triggering after the Drawer transition has finished on certain interactions (e.g. when hovering buttons)
						// This callback is also invoked during other transitions other than the Drawer's open transition.
						disableStackedFormDrawerAutoFocus
							? (e) => {
									// Make sure it is the drawer paper that finished transitioning before considering the transition complete.
									if ((e.target as HTMLElement).getAttribute('data-area-id') !== 'stackedFormDrawerPaper') return;
									finishStackedDrawerEnter();
								}
							: undefined
					}
					sx={{
						top: 'var(--scroll-top)',
						position: 'absolute',
						[`& > .${paperClasses.root}`]: {
							top: 0,
							width: stackSummary.fullWidth ? '100%' : 'calc(var(--container-width) - 100px)',
							height: isDialog ? `var(--container-height)` : '100vh',
							position: 'absolute'
						}
					}}
					slotProps={{
						paper: {
							// @ts-expect-error Setting a html prop
							'data-area-id': 'stackedFormDrawerPaper'
						}
					}}
				>
					{hasStackedForms && (
						<FormBootstrap
							key={stackedFormKey}
							stackIndex={formsStackData.length - 1}
							{...currentStackedFormProps}
							stackTransitionEnded={!disableStackedFormDrawerAutoFocus}
							isDialog={isDialog}
							onClose={handleCloseDrawerForm}
							onCommittedClose={() => popTopStackedForm(false)}
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
//  - Form controller: landed (see formControllers/ + docs/type-builder-forms-engine.md §5.9)
//  - FOR LATER...
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
