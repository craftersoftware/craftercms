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

import TypeCard, { TypeCardProps } from './TypeCard';
import Box from '@mui/material/Box';
import React from 'react';
import ContentType from '../../../models/ContentType';
import { EmptyState } from '../../EmptyState';
import { FormattedMessage } from 'react-intl';
import palette from '../../../styles/palette';

export interface TypeListProps extends Pick<TypeCardProps, 'showTypeId' | 'compact'> {
	skeleton?: boolean;
	skeletonItemCount?: number;
	contentTypes: ContentType[];
	selectedTypeId?: string;
	disableSelected?: boolean;
	onCardClick?: TypeCardProps['onClick'];
}

export function TypeList(props: TypeListProps) {
	const {
		skeleton = false,
		skeletonItemCount = 10,
		contentTypes,
		showTypeId,
		compact,
		selectedTypeId,
		disableSelected = true,
		onCardClick
	} = props;
	if (!skeleton && !contentTypes) {
		return <></>;
	}
	if (!skeleton && contentTypes?.length === 0) {
		return <EmptyState title={<FormattedMessage defaultMessage="No content types available for display." />} />;
	}
	return (
		<Box
			sx={{
				gap: 2,
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))'
			}}
		>
			{skeleton
				? new Array(skeletonItemCount)
						.fill(null)
						.map((_, index) => <TypeCard key={index} skeleton type={null} showTypeId={showTypeId} compact={compact} />)
				: contentTypes?.map((type) => {
						const isSelected = selectedTypeId === type.id;
						return (
							<TypeCard
								key={type.id}
								type={type}
								showTypeId={showTypeId}
								compact={compact}
								onClick={isSelected && disableSelected ? undefined : (e) => onCardClick?.(e, type)}
								sx={[
									isSelected && {
										boxShadow: `0 0 0 2px ${palette.blue.tint}`,
										opacity: disableSelected ? 0.7 : 1
									}
								]}
							/>
						);
					})}
		</Box>
	);
}

export default TypeList;
