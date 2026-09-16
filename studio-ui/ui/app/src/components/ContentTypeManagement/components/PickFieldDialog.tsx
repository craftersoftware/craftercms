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

import { EnhancedDialog, EnhancedDialogProps } from '../../EnhancedDialog';
import { ContentType, ContentTypeField, DataSource } from '../../../models';
import { FormattedMessage, useIntl } from 'react-intl';
import React, { ReactNode, useState } from 'react';
import { applyTranslations, DescriptorContentType, DescriptorField, PartialContentType } from '../utils';
import { DialogBody } from '../../DialogBody';
import { SearchBar, SearchBarProps } from '../../SearchBar';
import Box from '@mui/material/Box';
import ListItemButton from '@mui/material/ListItemButton';
import { ListItemIcon, ListItemText } from '@mui/material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
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
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import LookupTable from '../../../models/LookupTable';
import { SystemIcon } from '../../SystemIcon';
import ComponentIcon from '../../../icons/Component';

export interface PickFieldDialogProps extends EnhancedDialogProps {
	type: ContentType;
	configLookup?: LookupTable<{ descriptor?: DescriptorContentType; icon: { id: string }; id: string }>; // TODO: not a li
	typesFullList: DescriptorContentType[];
	typesCurrentList: DescriptorField[] | DataSource[];
	title: ReactNode;
	onInsert: (fieldType: string, position: number) => void;
	systemFieldsIds?: string[];
	systemFieldsTitle?: ReactNode;
}

export interface PickFieldDialogBodyProps extends Omit<PickFieldDialogProps, 'title'> {}

export function PickFieldDialogBody(props: PickFieldDialogBodyProps) {
	const { configLookup, typesFullList, typesCurrentList, onInsert, onClose, systemFieldsTitle, systemFieldsIds, type } =
		props;
	const [selectedField, setSelectedField] = useState<PartialContentType>(undefined);
	const [selectedView, setSelectedView] = useState<number>(0);
	const [position, setPosition] = useState<number>(typesCurrentList?.length ?? 0);

	const onSecondaryAction = (e: React.MouseEvent) => {
		if (selectedView === 0) {
			onClose?.(e, null);
		} else {
			setSelectedView(0);
		}
	};

	const onPrimaryAction = () => {
		if (selectedView === 0) {
			setSelectedView(1);
		} else {
			onInsert(selectedField.id, position);
		}
	};

	const onSelectField = (field: PartialContentType) => {
		setSelectedField(field);
		// If there are items in the current section, move to next view (select position). Otherwise, insert at first position.
		if (typesCurrentList?.length > 0) {
			setSelectedView(1);
		} else {
			onInsert(field.id, 0);
		}
	};

	return (
        <>
            <DialogBody sx={{ transition: 'height 0.3s ease-in-out', minHeight: '40vh' }}>
				{selectedView === 0 ? (
					<SelectField
						configLookup={configLookup}
						currentFields={type.fields}
						typesFullList={typesFullList}
						selectedField={selectedField}
						setSelectedField={onSelectField}
						systemFieldsIds={systemFieldsIds}
						systemFieldsTitle={systemFieldsTitle}
					/>
				) : (
					<Box>
						<Box sx={{ display: 'flex', mb: 1 }}>
							<Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center"
                                }}>
								<Tooltip title={<FormattedMessage defaultMessage="Back to control selection" />}>
									<IconButton onClick={() => setSelectedView(0)}>
										<ArrowBackRoundedIcon />
									</IconButton>
								</Tooltip>
							</Box>
							<ListItem>
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
						<FormControl>
							<FormLabel id="controlInsertionRadioGroupLabel">
								<FormattedMessage defaultMessage="Pick the position for the new control:" />
							</FormLabel>
						</FormControl>
						<RadioGroup
							aria-labelledby="controlInsertionRadioGroupLabel"
							name="controlInsertionRadioGroupLabel"
							value={position}
							onChange={(e) => setPosition(parseInt(e.target.value))}
							sx={{ padding: '10px' }}
						>
							<FormControlLabel
								control={<Radio />}
								value={0}
								sx={{ marginBottom: '10px' }}
								slotProps={{ typography: { variant: 'body2' } }}
								label={<FormattedMessage defaultMessage="Insert first" />}
							/>
							{typesCurrentList?.map((field, index) => (
								<FormControlLabel
									key={field.id}
									control={<Radio />}
									value={index + 1}
									sx={{ marginBottom: '10px' }}
									slotProps={{ typography: { variant: 'body2' } }}
									label={
										index + 1 === typesCurrentList.length ? (
											<FormattedMessage
												defaultMessage='Insert last (after "{sectionName}")'
												values={{ sectionName: field.title ?? field.name }}
											/>
										) : (
											<FormattedMessage
												defaultMessage='Insert after "{sectionName}"'
												values={{ sectionName: field.title ?? field.name }}
											/>
										)
									}
								/>
							))}
						</RadioGroup>
					</Box>
				)}
			</DialogBody>
            <DialogFooter>
				<SecondaryButton onClick={onSecondaryAction}>
					{selectedView === 0 ? (
						<FormattedMessage defaultMessage="Cancel" />
					) : (
						<FormattedMessage defaultMessage="Back" />
					)}
				</SecondaryButton>
				<PrimaryButton disabled={nou(selectedField)} onClick={() => onPrimaryAction()}>
					{selectedView === 0 ? (
						<FormattedMessage defaultMessage="Select" />
					) : (
						<FormattedMessage defaultMessage="Accept" />
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
	systemFieldsTitle,
	systemFieldsIds,
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
				systemFieldsTitle={systemFieldsTitle}
				systemFieldsIds={systemFieldsIds}
			/>
		</EnhancedDialog>
	);
}

export function SelectField(props: {
	typesFullList: DescriptorContentType[];
	selectedField: PartialContentType;
	configLookup?: PickFieldDialogProps['configLookup'];
	setSelectedField: (field: PartialContentType) => void;
	systemFieldsIds?: PickFieldDialogProps['systemFieldsIds'];
	systemFieldsTitle?: PickFieldDialogProps['systemFieldsTitle'];
	currentFields?: LookupTable<ContentTypeField>;
}) {
	const {
		configLookup,
		typesFullList,
		selectedField,
		setSelectedField,
		systemFieldsIds = [],
		systemFieldsTitle = <FormattedMessage defaultMessage="System Fields" />,
		currentFields = {}
	} = props;
	const [searchTerm, setSearchTerm] = useState('');
	const { formatMessage } = useIntl();
	const currentFieldTypes = Object.values(currentFields).map((field) => field.type);

	const systemFields = typesFullList
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
		);

	const filteredFields = typesFullList
		.map((type) => applyTranslations(type, formatMessage))
		.filter(
			(type) =>
				(type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					type.description.toLowerCase().includes(searchTerm.toLowerCase())) &&
				!systemFieldsIds.includes(type.id)
		);

	const handleSearchChange: SearchBarProps['onChange'] = (value) => {
		setSearchTerm(value);
	};

	return (
		<>
			<SearchBar keyword={searchTerm} onChange={handleSearchChange} autoFocus={true} />
			<Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', mt: 1, mb: 2 }}>
				{filteredFields.map((field, index) => (
					<ListItemButton key={index} onClick={() => setSelectedField(field)} selected={selectedField?.id === field.id}>
						<ListItemIcon>
							{configLookup?.[field.id]?.icon?.id ? (
								<SystemIcon icon={configLookup[field.id].icon} />
							) : (
								<ComponentIcon />
							)}
						</ListItemIcon>
						<ListItemText primary={field.name} secondary={field.description} />
					</ListItemButton>
				))}
			</Box>
			{systemFields.length > 0 && (
				<>
					<Divider />
					<FormControl sx={{ mt: 2 }}>
						<FormLabel id="fieldSectionRadioGroupLabel">{systemFieldsTitle}</FormLabel>
					</FormControl>
					<Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', mt: 2 }}>
						{systemFields.map((field, index) => (
							<ListItemButton
								key={index}
								onClick={() => setSelectedField(field)}
								selected={selectedField?.id === field.id}
							>
								<ListItemIcon>
									{configLookup?.[field.id]?.icon?.id ? (
										<SystemIcon icon={configLookup[field.id].icon} />
									) : (
										<ComponentIcon />
									)}
								</ListItemIcon>
								<ListItemText primary={field.name} secondary={field.description} />
							</ListItemButton>
						))}
					</Box>
				</>
			)}
		</>
	);
}

export default PickFieldDialog;
