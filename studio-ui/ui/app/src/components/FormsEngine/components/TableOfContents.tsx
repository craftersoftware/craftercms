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

import React, { RefObject, SyntheticEvent, useContext, useMemo, useState } from 'react';
import { ContentTypeField } from '../../../models';
import type { ContentTypeSection } from '../../../models/ContentType';
import { FormsEngineAtoms, ItemMetaContext, StableFormContext } from '../lib/formsEngineContext';
import { commitFormVisibility, useStackSubmitting } from '../lib/formUtils';
import useDebouncedInput from '../../../hooks/useDebouncedInput';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import SearchBar from '../../SearchBar';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import Box from '@mui/material/Box';
import { atom, useAtomValue, useSetAtom, useStore as useJotaiStore } from 'jotai';
import { FormattedMessage, useIntl } from 'react-intl';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {
	isScopeActive,
	revealField,
	returnToLaunchScope,
	scopeFieldCounts,
	scopeToggleVisible
} from '../lib/formVisibility';
import { hasFieldValidator, hasValidationKeyValidator, isEmptyValue, isFieldRequired } from '../lib/validators';
import { immutableEmptyArray } from '../../../utils/array';
import useLoadableAtom from '../lib/useLoadableAtom';
import Skeleton from '@mui/material/Skeleton';
import ErrorBoundary from '../../ErrorBoundary';
import FieldStateIndicator from './FieldStateIndicator';
import { XmlKeys } from '../lib/formConsts';

export interface TableOfContentsProps {
	containerRef: RefObject<HTMLDivElement>;
	/** Flat field list for a repeat-item editor, which has no sections. */
	fields?: ContentTypeField[];
	/** When provided (full form), ToC sections follow the same filtered field lists as the form body. */
	sections?: ContentTypeSection[];
	/**
	 * Field ids of the unscoped form (already past the embedded file-name filter).
	 * Present when this form was opened with a launch scope.
	 */
	countFieldIds?: string[];
}

export function TableOfContents({ containerRef, fields, sections, countFieldIds }: TableOfContentsProps) {
	const store = useJotaiStore();
	const atoms = useContext(StableFormContext).atoms;
	const contentType = useContext(ItemMetaContext).contentType;
	const contentTypeFields = contentType.fields;
	const contentTypeSections = sections ?? contentType.sections;
	const setOpenDrawerSidebar = useSetAtom(atoms.tableOfContentsDrawerOpen);
	const expandedStateAtoms = atoms.expandedStateBySectionId;
	const expandedSectionIds = useAtomValue(
		useMemo(
			() => atom((get) => Object.entries(expandedStateAtoms).flatMap(([key, atom]) => (get(atom) ? [key] : []))),
			[expandedStateAtoms]
		)
	);
	const scrollToTarget = (target: Element) => {
		// Wait for the drawer to hide so the transition focus doesn't impede the scrollIntoView.
		// When the sidebar is a drawer, the hide transition is set to 0 for this to work with minimal timeout.
		setTimeout(() => {
			target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
		});
	};
	const handleSectionClick = (event: SyntheticEvent) => {
		setOpenDrawerSidebar(false);
		const sectionId = event.currentTarget.getAttribute('data-section-id');
		if (!store.get(expandedStateAtoms[sectionId])) {
			store.set(expandedStateAtoms[sectionId], true);
		}
		scrollToTarget(containerRef.current.querySelector(`[data-area-id="formBody"] [data-section-id="${sectionId}"]`));
	};
	const handleFieldClick = (event: SyntheticEvent) => {
		event.stopPropagation();
		// TODO: When filtering and clicked, the section may be collapsed. Through DOM, we can't
		//  get the section id since sections aren't rendered when filtering. How do we get to the section to expand it?
		setOpenDrawerSidebar(false);
		const fieldId = event.currentTarget.getAttribute('data-field-id');
		scrollToTarget(containerRef.current.querySelector(`[data-area-id="formBody"] [data-field-id="${fieldId}"]`));
	};
	const handleSectionExpansionToggleClick = (event: SyntheticEvent, itemId: string, expanded: boolean) => {
		event.stopPropagation(); // Avoid accordion expansion
		store.set(expandedStateAtoms[itemId], expanded);
		setOpenDrawerSidebar(false);
	};
	const [searchFieldValue, setSearchFieldValue] = useState('');
	const [filteredFields, setFilteredFields] = useState<ContentTypeField[]>(null);
	const contentTypeFieldsArray =
		fields ??
		contentTypeSections.flatMap((section) =>
			section.fields.map((fieldId) => contentTypeFields[fieldId]).filter(Boolean)
		);
	const onKeyword$ = useDebouncedInput((value) => {
		if (!value?.trim()) {
			return setFilteredFields(null);
		}
		const keyword = value.toLowerCase();
		setFilteredFields(contentTypeFieldsArray.filter((field) => field.name.toLowerCase().includes(keyword)));
	});
	const createFieldTreeItem = (field: ContentTypeField) => {
		const fieldId = field.id;
		return (
			<TreeItem
				key={fieldId}
				itemId={fieldId}
				data-field-id={fieldId}
				onClick={handleFieldClick}
				label={<TreeItemLabel field={field} atoms={atoms} />}
			/>
		);
	};
	return (
		<>
			{countFieldIds && <FieldScopeNotice countFieldIds={countFieldIds} />}
			<SearchBar
				dense
				sx={{ mb: 1, mt: 1 }}
				showActionButton={searchFieldValue !== ''}
				keyword={searchFieldValue}
				onChange={(value) => {
					setSearchFieldValue(value);
					onKeyword$.next(value);
				}}
			/>
			<ErrorBoundary>
				<SimpleTreeView
					selectedItems={immutableEmptyArray}
					expansionTrigger="iconContainer"
					onItemExpansionToggle={handleSectionExpansionToggleClick}
					expandedItems={expandedSectionIds}
				>
					{filteredFields?.map(createFieldTreeItem) ??
						fields?.map(createFieldTreeItem) ??
						contentTypeSections.map((section) => (
							<TreeItem
								key={section.id}
								itemId={section.id}
								data-section-id={section.id}
								label={section.title}
								onClick={handleSectionClick}
								children={section.fields.map((fieldId) => createFieldTreeItem(contentTypeFields[fieldId]))}
							/>
						))}
				</SimpleTreeView>
			</ErrorBoundary>
			{/* Spacer: */}
			<Box sx={{ minHeight: 50 }} />
		</>
	);
}

export function FieldScopeNotice({ countFieldIds }: { countFieldIds: string[] }) {
	const { formatMessage } = useIntl();
	const store = useJotaiStore();
	const stableForm = useContext(StableFormContext);
	const stackSubmitting = useStackSubmitting();
	const visibility = useAtomValue(stableForm.atoms.formVisibility);
	useAtomValue(stableForm.atoms.relevanceVersion);
	const repeatFieldId = stableForm.props?.repeat?.fieldId;
	if (!scopeToggleVisible(visibility)) return null;
	const viewingFullForm = !isScopeActive(visibility.active);
	const { showing, total } = scopeFieldCounts(countFieldIds, {
		irrelevantFieldPaths: stableForm.formControllerState?.irrelevantFieldPaths,
		parentPath: repeatFieldId,
		scopeFieldIds: visibility.active.fieldIds
	});
	return (
		<Box role="status" sx={{ mb: 1 }}>
			<Typography variant="body2" color="textSecondary">
				{viewingFullForm
					? formatMessage({ defaultMessage: 'Showing all {total, plural, one {# field} other {# fields}}' }, { total })
					: formatMessage(
							{ defaultMessage: 'Showing {showing} of {total, plural, one {# field} other {# fields}}' },
							{ showing, total }
						)}
			</Typography>
			<Button
				size="small"
				sx={{ px: 0, minWidth: 0 }}
				disabled={!viewingFullForm && stackSubmitting}
				onClick={() => {
					const current = store.get(stableForm.atoms.formVisibility);
					if (viewingFullForm) {
						commitFormVisibility(store.set, stableForm.atoms, returnToLaunchScope(current));
						if (stableForm.itemFormMode) store.set(stableForm.itemFormMode, 'selected');
						return;
					}
					const reveal = revealField(current);
					commitFormVisibility(store.set, stableForm.atoms, reveal.state);
					if (stableForm.itemFormMode) store.set(stableForm.itemFormMode, 'full');
				}}
			>
				{viewingFullForm ? (
					<FormattedMessage defaultMessage="Back to selected fields" />
				) : (
					<FormattedMessage defaultMessage="Open full form" />
				)}
			</Button>
		</Box>
	);
}

function TreeItemLabel({
	field,
	atoms
}: {
	field: ContentTypeField;
	atoms: Pick<FormsEngineAtoms, 'valueByFieldId' | 'validationByFieldId' | 'fileName'>;
}) {
	const valueAtom = field.id === XmlKeys.fileName ? atoms.fileName : atoms.valueByFieldId[field.id];
	const validationAtom = atoms.validationByFieldId[field.id];
	if (!valueAtom || !validationAtom) return null;
	return <TreeItemLabelContent field={field} valueAtom={valueAtom} validationAtom={validationAtom} />;
}

function TreeItemLabelContent({
	field,
	valueAtom,
	validationAtom
}: {
	field: ContentTypeField;
	valueAtom: NonNullable<FormsEngineAtoms['valueByFieldId'][string] | FormsEngineAtoms['fileName']>;
	validationAtom: FormsEngineAtoms['validationByFieldId'][string];
}) {
	const value = useAtomValue(valueAtom);
	const validityData = useLoadableAtom(validationAtom);
	const isValid = validityData.state === 'hasData' ? validityData?.data.isValid : true;
	const isRequired = isFieldRequired(field);
	const hasValidator = hasFieldValidator(field.type) || hasValidationKeyValidator(field);
	return (
		<Box
			sx={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center'
			}}
		>
			<span>{field.name}</span>

			{validityData.state === 'loading' ? (
				<Skeleton variant="circular" width={15} height={15} />
			) : (
				<FieldStateIndicator
					isRequired={isRequired}
					hasValidator={hasValidator}
					isValid={isValid}
					isEmpty={isEmptyValue(field, value)}
				/>
			)}
		</Box>
	);
}

export default TableOfContents;
