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

import NewStateIcon from '@mui/icons-material/NewReleasesOutlined';
import EditedStateIcon from '@mui/icons-material/EditOutlined';
import DeletedStateIcon from '@mui/icons-material/DeleteOutlineRounded';
import LockedStateIcon from '../../icons/Lock';
import SystemProcessingStateIcon from '@mui/icons-material/HourglassEmptyRounded';
import SubmittedStateIcon from '../../icons/PaperPlane';
import ScheduledStateIcon from '@mui/icons-material/AccessTimeRounded';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import NotInWorkflowIcon from '@mui/icons-material/PanoramaFishEyeRounded';
import Tooltip from '@mui/material/Tooltip';
import * as React from 'react';
import { useMemo } from 'react';
import { getItemStateId, getItemStateText } from '../ItemDisplay/utils';
import { ContentItem, ItemStates } from '../../models/Item';
import { SvgIconProps } from '@mui/material/SvgIcon';
import { PartialSxRecord } from '../../models';
import { useIntl } from 'react-intl';

// The palette mode mapping is in the theme (getStudioPaletteOptions), so these are plain theme tokens:
// each one is 3:1 or more on every light and dark surface, including #393939 dialog paper.

export type ItemStateIconClassKey =
	| 'root'
	| 'stateNewIcon'
	| 'stateModifiedIcon'
	| 'stateDeletedIcon'
	| 'stateLockedIcon'
	| 'stateSystemProcessingIcon'
	| 'stateSubmittedIcon'
	| 'stateSubmittedToStagingIcon'
	| 'stateSubmittedToLiveIcon'
	| 'stateScheduledIcon'
	| 'statePublishingIcon'
	| 'stateDisabledIcon'
	| 'stateNotInWorkflow';

export interface ItemStateIconProps {
	item: Pick<ContentItem, 'systemType' | 'stateMap' | 'lockOwner' | 'savedAsDraft'>;
	classes?: Partial<Record<ItemStateIconClassKey, string>>;
	sxs?: PartialSxRecord<ItemStateIconClassKey>;
	className?: string;
	displayTooltip?: boolean;
	fontSize?: SvgIconProps['fontSize'];
}

export function ItemStateIcon(props: ItemStateIconProps) {
	const { item, classes, sxs, className, displayTooltip = true, fontSize } = props;
	const { Icon, stateSpecificClass, stateSpecificSx } = useMemo(() => {
		if (item.systemType === 'folder') {
			return {
				Icon: NotInWorkflowIcon,
				stateSpecificSx: { color: 'border.control', ...sxs?.stateNotInWorkflow }
			};
		}
		let map: { [key in ItemStates]: any };
		map = {
			new: {
				Icon: NewStateIcon,
				stateSpecificClass: classes?.stateNewIcon,
				stateSpecificSx: { color: 'info.main', ...sxs?.stateNewIcon }
			},
			modified: {
				Icon: EditedStateIcon,
				stateSpecificClass: classes?.stateModifiedIcon,
				stateSpecificSx: { color: 'yellow.main', ...sxs?.stateModifiedIcon }
			},
			deleted: {
				Icon: DeletedStateIcon,
				stateSpecificClass: classes?.stateDeletedIcon,
				stateSpecificSx: { color: 'error.main', ...sxs?.stateDeletedIcon }
			},
			locked: {
				Icon: LockedStateIcon,
				stateSpecificClass: classes?.stateLockedIcon,
				stateSpecificSx: { color: 'warning.main', ...sxs?.stateLockedIcon }
			},
			systemProcessing: {
				Icon: SystemProcessingStateIcon,
				stateSpecificClass: classes?.stateSystemProcessingIcon,
				stateSpecificSx: {
					color: 'indigo.main',
					...sxs?.stateSystemProcessingIcon
				}
			},
			submitted: {
				Icon: SubmittedStateIcon,
				stateSpecificClass: classes?.stateSubmittedIcon,
				stateSpecificSx: {
					color: 'purple.main',
					...sxs?.stateSubmittedIcon
				}
			},
			scheduled: {
				Icon: ScheduledStateIcon,
				stateSpecificClass: classes?.stateScheduledIcon,
				stateSpecificSx: { color: 'success.main', ...sxs?.stateScheduledIcon }
			},
			publishing: {
				Icon: CloudUploadOutlinedIcon,
				stateSpecificClass: classes?.statePublishingIcon,
				stateSpecificSx: {
					color: 'indigo.main',
					...sxs?.statePublishingIcon
				}
			},
			submittedToStaging: {
				Icon: item.stateMap.submitted ? SubmittedStateIcon : ScheduledStateIcon,
				stateSpecificClass: classes?.stateSubmittedToStagingIcon,
				stateSpecificSx: {
					color: 'primary.main',
					...sxs?.stateSubmittedToStagingIcon
				}
			},
			submittedToLive: {
				Icon: item.stateMap.submitted ? SubmittedStateIcon : ScheduledStateIcon,
				stateSpecificClass: classes?.stateSubmittedToLiveIcon,
				stateSpecificSx: {
					color: 'success.main',
					...sxs?.stateSubmittedToLiveIcon
				}
			},
			staged: null,
			live: null,
			disabled: {
				Icon: BlockRoundedIcon,
				stateSpecificClass: classes?.stateDisabledIcon,
				stateSpecificSx: { color: 'pink.main', ...sxs?.stateDisabledIcon }
			},
			translationUpToDate: null,
			translationPending: null,
			translationInProgress: null
		};
		return (
			map[getItemStateId(item.stateMap)] ?? {
				Icon: NotInWorkflowIcon,
				stateSpecificClass: classes?.stateNotInWorkflow,
				stateSpecificSx: { color: 'border.control', ...sxs?.stateNotInWorkflow }
			}
		);
	}, [sxs, classes, item]);
	const { formatMessage } = useIntl();
	return Icon === null ? null : item.systemType === 'folder' ? (
		<Icon
			sx={{
				...sxs?.root,
				...stateSpecificSx
			}}
			aria-label={getItemStateText(item.stateMap, formatMessage, { user: item.lockOwner?.username })}
			aria-hidden={false}
			className={[className, stateSpecificClass].filter(Boolean).join(' ')}
			fontSize={fontSize}
		/>
	) : (
		<Tooltip
			title={
				displayTooltip
					? getItemStateText(item.stateMap, formatMessage, { user: item.lockOwner?.username, draft: item.savedAsDraft })
					: ''
			}
			open={displayTooltip ? void 0 : false}
		>
			<Icon
				sx={{
					...sxs?.root,
					...stateSpecificSx
				}}
				aria-label={getItemStateText(item.stateMap, formatMessage, {
					user: item.lockOwner?.username,
					draft: item.savedAsDraft
				})}
				aria-hidden={false}
				className={[className, stateSpecificClass].filter(Boolean).join(' ')}
				fontSize={fontSize}
			/>
		</Tooltip>
	);
}

export default ItemStateIcon;
