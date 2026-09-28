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

import type { TItem } from './SortableList';
import { sortableListActionProcessor, SortAction } from '../lib/sortableListUtil';
import List from '@mui/material/List';
import { ListItem } from '@mui/material';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowUpRounded from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardDoubleArrowUpRounded from '@mui/icons-material/KeyboardDoubleArrowUpRounded';
import Divider from '@mui/material/Divider';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardDoubleArrowDownRounded from '@mui/icons-material/KeyboardDoubleArrowDownRounded';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

export interface TouchSortableListProps<T = unknown> {
	items: TItem<T>[];
	onChange(newList: TItem<T>[]): void;
	selectedItemId?: string;
}

export function TouchSortableList({ items, onChange, selectedItemId }: TouchSortableListProps) {
	const handleMove = (action: SortAction, moveToEdge: boolean, index: number) =>
		sortableListActionProcessor(action, moveToEdge, items, index, onChange);
	return (
		<List>
			{items.map((item, index) => (
				<ListItem key={index} sx={{ display: 'flex', bgcolor: item.key === selectedItemId && 'action.selected' }}>
					<ListItemText
						disableTypography
						primary={
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									placeContent: 'space-between'
								}}
							>
								<Typography>{item.value}</Typography>
								<Box sx={{ display: 'flex' }}>
									<IconButton color="primary" disabled={index === 0} onClick={() => handleMove('up', false, index)}>
										<KeyboardArrowUpRounded />
									</IconButton>
									<IconButton color="primary" disabled={index === 0} onClick={() => handleMove('up', true, index)}>
										<KeyboardDoubleArrowUpRounded />
									</IconButton>
									<Divider orientation="vertical" flexItem sx={{ height: 15, alignSelf: 'center' }} />
									<IconButton
										color="primary"
										disabled={index === items.length - 1}
										onClick={() => handleMove('down', false, index)}
									>
										<KeyboardArrowDownRounded />
									</IconButton>
									<IconButton
										color="primary"
										disabled={index === items.length - 1}
										onClick={() => handleMove('down', true, index)}
									>
										<KeyboardDoubleArrowDownRounded />
									</IconButton>
								</Box>
							</Box>
						}
					/>
				</ListItem>
			))}
		</List>
	);
}

export default TouchSortableList;
