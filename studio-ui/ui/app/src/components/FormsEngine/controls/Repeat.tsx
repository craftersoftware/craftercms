/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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
import { useStableGlobalApiContext } from '../lib/formsEngineContext';
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
import { FormattedMessage, useIntl } from 'react-intl';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import {
	destinationIndex,
	sortableListActionProcessor,
	sortableListKeyDownHandler,
	useOccurrenceKeys,
	useReorderFocus,
	useRestoreFocusWhenEmpty
} from '../lib/sortableListUtil';
import { ReorderMoveButton } from '../components/ReorderMoveButton';
import Tooltip from '@mui/material/Tooltip';
import { lazy, MouseEvent as ReactMouseEvent, Suspense, useMemo, useState } from 'react';
import Avatar, { avatarClasses } from '@mui/material/Avatar';
import { StackedButton } from '../components/StackedButton';
import { isTouchDevice } from '../lib/sortableListUtil';
import { DialogHeader } from '../../DialogHeader';
import Dialog from '@mui/material/Dialog';
import SortableListSkeleton from '../components/SortableListSkeleton';
import type { TItem } from '../components/SortableList';
import FieldBox from '../components/FieldBox';
import { buttonClasses } from '@mui/material/Button';

export type RepeatItem = Record<string, unknown>;

export interface RepeatProps extends ControlProps {
	value: RepeatItem[];
}

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

export function Repeat(props: RepeatProps) {
	const { field, value, setValue, readonly, autoFocus } = props;
	const { formatMessage } = useIntl();
	const [sortMode, setSortMode] = useState(false);
	const useTouchSorting = useMemo(() => isTouchDevice(), []);
	const handleCancelReorder = () => setSortMode(false);
	const onReorder = () => setSortMode(true);
	const api = useStableGlobalApiContext();
	const hasContent = value.length;
	const { rootRef, remember } = useReorderFocus(value);
	const { addButtonRef, fallbackRef, rememberEmpty } = useRestoreFocusWhenEmpty(value);
	const rowKeys = useOccurrenceKeys(value);
	const handleRemoveItem = (event: ReactMouseEvent, index: number) => {
		event.stopPropagation();
		const nextValue = value.concat();
		nextValue.splice(index, 1);
		if (nextValue.length > 0) {
			remember(Math.min(index, value.length - 2), 'row');
		} else {
			rememberEmpty();
		}
		setValue(nextValue);
	};
	const handleEditItem = (event: { stopPropagation(): void }, item: RepeatItem, index: number) => {
		api.pushForm({
			repeat: { fieldId: field.id, values: item, index },
			fieldsToRender: Object.values(field.fields),
			onSave(result) {
				const nextValue = value.concat();
				nextValue.splice(index, 1, result.values);
				setValue(nextValue);
				return Promise.resolve({ close: true });
			}
		});
	};
	const handleAddItem: IconButtonProps['onClick'] = (e) => {
		api.pushForm({
			repeat: { fieldId: field.id },
			fieldsToRender: Object.values(field.fields),
			onSave(result) {
				setValue(value.concat(result.values));
				return Promise.resolve({ close: true });
			}
		});
	};
	const isAddDisabled = readonly || field.validations.maxCount?.value >= value;
	const sortList = useMemo<Array<TItem<RepeatItem>>>(
		() =>
			sortMode
				? value.map((item, index) => ({ key: rowKeys[index], value: getRepeatItemTitle(item), data: item }))
				: [],
		[sortMode, value, rowKeys]
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
				min={field.validations.minCount?.value}
				max={field.validations.maxCount?.value}
				length={value.length}
				action={
					<Tooltip title={isAddDisabled ? '' : <FormattedMessage defaultMessage="Add items" />}>
						<IconButton ref={addButtonRef} size="small" color="primary" onClick={handleAddItem} autoFocus={autoFocus}>
							<AddRounded fontSize="small" />
						</IconButton>
					</Tooltip>
				}
				menuOptions={[{ id: 'reorder', text: <FormattedMessage defaultMessage="Reorder Items" /> }]}
				onMenuOptionClick={(_, __, closeMenu) => {
					onReorder();
					closeMenu();
				}}
			>
				<FieldBox ref={fallbackRef} tabIndex={-1} dashed={!hasContent}>
					{hasContent ? (
						<List dense ref={rootRef}>
							{value.map((item, index) => {
								const itemLabel = getRepeatItemTitle(item);
								const editLabel = formatMessage({ defaultMessage: 'Edit {item}' }, { item: itemLabel });
								const deleteLabel = formatMessage({ defaultMessage: 'Delete {item}' }, { item: itemLabel });
								return (
									<Box
										component="li"
										key={rowKeys[index]}
										sx={{
											display: 'flex',
											alignItems: 'center',
											borderBottom: index !== value.length - 1 ? 1 : 0,
											borderColor: 'divider'
										}}
									>
										<ListItemButton
											component="div"
											data-reorder-index={index}
											data-reorder-control="row"
											sx={{ flex: 1, minWidth: 0 }}
											onClick={(e) => handleEditItem(e, item, index)}
											onKeyDown={
												readonly
													? undefined
													: (event) =>
															sortableListKeyDownHandler(
																event,
																value,
																index,
																setValue,
																(itemIndex) => handleEditItem(event, value[itemIndex], itemIndex),
																(nextIndex) => remember(nextIndex, 'row')
															)
											}
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
										</ListItemButton>
										{!readonly && (
											<Box sx={{ display: 'flex', flexShrink: 0 }}>
												{value.length > 1 && (
													<>
														<ReorderMoveButton
															name={itemLabel}
															control="up"
															index={index}
															disabled={index === 0}
															onClick={() => {
																const next = destinationIndex('up', false, index, value.length);
																if (next == null) {
																	return;
																}
																remember(next, 'up');
																sortableListActionProcessor('up', false, value, index, setValue);
															}}
														>
															<ArrowUpwardRounded fontSize="small" />
														</ReorderMoveButton>
														<ReorderMoveButton
															name={itemLabel}
															control="down"
															index={index}
															disabled={index === value.length - 1}
															onClick={() => {
																const next = destinationIndex('down', false, index, value.length);
																if (next == null) {
																	return;
																}
																remember(next, 'down');
																sortableListActionProcessor('down', false, value, index, setValue);
															}}
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
														onClick={(event) => handleEditItem(event, item, index)}
													>
														<EditOutlined fontSize="small" />
													</IconButton>
												</Tooltip>
												<Tooltip title={deleteLabel}>
													<IconButton size="small" aria-label={deleteLabel} onClick={(e) => handleRemoveItem(e, index)}>
														<DeleteOutlined fontSize="small" />
													</IconButton>
												</Tooltip>
											</Box>
										)}
									</Box>
								);
							})}
						</List>
					) : (
						<>
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
						</>
					)}
				</FieldBox>
			</FormsEngineField>
		</>
	);
}

export default Repeat;
