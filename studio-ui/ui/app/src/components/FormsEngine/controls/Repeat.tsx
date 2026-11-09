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
import ListItemButton from '@mui/material/ListItemButton';
import Box from '@mui/material/Box';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import {
	destinationIndex,
	isTouchDevice,
	sortableListActionProcessor,
	sortableListKeyDownHandler,
	type SortAction,
	useReorderFocus,
	useRestoreFocusWhenEmpty
} from '../lib/sortableListUtil';
import { ReorderMoveButton } from '../components/ReorderMoveButton';
import Tooltip from '@mui/material/Tooltip';
import { lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Avatar, { avatarClasses } from '@mui/material/Avatar';
import { StackedButton } from '../components/StackedButton';
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
import {
	findRepeatItemIndex,
	removeRepeatItem,
	repeatItemKeysFor,
	repeatOccurrenceKeys,
	type RepeatItemKeys
} from '../lib/repeatItemKeys';
import {
	countLimitValue,
	getRepeatMinimum,
	isRepeatAddDisabled,
	isRepeatRemoveDisabled
} from '../../../utils/countLimits';
const repeatMessages = defineMessages({
	addItems: { defaultMessage: 'Add items' },
	maxReached: { defaultMessage: 'Maximum of {max, plural, one {# item} other {# items}} reached' },
	minRequired: { defaultMessage: 'At least {min, plural, one {# item is} other {# items are}} required' }
});

export type RepeatItem = Record<string, unknown>;

export type RepeatProps = ControlProps<RepeatItem[]>;

let warnedUnkeyedItem = false;
/** The stable row keys, one per occurrence. Items are objects, so a missing key means the value is malformed. */
function rowKeysFor(keys: RepeatItemKeys<RepeatItem>, items: readonly RepeatItem[]): string[] {
	if (!warnedUnkeyedItem && items.some((item) => keys.keyOf(item) === undefined)) {
		warnedUnkeyedItem = true;
		console.warn('A repeat item is not an object, so its row is keyed by position.');
	}
	return repeatOccurrenceKeys(items, keys);
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
	// Delete's tooltip is its name, or this reason while delete is disabled.
	const minimumTooltip = formatMessage(repeatMessages.minRequired, { min: minimum });
	const { rootRef, remember } = useReorderFocus(value);
	const { addButtonRef, fallbackRef, rememberEmpty } = useRestoreFocusWhenEmpty(value);
	const rowKeys = useMemo(() => rowKeysFor(itemKeys, value), [itemKeys, value]);
	// Row actions pass the row's render index. An item stored twice then acts on the occurrence that was clicked.
	/** Removes one item unless the repeat is already at its minimum. */
	const handleRemoveItem = (event: { stopPropagation(): void }, item: RepeatItem, near: number) => {
		event.stopPropagation();
		if (isRemoveDisabled) return;
		const stored = getStoredItems();
		// The stored array can be shorter than this render's. Check the limit against it.
		if (isRepeatRemoveDisabled(Boolean(readonly), stored.length, minCount)) return;
		// The row's item, found in the stored array. Its position may have moved since the render.
		const index = findRepeatItemIndex(stored, item, itemKeys, near);
		if (index === -1) return;
		if (stored.length > 1) {
			remember(Math.min(index, stored.length - 2), 'row');
		} else {
			rememberEmpty();
		}
		setValue(removeRepeatItem(stored, index));
	};
	/** Moves the row's item one step, or to the edge, in the stored array. Nothing moves past either end. */
	const handleMoveItem = (item: RepeatItem, near: number, action: SortAction, moveToEdge: boolean, control: string) => {
		const stored = getStoredItems();
		const index = findRepeatItemIndex(stored, item, itemKeys, near);
		if (index === -1) return;
		const next = destinationIndex(action, moveToEdge, index, stored.length);
		if (next == null) return;
		remember(next, control);
		sortableListActionProcessor(action, moveToEdge, stored, index, setValue);
	};
	/** Opens the item's form at the item's current position in the stored array, which may differ from this render's. */
	const handleEditItem = (item: RepeatItem, near: number) => {
		const stored = getStoredItems();
		const index = findRepeatItemIndex(stored, item, itemKeys, near);
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
									ref={addButtonRef}
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
				<FieldBox ref={fallbackRef} tabIndex={-1} dashed={!hasContent}>
					{hasContent ? (
						<List dense ref={rootRef}>
							{visibleItems.map(({ item, index }, position) => {
								const itemLabel = getRepeatItemTitle(item, displayFieldIds);
								const editLabel = formatMessage({ defaultMessage: 'Edit {item}' }, { item: itemLabel });
								const deleteLabel = formatMessage({ defaultMessage: 'Delete {item}' }, { item: itemLabel });
								// A scoped list shows one item, so there is nothing to reorder it against.
								const canMove = !readonly && !itemScoped && count > 1;
								return (
									<Box
										component="li"
										key={rowKeys[index]}
										sx={{
											display: 'flex',
											alignItems: 'center',
											borderBottom: position !== visibleItems.length - 1 ? 1 : 0,
											borderColor: 'divider'
										}}
									>
										<ListItemButton
											component="div"
											data-reorder-index={index}
											data-reorder-control="row"
											sx={{ flex: 1, minWidth: 0 }}
											onClick={() => handleEditItem(item, index)}
											onKeyDown={
												canMove
													? (event) => {
															const stored = getStoredItems();
															const storedIndex = findRepeatItemIndex(stored, item, itemKeys, index);
															if (storedIndex === -1) return;
															sortableListKeyDownHandler(
																event,
																stored,
																storedIndex,
																setValue,
																() => handleEditItem(item, index),
																(nextIndex) => remember(nextIndex, 'row')
															);
														}
													: undefined
											}
										>
											<ListItemText
												primary={itemLabel}
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
										</ListItemButton>
										{!readonly && (
											<Box sx={{ display: 'flex', flexShrink: 0 }}>
												{canMove && (
													<>
														<ReorderMoveButton
															name={itemLabel}
															control="up"
															index={index}
															disabled={index === 0}
															onClick={() => handleMoveItem(item, index, 'up', false, 'up')}
														>
															<ArrowUpwardRounded fontSize="small" />
														</ReorderMoveButton>
														<ReorderMoveButton
															name={itemLabel}
															control="down"
															index={index}
															disabled={index === count - 1}
															onClick={() => handleMoveItem(item, index, 'down', false, 'down')}
														>
															<ArrowDownwardRounded fontSize="small" />
														</ReorderMoveButton>
													</>
												)}
												<Tooltip title={editLabel}>
													{/* The row performs the same edit, so this control is not a second tab stop. */}
													<IconButton
														size="small"
														aria-label={editLabel}
														tabIndex={-1}
														onClick={() => handleEditItem(item, index)}
													>
														<EditOutlined fontSize="small" />
													</IconButton>
												</Tooltip>
												{!itemScoped && (
													// The span keeps the tooltip on a disabled button. describeChild keeps the tooltip from naming the span.
													<Tooltip describeChild title={isRemoveDisabled ? minimumTooltip : deleteLabel}>
														<span>
															<IconButton
																size="small"
																aria-label={deleteLabel}
																disabled={isRemoveDisabled}
																onClick={(e) => handleRemoveItem(e, item, index)}
															>
																<DeleteOutlined fontSize="small" />
															</IconButton>
														</span>
													</Tooltip>
												)}
											</Box>
										)}
									</Box>
								);
							})}
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
