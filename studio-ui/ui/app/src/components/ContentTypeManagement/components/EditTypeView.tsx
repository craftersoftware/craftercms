/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import ContentType, {
	ContentTypeField,
	ContentTypeSection,
	DataSource,
	FormDefinitionPlugin,
	NewContentTypeField,
	NewDataSource,
	PossibleContentTypeDraft
} from '../../../models/ContentType';
import LookupTable from '../../../models/LookupTable';
import React, { createElement, forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
	applyTranslations,
	buildContentTypeXml,
	CONTENT_TYPES_BASE_PATH,
	createDataSourceValuesObject,
	createEmptyTypeStructure,
	createFieldFormContextApi,
	createTypeFieldValuesObject,
	createTypeFormValuesObject,
	createTypeTemplate,
	createVirtualTypeForDataSource,
	createVirtualTypeForField,
	createVirtualTypeFormContext,
	createVirtualTypeForSection,
	DescriptorContentType,
	editTypeController,
	editTypeTemplate,
	getFieldFromType,
	getPropertiesAndValidationsFromDescriptor,
	getSectionFromType,
	isComposedPath,
	NEW_DATASOURCE_ID,
	NEW_FIELD_ID,
	prepareSerializeToXmlTypeObject,
	reverseTypeFieldValuesObject,
	systemFieldsIdsMap,
	systemFieldsTypesMap,
	TYPE_GROOVY_CONTROLLER_BASE_PATH,
	TYPE_TEMPLATE_BASE_PATH,
	TypePropsToEdit,
	typePropsToEdit
} from '../utils';
import { extractAtomValues, useShowAlert } from '../../FormsEngine/lib/formUtils';
import TypeBuilderFormsEngine, { FieldFormViewProps } from './TypeBuilderFormsEngine';
import controlDescriptors from '../descriptors/controls';
import dataSourceDescriptors from '../descriptors/dataSources';
import type { BuiltInControlType } from '../../FormsEngine/lib/controlMap';
import TypeDetailsView, { TypeDetailsViewProps } from './TypeDetailsView';
import {
	FormsEngineAtoms,
	FormsEngineFormApiContextProps,
	StableFormContextProps
} from '../../FormsEngine/lib/formsEngineContext';
import useContentTypes from '../../../hooks/useContentTypes';
import { createStore as createJotai, Provider } from 'jotai';
import { debounceTime, forkJoin, map, Observable, Subject } from 'rxjs';
import EditTypeViewLayout, { EditAppLayoutProps } from './EditTypeViewLayout';
import useUpdateRefs from '../../../hooks/useUpdateRefs';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import { JotaiStore } from '../../FormsEngine/types';
import { FormattedMessage, useIntl } from 'react-intl';
import { createLookupTable, nnou, pluckProps, reversePluckProps } from '../../../utils/object';
import Box, { BoxProps } from '@mui/material/Box';
import useEnhancedDialogContext from '../../EnhancedDialog/useEnhancedDialogContext';
import { fetchSiteUiConfig, writeConfiguration } from '../../../services/configuration';
import { createConfigPathFromTypeId, createFormDefinitionPathFromTypeId } from '../../../utils/contentType';
import { useDispatch } from 'react-redux';
import { popDialog, pushDialog } from '../../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import useEnv from '../../../hooks/useEnv';
import { deserialize, fromString, serialize } from '../../../utils/xml';
import useSpreadState from '../../../hooks/useSpreadState';
import { asArray } from '../../../utils/array';
import { fetchContentItem } from '../../../services/content';
import { batchActions } from '../../../state/actions/misc';
import { fetchItemVersions } from '../../../state/actions/versions';
import { getRootPath } from '../../../utils/path';
import { showHistoryDialog } from '../../../state/actions/dialogs';
import { XmlViewerDialog } from './XmlViewerDialog';
import useEnhancedDialogState from '../../../hooks/useEnhancedDialogState';
import { XmlDiffDialog } from './XmlDiffDialog';
import type { ReorderFieldsDialogProps } from './ReorderFieldsDialog';
import PickControlDialog from './PickControlDialog';
import PickDataSourceDialog from './PickDataSourceDialog';
import { fetchContentTypes } from '../../../state/actions/preview';
import { getXmlBuilder, valueSerializersLookup } from '../../FormsEngine/lib/valueSerializers';
import { pushErrorDialog } from '../../../utils/system';
import { showSystemNotification } from '../../../state/actions/system';
import { extractErrorPayload } from '../../../utils/ajax';
import Typography from '@mui/material/Typography';
import { AjaxError } from 'rxjs/ajax';
import { sectionDescriptor, typeBasicDetailsDescriptor } from '../descriptors/controls/commonDescriptors';

export interface EditTypeAppProps {
	/**
	 * The content type object structure that represents what's actually stored in the system.
	 * In the case of new/create, it would not have been stored yet (no XML file).
	 **/
	type: PossibleContentTypeDraft;
	sx?: BoxProps['sx'];
	style?: BoxProps['style'];
	onClose?: () => void;
}

// How this works:
//
// => Note: "Artefact" refers to a field, section, data source, or the type metadata (its "basic" details.)
//
// - A type object is received and cloned as the working copy on which edits will be made
//
// - When a field/section/etc is clicked, the fieldFormContext for the selected field gets created if it doesn't exist
// - The TypeBuilderFormsEngine component gets the needed contexts as props
//   - Each descriptor gets mapped to a "virtual" ContentType data structure to render a FormsEngine-like form using FormsEngine control components
// - The TypeBuilderFormsEngine updates atoms internally with user input. Atoms will live past the form on the EditTypeView.
// - When "save" is requested, the EditTypeView merges the basic details, the non-edited field values, the manipulated field atoms into a single object that gets serialized to XML and stored
//
// - When a field is added/removed...

interface EditAppContextProps {
	fieldUpdates$: Subject<string>;
	formContextApi: FormsEngineFormApiContextProps;
	activeFormContext: StableFormContextProps;
	selectedField: ContentTypeField;
	selectedSection: ContentTypeSection;
	selectedDataSource: DataSource;
	/**
	 * Keeps track of whether anything was changed when any form (type, field, section, data source) was opened.
	 * Resets when the form closes or changes to a different artefact (type, field, etc.)
	 * Used to avoid committing changes where not necessary.
	 **/
	formFieldsChanged: boolean;
}

export interface ContentTypeManagementConfig {
	controls: LookupTable<{ descriptor?: DescriptorContentType; icon: { id: string }; id: string }>;
	controlExclusions: string[];
	dataSources: LookupTable<{ descriptor?: DescriptorContentType; icon: { id: string }; id: string }>;
	dataSourceExclusions: string[];
}

export const EditTypeView = forwardRef<HTMLDivElement, EditTypeAppProps>((props, ref) => {
	const { onClose } = props;

	const site = useActiveSiteId();
	const contentTypesLookup = useContentTypes();
	const showAlert = useShowAlert();
	const { formatMessage } = useIntl();
	const jotai = useMemo(() => createJotai(), []); // TODO: Use stable memo?
	const dispatch = useDispatch();
	const { activeEnvironment } = useEnv();

	const dialogContext = useEnhancedDialogContext();
	const stateRef = useRef<EditAppContextProps>(null);
	if (!stateRef.current) stateRef.current = createContextObject();

	const [type, setType] = useState(() => ({ ...props.type })); // Working copy of the ContentType being edited.
	const [open, setOpen] = useState(false);
	const xmlViewerDialogState = useEnhancedDialogState();
	const [xmlViewerContent, setXmlViewerContent] = useState<string>(undefined);
	const xmlDiffDialogState = useEnhancedDialogState();
	const [xmlDiffContent, setXmlDiffContent] = useState<{ initialContent: string; currentContent }>(undefined);
	const [selectedFieldIdPath, setSelectedFieldIdPath] = useState<string>(null);
	const [hasPendingChanges, setHasPendingChanges] = useState(false);
	const [virtualContentType, setVirtualContentType] = useState<ContentType>(null);
	const [fieldFormViewProps, setFieldFormViewProps] = useState<FieldFormViewProps>(null);
	const [fieldPathsWithErrors, setFieldPathsWithErrors] = useState<LookupTable<boolean>>({});
	const [config, setConfig] = useSpreadState<ContentTypeManagementConfig>({
		controls: null,
		controlExclusions: null,
		dataSources: null,
		dataSourceExclusions: null
	});
	const [drawerOpenTransitionEnded, setDrawerOpenTransitionEnded] = useState(false);
	const [insertFieldData, setInsertFieldData] = useState<{ sectionId: string; fieldPath?: string }>({
		sectionId: null,
		fieldPath: null
	});
	const [openDataSourceInserter, setOpenDataSourceInserter] = useState<boolean>(false);

	const [activeFormHasErrors, setActiveFormHasErrors] = useState<boolean>(false);
	const [validatingForm, setValidatingForm] = useState<boolean>(false);
	const configDescriptors = useMemo(() => {
		const controlDescriptors = Object.values(config?.controls ?? {}).map(({ descriptor }) => descriptor);
		const dataSourceDescriptors = Object.values(config?.dataSources ?? {}).map(({ descriptor }) => descriptor);

		return {
			controlDescriptors: controlDescriptors.length ? createLookupTable(controlDescriptors) : null,
			dataSourceDescriptors: dataSourceDescriptors.length ? createLookupTable(dataSourceDescriptors) : null
		};
	}, [config?.controls, config?.dataSources]);
	const { configControlDescriptors, configDataSourceDescriptors } = useMemo(() => {
		return {
			configControlDescriptors: config?.controls
				? Object.values(config?.controls)
						.map(({ descriptor }) => descriptor)
						.filter((descriptor) => nnou(descriptor))
				: [],
			configDataSourceDescriptors: config?.dataSources
				? Object.values(config?.dataSources)
						.map(({ descriptor }) => descriptor)
						.filter((descriptor) => nnou(descriptor))
				: []
		};
	}, [config]);

	/** Saves and commits the state changes. Returns undefined if no changes occurred. */
	const commitOpenFormChanges = () => {
		// No form open, nothing to commit. Or, a form was opened but no changes were made.
		if (!open || !stateRef.current.formFieldsChanged) return;
		let updatedType: ContentType;
		const values = extractAtomValues(jotai, stateRef.current.activeFormContext.atoms.valueByFieldId);
		if (stateRef.current.selectedField) {
			updatedType = updateTypeFromFieldUpdate(
				type,
				stateRef.current,
				values,
				selectedFieldIdPath,
				configDescriptors.controlDescriptors
			);
		} else if (stateRef.current.selectedSection) {
			updatedType = updateTypeFromSectionUpdate(type, stateRef.current.selectedSection, values);
		} else if (stateRef.current.selectedDataSource) {
			const currentDataSource = stateRef.current.selectedDataSource;
			const descriptor =
				dataSourceDescriptors[currentDataSource.type] ?? config.dataSources?.[currentDataSource.type]?.descriptor;
			if (!descriptor) {
				console.error(`No data source descriptor found for type "${currentDataSource.type}"`);
				return type;
			}
			updatedType = updateTypeFromDataSourceUpdate(type, currentDataSource, values, descriptor);
		} else {
			// There's no selected field, section or data source, so assume the type itself is being edited.
			updatedType = updateTypeProps(type, values as TypePropsToEdit);
		}
		setType(updatedType);
		return updatedType;
	};
	/** Returns true if no form is opened or if the active form it's all valid and can be committed and closed. Returns false otherwise. */
	const performCurrentFormErrorCheckAndWarning = () => {
		if (open && activeFormHasErrors) {
			showAlert(formatMessage({ defaultMessage: 'Please resolve any issues prior to closing the form' }));
			return false;
		}
		return true;
	};
	/** Closes the active form and cleans up state. */
	const closeAndCleanup = () => {
		if (!performCurrentFormErrorCheckAndWarning()) return false;
		commitOpenFormChanges();
		stateRef.current.selectedField = null;
		stateRef.current.selectedSection = null;
		stateRef.current.selectedDataSource = null;
		stateRef.current.formFieldsChanged = false;
		// `activeFormContext` is not nulled since without it, TypeBuilderFormsEngine would crash
		// stateRef.current.activeFormContext = null;
		setVirtualContentType(null);
		setSelectedFieldIdPath(null);
		setOpen(false);
		return true;
	};
	/** Performs the common steps that must occur when an artefact is selected for editing. */
	const handleArtefactSelected = (
		virtualType: ContentType,
		stableFormContext: StableFormContextProps,
		extraFormProps?: Partial<FieldFormViewProps>
	) => {
		setFieldFormViewProps({
			type,
			virtualType,
			stableFormContext,
			formApiContext: stateRef.current.formContextApi,
			onClose: () => {
				const formValid = effectRefs.current.closeAndCleanup();
				if (!formValid) return;
				setDrawerOpenTransitionEnded(false);
			},
			onDeleteField: handleDeleteField,
			onDeleteSection: handleDeleteSection,
			onDeleteDataSource: handleDeleteDataSource,
			onMoveFieldToSection: handleMoveFieldToSection,
			onReorderSectionFields: handleReorderSectionFields,
			onReorderTypeSections: handleReorderTypeSections,
			onReorderRepGroupFields: handleReorderRepGroupFields,
			onSwapField: handleSwapFileNameField,
			...extraFormProps
		});
		// Note: things set here should be cleaned up in closeAndCleanup
		stateRef.current.activeFormContext = stableFormContext;
		setVirtualContentType(virtualType);
		setOpen(true);
	};

	const handleFieldSelected = (
		fieldIdPath: string,
		field: ContentTypeField,
		sectionId: string,
		overrideType?: ContentType
	) => {
		if (!closeAndCleanup()) return;

		const controlDescriptor =
			controlDescriptors[field.type as BuiltInControlType] ?? config.controls?.[field.type]?.descriptor;
		if (!controlDescriptor)
			return showAlert(`No control descriptor found for field "${field.name}" of type "${field.type}"`);

		// Adding data sources to the virtual type to ensure they are available for rendering in the dataSourceSelector.
		const virtualType = createVirtualTypeForField(
			{ ...controlDescriptor, dataSources: type.dataSources },
			formatMessage
		);
		handleArtefactSelected(
			virtualType,
			createVirtualTypeFormContext(virtualType, createTypeFieldValuesObject(field), contentTypesLookup, {
				fieldUpdates$: stateRef.current.fieldUpdates$
			}),
			{
				field,
				fieldIdPath,
				controlDescriptor: applyTranslations(controlDescriptor, formatMessage),
				sectionId,
				...(overrideType && { type: overrideType })
			}
		);
		setSelectedFieldIdPath(fieldIdPath);
		stateRef.current.selectedField = field;
	};
	const handleSectionSelected = (section: ContentTypeSection, overrideType?: ContentType) => {
		if (!closeAndCleanup()) return;
		const sectionIndex = type.sections.findIndex((s) => s.id === section.id);
		const virtualType = createVirtualTypeForSection(sectionDescriptor, formatMessage);
		handleArtefactSelected(
			virtualType,
			createVirtualTypeFormContext(virtualType, section as unknown as LookupTable<unknown>, contentTypesLookup, {
				fieldUpdates$: stateRef.current.fieldUpdates$
			}),
			{ section, isMainSection: sectionIndex === 0, ...(overrideType && { type: overrideType }) }
		);
		stateRef.current.selectedSection = section;
	};
	const handleDataSourceSelected: TypeDetailsViewProps['onDataSourceSelected'] = (dataSource) => {
		if (!closeAndCleanup()) return;

		const dataSourceDescriptor =
			dataSourceDescriptors[dataSource.type] ?? config.dataSources?.[dataSource.type]?.descriptor;
		if (!dataSourceDescriptor)
			return showAlert(`No control descriptor found for field "${dataSource.title}" of type "${dataSource.type}"`);

		const virtualType = createVirtualTypeForDataSource(dataSourceDescriptor, formatMessage);
		handleArtefactSelected(
			virtualType,
			createVirtualTypeFormContext(virtualType, createDataSourceValuesObject(dataSource), contentTypesLookup, {
				fieldUpdates$: stateRef.current.fieldUpdates$
			}),
			{ dataSource }
		);
		const dataSourceId = dataSource.id ? dataSource.id : NEW_DATASOURCE_ID;
		setSelectedFieldIdPath(dataSourceId);
		stateRef.current.selectedDataSource = dataSource;
	};
	const handleEditTypeProperties = (overrideType?: ContentType) => {
		if (!closeAndCleanup()) return;
		const virtualType = createEmptyTypeStructure(applyTranslations(typeBasicDetailsDescriptor, formatMessage));
		handleArtefactSelected(
			virtualType,
			createVirtualTypeFormContext(virtualType, createTypeFormValuesObject(type), contentTypesLookup, {
				fieldUpdates$: stateRef.current.fieldUpdates$
			}),
			{ ...(overrideType && { type: overrideType }) }
		);
	};

	const onUpdateHasPendingChanges = (hasPendingChanges: boolean) => {
		setHasPendingChanges(hasPendingChanges);
		dialogContext?.updateSubmittingOrHasPendingChanges({ hasPendingChanges });
	};

	const effectRefs = useUpdateRefs({
		jotai,
		selectedFieldIdPath,
		fieldPathsWithErrors,
		activeFormHasErrors,
		closeAndCleanup,
		handleEditTypeProperties,
		onUpdateHasPendingChanges
	});

	const handleCloseDrawer: EditAppLayoutProps['onClose'] = () => effectRefs.current.closeAndCleanup();
	const handleEditTypeAction: TypeDetailsViewProps['onEditTypeAction'] = (e, target) => {
		switch (target) {
			case 'properties': {
				handleEditTypeProperties();
				break;
			}
			case 'template': {
				const templatePath = type.displayTemplate;
				if (templatePath) {
					editTypeTemplate(templatePath, dispatch);
				} else {
					createTypeTemplate(TYPE_TEMPLATE_BASE_PATH, dispatch, (item) => {
						editTypeTemplate(`${item.path}/${item.fileName}`, dispatch);
					});
				}
				break;
			}
			case 'jsController':
				editTypeController(TYPE_GROOVY_CONTROLLER_BASE_PATH, type.id, dispatch, 'javascript');
				break;
			case 'groovyController':
				editTypeController(TYPE_GROOVY_CONTROLLER_BASE_PATH, type.id, dispatch, 'groovy');
				break;
			case 'deleted':
				onClose?.();
				window.top.postMessage(
					{
						type: 'CONTENT_TYPES_ON_DELETED'
					},
					'*'
				);
				break;
		}
	};
	const handleToolbarActionClick: EditAppLayoutProps['onActionClick'] = (e, action) => {
		switch (action) {
			case 'exit':
				if (!performCurrentFormErrorCheckAndWarning()) break;
				if (hasPendingChanges) {
					const id = nanoid();
					dispatch(
						pushDialog({
							id,
							component: 'craftercms.components.ConfirmDialog',
							props: {
								title: <FormattedMessage defaultMessage="Discard changes?" />,
								onOk: () => {
									onClose?.();
									onUpdateHasPendingChanges(false);
									dispatch(popDialog({ id }));
								},
								onCancel: () => dispatch(popDialog({ id }))
							}
						})
					);
				} else {
					onClose?.();
				}
				break;
			case 'save': {
				if (!performCurrentFormErrorCheckAndWarning()) break;
				const latestUpdate = commitOpenFormChanges();
				dialogContext?.updateSubmittingOrHasPendingChanges({ isSubmitting: true });
				const typeToSave = latestUpdate ?? type;
				save(site, typeToSave, configDescriptors).subscribe({
					next() {
						onUpdateHasPendingChanges(false);
						dialogContext?.updateSubmittingOrHasPendingChanges({ isSubmitting: false, hasPendingChanges: false });
						// If the type being saved is new, update the type state to remove the NEW property.
						if ((typeToSave as PossibleContentTypeDraft).NEW) {
							setType(reversePluckProps(typeToSave as PossibleContentTypeDraft, 'NEW'));
						}
						dispatch(
							batchActions([
								fetchContentTypes(),
								showSystemNotification({
									message: formatMessage({ defaultMessage: 'Save successful.' })
								})
							])
						);
					},
					error(error: AjaxError) {
						dialogContext?.updateSubmittingOrHasPendingChanges({ isSubmitting: false });
						showAlert({
							children: (
								<Box>
									<Typography marginBottom={1}>
										<FormattedMessage defaultMessage="Error saving content type" />
									</Typography>
									<Typography variant="body2" color="textSecondary">
										{extractErrorPayload(error).message ?? ''}
									</Typography>
								</Box>
							)
						});
					}
				});
				break;
			}
			case 'viewXml': {
				const xml = buildXmlFromType(type, configDescriptors);
				openViewXml(xml);
				break;
			}
			case 'diff': {
				const initialXml = buildXmlFromType(props.type, configDescriptors);
				const currentXml = buildXmlFromType(type, configDescriptors);
				openDiffXml(initialXml, currentXml);
				break;
			}
			case 'history': {
				fetchContentItem(site, `${CONTENT_TYPES_BASE_PATH}${type.id}/form-definition.xml`).subscribe((item) => {
					dispatch(
						batchActions([
							fetchItemVersions({
								item,
								rootPath: getRootPath(item.path)
							}),
							showHistoryDialog({})
						])
					);
				});
				break;
			}
			case 'rollback': {
				const id = nanoid();
				dispatch(
					pushDialog({
						id,
						component: 'craftercms.components.ConfirmDialog',
						props: {
							body: (
								<FormattedMessage defaultMessage="Are you sure you want to revert all changes made during this session?" />
							),
							onOk: () => {
								resetSelection();
								setType(props.type);
								dispatch(popDialog({ id }));
							},
							onCancel: () => dispatch(popDialog({ id }))
						}
					})
				);
				break;
			}
		}
	};

	const resetSelection = () => {
		setSelectedFieldIdPath(null);
		stateRef.current.selectedField = null;
		setVirtualContentType(null);
		setFieldFormViewProps(null);
		setHasPendingChanges(false);
		setDrawerOpenTransitionEnded(false);
		setOpen(false);
	};

	// region insert
	const onOpenInsertFieldDialog = (sectionId: string, fieldPath?: string) => {
		if (!performCurrentFormErrorCheckAndWarning()) return false;
		setInsertFieldData({ sectionId, fieldPath });
	};

	const onOpenInsertDataSourceDialog = () => {
		if (!performCurrentFormErrorCheckAndWarning()) return false;
		setOpenDataSourceInserter(true);
	};

	const handleInsertSection: TypeDetailsViewProps['onInsertSection'] = (section, position) => {
		setType(insertSection(type, section, position));
		onUpdateHasPendingChanges(true);
		handleSectionSelected(section);
	};
	const handleInsertField = (fieldType: string, position: number): void => {
		const { sectionId, fieldPath } = insertFieldData;
		setInsertFieldData({ sectionId: null });
		const configEntry = config.controls?.[fieldType];
		const descriptor = controlDescriptors[fieldType] ?? configEntry?.descriptor;
		if (!descriptor) {
			showAlert(`No control descriptor found for field type "${fieldType}"`);
			return;
		}
		const newField = getNewFieldFromDescriptor(fieldType, descriptor, configEntry);
		const newFieldPath = fieldPath ? `${fieldPath}.${NEW_FIELD_ID}` : NEW_FIELD_ID;
		setType(addField(type, newField, newFieldPath, sectionId, position));
		onUpdateHasPendingChanges(true);
		handleFieldSelected(newFieldPath, newField, sectionId);
	};
	const handleInsertDataSource = (dataSourceType: string, position: number) => {
		const configEntry = config.dataSources?.[dataSourceType];
		const descriptor = dataSourceDescriptors[dataSourceType] ?? configEntry?.descriptor;
		if (!descriptor) {
			showAlert(`No data source descriptor found for type "${dataSourceType}"`);
			return;
		}

		const newDataSource = getNewDataSourceFromDescriptor(dataSourceType, descriptor, configEntry);

		setOpenDataSourceInserter(false);
		const nextDataSources = type.dataSources?.concat() ?? [];
		nextDataSources.splice(position, 0, newDataSource);
		setType({ ...type, dataSources: nextDataSources });
		onUpdateHasPendingChanges(true);
		handleDataSourceSelected(newDataSource);
	};
	// endregion

	// region delete
	const handleDeleteSection: FieldFormViewProps['onDeleteSection'] = (section) => {
		resetSelection();
		onUpdateHasPendingChanges(true);
		setType((currentType) => deleteSection(currentType, section));
	};
	const handleDeleteField: FieldFormViewProps['onDeleteField'] = (fieldIdPath: string, sectionId) => {
		resetSelection();
		onUpdateHasPendingChanges(true);
		setType((currentType) => deleteField(currentType, fieldIdPath, sectionId));
	};
	const handleDeleteDataSource: FieldFormViewProps['onDeleteDataSource'] = (dataSourceId) => {
		resetSelection();
		onUpdateHasPendingChanges(true);
		const nextDataSources = type.dataSources.filter((dataSource) => dataSource.id !== dataSourceId);
		setType((currentType) => ({ ...currentType, dataSources: nextDataSources }));
	};
	// endregion

	const handleSwapFileNameField: FieldFormViewProps['onSwapField'] = (fieldId, sectionId, newField) => {
		onUpdateHasPendingChanges(true);
		setType((prevType) => {
			const nextType = {
				...prevType,
				fields: {
					...prevType.fields,
					[fieldId]: {
						...prevType.fields[fieldId],
						type: newField.id
					}
				}
			};
			handleFieldSelected(fieldId, nextType.fields[fieldId], sectionId, nextType);
			return nextType;
		});
	};

	// region const fieldEditorView = ...
	const fieldEditorView = virtualContentType
		? createElement(TypeBuilderFormsEngine, {
				...fieldFormViewProps,
				isPanelReady: drawerOpenTransitionEnded,
				onOpenInsertFieldDialog,
				performCurrentFormErrorCheckAndWarning
			})
		: null;
	// endregion

	const handleMoveFieldToSection: FieldFormViewProps['onMoveFieldToSection'] = (
		fieldIdPath,
		originSectionId,
		newSectionId,
		fieldIndex,
		isTargetRepeatGroup
	) => {
		onUpdateHasPendingChanges(true);
		if (isTargetRepeatGroup) {
			const fieldId = getIdFromIdPath(fieldIdPath);
			// For repeat groups as targets, newSectionId is the path of the selected repeating group
			const newFieldIdPath = `${newSectionId}.${fieldId}`;
			const fieldIdRoot = newFieldIdPath.split('.')[0];
			// Section where the field will be added (when moving to a repeat group, newSectionId is the path of the selected repeating group)
			const targetSectionId = type.sections.find((section) => section.fields.includes(fieldIdRoot)).id;
			setType((prevType) => {
				const field = getFieldFromType(prevType, fieldIdPath);
				let nextType = deleteField(prevType, fieldIdPath, originSectionId);
				nextType = addField(nextType, field, newFieldIdPath, targetSectionId, fieldIndex);
				handleFieldSelected(newFieldIdPath, field, targetSectionId, nextType);
				return nextType;
			});
		} else {
			setType((prevType) => {
				const field = getFieldFromType(prevType, fieldIdPath);
				let nextType = deleteField(prevType, fieldIdPath, originSectionId);
				nextType = addField(nextType, field, field.id, newSectionId, fieldIndex);
				handleFieldSelected(fieldIdPath, field, newSectionId, nextType);
				return nextType;
			});
		}
	};

	// region view/diff xml
	const openViewXml = (xml: string) => {
		setXmlViewerContent(xml);
		xmlViewerDialogState.onOpen();
	};
	const closeViewXml = () => {
		xmlViewerDialogState.onClose();
	};

	const openDiffXml = (initialContent: string, currentContent: string) => {
		setXmlDiffContent({ initialContent, currentContent });
		xmlDiffDialogState.onOpen();
	};
	const closeDiffXml = () => {
		xmlDiffDialogState.onClose();
	};
	// endregion

	// region reorder
	const handleReorderRepGroupFields: FieldFormViewProps['onReorderRepGroupFields'] = (
		fields,
		fieldIdPath,
		sectionId
	) => {
		setType((currentType) => {
			const nextType = reorderRepGroupFields(currentType, fields, fieldIdPath);
			const field = getFieldFromType(nextType, fieldIdPath);
			handleFieldSelected(fieldIdPath, field, sectionId, nextType);
			return nextType;
		});
	};

	const handleReorderSectionFields = (fields: ReorderFieldsDialogProps['fields'], sectionId: string) => {
		setType((currentType) => {
			const nextType = reorderSectionFields(currentType, fields, sectionId);
			const nextSection = getSectionFromType(nextType, sectionId);
			handleSectionSelected(nextSection, nextType);
			return nextType;
		});
	};

	const handleReorderTypeSections = (sections: ReorderFieldsDialogProps['fields']) => {
		setType((currentType) => {
			const newSections = sections.map((section) => {
				return currentType.sections.find((s) => s.id === section.key);
			});
			const nextType = { ...currentType, sections: newSections };
			handleEditTypeProperties(nextType);
			return nextType;
		});
	};
	// endregion

	// `fieldUpdates$` subscription
	useEffect(() => {
		const sub = stateRef.current.fieldUpdates$.pipe(debounceTime(500)).subscribe(async () => {
			const { fieldPathsWithErrors, selectedFieldIdPath, onUpdateHasPendingChanges } = effectRefs.current;
			onUpdateHasPendingChanges(true);
			stateRef.current.formFieldsChanged = true;
			const nextFieldPathsWithErrors = { ...fieldPathsWithErrors };
			// Check validation atoms of the form to see if there are any unfulfilled validations.
			setValidatingForm(true);
			const hasErrors = await validityAtomsHaveErrors(
				effectRefs.current.jotai,
				stateRef.current?.activeFormContext?.atoms?.validationByFieldId
			);
			setActiveFormHasErrors(hasErrors);
			nextFieldPathsWithErrors[selectedFieldIdPath] = hasErrors;
			if (!nextFieldPathsWithErrors[selectedFieldIdPath]) delete nextFieldPathsWithErrors[selectedFieldIdPath];

			setFieldPathsWithErrors(nextFieldPathsWithErrors);
			setValidatingForm(false);
		});
		return () => {
			sub.unsubscribe();
		};
	}, [effectRefs]);

	useEffect(() => {
		if (type.NEW) {
			effectRefs.current.handleEditTypeProperties();
		}
	}, [type.NEW, effectRefs]);

	useEffect(() => {
		const sub = fetchSiteUiConfig(site, activeEnvironment).subscribe({
			next: (config) => {
				const configDOM = fromString(config);
				const contentTypesConfigDOM = configDOM.querySelector(
					'widget[id="craftercms.components.ContentTypeManagement"] > configuration'
				);
				const contentTypesConfig = contentTypesConfigDOM ? deserialize(contentTypesConfigDOM).configuration : null;
				if (contentTypesConfig) {
					setConfig({
						controls: parseConfigPlugins(asArray(contentTypesConfig.controls?.control)),
						controlExclusions: asArray(contentTypesConfig.controlExclusions),
						dataSources: parseConfigPlugins(asArray(contentTypesConfig.dataSources?.dataSource)),
						dataSourceExclusions: asArray(contentTypesConfig.dataSourceExclusions)
					});
				}
			},
			error: ({ response }) => {
				dispatch(pushErrorDialog({ props: { error: response.response } }));
			}
		});

		return () => sub.unsubscribe();
	}, [site, activeEnvironment, setConfig, dispatch]);

	const disableSave =
		(!type.NEW && !hasPendingChanges) || Object.keys(fieldPathsWithErrors).length !== 0 || validatingForm;
	return (
		<Provider store={jotai}>
			<EditTypeViewLayout
				sx={props.sx}
				ref={ref}
				style={props.style}
				open={open}
				onClose={handleCloseDrawer}
				disableSave={disableSave}
				onActionClick={handleToolbarActionClick}
				drawerContent={fieldEditorView}
				drawerProps={{
					// onTransitionEnd keeps triggering after the Drawer transition has finished on certain interactions (e.g. when hovering buttons)
					onTransitionEnd: (e) => {
						// Make sure it is the drawer paper that finished transitioning before considering the transition complete.
						// If 'EditTypeViewDrawer' transition ended, and 'open' is true, then the opening transition is complete.
						if ((e.target as HTMLElement).getAttribute('data-area-id') === 'EditTypeViewDrawer') {
							setDrawerOpenTransitionEnded(open);
						}
					},
					slotProps: {
						paper: {
							// @ts-expect-error Setting a html prop
							['data-area-id']: 'EditTypeViewDrawer'
						}
					}
				}}
				mainContent={
					<TypeDetailsView
						type={type}
						onInsertSection={handleInsertSection}
						onOpenInsertFieldDialog={onOpenInsertFieldDialog}
						onOpenInsertDataSourceDialog={onOpenInsertDataSourceDialog}
						onEditTypeAction={handleEditTypeAction}
						onFieldSelected={handleFieldSelected}
						onDataSourceSelected={handleDataSourceSelected}
						onSectionSelected={handleSectionSelected}
						fieldPathsWithErrors={fieldPathsWithErrors}
						selectedFieldIdPath={selectedFieldIdPath}
						performCurrentFormErrorCheckAndWarning={performCurrentFormErrorCheckAndWarning}
					/>
				}
				isNew={type.NEW}
			/>
			<XmlViewerDialog xml={xmlViewerContent} open={xmlViewerDialogState.open} onClose={closeViewXml} />
			<XmlDiffDialog
				initialXml={xmlDiffContent?.initialContent}
				currentXml={xmlDiffContent?.currentContent}
				open={xmlDiffDialogState.open}
				onClose={closeDiffXml}
			/>
			<PickControlDialog
				open={Boolean(insertFieldData.sectionId)}
				type={type}
				sectionId={insertFieldData.sectionId}
				fieldIdPath={insertFieldData.fieldPath}
				onClose={() => setInsertFieldData({ sectionId: null })}
				onInsertField={handleInsertField}
				configControls={config?.controls}
				configDescriptors={configControlDescriptors}
				controlExclusions={config.controlExclusions}
			/>
			<PickDataSourceDialog
				type={type}
				onInsert={handleInsertDataSource}
				open={openDataSourceInserter}
				onClose={() => setOpenDataSourceInserter(false)}
				configDataSources={config?.dataSources}
				configDescriptors={configDataSourceDescriptors}
				dataSourceExclusions={config.dataSourceExclusions}
			/>
		</Provider>
	);
});

function createContextObject(): EditAppContextProps {
	return {
		fieldUpdates$: new Subject<string>(),
		formContextApi: createFieldFormContextApi(),
		activeFormContext: null,
		selectedField: null,
		selectedSection: null,
		selectedDataSource: null,
		formFieldsChanged: false
	};
}

function getIdFromIdPath(idPath: string): string {
	const pieces = idPath.split('.');
	return pieces.pop();
}

function insertSection(type: ContentType, section: ContentTypeSection, position: number = 0): ContentType {
	const nextType = { ...type, sections: type.sections.concat() };
	nextType.sections.splice(position, 0, section);
	return nextType;
}

function deleteSection(type: ContentType, section: ContentTypeSection): ContentType {
	const nextType = { ...type, sections: type.sections.concat() };
	const sectionIndex = nextType.sections.findIndex((s) => s.id === section.id);
	nextType.sections.splice(sectionIndex, 1);
	return nextType;
}

function addSubField(
	parentField: ContentTypeField,
	newField: ContentTypeField,
	subFieldPath: string,
	position: number
): ContentTypeField {
	if (isComposedPath(subFieldPath)) {
		// If still composed, we need to find the root field and add the new field to it recursively
		const rootFieldId = subFieldPath.split('.').shift();
		return {
			...parentField,
			fields: {
				...(parentField.fields ?? {}),
				[rootFieldId]: addSubField(
					parentField.fields[rootFieldId],
					newField,
					subFieldPath.replace(`${rootFieldId}.`, ''),
					position
				)
			}
		};
	} else {
		// If not composed, we can add the field directly to the parent fields lookup.
		// Since the fields prop under a parentField is a lookupTable and we need to insert on a specific position, we first
		// convert it to an array, insert the new field and then convert it back to a lookupTable.
		const nextFieldsArray = Object.values(parentField.fields ?? {});
		nextFieldsArray.splice(position, 0, newField);
		const nextFields = {};
		nextFieldsArray.forEach((field) => {
			const fieldId = field.id ? field.id : NEW_FIELD_ID;
			nextFields[fieldId] = field;
		});
		return {
			...parentField,
			fields: nextFields
		};
	}
}

function addField(
	type: ContentType,
	field: ContentTypeField,
	fieldIdPath: string,
	sectionId: string,
	position: number
): ContentType {
	if (isComposedPath(fieldIdPath)) {
		// If the fieldIdPath is composed, we need to find the root field and add the new field to it recursively
		const rootFieldId = fieldIdPath.split('.').shift();
		// When fieldIdPath is composed (inside a rep-group), sections don't change since the root fields remain the same
		return {
			...type,
			fields: {
				...type.fields,
				[rootFieldId]: addSubField(
					type.fields[rootFieldId],
					field,
					fieldIdPath.replace(`${rootFieldId}.`, ''),
					position
				)
			}
		};
	} else {
		// If not composed, we can add the field directly to the fields lookup and to the sections list
		const nextFields = { ...type.fields, [fieldIdPath]: field };
		const nextSections = type.sections.concat();
		const sectionIndex = nextSections.findIndex((section) => section.id === sectionId);
		const section = nextSections[sectionIndex];
		const nextSectionFields = nextSections[sectionIndex].fields.concat();
		nextSectionFields.splice(position, 0, fieldIdPath);
		nextSections[sectionIndex] = {
			...section,
			fields: nextSectionFields
		};
		return { ...type, sections: nextSections, fields: nextFields };
	}
}

function deleteSubField(parentField: ContentTypeField, fieldIdPath: string): ContentTypeField {
	if (isComposedPath(fieldIdPath)) {
		// If still composed, we need to find the root field and delete the field recursively
		const rootFieldId = fieldIdPath.split('.').shift();
		return {
			...parentField,
			fields: {
				...(parentField.fields ?? {}),
				[rootFieldId]: deleteSubField(parentField.fields[rootFieldId], fieldIdPath.replace(`${rootFieldId}.`, ''))
			}
		};
	} else {
		const nextFields = { ...(parentField.fields ?? {}) };
		delete nextFields[fieldIdPath];
		return { ...parentField, fields: nextFields };
	}
}

function deleteField(type: ContentType, fieldIdPath: string, sectionId: string): ContentType {
	if (isComposedPath(fieldIdPath)) {
		// If the fieldIdPath is composed, we need to find the root field and remove the field recursively
		const rootFieldId = fieldIdPath.split('.').shift();
		// When fieldIdPath is composed (inside a rep-group), sections don't change since the root fields remain the same
		return {
			...type,
			fields: {
				...type.fields,
				[rootFieldId]: deleteSubField(type.fields[rootFieldId], fieldIdPath.replace(`${rootFieldId}.`, ''))
			}
		};
	} else {
		const nextFields = { ...type.fields };
		delete nextFields[fieldIdPath];

		const nextSections = type.sections.concat();
		const sectionIndex = nextSections.findIndex((section) => section.id === sectionId);
		const section = nextSections[sectionIndex];
		const nextSectionFields = nextSections[sectionIndex].fields.concat();
		const fieldIndex = nextSectionFields.findIndex((fieldId) => fieldId === fieldIdPath);
		nextSectionFields.splice(fieldIndex, 1);
		nextSections[sectionIndex] = {
			...section,
			fields: nextSectionFields
		};

		return { ...type, sections: nextSections, fields: nextFields };
	}
}

function updateTypeProps(type: ContentType, updatedTypeDetails: TypePropsToEdit): ContentType {
	const newProps = pluckProps(updatedTypeDetails, ...typePropsToEdit);
	// If the sections property have not changed, retain the current type's sections to prevent unintentional
	// data loss (e.g., sections being set to 'undefined').
	if (!newProps.sections) {
		newProps.sections = type.sections;
	}
	return { ...type, ...newProps };
}

function updateTypeFromSubFieldUpdate(
	fields: LookupTable<ContentTypeField>,
	state: EditAppContextProps,
	updatedValues: LookupTable<unknown>,
	fieldIdPath: string,
	descriptor: DescriptorContentType
): LookupTable<ContentTypeField> {
	if (isComposedPath(fieldIdPath)) {
		const rootFieldId = fieldIdPath.split('.').shift();
		return {
			...fields,
			[rootFieldId]: {
				...fields[rootFieldId],
				fields: updateTypeFromSubFieldUpdate(
					fields[rootFieldId].fields,
					state,
					updatedValues,
					fieldIdPath.replace(`${rootFieldId}.`, ''),
					descriptor
				)
			}
		};
	} else {
		const updatedField = reverseTypeFieldValuesObject(state.selectedField, updatedValues, descriptor);
		let updatedFields = { ...fields };

		if (updatedField.id !== state.selectedField.id) {
			// Since the order of the fields is determined by the lookupTable order, we need to convert it to array, set the
			// field in the proper position and convert it back to a lookupTable.
			const updatedFieldsArray = Object.values(updatedFields);
			const originalFieldIndex = updatedFieldsArray.findIndex((field) => field.id === state.selectedField.id);
			updatedFieldsArray.splice(originalFieldIndex, 0, updatedField);
			updatedFields = createLookupTable(updatedFieldsArray, 'id');

			// Delete the old id
			delete updatedFields[state.selectedField.id];
		} else {
			updatedFields[updatedField.id] = updatedField;
		}
		state.selectedField = updatedField;
		return updatedFields;
	}
}

function updateTypeFromFieldUpdate(
	type: ContentType,
	state: EditAppContextProps,
	updatedValues: LookupTable<unknown>,
	fieldIdPath: string,
	configDescriptors?: LookupTable<DescriptorContentType>
): ContentType {
	if (!state.selectedField) return;

	const fieldType = state.selectedField.type;
	const descriptor = configDescriptors?.[fieldType] ?? controlDescriptors[fieldType];
	if (isComposedPath(fieldIdPath)) {
		// When the field is not on the root level (composed fieldIdPath), the field is under another field, where each
		// field contains a lookupTable of fields. In that screnario sections should not be updated.
		const rootFieldId = fieldIdPath.split('.').shift();
		return {
			...type,
			fields: {
				...type.fields,
				[rootFieldId]: {
					...type.fields[rootFieldId],
					fields: updateTypeFromSubFieldUpdate(
						type.fields[rootFieldId].fields,
						state,
						updatedValues,
						fieldIdPath.replace(`${rootFieldId}.`, ''),
						descriptor
					)
				}
			}
		};
	} else {
		const isNewField = (state.selectedField as NewContentTypeField).NEW;
		const selectedFieldId = isNewField ? NEW_FIELD_ID : state.selectedField.id;

		// If the field is on the root level, the edition is different since the structure of `type` has sections with the
		// fields (string array) and the lookupTable of the fields. Both properties need to be updated.
		const updatedType: ContentType = { ...type, fields: { ...type.fields } };
		const updatedField = reverseTypeFieldValuesObject(state.selectedField, updatedValues, descriptor);
		updatedType.fields[updatedField.id] = updatedField;
		if (updatedField.id !== selectedFieldId) {
			// Delete the old id
			delete updatedType.fields[selectedFieldId];
			// Find the section in which the field is located
			const sectionIndex = updatedType.sections.findIndex((section) => section.fields.includes(selectedFieldId));
			const section: ContentTypeSection = {
				...updatedType.sections[sectionIndex],
				fields: updatedType.sections[sectionIndex].fields.concat()
			};
			// Replace the field in the section
			const fieldIndex = section.fields.findIndex((fieldId) => fieldId === selectedFieldId);
			section.fields[fieldIndex] = updatedField.id;
			updatedType.sections = updatedType.sections.concat();
			updatedType.sections[sectionIndex] = section;
		}
		state.selectedField = updatedField;
		return updatedType;
	}
}

function updateTypeFromSectionUpdate(
	type: ContentType,
	selectedSection: ContentTypeSection,
	updatedValues: LookupTable<unknown>
): ContentType {
	const updatedType: ContentType = { ...type, sections: type.sections.concat() };
	const index = updatedType.sections.findIndex((item) => item.id === selectedSection.id);
	updatedType.sections[index] = { ...selectedSection, ...updatedValues };
	return updatedType;
}

function updateTypeFromDataSourceUpdate(
	type: ContentType,
	selectedDataSource: DataSource,
	updatedValues: LookupTable<unknown>,
	descriptor: DescriptorContentType
): ContentType {
	const updatedType: ContentType = { ...type, dataSources: type.dataSources.concat() };
	const index = updatedType.dataSources.findIndex((item) => {
		if (selectedDataSource.id) {
			return item.id === selectedDataSource.id;
		} else {
			return (item as NewDataSource).NEW;
		}
	});

	const descriptorFields = descriptor?.fields ?? {};
	// Serialize datasource values
	const serializedValues: LookupTable<unknown> = {};
	Object.entries(updatedValues).forEach(([key, value]) => {
		const field = descriptorFields[key];
		const fieldType = field?.type;
		const serializer = fieldType ? valueSerializersLookup[fieldType] : undefined;
		serializedValues[key] = serializer ? serializer(field, value) : value;
	});
	const nextDataSource = { ...selectedDataSource };
	// When updating a new data source, we need to exclude NEW prop from the new datasource content
	delete (nextDataSource as NewDataSource).NEW;
	const { title, id, plugin, ...properties } = serializedValues;
	updatedType.dataSources[index] = {
		...nextDataSource,
		id: id as string,
		title: title as string,
		properties,
		...(plugin ? { plugin: plugin as DataSource['plugin'] } : {})
	};
	return updatedType;
}

function buildXmlFromType(
	type: ContentType,
	configDescriptors?: {
		controlDescriptors: LookupTable<DescriptorContentType>;
		dataSourceDescriptors: LookupTable<DescriptorContentType>;
	}
): string {
	const typeStructure = prepareSerializeToXmlTypeObject(type, configDescriptors);
	return buildContentTypeXml(typeStructure);
}

// merge the basic details, the non-edited field values, the manipulated field atoms into a single object
// that gets serialized to XML and stored
function save(
	siteId: string,
	type: ContentType,
	configDescriptors?: {
		controlDescriptors: LookupTable<DescriptorContentType>;
		dataSourceDescriptors: LookupTable<DescriptorContentType>;
	}
): Observable<string> {
	let xml = buildXmlFromType(type, configDescriptors);
	xml = cleanupStaleDatasourceValuesFromXml(xml, type);
	const requests = [writeConfiguration(siteId, createFormDefinitionPathFromTypeId(type.id), 'studio', xml)];

	return forkJoin(requests).pipe(map(() => xml));
}

/**
 * Checks if any of the validity atoms in the provided `atoms` object have errors.
 *
 * This function asynchronously evaluates the validity of all atoms by retrieving their values
 * using the `jotai.get` method. It then determines if any of the atoms are invalid based on their
 * `isValid` property.
 *
 * @async
 * @function
 * @param {JotaiStore} jotai - The Jotai store instance used to retrieve atom values.
 * @param {FormsEngineAtoms['validationByFieldId']} [atoms={}] - A lookup table of validation atoms by field ID.
 * @returns {Promise<boolean>} - Resolves to `true` if any atom is invalid, otherwise `false`.
 *
 */
async function validityAtomsHaveErrors(
	jotai: JotaiStore,
	atoms: FormsEngineAtoms['validationByFieldId'] = {}
): Promise<boolean> {
	try {
		const results = await Promise.all(Object.values(atoms).map((atom) => jotai.get(atom)));
		return results.some((validity) => !validity.isValid);
	} catch (error) {
		console.error('Error checking field validity:', error);
		return true;
	}
}

function parseConfigPlugins(
	plugins: { descriptor?: DescriptorContentType; icon: { id: string }; id: string }[]
): LookupTable<{ descriptor?: DescriptorContentType; icon: { id: string }; id: string }> {
	if (!plugins) return {};
	const parsedPlugins = asArray(plugins).map((plugin) => {
		if (plugin.descriptor) {
			const fields = Object.values(plugin.descriptor.fields ?? {})?.map((field) => {
				return {
					...field,
					validations: field.validations ?? {}
				};
			});
			return {
				...plugin,
				descriptor: {
					...plugin.descriptor,
					fields: createLookupTable(fields),
					sections:
						asArray(plugin.descriptor?.sections).map((section) => ({
							...section,
							fields: asArray(section.fields) ?? []
						})) ?? []
				}
			};
		} else {
			return plugin;
		}
	});
	return createLookupTable(parsedPlugins);
}

function getNewFieldFromDescriptor(
	fieldType: string,
	descriptor: DescriptorContentType,
	configEntry?: { plugin?: FormDefinitionPlugin; descriptor?: DescriptorContentType }
): NewContentTypeField {
	const newField: NewContentTypeField = {
		NEW: true,
		id: systemFieldsIdsMap[fieldType] ?? null,
		name: '',
		helpText: '',
		description: '',
		type: systemFieldsTypesMap[fieldType] ?? fieldType,
		validations: {},
		defaultValue: '',
		properties: {}
	};
	if (!descriptor) return newField;

	if (descriptor.id === 'repeat') newField.fields = {};
	const { properties, validations } = getPropertiesAndValidationsFromDescriptor(descriptor);

	newField.properties = properties;
	newField.validations = validations;
	const plugin = extractPluginLocatorFromConfigEntry(configEntry);
	if (plugin) {
		Object.assign(newField.properties, { plugin });
	}

	return newField;
}

function getNewDataSourceFromDescriptor(
	dataSourceType: string,
	descriptor: DescriptorContentType,
	configEntry?: { plugin?: FormDefinitionPlugin; descriptor?: DescriptorContentType }
): NewDataSource {
	const newDataSource: NewDataSource = {
		NEW: true,
		id: '',
		title: '',
		type: dataSourceType,
		interface: '',
		properties: {}
	};
	if (!descriptor) return newDataSource;

	const sections = createLookupTable(descriptor.sections);

	newDataSource.interface = descriptor.type;
	const propertiesFieldIds = sections.properties?.fields ?? [];
	const properties = {};
	propertiesFieldIds.forEach((field) => (properties[field] = descriptor.fields[field]?.defaultValue));
	newDataSource.properties = properties;
	const plugin = extractPluginLocatorFromConfigEntry(configEntry);
	if (plugin) {
		newDataSource.plugin = plugin;
	}

	return newDataSource;
}

function extractPluginLocatorFromConfigEntry(
	configEntry?: { plugin?: FormDefinitionPlugin | Record<string, unknown> } & Record<string, unknown>
): FormDefinitionPlugin | undefined {
	if (!configEntry?.plugin || typeof configEntry.plugin !== 'object') return undefined;
	const raw = configEntry.plugin as Record<string, unknown>;
	// ui.xml attribute form: <plugin id type name fileName />; form-definition uses pluginId/filename.
	const type = raw.type;
	const name = raw.name;
	const filename = raw.filename ?? raw.fileName ?? raw.file;
	const pluginId = raw.pluginId ?? raw.id;
	if (
		typeof type === 'string' &&
		typeof name === 'string' &&
		typeof filename === 'string' &&
		typeof pluginId === 'string' &&
		type &&
		name &&
		filename &&
		pluginId
	) {
		return { type, name, filename, pluginId };
	}
	return undefined;
}

function reorderSectionFields(
	type: ContentType,
	fields: ReorderFieldsDialogProps['fields'],
	sectionId: string
): ContentType {
	const newFields = fields.map((field) => field.key);
	const nextSections = type.sections.map((section) => {
		if (section.id !== sectionId) return section;
		return {
			...section,
			fields: newFields
		};
	});

	return { ...type, sections: nextSections };
}

function reorderRepGroupSubFields(
	field: ContentTypeField,
	fields: ReorderFieldsDialogProps['fields'],
	subFieldPath: string
): ContentTypeField {
	if (isComposedPath(subFieldPath)) {
		const rootFieldId = subFieldPath.split('.').shift();

		return {
			...field,
			fields: {
				...field.fields,
				[rootFieldId]: reorderRepGroupSubFields(
					field.fields[rootFieldId],
					fields,
					subFieldPath.replace(`${rootFieldId}.`, '')
				)
			}
		};
	} else {
		const fieldsContainer = field.fields[subFieldPath];
		const newFields = fields.map(({ key }) => fieldsContainer.fields[key]);
		return {
			...field,
			fields: {
				...field.fields,
				[subFieldPath]: {
					...field.fields[subFieldPath],
					fields: createLookupTable(newFields)
				}
			}
		};
	}
}

function reorderRepGroupFields(
	type: ContentType,
	fields: ReorderFieldsDialogProps['fields'],
	fieldIdPath: string
): ContentType {
	if (isComposedPath(fieldIdPath)) {
		const rootFieldId = fieldIdPath.split('.').shift();

		return {
			...type,
			fields: {
				...type.fields,
				[rootFieldId]: reorderRepGroupSubFields(
					type.fields[rootFieldId],
					fields,
					fieldIdPath.replace(`${rootFieldId}.`, '')
				)
			}
		};
	} else {
		const fieldsContainer = type.fields[fieldIdPath];
		const newFields = fields.map(({ key }) => fieldsContainer.fields[key]);
		return {
			...type,
			fields: {
				...type.fields,
				[fieldIdPath]: {
					...type.fields[fieldIdPath],
					fields: createLookupTable(newFields)
				}
			}
		};
	}
}

/**
 * Cleans up stale datasource references in the provided XML string.
 *
 * This function parses the XML, finds all <type> elements whose text content starts with 'datasource:',
 * and then checks their sibling <value> elements. The <value> element contains a comma-separated list
 * of datasource IDs. Any IDs that do not exist in the current list of datasource IDs (from the type object)
 * are removed. If all IDs are invalid, the <value> element is cleared.
 *
 * @param {string} xml - The XML string to clean up.
 * @param {ContentType} type - The content type object containing the current list of datasource IDs.
 * @returns {string} - The cleaned XML string with only valid datasource references.
 */
function cleanupStaleDatasourceValuesFromXml(xml: string, type: ContentType): string {
	let cleanXml = xml;
	try {
		const dataSourceIds = (type.dataSources ?? []).map((ds) => ds.id);
		const dom = fromString(xml);
		const parseError = dom?.getElementsByTagName('parsererror')[0];
		if (dom && !parseError) {
			// Find all <type> elements
			const typeElements = Array.from(dom.getElementsByTagName('type'));
			for (const typeEl of typeElements) {
				const typeText = typeEl.textContent?.trim() ?? '';
				if (typeText.startsWith('datasource:')) {
					// Find sibling <value> element
					const parent = typeEl.parentElement;
					let valueEl = null;
					if (parent) {
						valueEl = parent.querySelector(':scope > value');
					}
					if (valueEl && valueEl.textContent) {
						const values = valueEl.textContent
							.split(',')
							.map((v) => v.trim())
							.filter(Boolean);
						const filtered = values.filter((id) => dataSourceIds.includes(id));
						if (filtered.length !== values.length) {
							if (filtered.length > 0) {
								valueEl.textContent = filtered.join(',');
							} else {
								valueEl.textContent = '';
							}
						}
					}
				}
			}
			cleanXml = serialize(dom);
		}
	} catch (e) {
		// If XML parsing fails, fallback to original xml (already set to xml at the beginning of the function)
		console.error('Error parsing XML for cleanup, returning original XML', e);
	}
	return cleanXml;
}

export default EditTypeView;

// TODO:
//  - Because IDs can be modified, keep a lookup table of `{ [nanoid]: id }`? - Probably N/A
//  - BE tickets for APIs etc
//  - BE ticket for UM section ids
// 		- Changes have been made on the UI to assume controller, imageThumbnail, no-template-required and paths are in form-def.xml (e.g. parseLegacyFormDefinition)
//  - BE ticket: `/studio/api/2/configuration/content-type/usage` API replies with paths and within the UI (fetchContentTypeUsage) it'll immediately fetch the ContentItem for each path. Could we update for API to return ContentItems?
//  - Can we move display-template, no-template-required and merge-strategy to the root of the type def? If so, update BE, UI and UM
//    - If not moved, drop `label` & `type`?
//  - Should we rename the root tag on form-def.xml from `form` to something like `type`, `contentType` or so?
//  - Can we drop iceId?
// 	- Should we use UM to remove from maxlength property and move into constraints? Also fix spelling to `maxLength`
// 	- Can we add created, modified, createdBy and modifiedBy to the XML?
//  - Assess removal of internalName/disabled controls.
//  - Dynamic default values (eg. can't have a text field for the node selector). An idea is to have a custom control that renders depending on the type.
