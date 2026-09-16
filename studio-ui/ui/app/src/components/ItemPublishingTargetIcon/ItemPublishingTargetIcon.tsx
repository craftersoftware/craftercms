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

import Tooltip from '@mui/material/Tooltip';
import PublishingTargetIcon from '@mui/icons-material/FiberManualRecordRounded';
import * as React from 'react';
import { getItemPublishingTargetText } from '../ItemDisplay/utils';
import { ContentItem } from '../../models/Item';
import { SvgIconProps } from '@mui/material/SvgIcon';
import { PartialSxRecord } from '../../models';
import palette from '../../styles/palette';
import { LIVE_COLOUR, STAGING_COLOUR } from './styles';
import { useIntl } from 'react-intl';

export type ItemPublishingTargetIconClassKey =
	'root' | 'publishingTargetLive' | 'publishingTargetStaged' | 'publishingIcon';
export interface ItemPublishingTargetIconProps {
	item: Pick<ContentItem, 'stateMap'>;
	classes?: Partial<Record<ItemPublishingTargetIconClassKey, string>>;
	sxs?: PartialSxRecord<ItemPublishingTargetIconClassKey>;
	className?: string;
	displayTooltip?: boolean;
	fontSize?: SvgIconProps['fontSize'];
}

export function ItemPublishingTargetIcon(props: ItemPublishingTargetIconProps) {
	const { item, classes, sxs, className, displayTooltip = true, fontSize } = props;
	const { formatMessage } = useIntl();
	return (
		<Tooltip
			title={displayTooltip ? getItemPublishingTargetText(item.stateMap, formatMessage) : ''}
			open={displayTooltip ? void 0 : false}
		>
			<PublishingTargetIcon
				fontSize={fontSize}
				className={[className, classes?.root].join(' ')}
				aria-label={getItemPublishingTargetText(item.stateMap, formatMessage)}
				aria-hidden={false}
				sx={{
					color: item.stateMap.live ? LIVE_COLOUR : item.stateMap.staged ? STAGING_COLOUR : palette.gray.medium2,
					...sxs?.root
				}}
			/>
		</Tooltip>
	);
}

export default ItemPublishingTargetIcon;
