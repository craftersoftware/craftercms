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

import { EnhancedDialog, EnhancedDialogProps } from '../../EnhancedDialog';
import { ContentType, ContentTypeField, DataSource } from '../../../models';
import { FormattedMessage, useIntl } from 'react-intl';
import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { applyTranslations, DescriptorContentType, DescriptorField, PartialContentType } from '../utils';
import { DialogBody } from '../../DialogBody';
import { SearchBar, SearchBarProps } from '../../SearchBar';
import Box from '@mui/material/Box';
import ListItemButton from '@mui/material/ListItemButton';
import { ListItemIcon, ListItemText } from '@mui/material';
import SecondaryButton from '../../SecondaryButton';
import PrimaryButton from '../../PrimaryButton';
import { nou } from '../../../utils/object';
import { DialogFooter } from '../../DialogFooter';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ListItem from '@mui/material/ListItem';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import Divider from '@mui/material/Divider';
import LookupTable from '../../../models/LookupTable';
import { SystemIcon } from '../../SystemIcon';
import ComponentIcon from '../../../icons/Component';
import Button from '@mui/material/Button';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import InsertPositionPicker from './InsertPositionPicker';

export interface PickFieldDialogProps extends EnhancedDialogProps {
	type: ContentType;
	configLookup?: LookupTable<{ descriptor?: DescriptorContentType; icon: { id: string }; id: string }>; // TODO: not a li
	typesFullList: DescriptorContentType[];
	typesCurrentList: DescriptorField[] | DataSource[];
	/** Fields already present in the insertion target (root or repeat group). Defaults to type.fields. */
	currentFields?: LookupTable<ContentTypeField>;
	title: ReactNode;
	onInsert: (fieldType: string, position: number) => void;
	systemFieldsIds?: string[];
	systemFieldsTitle?: ReactNode;
	/** Accessible name for the insert-after select in the position picker. */
	insertAfterSelectLabel?: ReactNode;
}

export interface PickFieldDialogBodyProps extends Omit<PickFieldDialogProps, 'title'> {}

export function PickFieldDialogBody(props: PickFieldDialogBodyProps) {
	const {
		configLookup,
		typesFullList,
		typesCurrentList,
		currentFields,
		onInsert,
		onClose,
		open,
		systemFieldsTitle,
		systemFieldsIds,
		type,
		insertAfterSelectLabel = <FormattedMessage defaultMessage="Control to insert after" />
	} = props;
	const theme = useTheme();
	const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
	const [selectedField, setSelectedField] = useState<PartialContentType>(undefined);
	const [selectedView, setSelectedView] = useState<number>(0);
	const [position, setPosition] = useState<number>(typesCurrentList?.length ?? 0);
	const insertedRef = useRef(false);
	const { formatMessage } = useIntl();
	const hasItems = (typesCurrentList?.length ?? 0) > 0;
	const positionItems = useMemo(
		() =>
			(typesCurrentList ?? []).map((item) => ({
				id: item.id,
				label: item.title || item.name || item.id
			})),
		[typesCurrentList]
	);
	const showFieldPositionStep = !isMdUp && selectedView === 1;

	// Dialog exit transition keeps the body mounted; ignore further inserts after the first in this open session.
	useEffect(() => {
		if (open) {
			insertedRef.current = false;
		}
	}, [open]);

	const insertOnce = (fieldType: string, insertPosition: number) => {
		if (insertedRef.current) {
			return;
		}
		insertedRef.current = true;
		onInsert(fieldType, insertPosition);
	};

	const onSecondaryAction = (e: React.MouseEvent) => {
		if (isMdUp || selectedView === 0) {
			onClose?.(e, null);
		} else {
			setSelectedView(0);
		}
	};

	const onPrimaryAction = () => {
		if (nou(selectedField)) {
			return;
		}
		if (!hasItems) {
			insertOnce(selectedField.id, 0);
			return;
		}
		if (isMdUp || selectedView === 1) {
			insertOnce(selectedField.id, position);
		} else {
			setSelectedView(1);
		}
	};

	const onSelectField = (field: PartialContentType) => {
		setSelectedField(field);
		if (!hasItems) {
			insertOnce(field.id, 0);
		} else if (!isMdUp) {
			setSelectedView(1);
		}
	};

	const onConfirmField = (field: PartialContentType) => {
		setSelectedField(field);
		if (!hasItems) {
			insertOnce(field.id, 0);
		} else if (isMdUp) {
			insertOnce(field.id, position);
		} else {
			setSelectedView(1);
		}
	};

	const positionPicker = (
		<InsertPositionPicker
			items={positionItems}
			value={position}
			onChange={setPosition}
			disabled={!selectedField}
			afterSelectLabel={insertAfterSelectLabel}
			emptyMode="hide"
		/>
	);

	const selectField = (
		<SelectField
			configLookup={configLookup}
			currentFields={currentFields ?? type.fields}
			typesFullList={typesFullList}
			selectedField={selectedField}
			setSelectedField={onSelectField}
			onConfirmField={onConfirmField}
			systemFieldsIds={systemFieldsIds}
			systemFieldsTitle={systemFieldsTitle}
		/>
	);

	return (
		<>
			<DialogBody sx={{ transition: 'height 0.3s ease-in-out', minHeight: '40vh' }}>
				{/* If the dialog is wide enough, show the select field and the position picker side by side. */}
				{isMdUp ? (
					<Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch', minHeight: '40vh', minWidth: 0 }}>
						<Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>{selectField}</Box>
						{hasItems && (
							<Box
								sx={{
									width: 300,
									flexShrink: 0,
									minWidth: 0,
									overflow: 'hidden',
									borderLeft: 1,
									borderColor: 'divider',
									pl: 2,
									display: 'flex',
									flexDirection: 'column',
									gap: 1
								}}
							>
								{!selectedField && (
									<Typography variant="body2" color="text.secondary">
										<FormattedMessage defaultMessage="Select an item to choose its insert position." />
									</Typography>
								)}
								{positionPicker}
							</Box>
						)}
					</Box>
				) : showFieldPositionStep ? (
					// If the dialog is narrow, show the select field and the position picker one after the other.
					<Box>
						<Box sx={{ display: 'flex', mb: 1 }}>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center'
								}}
							>
								<Tooltip title={formatMessage({ defaultMessage: 'Back to control selection' })}>
									<IconButton onClick={() => setSelectedView(0)}>
										<ArrowBackRoundedIcon />
									</IconButton>
								</Tooltip>
							</Box>
							<ListItem component="div">
								<ListItemIcon>
									{selectedField && configLookup?.[selectedField.id]?.icon?.id ? (
										<SystemIcon icon={configLookup[selectedField.id].icon} />
									) : (
										<ComponentIcon />
									)}
								</ListItemIcon>
								<ListItemText primary={selectedField.name} secondary={selectedField.description} />
							</ListItem>
						</Box>
						{positionPicker}
					</Box>
				) : (
					selectField
				)}
			</DialogBody>
			<DialogFooter>
				<SecondaryButton onClick={onSecondaryAction}>
					{isMdUp || selectedView === 0 ? (
						<FormattedMessage defaultMessage="Cancel" />
					) : (
						<FormattedMessage defaultMessage="Back" />
					)}
				</SecondaryButton>
				<PrimaryButton disabled={nou(selectedField)} onClick={() => onPrimaryAction()}>
					{isMdUp || selectedView === 1 ? (
						<FormattedMessage defaultMessage="Accept" />
					) : (
						<FormattedMessage defaultMessage="Select" />
					)}
				</PrimaryButton>
			</DialogFooter>
		</>
	);
}

export function PickFieldDialog({
	type,
	title,
	onInsert,
	typesFullList,
	typesCurrentList,
	currentFields,
	systemFieldsTitle,
	systemFieldsIds,
	insertAfterSelectLabel,
	configLookup,
	...dialogProps
}: PickFieldDialogProps) {
	return (
		<EnhancedDialog title={title} maxWidth="lg" {...dialogProps}>
			<PickFieldDialogBody
				{...dialogProps}
				type={type}
				onInsert={onInsert}
				typesFullList={typesFullList}
				typesCurrentList={typesCurrentList}
				currentFields={currentFields}
				systemFieldsTitle={systemFieldsTitle}
				systemFieldsIds={systemFieldsIds}
				insertAfterSelectLabel={insertAfterSelectLabel}
				configLookup={configLookup}
			/>
		</EnhancedDialog>
	);
}

export function SelectField(props: {
	typesFullList: DescriptorContentType[];
	selectedField: PartialContentType;
	configLookup?: PickFieldDialogProps['configLookup'];
	setSelectedField: (field: PartialContentType) => void;
	/** Double-click or Enter. Defaults to `setSelectedField` when omitted. */
	onConfirmField?: (field: PartialContentType) => void;
	systemFieldsIds?: PickFieldDialogProps['systemFieldsIds'];
	systemFieldsTitle?: PickFieldDialogProps['systemFieldsTitle'];
	currentFields?: LookupTable<ContentTypeField>;
}) {
	const {
		configLookup,
		typesFullList,
		selectedField,
		setSelectedField,
		onConfirmField,
		systemFieldsIds = [],
		systemFieldsTitle = <FormattedMessage defaultMessage="System Fields" />,
		currentFields = {}
	} = props;
	const [searchTerm, setSearchTerm] = useState('');
	const [sortOrder, setSortOrder] = useState<'ascending' | 'descending'>('ascending');
	const { formatMessage, locale } = useIntl();
	const collator = useMemo(() => new Intl.Collator(locale), [locale]);
	const currentFieldTypes = Object.values(currentFields).map((field) => field.type);
	const confirmField = onConfirmField ?? setSelectedField;
	// MUI ButtonBase synthesizes a click after Enter; skip that click when onKeyDown already confirmed.
	const ignoreClickAfterEnterRef = useRef(false);

	const systemFields = sortFieldsByName(
		typesFullList
			.map((type) => applyTranslations(type, formatMessage))
			.filter(
				(type) =>
					(type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
						type.description.toLowerCase().includes(searchTerm.toLowerCase())) &&
					systemFieldsIds.includes(type.id) &&
					// Type is not in 'currentTypeIds'
					!currentFieldTypes.includes(type.id) &&
					// id is not in currentFields
					!currentFields[type.id] &&
					// If type is file-name and `currentTypeIds` has auto-filename, or
					// type is auto-filename and `currentTypeIds` has file-name, then filter out
					!(
						(type.id === 'file-name' && currentFieldTypes.includes('auto-filename')) ||
						(type.id === 'auto-filename' && currentFieldTypes.includes('file-name'))
					)
			),
		sortOrder,
		collator
	);

	const filteredFields = sortFieldsByName(
		typesFullList
			.map((type) => applyTranslations(type, formatMessage))
			.filter(
				(type) =>
					(type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
						type.description.toLowerCase().includes(searchTerm.toLowerCase())) &&
					!systemFieldsIds.includes(type.id)
			),
		sortOrder,
		collator
	);

	const handleSearchChange: SearchBarProps['onChange'] = (value) => {
		setSearchTerm(value);
	};

	const renderFieldButton = (field: PartialContentType, key: React.Key) => (
		<ListItemButton
			key={key}
			// Double-click or Enter selects the field (inserts at current position on large screens).
			onClick={() => {
				if (ignoreClickAfterEnterRef.current) {
					ignoreClickAfterEnterRef.current = false;
					return;
				}
				setSelectedField(field);
			}}
			onDoubleClick={() => confirmField(field)}
			onKeyDown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					ignoreClickAfterEnterRef.current = true;
					confirmField(field);
				}
			}}
			selected={selectedField?.id === field.id}
			aria-pressed={selectedField?.id === field.id}
		>
			<ListItemIcon>
				{configLookup?.[field.id]?.icon?.id ? <SystemIcon icon={configLookup[field.id].icon} /> : <ComponentIcon />}
			</ListItemIcon>
			<ListItemText primary={field.name} secondary={field.description} />
		</ListItemButton>
	);

	return (
		<>
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
				<SearchBar keyword={searchTerm} onChange={handleSearchChange} autoFocus={true} sx={{ flexGrow: 1 }} />
				<Tooltip
					title={
						sortOrder === 'ascending'
							? formatMessage({ defaultMessage: 'Sort by name (ascending)' })
							: formatMessage({ defaultMessage: 'Sort by name (descending)' })
					}
				>
					<Button
						variant="text"
						aria-label={
							sortOrder === 'ascending'
								? formatMessage({ defaultMessage: 'Sort by name (ascending)' })
								: formatMessage({ defaultMessage: 'Sort by name (descending)' })
						}
						endIcon={
							sortOrder === 'ascending' ? (
								<ArrowUpwardRoundedIcon color="primary" />
							) : (
								<ArrowDownwardRoundedIcon color="primary" />
							)
						}
						onClick={() => setSortOrder((order) => (order === 'ascending' ? 'descending' : 'ascending'))}
						sx={{
							color: 'text.primary',
							fontWeight: 'normal',
							fontSize: (theme) => theme.typography.fontSize,
							flexShrink: 0
						}}
					>
						<FormattedMessage defaultMessage="Sort" />
					</Button>
				</Tooltip>
			</Box>
			<Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', mt: 1, mb: 2 }}>
				{filteredFields.map((field) => renderFieldButton(field, field.id))}
			</Box>
			{systemFields.length > 0 && (
				<>
					<Divider />
					<FormControl sx={{ mt: 2 }}>
						<FormLabel id="fieldSectionRadioGroupLabel">{systemFieldsTitle}</FormLabel>
					</FormControl>
					<Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', mt: 2 }}>
						{systemFields.map((field, index) => renderFieldButton(field, index))}
					</Box>
				</>
			)}
		</>
	);
}

/**
 * Sorts an array of fields alphabetically by their name property, either in ascending or descending order.
 */
function sortFieldsByName(
	fields: PartialContentType[],
	order: 'ascending' | 'descending',
	collator: Intl.Collator
): PartialContentType[] {
	return [...fields].sort((a, b) => {
		const result = collator.compare(a.name, b.name);
		return order === 'ascending' ? result : -result;
	});
}

export default PickFieldDialog;
