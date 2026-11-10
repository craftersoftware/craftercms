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
import { FormattedMessage } from 'react-intl';
import { DialogBody } from '../../DialogBody';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import { DialogFooter } from '../../DialogFooter';
import SecondaryButton from '../../SecondaryButton';
import PrimaryButton from '../../PrimaryButton';
import React, { useMemo, useState } from 'react';
import { FieldFormViewProps } from './TypeBuilderFormsEngine';
import useSpreadState from '../../../hooks/useSpreadState';
import { isTouchDevice } from '../../FormsEngine/lib/sortableListUtil';
import TouchSortableList, { TouchSortableListProps } from '../../FormsEngine/components/TouchSortableList';
import SortableList from '../../FormsEngine/components/SortableList';
import ContentType, { ContentTypeField, ContentTypeSection } from '../../../models/ContentType';
import { LookupTable } from '../../../models';
import Box from '@mui/material/Box';
import { isComposedPath, isFieldRootOnly } from '../utils';
import { EmptyState } from '../../EmptyState';

export interface MoveFieldToSectionDialogProps extends EnhancedDialogProps {
	fieldIdPath: FieldFormViewProps['fieldIdPath'];
	field: FieldFormViewProps['field'];
	sectionId: FieldFormViewProps['sectionId'];
	type: ContentType;
	controlDescriptor: FieldFormViewProps['controlDescriptor'];
	onMoveFieldToSection?: FieldFormViewProps['onMoveFieldToSection'];
}

export function MoveFieldToSectionDialogBody(props: MoveFieldToSectionDialogProps) {
	const { fieldIdPath, field, sectionId, type, controlDescriptor, onClose, onMoveFieldToSection } = props;
	const [selectedView, setSelectedView] = useState<number>(0);
	const [selections, setSelections] = useSpreadState<{
		sectionId: string;
		fieldIndex: number;
		isRepeatGroup: boolean;
	}>({
		sectionId: '',
		fieldIndex: 0,
		isRepeatGroup: false
	});
	const sections = type.sections;
	const typeRepeatGroups = getRepeatGroups(type.fields);

	const useTouchSorting = useMemo(() => isTouchDevice(), []);
	const [fields, setFields] = useState<TouchSortableListProps['items']>([]);

	const onSectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newSectionId = e.target.value;
		let isRepeatGroup = false;
		let fieldIndex = selections.fieldIndex;

		if (typeRepeatGroups[newSectionId]) {
			// When moving to sections, repeat groups are treated like sections too. When 'newSectionId' is a repeat group,
			// we need to get the fields from that repeat group.
			const selectedRepGroup = typeRepeatGroups[newSectionId];
			const newFields = Object.values(selectedRepGroup.fields).map((field) => ({ key: field.id, value: field.id }));
			fieldIndex = newFields.length;
			newFields.push({ key: field.id, value: field.id });
			setFields(newFields);
			isRepeatGroup = true;
		} else {
			const selectedSection = sections.find((section) => section.id === newSectionId);
			const newFields = selectedSection?.fields.map((field) => ({ key: field, value: field }));
			fieldIndex = newFields.length;
			// Check if the field is already in the section to avoid duplicates (before onSectionChange we're already validating
			// to avoid duplicates in sections/repeat groups).
			if (!selectedSection?.fields.includes(field.id)) {
				newFields.push({ key: field.id, value: field.id });
			}
			setFields(newFields);
		}
		setSelections({ sectionId: newSectionId, isRepeatGroup, fieldIndex });
	};

	const onReorderField = (newFields: TouchSortableListProps['items']) => {
		const fieldIndex = newFields.findIndex(({ key }) => key === field.id);
		setSelections({ fieldIndex });
		setFields(newFields);
	};

	const onSecondaryAction = (e: React.MouseEvent) => {
		if (selectedView === 0) {
			onClose?.(e, null);
		} else {
			setSelectedView(0);
		}
	};

	const onPrimaryAction = () => {
		// If when selecting the new target, there is only one field (the field being moved), skip the select position view.
		if (selectedView === 0 && fields.length > 1) {
			setSelectedView(1);
		} else {
			onMoveFieldToSection?.(
				field.id,
				sectionId,
				selections.sectionId,
				selections.fieldIndex,
				selections.isRepeatGroup
			);
		}
	};

	// Array of sections and repeat groups that the field can be moved to.
	const filteredTargets = useMemo(() => {
		const targets = [];
		// Prefer the resolved descriptor (built-in or custom) so rootOnly metadata is honored.
		// System fields (e.g. Internal Name) may store a remapped type (input/checkbox); check id too.
		const isRootOnlyField = isFieldRootOnly(field, controlDescriptor);

		sections.forEach((section) => {
			const repeatGroupsIdsForSection = getRepeatGroupsIdsForSection(section, typeRepeatGroups);
			const sameFieldInType = Boolean(type.fields[field.id]);
			const sameSection = section.id === sectionId;
			/* Include section if:
				1- If fieldPath is composed: It can be moved to any section as long as there are no fields with the same id in the type.
				2- If fieldPath is not composed: It can be moved to any section that is not the same as the current section.
			*/
			if ((isComposedPath(fieldIdPath) && !sameFieldInType) || (!isComposedPath(fieldIdPath) && !sameSection)) {
				targets.push({
					id: section.id,
					title: section.title
				});
			}

			repeatGroupsIdsForSection.forEach((repeatGroupFieldIdPath) => {
				// The pathId of the repeating group of the field being moved
				const currentRepeatGroupIdPath = fieldIdPath.split('.').slice(0, -1).join('.');
				// Validates if the current field is a child of the repeat group or if is the same repeat group
				// being moved.
				const isSameOrChildRepeatGroup = repeatGroupFieldIdPath.includes(fieldIdPath);
				const sameFieldInRepGroup = typeRepeatGroups[repeatGroupFieldIdPath].fields[field.id];
				const label = getLabelFromRepeatGroupIdPath(repeatGroupFieldIdPath, typeRepeatGroups);

				if (
					!isRootOnlyField &&
					currentRepeatGroupIdPath !== repeatGroupFieldIdPath &&
					!isSameOrChildRepeatGroup &&
					!sameFieldInRepGroup
				) {
					targets.push({
						id: repeatGroupFieldIdPath,
						title: label
					});
				}
			});
		});
		return targets;
	}, [sections, field?.id, field?.type, controlDescriptor, sectionId, type?.fields, typeRepeatGroups, fieldIdPath]);

	return (
		<>
			<DialogBody sx={{ transition: 'height 0.3s ease-in-out' }}>
				{selectedView === 0 ? (
					<>
						{filteredTargets.length > 0 ? (
							<>
								<FormControl>
									<FormLabel id="fieldSectionRadioGroupLabel">
										<FormattedMessage defaultMessage="Pick the new section for the field" />
									</FormLabel>
								</FormControl>
								<RadioGroup
									aria-labelledby="fieldSectionRadioGroupLabel"
									name="fieldSectionRadioGroupLabel"
									sx={{ padding: '10px' }}
									value={selections.sectionId}
									onChange={onSectionChange}
								>
									<Box sx={{ display: 'flex', flexDirection: 'column' }}>
										{filteredTargets.map(({ id, title }) => (
											<FormControlLabel
												key={id}
												control={<Radio />}
												value={id}
												sx={{ marginBottom: '10px' }}
												slotProps={{ typography: { variant: 'body2' } }}
												label={
													<FormattedMessage
														defaultMessage='Move to "{sectionTitle}"'
														values={{ sectionTitle: title }}
													/>
												}
											/>
										))}
									</Box>
								</RadioGroup>
							</>
						) : (
							<EmptyState title={<FormattedMessage defaultMessage="No sections available to move this field." />} />
						)}
					</>
				) : (
					<FormControl>
						<FormLabel id="moveFieldRadioGroupLabel">
							<FormattedMessage defaultMessage="Manage field position" />
						</FormLabel>
						{fields &&
							(useTouchSorting ? (
								<TouchSortableList items={fields} onChange={onReorderField} selectedItemId={field.id} />
							) : (
								<SortableList items={fields} onChange={onReorderField} selectedItemId={field.id} />
							))}
					</FormControl>
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
				<PrimaryButton disabled={selectedView === 0 ? !selections.sectionId : false} onClick={() => onPrimaryAction()}>
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

export function MoveFieldToSectionDialog(props: MoveFieldToSectionDialogProps) {
	const { field, fieldIdPath, sectionId, type, controlDescriptor, onClose, onMoveFieldToSection, ...dialogProps } =
		props;
	return (
		<EnhancedDialog
			{...dialogProps}
			onClose={onClose}
			maxWidth="sm"
			title={<FormattedMessage defaultMessage="Move to another section" />}
		>
			<MoveFieldToSectionDialogBody
				{...dialogProps}
				fieldIdPath={fieldIdPath}
				field={field}
				sectionId={sectionId}
				type={type}
				controlDescriptor={controlDescriptor}
				onClose={onClose}
				onMoveFieldToSection={onMoveFieldToSection}
			/>
		</EnhancedDialog>
	);
}

const getRepeatGroups = (fields: LookupTable<ContentTypeField>, parentId?: string): LookupTable<ContentTypeField> => {
	const flatRepeatGroups = {};
	Object.values(fields).forEach((field) => {
		if (field.type === 'repeat') {
			flatRepeatGroups[parentId ? `${parentId}.${field.id}` : field.id] = field;
		}
		if (field.fields) {
			const newParentId = parentId ? `${parentId}.${field.id}` : field.id;
			Object.assign(flatRepeatGroups, getRepeatGroups(field.fields, newParentId));
		}
	});
	return flatRepeatGroups;
};

const getRepeatGroupsIdsForSection = (
	section: ContentTypeSection,
	repeatGroups: LookupTable<ContentTypeField>
): string[] => {
	return Object.keys(repeatGroups).filter((key) => {
		const rootId = key.split('.')[0];
		return section.fields.includes(rootId);
	});
};

// Given an ID path for a repeat group, retrieves a label composed by the parent's labels and the repeat group label
// e.g: 'repGroup_o.subRepGroup_o' => 'Repeat Group | Sub Repeat Group'
const getLabelFromRepeatGroupIdPath = (
	repeatGroupIdPath: string,
	typeRepeatGroups: LookupTable<ContentTypeField>
): string => {
	const paths = repeatGroupIdPath.split('.');
	let composedPath: string;
	const labels = [];
	paths.forEach((path) => {
		if (composedPath) {
			composedPath = `${composedPath}.${path}`;
		} else {
			composedPath = path;
		}
		const repeatGroup = typeRepeatGroups[composedPath];
		if (!repeatGroup) {
			console.warn(`Repeat group not found for path: ${composedPath}`);
			return;
		}
		labels.push(repeatGroup.name);
	});
	return labels.join(' | ');
};

export default MoveFieldToSectionDialog;
