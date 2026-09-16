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

import React, { createElement, useEffect, useRef, useState } from 'react';
import {
	FormsEngineFormApiContextProps,
	FormsEngineFormContextApi,
	ItemContext,
	ItemMetaContext,
	StableFormContext,
	StableFormContextProps,
	StableGlobalContext,
	useStableFormContext
} from '../../FormsEngine/lib/formsEngineContext';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { FormattedMessage } from 'react-intl';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import NavigateNextIcon from '@mui/icons-material/NavigateNextRounded';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import DriveFileMoveOutlined from '@mui/icons-material/DriveFileMoveOutlined';
import { XmlKeys } from '../../FormsEngine/lib/formConsts';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import ListItem from '@mui/material/ListItem';
import SwapCallsOutlined from '@mui/icons-material/SwapCallsOutlined';
import ListItemIcon from '@mui/material/ListItemIcon';
import ContentTypeFieldIcon from '../../../icons/ContentTypeField';
import ListItemText from '@mui/material/ListItemText';
import SectionAccordion from '../../FormsEngine/components/SectionAccordion';
import { renderFieldControl } from '../../FormsEngine/lib/controlHelpers';
import FormBackToTop from '../../FormsEngine/components/FormBackToTop';
import type {
	ContentType,
	ContentTypeField,
	ContentTypeSection,
	DataSource,
	NewContentTypeField
} from '../../../models/ContentType';
import {
	fooStableGlobalContext,
	getFieldFromType,
	PartialContentType,
	type readOnlyFieldIdsType,
	readOnlyFieldsIds
} from '../utils';
import ErrorBoundary from '../../ErrorBoundary/ErrorBoundary';
import Alert from '@mui/material/Alert';
import { controlMap } from '../controlMap';
import { ConfirmDropdown } from '../../ConfirmDropdown';
import { MoveFieldToSectionDialog } from './MoveFieldToSectionDialog';
import { useEnhancedDialogState } from '../../../hooks/useEnhancedDialogState';
import { SwapFieldDialog } from './SwapFieldDialog';
import { nanoid } from 'nanoid';
import MoveDownIcon from '@mui/icons-material/MoveDown';
import { ReorderFieldsDialog, type ReorderFieldsDialogProps } from './ReorderFieldsDialog';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';

interface TypeModeProps {
	type: ContentType;
}

interface FieldModeProps {
	field: ContentTypeField;
	fieldIdPath: string;
	sectionId: string;
	controlDescriptor: PartialContentType;
	isPanelReady?: boolean;
	onDeleteField(fieldIdPath: string, sectionId: string): void;
	onMoveFieldToSection(
		fieldIdPath: string,
		originSectionId: string,
		newSectionId: string,
		fieldIndex: number,
		isTargetRepeatGroup: boolean
	): void;
	onSwapField(fieldId: string, sectionId: string, newField: PartialContentType): void;
	onReorderRepGroupFields?(fields: ReorderFieldsDialogProps['fields'], fieldIdPath: string, sectionId: string): void;
	performCurrentFormErrorCheckAndWarning(): boolean;
}

interface SectionModeProps {
	section: ContentTypeSection;
	isMainSection: boolean;
	onDeleteSection(section: ContentTypeSection): void;
	onReorderSectionFields?(fields: ReorderFieldsDialogProps['fields'], sectionId: string): void;
	onOpenInsertFieldDialog?(sectionId: string, fieldPath?: string): void;
}

interface DataSourceModeProps {
	dataSource: DataSource;
	onDeleteDataSource(dataSourceId: string): void;
}

interface BaseProps extends Partial<FieldModeProps & SectionModeProps & DataSourceModeProps & TypeModeProps> {
	virtualType: ContentType;
	formApiContext: FormsEngineFormApiContextProps;
	stableFormContext: StableFormContextProps;
	onReorderTypeSections?(fields: ReorderFieldsDialogProps['fields']): void;
	onClose(): void;
}

export type FieldFormViewProps = BaseProps & (TypeModeProps | FieldModeProps | SectionModeProps | DataSourceModeProps);

function FieldFormViewBody(props: FieldFormViewProps) {
	const { virtualType, isPanelReady = true, onClose } = props;
	const containerRef = useRef<HTMLDivElement>(undefined);
	const stableFormContext = useStableFormContext();
	// We're using nanoid to generate a unique ID for the typeId. This is to ensure that the component re-renders
	// when the virtualType changes, so the autoFocus is set properly when the new set of fields render.
	const [typeId, setTypeId] = useState<string>(undefined);
	const isReadOnlyField = props.field && readOnlyFieldsIds.includes(props.field.id as readOnlyFieldIdsType);

	useEffect(() => {
		containerRef.current.scroll({ top: 0, behavior: 'smooth' });
		setTypeId(nanoid());
	}, [virtualType]);

	return (
        <Box
            sx={{
                height: "var(--container-height)",
                display: "flex",
                flexDirection: "column"
            }}>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    py: 2,
                    px: 3
                }}>
				<Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        position: "sticky",
                        top: "0"
                    }}>
					<Typography variant="h6">{pickPanelTitleByMode(props)}</Typography>
					{createElement(FieldBreadcrumbs, props)}
				</Box>
				<Box
                    sx={{
                        display: "flex",
                        alignItems: "center"
                    }}>
					{createElement(FieldActions, props)}
					{createElement(SectionActions, props)}
					{createElement(DataSourceActions, props)}
					{createElement(ContentTypeActions, props)}
					<Divider sx={{ ml: 1, mr: 2 }} orientation="vertical" flexItem />
					<Button variant="outlined" onClick={onClose}>
						<FormattedMessage defaultMessage="Done" />
					</Button>
				</Box>
			</Box>
            <Container ref={containerRef} maxWidth="md" sx={{ overflow: 'auto', flex: 1 }}>
				{createElement(FieldSwapper, props)}
				{isPanelReady &&
					virtualType.sections.map((section, sectionIndex) => (
						<SectionAccordion
							key={`${typeId}-${section.title}`}
							section={section}
							colorize={false}
							renderControl={(fieldId, fieldIndex) => {
								const field = virtualType.fields[fieldId];
								if (!field)
									return (
										<Alert key={fieldId} severity="error">
											Field {fieldId} not found
										</Alert>
									);
								return renderFieldControl(
									field,
									stableFormContext.atoms.valueByFieldId,
									sectionIndex === 0 && fieldIndex === 0,
									field.id === 'id' && isReadOnlyField,
									virtualType,
									controlMap
								);
							}}
						/>
					))}
				<FormBackToTop containerRef={containerRef} />
			</Container>
        </Box>
    );
}

export function TypeBuilderFormsEngine(props: FieldFormViewProps) {
	const { stableFormContext, formApiContext } = props;
	const itemMetaContext = stableFormContext.itemMeta;
	return (
		<ErrorBoundary>
			<StableGlobalContext.Provider value={fooStableGlobalContext}>
				<FormsEngineFormContextApi.Provider value={formApiContext}>
					<StableFormContext.Provider value={stableFormContext}>
						<ItemContext.Provider value={null}>
							<ItemMetaContext.Provider value={itemMetaContext}>
								{createElement(FieldFormViewBody, props)}
							</ItemMetaContext.Provider>
						</ItemContext.Provider>
					</StableFormContext.Provider>
				</FormsEngineFormContextApi.Provider>
			</StableGlobalContext.Provider>
		</ErrorBoundary>
	);
}

function FieldBreadcrumbs(props: FieldFormViewProps): React.ReactNode {
	if (!props.field) return;
	const fieldPathIds = props.fieldIdPath?.split('.') ?? [];
	return (
		fieldPathIds.length > 1 && (
			<Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
				{fieldPathIds.map((id) => {
					// Retrieve the fieldPathId by removing everything after `id` in fieldPathIds
					const currentFieldPathId = fieldPathIds.slice(0, fieldPathIds.indexOf(id) + 1).join('.');
					const currentField = props.type ? getFieldFromType(props.type, currentFieldPathId) : undefined;
					return (
						<Typography variant="body2" key={id}>
							{currentField?.name ?? id}
						</Typography>
					);
				})}
			</Breadcrumbs>
		)
	);
}

function FieldActions(props: FieldFormViewProps): React.JSX.Element {
	const {
		field,
		fieldIdPath,
		sectionId,
		onDeleteField,
		onMoveFieldToSection,
		type,
		onReorderRepGroupFields,
		performCurrentFormErrorCheckAndWarning
	} = props;
	const [openMoveFieldDialog, setOpenMoveFieldDialog] = useState(false);
	const [openReorderFieldsDialog, setOpenReorderFieldsDialog] = useState(false);
	if (!field) return;
	const fields = Object.values(field.fields ?? {}).map((f) => ({ key: f.id, value: f.name })) || [];

	const onOpenMoveFieldDialog = () => {
		if (!performCurrentFormErrorCheckAndWarning()) return;
		setOpenMoveFieldDialog(true);
	};

	const handleMoveFieldToSection: FieldFormViewProps['onMoveFieldToSection'] = (
		fieldId,
		originSectionId,
		newSectionId,
		fieldIndex,
		isRepeatGroup
	) => {
		setOpenMoveFieldDialog(false);
		onMoveFieldToSection?.(fieldIdPath, originSectionId, newSectionId, fieldIndex, isRepeatGroup);
	};

	const onReorderFields = (newFields: ReorderFieldsDialogProps['fields']) => {
		setOpenReorderFieldsDialog(false);
		onReorderRepGroupFields?.(newFields, fieldIdPath, sectionId);
	};

	return (
		<>
			{field.type === 'repeat' && Object.keys(field.fields ?? {}).length > 0 && (
				<Tooltip title={<FormattedMessage defaultMessage="Reorder fields" />}>
					<IconButton onClick={() => setOpenReorderFieldsDialog(true)}>
						<MoveDownIcon />
					</IconButton>
				</Tooltip>
			)}
			<Tooltip title={<FormattedMessage defaultMessage="Move to another section" />}>
				<IconButton onClick={() => onOpenMoveFieldDialog()}>
					<DriveFileMoveOutlined />
				</IconButton>
			</Tooltip>
			{field.id !== XmlKeys.internalName && field.id !== XmlKeys.fileName && (
				<ConfirmDropdown
					icon={DeleteRounded}
					iconTooltip={<FormattedMessage defaultMessage="Delete field" />}
					confirmHelperText={
						!(field as NewContentTypeField).NEW ? (
							<FormattedMessage
								defaultMessage={'Delete "{fieldName} ({fieldId})"?'}
								values={{
									fieldName: field.name,
									fieldId: field.id
								}}
							/>
						) : (
							<FormattedMessage defaultMessage="Delete new field?" />
						)
					}
					cancelText={<FormattedMessage defaultMessage="No" />}
					confirmText={<FormattedMessage defaultMessage="Yes" />}
					onConfirm={() => onDeleteField?.(fieldIdPath, sectionId)}
				/>
			)}
			<MoveFieldToSectionDialog
				fieldIdPath={fieldIdPath}
				field={field}
				sectionId={sectionId}
				type={type}
				open={openMoveFieldDialog}
				onClose={() => setOpenMoveFieldDialog(false)}
				onMoveFieldToSection={handleMoveFieldToSection}
			/>
			<ReorderFieldsDialog
				fields={fields}
				open={openReorderFieldsDialog}
				onClose={() => setOpenReorderFieldsDialog(false)}
				onReorderFields={onReorderFields}
			/>
		</>
	);
}

const fileNameTypeIds = ['file-name', 'auto-filename'];

function FieldSwapper(props: FieldFormViewProps): React.JSX.Element {
	const { field, sectionId, controlDescriptor, onSwapField } = props;
	const swapFieldDialogState = useEnhancedDialogState();
	if (!props.field) return;

	const handleSwapField = (newField: PartialContentType) => {
		onSwapField?.(field.id, sectionId, newField);
		swapFieldDialogState.onClose();
	};

	return (
		<>
			<ListItem
				component="div"
				secondaryAction={
					field.id === 'file-name' && (
						<Tooltip title={<FormattedMessage defaultMessage="Swap Field" />}>
							<IconButton onClick={() => swapFieldDialogState.onOpen()}>
								<SwapCallsOutlined />
							</IconButton>
						</Tooltip>
					)
				}
			>
				<ListItemIcon>
					<ContentTypeFieldIcon />
				</ListItemIcon>
				<ListItemText
					primary={controlDescriptor.name}
					secondary={controlDescriptor.description || controlDescriptor.id}
				/>
			</ListItem>
			<SwapFieldDialog
				currentFieldType={field.type}
				open={swapFieldDialogState.open}
				onClose={swapFieldDialogState.onClose}
				onSwapField={handleSwapField}
				allowedTypeIds={fileNameTypeIds}
			/>
		</>
	);
}

function SectionActions(props: FieldFormViewProps): React.JSX.Element {
	const { section, isMainSection, onDeleteSection, onReorderSectionFields, onOpenInsertFieldDialog } = props;
	const [openReorderFieldsDialog, setOpenReorderFieldsDialog] = useState(false);
	if (!section) return;
	const fields = section.fields.map((field) => ({ key: field, value: field })) || [];

	const onReorderFields = (newFields: ReorderFieldsDialogProps['fields']) => {
		setOpenReorderFieldsDialog(false);
		onReorderSectionFields?.(newFields, section.id);
	};

	return (
		<>
			{section.fields?.length > 0 ? (
				<Tooltip title={<FormattedMessage defaultMessage="Reorder fields" />}>
					<IconButton onClick={() => setOpenReorderFieldsDialog(true)}>
						<MoveDownIcon />
					</IconButton>
				</Tooltip>
			) : (
				<Tooltip title={<FormattedMessage defaultMessage="Add field" />}>
					<IconButton onClick={() => onOpenInsertFieldDialog?.(section.id)}>
						<AddCircleOutlineOutlinedIcon />
					</IconButton>
				</Tooltip>
			)}
			{!isMainSection && (
				<ConfirmDropdown
					icon={DeleteRounded}
					iconTooltip={<FormattedMessage defaultMessage="Delete Section" />}
					confirmHelperText={
						<FormattedMessage defaultMessage={'Delete "{title}"?'} values={{ title: section.title }} />
					}
					cancelText={<FormattedMessage defaultMessage="No" />}
					confirmText={<FormattedMessage defaultMessage="Yes" />}
					onConfirm={() => onDeleteSection?.(section)}
				/>
			)}
			<ReorderFieldsDialog
				fields={fields}
				open={openReorderFieldsDialog}
				onClose={() => setOpenReorderFieldsDialog(false)}
				onReorderFields={onReorderFields}
			/>
		</>
	);
}

function DataSourceActions(props: FieldFormViewProps): React.JSX.Element {
	const { dataSource, onDeleteDataSource } = props;
	if (!dataSource) return;
	return (
		<>
			<ConfirmDropdown
				icon={DeleteRounded}
				iconTooltip={<FormattedMessage defaultMessage="Delete Data Source" />}
				confirmHelperText={<FormattedMessage defaultMessage={'Delete "{name}"?'} values={{ name: dataSource.title }} />}
				cancelText={<FormattedMessage defaultMessage="No" />}
				confirmText={<FormattedMessage defaultMessage="Yes" />}
				onConfirm={() => {
					onDeleteDataSource?.(dataSource.id);
				}}
			/>
		</>
	);
}

function ContentTypeActions(props: FieldFormViewProps): React.JSX.Element {
	const { section, field, dataSource, type, onReorderTypeSections } = props;
	const [openReorderFieldsDialog, setOpenReorderFieldsDialog] = useState(false);
	if (section || field || dataSource) return;

	const sections = type.sections.map((section) => ({ key: section.id, value: section.title, content: section })) || [];

	const onReorderSections = (newSections: ReorderFieldsDialogProps['fields']) => {
		setOpenReorderFieldsDialog(false);
		onReorderTypeSections?.(newSections);
	};

	return (
		<>
			<Tooltip title={<FormattedMessage defaultMessage="Reorder sections" />}>
				<IconButton onClick={() => setOpenReorderFieldsDialog(true)}>
					<MoveDownIcon />
				</IconButton>
			</Tooltip>
			<ReorderFieldsDialog
				fields={sections}
				open={openReorderFieldsDialog}
				onClose={() => setOpenReorderFieldsDialog(false)}
				onReorderFields={onReorderSections}
			/>
		</>
	);
}

function pickPanelTitleByMode(props: FieldFormViewProps): React.JSX.Element {
	if (props.field) {
		return <FormattedMessage defaultMessage="Edit Field" />;
	} else if (props.section) {
		return <FormattedMessage defaultMessage="Edit Section" />;
	} else if (props.dataSource) {
		return <FormattedMessage defaultMessage="Edit Data Source" />;
	} else if (props.type) {
		return <FormattedMessage defaultMessage="Edit Type" />;
	}
}

export default TypeBuilderFormsEngine;
