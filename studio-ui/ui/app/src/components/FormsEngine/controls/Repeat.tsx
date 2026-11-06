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

import React from 'react';
import { StableFormContext, useStableGlobalApiContext } from '../lib/formsEngineContext';
import { useAtomValue, useStore as useJotaiStore } from 'jotai';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { FormsEngineField } from '../components/FormsEngineField';
import { ControlProps } from '../types';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import ListItemButton from '@mui/material/ListItemButton';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import Tooltip from '@mui/material/Tooltip';
import { lazy, MouseEvent as ReactMouseEvent, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Avatar, { avatarClasses } from '@mui/material/Avatar';
import { StackedButton } from '../components/StackedButton';
import { isTouchDevice } from '../lib/sortableListUtil';
import { DialogHeader } from '../../DialogHeader';
import Dialog from '@mui/material/Dialog';
import SortableListSkeleton from '../components/SortableListSkeleton';
import type { TItem } from '../components/SortableList';
import FieldBox from '../components/FieldBox';
import { buttonClasses } from '@mui/material/Button';
import { repeatIndexOutOfRangeWarning, visibleRepeatItems } from '../lib/formVisibility';
import { repeatItemFormProps } from '../lib/repeatItemForm';
import {
	getRepeatItemSummary,
	getRepeatItemTitle,
	reorderRepeatItems,
	repeatDisplayFieldIds,
	repeatSortItems
} from './repeatItemDisplay';
import { findRepeatItemIndex, removeRepeatItem, repeatItemKeysFor, type RepeatItemKeys } from '../lib/repeatItemKeys';
import {
	countLimitValue,
	getRepeatMinimum,
	isRepeatAddDisabled,
	isRepeatRemoveDisabled
} from '../../../utils/countLimits';
const repeatMessages = {
	...defineMessages({
		addItems: { defaultMessage: 'Add items' },
		deleteItem: { defaultMessage: 'Delete' }
	}),
	...defineMessages<{
		maxReached: { readonly max: number | bigint };
		minRequired: { readonly min: number | bigint };
	}>({
		maxReached: { defaultMessage: 'Maximum of {max, plural, one {# item} other {# items}} reached' },
		minRequired: { defaultMessage: 'At least {min, plural, one {# item is} other {# items are}} required' }
	})
};

export type RepeatItem = Record<string, unknown>;

export type RepeatProps = ControlProps<RepeatItem[]>;

let warnedUnkeyedItem = false;
/** The stable key of a row. Items are objects, so a missing key means the value is malformed. */
function rowKey(keys: RepeatItemKeys<RepeatItem>, item: RepeatItem, index: number): string | number {
	const key = keys.keyOf(item);
	if (key !== undefined) return key;
	if (!warnedUnkeyedItem) {
		warnedUnkeyedItem = true;
		console.warn('A repeat item is not an object, so its row is keyed by position.');
	}
	return index;
}

const SortableList = lazy(() => import('../components/SortableList'));
const TouchSortableList = lazy(() => import('../components/TouchSortableList'));

/** Repeating group. Add stops at maxCount; delete stops at minCount. See utils/countLimits.ts. */
export function Repeat(props: RepeatProps) {
	const { field, value, setValue, readonly, autoFocus } = props;
	const { formatMessage } = useIntl();
	const [sortMode, setSortMode] = useState(false);
	const useTouchSorting = useMemo(() => isTouchDevice(), []);
	const handleCancelReorder = () => setSortMode(false);
	const onReorder = () => setSortMode(true);
	const api = useStableGlobalApiContext();
	const store = useJotaiStore();
	const formAtoms = useContext(StableFormContext).atoms;
	const valueAtom = formAtoms.valueByFieldId[field.id];
	// Keys are per repeat field, and the item form (another FormsEngine) writes to the same array. See repeatItemKeysFor.
	const fallbackOwner = useRef({});
	const itemKeys = repeatItemKeysFor<RepeatItem>(valueAtom ?? fallbackOwner.current);
	// Read at click time. `value` is the render-time array and can be behind an item form save.
	const getStoredItems = () => (valueAtom ? ((store.get(valueAtom) as RepeatItem[]) ?? []) : value);
	const openItemForm = (index?: number, item?: RepeatItem) => {
		if (!valueAtom) return;
		api.pushForm(
			repeatItemFormProps({
				fieldId: field.id,
				index,
				values: item,
				getItems: getStoredItems,
				keys: itemKeys,
				setItems: (next) => setValue(next)
			})
		);
	};
	const formVisibility = useAtomValue(formAtoms.formVisibility);
	const selection = visibleRepeatItems(value, formVisibility.active.repeatItem, field.id);
	const visibleItems = selection.items;
	const itemScoped = selection.scoped;
	const count = value.length;
	const hasContent = visibleItems.length > 0;
	useEffect(() => {
		if (selection.outOfRangeIndex === undefined) return;
		console.warn(repeatIndexOutOfRangeWarning(field.id, selection.outOfRangeIndex, value.length));
	}, [field.id, selection.outOfRangeIndex, value.length]);
	// minCount/maxCount are the mapped limits. 0 is unlimited. See utils/countLimits.ts.
	const maxCount = countLimitValue(field.validations?.maxCount?.value);
	const minCount = countLimitValue(field.validations?.minCount?.value);
	const minimum = getRepeatMinimum(minCount);
	const isAddDisabled = isRepeatAddDisabled(Boolean(readonly), count, maxCount);
	const isRemoveDisabled = isRepeatRemoveDisabled(Boolean(readonly), count, minCount);
	const addTooltip = readonly
		? ''
		: isAddDisabled
			? formatMessage(repeatMessages.maxReached, { max: maxCount ?? 0 })
			: formatMessage(repeatMessages.addItems);
	const deleteTooltip = readonly
		? ''
		: isRemoveDisabled
			? formatMessage(repeatMessages.minRequired, { min: minimum })
			: formatMessage(repeatMessages.deleteItem);
	/** Removes one item unless the repeat is already at its minimum. */
	const handleRemoveItem = (event: ReactMouseEvent, item: RepeatItem) => {
		event.stopPropagation();
		if (isRemoveDisabled) return;
		const stored = getStoredItems();
		// The stored array can be shorter than this render's. Check the limit against it.
		if (isRepeatRemoveDisabled(Boolean(readonly), stored.length, minCount)) return;
		// The row's item, found in the stored array. Its position may have moved since the render.
		const index = findRepeatItemIndex(stored, item, itemKeys);
		if (index === -1) return;
		setValue(removeRepeatItem(stored, index));
	};
	/** Opens the item's form at the item's current position in the stored array, which may differ from this render's. */
	const handleEditItem = (event: ReactMouseEvent, item: RepeatItem) => {
		const stored = getStoredItems();
		const index = findRepeatItemIndex(stored, item, itemKeys);
		if (index === -1) return;
		openItemForm(index, stored[index]);
	};
	/** Opens a new repeat item unless adding is disabled. */
	const handleAddItem: IconButtonProps['onClick'] = () => {
		if (isAddDisabled || isRepeatAddDisabled(Boolean(readonly), getStoredItems().length, maxCount)) return;
		openItemForm();
	};
	const displayFieldIds = useMemo(() => repeatDisplayFieldIds(field.fields), [field.fields]);
	const sortList = useMemo<Array<TItem<RepeatItem>>>(
		() => (sortMode ? repeatSortItems(value, displayFieldIds, itemKeys) : []),
		[sortMode, value, displayFieldIds, itemKeys]
	);
	/** Stores the new order, built from the latest stored array so an item saved since the list was built is kept. */
	const onSortChange = (newList: TItem<RepeatItem>[]) => {
		setValue(reorderRepeatItems(getStoredItems(), newList, itemKeys));
	};
	return (
		<>
			<Dialog open={sortMode} onClose={handleCancelReorder} maxWidth="xs" fullWidth>
				<DialogHeader
					title={field.name}
					rightActions={[{ text: <FormattedMessage defaultMessage="Done" />, onClick: handleCancelReorder }]}
				/>
				{useTouchSorting ? (
					<TouchSortableList items={sortList} onChange={onSortChange} />
				) : (
					<Suspense
						fallback={<SortableListSkeleton items={sortList} />}
						children={<SortableList items={sortList} onChange={onSortChange} />}
					/>
				)}
			</Dialog>
			<FormsEngineField
				field={field}
				min={minCount}
				max={maxCount}
				length={count}
				action={
					itemScoped ? undefined : (
						<Tooltip title={addTooltip}>
							<span>
								<IconButton
									size="small"
									color="primary"
									onClick={handleAddItem}
									autoFocus={autoFocus}
									disabled={isAddDisabled}
								>
									<AddRounded fontSize="small" />
								</IconButton>
							</span>
						</Tooltip>
					)
				}
				menuOptions={
					itemScoped ? undefined : [{ id: 'reorder', text: <FormattedMessage defaultMessage="Reorder Items" /> }]
				}
				onMenuOptionClick={(_, __, closeMenu) => {
					onReorder();
					closeMenu();
				}}
			>
				<FieldBox dashed={!hasContent}>
					{hasContent ? (
						<List dense>
							{visibleItems.map(({ item, index }, position) => (
								<ListItemButton
									key={rowKey(itemKeys, item, index)}
									divider={position !== visibleItems.length - 1}
									onClick={(e) => handleEditItem(e, item)}
								>
									<ListItemText
										primary={getRepeatItemTitle(item, displayFieldIds)}
										secondary={getRepeatItemSummary(item, displayFieldIds)}
										slotProps={{
											primary: {
												noWrap: true
											},
											secondary: {
												noWrap: true
											}
										}}
									/>
									{!readonly && (
										<ListItemSecondaryAction sx={{ position: 'static', display: 'flex', transform: 'none' }}>
											<Tooltip title="Edit">
												<IconButton size="small">
													<EditOutlined fontSize="small" />
												</IconButton>
											</Tooltip>
											{!itemScoped && (
												<Tooltip title={deleteTooltip}>
													<span onClick={(event) => event.stopPropagation()}>
														<IconButton
															size="small"
															disabled={isRemoveDisabled}
															onClick={(e) => handleRemoveItem(e, item)}
														>
															<DeleteOutlined fontSize="small" />
														</IconButton>
													</span>
												</Tooltip>
											)}
										</ListItemSecondaryAction>
									)}
								</ListItemButton>
							))}
						</List>
					) : (
						<Tooltip title={addTooltip}>
							<span>
								<StackedButton
									onClick={handleAddItem}
									disabled={isAddDisabled}
									sx={{
										[`&.${buttonClasses.disabled} .${avatarClasses.root}`]: {
											opacity: 0.7,
											color: 'action.disabled',
											bgcolor: 'action.disabled'
										}
									}}
								>
									<Avatar variant="circular">
										<AddRounded />
									</Avatar>
									<FormattedMessage defaultMessage="Add" />
								</StackedButton>
							</span>
						</Tooltip>
					)}
				</FieldBox>
			</FormsEngineField>
		</>
	);
}

export default Repeat;
