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
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import ListItemButton from '@mui/material/ListItemButton';
import { FormattedMessage } from 'react-intl';
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
	const [sortMode, setSortMode] = useState(false);
	const useTouchSorting = useMemo(() => isTouchDevice(), []);
	const handleCancelReorder = () => setSortMode(false);
	const onReorder = () => setSortMode(true);
	const api = useStableGlobalApiContext();
	const hasContent = value.length;
	const handleRemoveItem = (event: ReactMouseEvent, index: number) => {
		event.stopPropagation();
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
				min={field.validations.minCount?.value}
				max={field.validations.maxCount?.value}
				length={value.length}
				action={
					<Tooltip title={isAddDisabled ? '' : <FormattedMessage defaultMessage="Add items" />}>
						<IconButton size="small" color="primary" onClick={handleAddItem} autoFocus={autoFocus}>
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
				<FieldBox dashed={!hasContent}>
					{hasContent ? (
						<List dense>
							{value.map((item, index) => (
								<ListItemButton
									key={index}
									divider={index !== value.length - 1}
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
											<Tooltip title={<FormattedMessage defaultMessage="Delete" />}>
												<IconButton size="small" onClick={(e) => handleRemoveItem(e, index)}>
													<DeleteOutlined fontSize="small" />
												</IconButton>
											</Tooltip>
										</ListItemSecondaryAction>
									)}
								</ListItemButton>
							))}
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
