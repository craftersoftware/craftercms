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

import {
	ContentTypeField,
	ContentTypeSection,
	DataSource,
	PossibleContentTypeDraft
} from '../../../models/ContentType';
import FieldChip from './FieldChip';
import React, { useMemo, useRef, useState } from 'react';
import { createStore, Provider } from 'jotai/index';
import { StableFormContext, StableFormContextProps } from '../../FormsEngine/lib/formsEngineContext';
import { createStableFormContextProps, createVirtualDataSourceFields, createVirtualSection } from '../utils';
import ErrorBoundary from '../../ErrorBoundary';
import Box from '@mui/material/Box';
import { FormattedMessage } from 'react-intl';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import UnfoldMore from '@mui/icons-material/UnfoldMoreRounded';
import UnfoldLess from '@mui/icons-material/UnfoldLessRounded';
import SectionAccordion from '../../FormsEngine/components/SectionAccordion';
import { accordionClasses } from '@mui/material/Accordion';
import Button from '@mui/material/Button';
import TypeDetailsViewHeader, { TypeDetailsViewHeaderProps } from './TypeDetailsViewHeader';
import LookupTable from '../../../models/LookupTable';
import { atom } from 'jotai';
import SectionInsertionDialog, { SectionInsertionProps } from './SectionInsertionDialog';
import { defaultDataSourcesSection } from '../descriptors/controls/commonDescriptors';
import MoveDownIcon from '@mui/icons-material/MoveDown';
import { ReorderFieldsDialog, type ReorderFieldsDialogProps } from './ReorderFieldsDialog';

export interface TypeDetailsViewProps {
	type: PossibleContentTypeDraft;
	fieldPathsWithErrors: LookupTable<boolean>;
	selectedFieldIdPath: string;
	onFieldSelected(fieldPath: string, field: ContentTypeField, sectionId: string): void;
	onDataSourceSelected(dataSource: DataSource): void;
	onSectionSelected(section: ContentTypeSection): void;
	onEditTypeAction: TypeDetailsViewHeaderProps['onActionClick'];
	onInsertSection: SectionInsertionProps['onInsertSection'];
	onOpenInsertFieldDialog(sectionId: string, fieldPath?: string): void;
	onOpenInsertDataSourceDialog(): void;
	onReorderSectionFields?(fields: ReorderFieldsDialogProps['fields'], sectionId: string): void;
	performCurrentFormErrorCheckAndWarning?(): boolean;
}

export function TypeDetailsView(props: TypeDetailsViewProps) {
	const {
		type,
		selectedFieldIdPath,
		onFieldSelected,
		fieldPathsWithErrors,
		onSectionSelected,
		onDataSourceSelected,
		onEditTypeAction,
		onOpenInsertFieldDialog,
		onOpenInsertDataSourceDialog,
		onReorderSectionFields,
		performCurrentFormErrorCheckAndWarning
	} = props;

	const store = useMemo(() => createStore(), []); // TODO: Use stable memo?
	const stableFormContextRef = useRef<StableFormContextProps>(null);
	if (stableFormContextRef.current === null)
		stableFormContextRef.current = createStableFormContextProps({ type }, true);

	const [openSectionInserter, setOpenSectionInserter] = useState<boolean>(false);
	const [reorderSectionId, setReorderSectionId] = useState<string>(null);

	const onAddSection = () => {
		if (!performCurrentFormErrorCheckAndWarning()) return false;
		setOpenSectionInserter(true);
	};

	const dataSourcesSection = useMemo(
		() =>
			createVirtualSection({
				...defaultDataSourcesSection,
				fields: type.dataSources?.map((dataSource) => dataSource.id) ?? []
			}),
		[type]
	);

	const dataSourceFields = useMemo(() => createVirtualDataSourceFields(type), [type]);

	const setSectionsExpandedState = (expanded: boolean) => {
		Object.values(stableFormContextRef.current.atoms.expandedStateBySectionId).forEach((atom) => {
			store.set(atom, expanded);
		});
	};
	const handleExpandAllSections = () => {
		setSectionsExpandedState(true);
	};
	const handleCollapseAllSections = () => {
		setSectionsExpandedState(false);
	};
	const handleInsertSection: SectionInsertionProps['onInsertSection'] = (
		section: ContentTypeSection,
		position: number
	) => {
		stableFormContextRef.current.atoms.expandedStateBySectionId[section.id] = atom(true);
		setOpenSectionInserter(false);
		props.onInsertSection?.(section, position);
	};

	const handleDataSourceSelected = (_, field) => {
		onDataSourceSelected?.(type.dataSources.find((dataSource) => dataSource.id === field.id));
	};

	const reorderSection = type.sections.find((section) => section.id === reorderSectionId);
	const reorderFields =
		reorderSection?.fields.map((fieldId) => ({
			key: fieldId,
			value: type.fields[fieldId]?.name ?? fieldId
		})) ?? [];

	const handleReorderFields = (fields: ReorderFieldsDialogProps['fields']) => {
		const sectionId = reorderSectionId;
		setReorderSectionId(null);
		onReorderSectionFields?.(fields, sectionId);
	};

	return (
		<ErrorBoundary>
			<Provider store={store}>
				<StableFormContext.Provider value={stableFormContextRef.current}>
					<TypeDetailsViewHeader type={type} onActionClick={onEditTypeAction} />

					<Box display="flex" justifyContent="space-between" mt={(theme) => `${theme.spacing(1)} !important`}>
						<Button onClick={() => onAddSection()}>
							<FormattedMessage defaultMessage="Add Section" />
						</Button>
						<div>
							<Divider orientation="vertical" flexItem />
							<Tooltip title={<FormattedMessage defaultMessage="Expand All" />}>
								<IconButton onClick={handleExpandAllSections}>
									<UnfoldMore />
								</IconButton>
							</Tooltip>
							<Tooltip title={<FormattedMessage defaultMessage="Collapse All" />}>
								<IconButton onClick={handleCollapseAllSections}>
									<UnfoldLess />
								</IconButton>
							</Tooltip>
						</div>
					</Box>

					{type.sections.map((section) => (
						<SectionAccordion
							key={section.id}
							section={section}
							sx={{ [`&.${accordionClasses.expanded}`]: { margin: 0 } }}
							slotProps={{
								accordionDetails: {
									className: '',
									children: (
										<Button onClick={() => onOpenInsertFieldDialog(section.id)}>
											<FormattedMessage defaultMessage="Add Field" />
										</Button>
									)
								}
							}}
							renderControl={(fieldId) => (
								<FieldChip
									key={fieldId}
									field={type.fields[fieldId]}
									fieldPathsWithErrors={fieldPathsWithErrors}
									onFieldSelected={(fieldIdPath, field) => onFieldSelected(fieldIdPath, field, section.id)}
									selectedFieldIdPath={selectedFieldIdPath}
									onInsertField={(fieldPath) => onOpenInsertFieldDialog(section.id, fieldPath)}
								/>
							)}
						>
							<Box sx={{ position: 'absolute', top: 15, right: 10 }}>
								{section.fields?.length > 0 && (
									<Tooltip title={<FormattedMessage defaultMessage="Reorder fields" />}>
										<IconButton onClick={() => setReorderSectionId(section.id)}>
											<MoveDownIcon />
										</IconButton>
									</Tooltip>
								)}
								<Button onClick={() => onSectionSelected?.(section)}>
									<FormattedMessage defaultMessage="Edit" />
								</Button>
							</Box>
						</SectionAccordion>
					))}

					<Divider sx={{ mx: -3 }} />

					<SectionAccordion
						colorize={false}
						variant="outlined"
						section={dataSourcesSection as ContentTypeSection}
						slotProps={{
							accordionDetails: {
								className: '',
								children: (
									<Button onClick={() => onOpenInsertDataSourceDialog()}>
										<FormattedMessage defaultMessage="Add Data Source" />
									</Button>
								)
							}
						}}
						renderControl={(fieldId) => (
							<FieldChip
								key={fieldId}
								field={dataSourceFields[fieldId]}
								fieldPathsWithErrors={fieldPathsWithErrors}
								onFieldSelected={handleDataSourceSelected}
								selectedFieldIdPath={selectedFieldIdPath}
							/>
						)}
					/>
					<SectionInsertionDialog
						type={type}
						open={openSectionInserter}
						onClose={() => setOpenSectionInserter(false)}
						onInsertSection={handleInsertSection}
					/>
					<ReorderFieldsDialog
						fields={reorderFields}
						open={Boolean(reorderSectionId)}
						onClose={() => setReorderSectionId(null)}
						onReorderFields={handleReorderFields}
					/>
				</StableFormContext.Provider>
			</Provider>
		</ErrorBoundary>
	);
}

export default TypeDetailsView;
