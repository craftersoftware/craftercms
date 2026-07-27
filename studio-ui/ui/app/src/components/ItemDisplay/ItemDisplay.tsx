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

import * as React from 'react';
import { ElementType, forwardRef } from 'react';
import { ContentItem, type LightItem } from '../../models/Item';
import palette from '../../styles/palette';
import Typography, { TypographyProps } from '@mui/material/Typography';
import { isPreviewable } from '../PathNavigator/utils';
import ItemStateIcon, { ItemStateIconProps } from '../ItemStateIcon';
import ItemTypeIcon, { ItemTypeIconProps } from '../ItemTypeIcon';
import ItemPublishingTargetIcon, { ItemPublishingTargetIconProps } from '../ItemPublishingTargetIcon';
import { isInWorkflow } from './utils';
import Box from '@mui/material/Box';
import { PartialSxRecord } from '../../models';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';
import { DisabledItemIcon } from '../DisabledItemIcon';

export type ItemDisplayClassKey = 'root' | 'label' | 'labelPreviewable' | 'icon' | 'typeIcon';

export interface ItemDisplayProps<
	LabelTypographyComponent extends React.ElementType = 'span'
> extends React.HTMLAttributes<HTMLSpanElement> {
	showPublishingTarget?: boolean;
	showWorkflowState?: boolean;
	showItemType?: boolean;
	showNavigableAsLinks?: boolean;
	classes?: Partial<Record<ItemDisplayClassKey, string>>;
	sxs?: PartialSxRecord<ItemDisplayClassKey>;
	item: LightItem | ContentItem;
	labelTypographyProps?: TypographyProps<LabelTypographyComponent, { component?: LabelTypographyComponent }>;
	isNavigableFn?: (item: ContentItem) => boolean;
	labelComponent?: ElementType;
	labelDisplayProp?: 'label' | 'path' | 'previewUrl';
	titleDisplayProp?: 'label' | 'path' | 'previewUrl';
	stateIconProps?: Partial<ItemStateIconProps>;
	publishingTargetIconProps?: Partial<ItemPublishingTargetIconProps>;
	itemTypeIconProps?: Partial<ItemTypeIconProps>;
	sx?: SxProps<Theme>;
	component?: ElementType;
}

const ItemDisplay = forwardRef<HTMLSpanElement, ItemDisplayProps>((props, ref) => {
	// region const { ... } = props;
	const {
		item,
		// @see https://github.com/craftersoftware/craftercms/issues/5442
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		showPublishingTarget = true,
		showWorkflowState = true,
		showItemType = true,
		showNavigableAsLinks = true,
		isNavigableFn = isPreviewable,
		labelTypographyProps,
		labelComponent = 'span',
		labelDisplayProp = 'label',
		titleDisplayProp = 'label',
		stateIconProps,
		publishingTargetIconProps,
		itemTypeIconProps,
		component = 'span',
		classes,
		sxs,
		...rest
	} = props;
	// endregion
	if (!item) {
		// Prevents crashing if the item is nullish
		return null;
	}
	const isDisabledItem = (item as ContentItem).stateMap?.disabled;
	// inWorkflow will only be true for type ContentItem (if they met the workflow criteria). Casting to ContentItem
	// is only done on scenarios where `isWorkflow` is true.
	const inWorkflow = isInWorkflow((item as ContentItem).stateMap) || item.systemType === 'folder';
	return (
		<Box
			component={component}
			ref={ref}
			{...rest}
			className={[classes?.root, rest?.className].filter(Boolean).join(' ')}
			sx={{
				display: 'inline-flex',
				alignItems: 'center',
				placeContent: 'left center',
				maxWidth: '100%',
				...sxs?.root
			}}
		>
			{/* @see https://github.com/craftersoftware/craftercms/issues/5442 */}
			{inWorkflow && !shouldItemShowAsStaged(item)
				? showWorkflowState && (
						<ItemStateIcon
							{...stateIconProps}
							item={item as ContentItem}
							className={[classes?.icon, stateIconProps?.className].filter(Boolean).join(' ')}
							sxs={{
								root: {
									fontSize: '1.1rem',
									...sxs?.icon
								}
							}}
						/>
					)
				: showPublishingTarget && (
						<ItemPublishingTargetIcon
							{...publishingTargetIconProps}
							item={item as ContentItem}
							className={[classes?.icon, publishingTargetIconProps?.className].filter(Boolean).join(' ')}
							sxs={{
								root: {
									fontSize: '1.1rem',
									...sxs?.icon
								}
							}}
						/>
					)}
			{showItemType &&
				(isDisabledItem ? (
					<DisabledItemIcon item={item} itemTypeIconProps={itemTypeIconProps} sxs={sxs} classes={classes} />
				) : (
					<ItemTypeIcon
						{...itemTypeIconProps}
						item={item}
						className={[classes?.icon, itemTypeIconProps?.className].filter(Boolean).join(' ')}
						sx={{ fontSize: '1.1rem', ...sxs?.icon }}
					/>
				))}
			<Typography
				noWrap
				component={labelComponent}
				{...labelTypographyProps}
				className={[classes?.label, labelTypographyProps?.className].filter(Boolean).join(' ')}
				sx={{
					marginLeft: '2px',
					display: 'inline-block',
					color:
						showNavigableAsLinks && isNavigableFn(item as ContentItem)
							? (theme) => (theme.palette.mode === 'dark' ? palette.teal.tint : palette.teal.shade)
							: null,
					...sxs?.label
				}}
				title={item[titleDisplayProp]}
				children={item[labelDisplayProp]}
			/>
		</Box>
	);
});

/**
 * Determines if the item's icon should be displayed as staged.
 *
 * @param item - The content item to check.
 * @returns True if the item should be displayed as staged, false otherwise.
 *
 * Staging has priority over modified and null. Additionally, if an item is submitted to live, submitted to staging, or
 * scheduled, it should not be shown as staged.
 */
function shouldItemShowAsStaged(item: ContentItem | LightItem): boolean {
	if (!('stateMap' in item) || !item.stateMap) return false;
	return (
		item.stateMap?.staged &&
		(item.stateMap?.new || item.stateMap?.modified) &&
		!item.stateMap?.submittedToLive &&
		!item.stateMap?.submittedToStaging &&
		!item.stateMap?.scheduled
	);
}

export default ItemDisplay;
