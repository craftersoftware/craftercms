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

import Avatar from '@mui/material/Avatar';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import * as React from 'react';
import { PublishingStatus } from '../../models/Publishing';
import { getPublishingStatusCodeColor } from './util';
import { PartialSxRecord } from '../../models';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material';
import { consolidateSx } from '../../utils/system';
import { useTheme } from '@mui/material/styles';

export type PublishingStatusAvatarClassKey = 'root' | 'icon';

export interface PublishingStatusAvatarProps extends Pick<PublishingStatus, 'enabled'> {
	status: string;
	className?: string;
	classes?: Partial<Record<PublishingStatusAvatarClassKey, string>>;
	sx?: SxProps<Theme>;
	sxs?: PartialSxRecord<PublishingStatusAvatarClassKey>;
	variant?: 'background' | 'icon';
}

const targets: { [prop in PublishingStatusAvatarProps['variant']]: 'backgroundColor' | 'color' } = {
	background: 'backgroundColor',
	icon: 'color'
};

export const PublishingStatusAvatar = React.forwardRef<HTMLDivElement, PublishingStatusAvatarProps>((props, ref) => {
	const { status, enabled, variant = 'icon', sx, sxs } = props;
	const stylingTarget = targets[variant] ?? 'backgroundColor';
	const theme = useTheme();
	// colorDefault paints text.primary on every avatar without an image. The background variant
	// puts the status colour behind the icon and would otherwise inherit that: white on the dark-mode
	// success fill (#30DB5B) is 1.84:1. The icon takes the contrast colour of the fill instead.
	const statusAppearance = (code: 'ready' | 'publishing' | 'stopped') => {
		const fill = getPublishingStatusCodeColor(code, theme);
		return variant === 'background' && fill
			? { backgroundColor: fill, color: theme.palette.getContrastText(fill) }
			: { [stylingTarget]: fill };
	};
	return (
		<Avatar
			ref={ref}
			variant="circular"
			className={[props.className, enabled ? status : enabled === false ? 'stopped' : '', props.classes?.root].join(
				' '
			)}
			sx={consolidateSx(
				stylingTarget === 'color' && {
					background: 'none',
					color: theme.palette.text.secondary
				},
				{
					'&.ready': statusAppearance('ready'),
					'&.publishing': statusAppearance('publishing'),
					'&.stopped': statusAppearance('stopped')
				},
				sx,
				sxs?.root
			)}
		>
			<CloudUploadOutlined className={props.classes?.icon} sx={sxs?.icon} />
		</Avatar>
	);
});

export default PublishingStatusAvatar;
