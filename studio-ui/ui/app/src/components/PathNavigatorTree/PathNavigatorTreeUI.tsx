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

import React, { type ReactNode } from 'react';
import Accordion from '@mui/material/Accordion';
import { PathNavigatorHeader } from '../PathNavigator/PathNavigatorHeader';
import AccordionDetails from '@mui/material/AccordionDetails';
import { StateStylingProps } from '../../models/UiConfig';
import PathNavigatorTreeItem, { PathNavigatorTreeItemProps } from './PathNavigatorTreeItem';
import LookupTable from '../../models/LookupTable';
import { ContentItem } from '../../models/Item';
import { SystemIconDescriptor } from '../SystemIcon';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import { FormattedMessage } from 'react-intl';
import { ErrorState } from '../ErrorState';
import { SimpleTreeView } from '@mui/x-tree-view';
import { PartialSxRecord } from '../../models';

export type PathNavigatorTreeUIClassKey = 'root' | 'body' | 'header';

export interface PathNavigatorTreeUIProps
	extends Pick<
		PathNavigatorTreeItemProps,
		| 'showNavigableAsLinks'
		| 'showPublishingTarget'
		| 'showWorkflowState'
		| 'showItemMenu'
		| 'keywordByPath'
		| 'totalByPath'
		| 'childrenByParentPath'
		| 'errorByPath'
	> {
	title: ReactNode;
	icon?: SystemIconDescriptor;
	container?: Partial<StateStylingProps>;
	rootPath: string;
	isRootPathMissing: boolean;
	itemsByPath: LookupTable<ContentItem>;
	onIconClick(path: string): void;
	onLabelClick(event: React.MouseEvent<Element, MouseEvent>, path: string): void;
	onChangeCollapsed(collapsed: boolean): void;
	onOpenItemMenu(element: Element, path: string): void;
	onHeaderButtonClick(element: Element): void;
	onFilterChange(keyword: string, path: string): void;
	onMoreClick(path: string): void;
	isCollapsed: boolean;
	expandedNodes: string[];
	classes?: Partial<Record<PathNavigatorTreeUIClassKey, string>>;
	sxs?: PartialSxRecord<PathNavigatorTreeUIClassKey>;
	active?: PathNavigatorTreeItemProps['active'];
}

export function PathNavigatorTreeUI(props: PathNavigatorTreeUIProps) {
	// region const { ... } = props
	const {
		icon,
		container,
		title,
		rootPath,
		isRootPathMissing,
		itemsByPath,
		keywordByPath,
		childrenByParentPath,
		errorByPath,
		totalByPath,
		onIconClick,
		onLabelClick,
		onChangeCollapsed,
		onOpenItemMenu,
		onHeaderButtonClick,
		onFilterChange,
		onMoreClick,
		isCollapsed,
		expandedNodes,
		active,
		showNavigableAsLinks,
		showPublishingTarget,
		showWorkflowState,
		showItemMenu,
		sxs
	} = props;
	// endregion
	return (
		<Accordion
			square
			disableGutters
			elevation={0}
			TransitionProps={{ unmountOnExit: true }}
			expanded={!isCollapsed}
			onChange={() => onChangeCollapsed(!isCollapsed)}
			className={props.classes?.root}
			style={{
				...container?.baseStyle,
				...(container ? (isCollapsed ? container.collapsedStyle : container.expandedStyle) : void 0)
			}}
			sx={{
				boxShadow: 'none',
				backgroundColor: 'inherit',
				'&.Mui-expanded': {
					margin: 'inherit'
				},
				...sxs?.root,
				...container?.baseSxs,
				...(isCollapsed ? container?.collapsedSxs : container?.expandedSxs)
			}}
		>
			<PathNavigatorHeader
				icon={icon}
				title={title}
				locale={null}
				// @see https://github.com/craftersoftware/craftercms/issues/5360
				menuButtonIcon={<RefreshRounded />}
				collapsed={isCollapsed}
				onMenuButtonClick={onHeaderButtonClick}
				className={props.classes?.header}
				sx={sxs?.header}
			/>
			{isRootPathMissing ? (
				<ErrorState
					sxs={{ root: { textAlign: 'center' }, image: { display: 'none' } }}
					title={
						<FormattedMessage
							id="pathNavigatorTree.missingRootPath"
							defaultMessage={`The path "{path}" doesn't exist`}
							values={{ path: rootPath }}
						/>
					}
				/>
			) : (
				<AccordionDetails className={props.classes?.body} sx={{ padding: 0, flexDirection: 'column', ...sxs?.body }}>
					<SimpleTreeView expandedItems={expandedNodes} disableSelection>
						<PathNavigatorTreeItem
							path={rootPath}
							active={active}
							itemsByPath={itemsByPath}
							keywordByPath={keywordByPath}
							totalByPath={totalByPath}
							childrenByParentPath={childrenByParentPath}
							errorByPath={errorByPath}
							onIconClick={onIconClick}
							onLabelClick={onLabelClick}
							onFilterChange={onFilterChange}
							onOpenItemMenu={onOpenItemMenu}
							onMoreClick={onMoreClick}
							showNavigableAsLinks={showNavigableAsLinks}
							showPublishingTarget={showPublishingTarget}
							showWorkflowState={showWorkflowState}
							showItemMenu={showItemMenu}
						/>
					</SimpleTreeView>
				</AccordionDetails>
			)}
		</Accordion>
	);
}

export default PathNavigatorTreeUI;
