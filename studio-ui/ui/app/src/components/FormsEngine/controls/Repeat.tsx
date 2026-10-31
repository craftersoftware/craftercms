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
import { lazy, MouseEvent as ReactMouseEvent, Suspense, useContext, useEffect, useMemo, useState } from 'react';
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
	countLimitValue,
	getRepeatMinimum,
	isRepeatAddDisabled,
	isRepeatRemoveDisabled
} from '../../../utils/countLimits';
const repeatMessages = defineMessages({
	addItems: { defaultMessage: 'Add items' },
	maxReached: { defaultMessage: 'Maximum of {max, plural, one {# item} other {# items}} reached' },
	deleteItem: { defaultMessage: 'Delete' },
	minRequired: { defaultMessage: 'At least {min, plural, one {# item is} other {# items are}} required' }
});

export type RepeatItem = Record<string, unknown>;

export type RepeatProps = ControlProps<RepeatItem[]>;

const SortableList = lazy(() => import('../components/SortableList'));
const TouchSortableList = lazy(() => import('../components/TouchSortableList'));

function getRepeatItemTitle(item: RepeatItem): string {
	const keys = Object.keys(item);
	const titleKey = keys.find((key) => key.includes('title'));
	if (titleKey && item[titleKey]) {
		return String(item[titleKey]);
	}
	return String(item[keys[0]]);
}

function getRepeatItemSummary(item: RepeatItem): string {
	// TODO: HTML tags would look quite bad; somehow exclude HTML fields or convert to text?
	return Object.values(item)
		.flatMap((value) => (typeof value === 'string' && value ? value.substring(0, 50) : []))
		.join(' | ');
}

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
	const openItemForm = (index?: number, item?: RepeatItem) => {
		if (!valueAtom) return;
		api.pushForm(
			repeatItemFormProps({
				fieldId: field.id,
				index,
				values: item,
				getItems: () => (store.get(valueAtom) as RepeatItem[]) ?? [],
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
	const handleRemoveItem = (event: ReactMouseEvent, index: number) => {
		event.stopPropagation();
		if (isRemoveDisabled) return;
		const nextValue = value.concat();
		nextValue.splice(index, 1);
		setValue(nextValue);
	};
	const handleEditItem = (event: ReactMouseEvent, item: RepeatItem, index: number) => {
		openItemForm(index, item);
	};
	/** Opens a new repeat item unless adding is disabled. */
	const handleAddItem: IconButtonProps['onClick'] = () => {
		if (isAddDisabled) return;
		openItemForm();
	};
	const sortList = useMemo<Array<TItem<RepeatItem>>>(
		() => (sortMode ? value.map((i, index) => ({ key: String(index), value: getRepeatItemTitle(i), data: i })) : []),
		[sortMode, value]
	);
	const onSortChange = (newList: TItem<RepeatItem>[]) => setValue(newList.map((i) => i.data));
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
									key={index}
									divider={position !== visibleItems.length - 1}
									onClick={(e) => handleEditItem(e, item, index)}
								>
									<ListItemText
										primary={getRepeatItemTitle(item)}
										secondary={getRepeatItemSummary(item)}
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
															onClick={(e) => handleRemoveItem(e, index)}
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
