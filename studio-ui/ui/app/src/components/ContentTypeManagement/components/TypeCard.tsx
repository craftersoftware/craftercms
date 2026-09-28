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

import React from 'react';
import Card, { CardProps } from '@mui/material/Card';
import ContentType from '../../../models/ContentType';
import CardHeader from '@mui/material/CardHeader';
import { consolidateSx } from '../../../utils/system';
import CardActionArea from '@mui/material/CardActionArea';
import type { BoxProps } from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { TypeCardMedia } from './TypeCardMedia';
import { toColor } from '../../../utils/string';

export interface TypeCardProps extends Omit<CardProps, 'onClick'> {
	type: ContentType;
	showTypeId?: boolean;
	wrapName?: boolean;
	compact?: boolean;
	skeleton?: boolean;
	onClick?(event: React.MouseEvent<HTMLButtonElement, MouseEvent>, contentType: ContentType): void;
}

const compactSxOverrides: Record<'actionArea' | 'cardMedia', BoxProps['sx']> = {
	actionArea: { display: 'flex', flexDirection: 'row-reverse', justifyContent: 'left' },
	cardMedia: { height: '80px', width: '100px' }
};

const baseCardSx: BoxProps['sx'] = { minWidth: '270px', maxWidth: '500px', flex: 1 };

export function TypeCard(props: TypeCardProps) {
	const {
		type,
		skeleton = false,
		showTypeId = false,
		wrapName = true,
		compact = false,
		sx,
		onClick,
		...cardProps
	} = props;
	const styleOverrides = compact ? compactSxOverrides : undefined;
	const hasActionArea = !skeleton && Boolean(onClick);
	const heading = skeleton ? <Skeleton animation="wave" variant="text" sx={{ mb: 0.5 }} /> : type.name;
	const subheading = showTypeId ? (
		skeleton ? (
			<Skeleton animation="wave" variant="text" width="60%" />
		) : (
			type.id
		)
	) : undefined;
	const cardBody = (
		<>
			<CardHeader
				sx={{ flexGrow: 1, flex: 1, overflow: 'hidden' }}
				title={heading}
				subheader={subheading}
				slotProps={{
					title: {
						variant: 'body1',
						noWrap: !wrapName,
						title: skeleton ? undefined : type.name,
						sx: { fontWeight: 'normal' }
					},
					subheader: { variant: 'body2', noWrap: true, title: skeleton ? undefined : type.id },
					content: { sx: { overflow: 'hidden' } }
				}}
			/>
			<TypeCardMedia
				skeleton={skeleton}
				typeId={type?.id}
				thumbnailFileName={type?.thumbnailFileName}
				sx={styleOverrides?.cardMedia}
			/>
		</>
	);
	return (
		<Card
			{...cardProps}
			sx={consolidateSx(
				baseCardSx,
				{
					borderLeft: (theme) => `${theme.spacing(1)} solid`,
					borderLeftColor: type ? toColor(type.id) : null
				},
				!hasActionArea && styleOverrides?.actionArea,
				sx
			)}
		>
			{hasActionArea ? (
				<CardActionArea sx={styleOverrides?.actionArea} onClick={(e) => onClick(e, type)}>
					{cardBody}
				</CardActionArea>
			) : (
				cardBody
			)}
		</Card>
	);
}

export default TypeCard;
