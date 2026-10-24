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
import { useStableGlobalApiContext } from '../lib/formsEngineContext';
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
import {
	getRepeatMinimum,
	isRepeatAddDisabled,
	isRepeatRemoveDisabled,
	readNumericLimit
} from '../../../utils/repeatLimits';
import { isFieldRequired } from '../lib/validators';

const repeatMessages = defineMessages({
	addItems: { defaultMessage: 'Add items' },
	maxReached: { defaultMessage: 'Maximum of {max, plural, one {# item} other {# items}} reached' },
	deleteItem: { defaultMessage: 'Delete' },
	minRequired: { defaultMessage: 'At least {min, plural, one {# item is} other {# items are}} required' }
});

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

/** Repeating group. Add stops at the maximum; delete stops at the effective minimum. */
export function Repeat(props: RepeatProps) {
	const { field, value, setValue, readonly, autoFocus } = props;
	const { formatMessage } = useIntl();
	const [sortMode, setSortMode] = useState(false);
	const useTouchSorting = useMemo(() => isTouchDevice(), []);
	const handleCancelReorder = () => setSortMode(false);
	const onReorder = () => setSortMode(true);
	const api = useStableGlobalApiContext();
	const count = value.length;
	const hasContent = count;
	const maxCount = field.validations?.maxCount?.value;
	const minCount = field.validations?.minCount?.value;
	const required = isFieldRequired(field);
	const minimum = getRepeatMinimum(minCount, required);
	const isAddDisabled = isRepeatAddDisabled(Boolean(readonly), count, maxCount);
	const isRemoveDisabled = isRepeatRemoveDisabled(Boolean(readonly), count, minCount, required);
	const addTooltip = readonly
		? ''
		: isAddDisabled
			? formatMessage(repeatMessages.maxReached, { max: readNumericLimit(maxCount) ?? 0 })
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
	/** Opens a new repeat item unless adding is disabled. */
	const handleAddItem: IconButtonProps['onClick'] = () => {
		if (isAddDisabled) return;
		api.pushForm({
			repeat: { fieldId: field.id },
			fieldsToRender: Object.values(field.fields),
			onSave(result) {
				setValue(value.concat(result.values));
				return Promise.resolve({ close: true });
			}
		});
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
				}
				menuOptions={[{ id: 'reorder', text: <FormattedMessage defaultMessage="Reorder Items" /> }]}
				onMenuOptionClick={(_, __, closeMenu) => {
					onReorder();
					closeMenu();
				}}
			>
				<FieldBox dashed={!hasContent}>
					{hasContent ? (
						<List dense>
							{value.map((item, index) => (
								<ListItemButton
									key={index}
									divider={index !== count - 1}
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
