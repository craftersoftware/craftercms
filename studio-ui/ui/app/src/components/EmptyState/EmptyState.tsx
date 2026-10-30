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

import React, { ReactNode } from 'react';
import Typography from '@mui/material/Typography';
import emptyImage from '../../assets/desert.svg';
import { MessageDescriptor, useIntl } from 'react-intl';
import { nou } from '../../utils/object';
import Box from '@mui/material/Box';
import { PartialSxRecord } from '../../models';

type EmptyStateClassKey = 'root' | 'title' | 'subtitle' | 'image';

export type EmptyStateProps = React.PropsWithChildren<{
	image?: string;
	title: ReactNode | MessageDescriptor;
	subtitle?: ReactNode | MessageDescriptor;
	/** Heading level for `title`. Defaults to h3 so nested empty states do not become the page h1. */
	titleComponent?: React.ElementType;
	classes?: Partial<Record<EmptyStateClassKey, string>>;
	sxs?: PartialSxRecord<EmptyStateClassKey>;
}>;

function isValidElement(target: any): boolean {
	return React.isValidElement(target) || nou(target) || ['string', 'number'].includes(typeof target);
}

export function EmptyState(props: EmptyStateProps) {
	const { sxs } = props;
	const { formatMessage } = useIntl();
	const { image = emptyImage, classes: propClasses, children } = props;
	const title = isValidElement(props.title) ? (props.title as string) : formatMessage(props.title as MessageDescriptor);
	const subtitle = isValidElement(props.subtitle)
		? (props.subtitle as string)
		: formatMessage(props.subtitle as MessageDescriptor);
	return (
		<Box
			className={propClasses?.root}
			sx={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				flexDirection: 'column',
				margin: (theme) => theme.spacing(2),
				...sxs?.root
			}}
		>
			{image && (
				<Box
					component="img"
					className={propClasses?.image}
					sx={{ width: 100, maxWidth: '80%', ...sxs?.image }}
					src={image}
					alt=""
				/>
			)}
			{title && (
				<Typography
					variant="body1"
					component={props.titleComponent ?? 'h3'}
					className={propClasses?.title}
					sx={{ margin: (theme) => `${theme.spacing(1)} 0`, ...sxs?.title }}
					color="textSecondary"
				>
					{title}
				</Typography>
			)}
			{subtitle && (
				<Typography
					variant="body2"
					component="p"
					className={propClasses?.subtitle}
					sx={{ textAlign: 'center', ...sxs?.subtitle }}
					color="textSecondary"
				>
					{subtitle}
				</Typography>
			)}
			{children}
		</Box>
	);
}

export default EmptyState;
