/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import { FormattedMessage, useIntl } from 'react-intl';
import translations from './translations';
import React from 'react';
import List from '@mui/material/List';
import ContentInstance from '../../models/ContentInstance';
import { DraggablePanelListItem } from '../DraggablePanelListItem/DraggablePanelListItem';
import EmptyState from '../EmptyState/EmptyState';
import FormHelperText from '@mui/material/FormHelperText';
import Pagination from '../Pagination';
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';

export interface PreviewBrowseComponentsPanelUIProps {
	awaitingGuestCheckIn: boolean;
	items: Array<ContentInstance>;
	count: number;
	pageNumber: number;
	limit: number;
	classes?: Partial<
		Record<'browsePanelWrapper' | 'pagination' | 'toolbar' | 'list' | 'noResultsImage' | 'noResultsTitle', string>
	>;
	onPageChanged(page: number): void;
	onRowsPerPageChange(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void;
	onDragStart(item: ContentInstance): void;
	onDragEnd(): void;
	onInsert?(item: ContentInstance): void;
}

export function PreviewBrowseComponentsPanelUI(props: PreviewBrowseComponentsPanelUIProps) {
	const {
		awaitingGuestCheckIn,
		items,
		onPageChanged,
		onDragStart,
		onDragEnd,
		onInsert,
		onRowsPerPageChange,
		count,
		pageNumber,
		limit
	} = props;
	const { formatMessage } = useIntl();
	return awaitingGuestCheckIn ? (
		<Alert severity="info" variant="outlined" icon={<HourglassEmptyRounded />} sx={{ border: 0 }}>
			<FormattedMessage defaultMessage="Waiting for the preview application to load." />
		</Alert>
	) : (
		<>
			<Pagination
				count={count}
				rowsPerPage={limit}
				page={pageNumber}
				onPageChange={(e, page: number) => onPageChanged(page * limit)}
				onRowsPerPageChange={onRowsPerPageChange}
			/>
			<Box sx={{ padding: (theme) => `0 0 ${theme.spacing(4)} 0` }}>
				<List>
					{items.map((item: ContentInstance) => (
						<DraggablePanelListItem
							key={item.craftercms.id}
							primaryText={item.craftercms.label}
							avatarColorBase={item.craftercms.contentTypeId}
							onDragStart={() => onDragStart(item)}
							onDragEnd={onDragEnd}
							onInsert={onInsert ? () => onInsert(item) : undefined}
						/>
					))}
				</List>
				{count === 0 && (
					<EmptyState
						title={formatMessage(translations.noResults)}
						sxs={{
							image: { width: '150px' },
							title: { fontSize: 'inherit', marginTop: '10px' }
						}}
					/>
				)}
				<FormHelperText
					sx={{
						margin: '10px 16px',
						paddingTop: '10px',
						textAlign: 'center',
						lineHeight: 1.2,
						borderTop: (theme) => `1px solid ${theme.palette.divider}`
					}}
				>
					<FormattedMessage
						id="previewBrowseComponentsPanel.sharedComponentsHelperText"
						defaultMessage="Only shared components are shown here"
					/>
				</FormHelperText>
			</Box>
		</>
	);
}

export default PreviewBrowseComponentsPanelUI;
