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

import { TreeItem, treeItemClasses } from '@mui/x-tree-view/TreeItem';
import React, { useState } from 'react';
import { ContentItem } from '../../models/Item';
import LookupTable from '../../models/LookupTable';
import CircularProgress from '@mui/material/CircularProgress';
import { Typography } from '@mui/material';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import ItemDisplay from '../ItemDisplay';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SearchBar from '../SearchBar/SearchBar';
import CloseIconRounded from '@mui/icons-material/CloseRounded';
import Button from '@mui/material/Button';
import ArrowRightRoundedIcon from '@mui/icons-material/ArrowRightRounded';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import { isBlank } from '../../utils/string';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import { lookupItemByPath } from '../../utils/content';
import { PathNavigatorTreeStateProps } from './PathNavigatorTree';
import { PartialSxRecord } from '../../models';
import Box from '@mui/material/Box';

export interface PathNavigatorTreeItemProps extends Pick<
	PathNavigatorTreeStateProps,
	'keywordByPath' | 'totalByPath' | 'childrenByParentPath' | 'errorByPath'
> {
	path: string;
	itemsByPath: LookupTable<ContentItem>;
	active?: Record<string, boolean>;
	classes?: Partial<Record<PathNavigatorTreeBreadcrumbsClassKey, string>>;
	sxs?: PartialSxRecord<PathNavigatorTreeBreadcrumbsClassKey>;
	showNavigableAsLinks?: boolean;
	showPublishingTarget?: boolean;
	showWorkflowState?: boolean;
	showItemMenu?: boolean;
	onLabelClick(event: React.MouseEvent<Element, MouseEvent>, path: string): void;
	onIconClick(path: string): void;
	onOpenItemMenu?(element: Element, path: string): void;
	onFilterChange(keyword: string, path: string): void;
	onMoreClick(path: string): void;
}

export type PathNavigatorTreeBreadcrumbsClassKey =
	| 'activeItem'
	| 'searchRoot'
	| 'searchInput'
	| 'searchCleanButton'
	| 'searchCloseButton';

const translations = defineMessages({
	filter: {
		id: 'pathNavigatorTreeItemFilter.placeholder',
		defaultMessage: 'Filter children...'
	},
	expand: {
		id: 'words.expand',
		defaultMessage: 'Expand'
	},
	collapse: {
		id: 'words.collapse',
		defaultMessage: 'Collapse'
	}
});

export function PathNavigatorTreeItem(props: PathNavigatorTreeItemProps) {
	const {
		path,
		itemsByPath,
		keywordByPath,
		totalByPath,
		errorByPath,
		childrenByParentPath,
		active = {},
		showNavigableAsLinks = true,
		showPublishingTarget = true,
		showWorkflowState = true,
		showItemMenu = true,
		onLabelClick,
		onIconClick,
		onOpenItemMenu,
		onFilterChange,
		onMoreClick,
		sxs
	} = props;
	const [over, setOver] = useState(false);
	const [showFilter, setShowFilter] = useState(Boolean(keywordByPath[path]));
	const [keyword, setKeyword] = useState(keywordByPath[path] ?? '');
	const { formatMessage } = useIntl();
	const item = lookupItemByPath(path, itemsByPath);
	const children = lookupItemByPath(path, childrenByParentPath) ?? [];

	const onMouseOver = (e) => {
		e.stopPropagation();
		setOver(true);
	};

	const onMouseLeave = (e) => {
		e.stopPropagation();
		setOver(false);
	};

	const onFilterButtonClick = () => {
		setShowFilter(!showFilter);
	};

	const onClearKeywords = () => {
		if (keyword) {
			setKeyword('');
			onFilterChange('', path);
		}
	};

	const onContextMenu = (e) => {
		if (onOpenItemMenu) {
			e.preventDefault();
			onOpenItemMenu(e.currentTarget.querySelector('[data-item-menu]'), path);
		}
	};

	// Children for TreeItem set here this way instead of as JSX children below since, because there
	// are multiple blocks, that would cause all nodes to have an "open" icon even if they have no children.
	const propsForTreeItem = { children: [] };
	if (children.length) {
		propsForTreeItem.children = children.map((path) => (
			<PathNavigatorTreeItem
				key={path}
				path={path}
				itemsByPath={itemsByPath}
				keywordByPath={keywordByPath}
				totalByPath={totalByPath}
				childrenByParentPath={childrenByParentPath}
				errorByPath={errorByPath}
				active={active}
				sxs={sxs}
				onLabelClick={onLabelClick}
				onIconClick={onIconClick}
				onOpenItemMenu={onOpenItemMenu}
				onFilterChange={onFilterChange}
				onMoreClick={onMoreClick}
				showNavigableAsLinks={showNavigableAsLinks}
				showPublishingTarget={showPublishingTarget}
				showWorkflowState={showWorkflowState}
				showItemMenu={showItemMenu}
			/>
		));
		children.length < totalByPath[path] &&
			propsForTreeItem.children.push(
				<TreeItem
					key="more"
					itemId={`${path}::__more__`}
					label={
						<Button
							color="primary"
							size="small"
							onClick={(event) => {
								event.stopPropagation();
								onMoreClick(path);
							}}
						>
							<FormattedMessage
								id="pathNavigatorTree.moreLinkLabel"
								defaultMessage="{count, plural, one {...{count} more item} other {...{count} more items}}"
								values={{ count: totalByPath[path] - children.length }}
							/>
						</Button>
					}
					sx={{
						[`& > .${treeItemClasses.content}`]: {
							pt: 0,
							pb: 0,
							pr: 0,
							alignItems: 'center',
							minHeight: '23.5px',
							cursor: 'default',
							'&:hover': {
								background: 'none'
							}
						},
						[`& .${treeItemClasses.label}`]: {
							paddingLeft: 0
						},
						[`& .${treeItemClasses.iconContainer}`]: {
							width: '26px',
							marginRight: 0
						}
					}}
				/>
			);
	} else if (totalByPath[path] > 0 && !childrenByParentPath[path]?.length) {
		// If totalByPath at the current path is greater than 0, but there are no children in childrenByParentPath for the current path,
		// it means that the children are still loading, so we show a loading indicator. If there is an error for the current path, we show an error message instead.
		propsForTreeItem.children.push(
			errorByPath[path] ? (
				<Box
					key="loading"
					sx={{
						display: 'flex',
						alignItems: 'center',
						minHeight: '23.5px',
						marginLeft: '100px',
						'& span': {
							marginLeft: '10px'
						}
					}}
				>
					<Typography variant="caption" color="error.main">
						<FormattedMessage
							defaultMessage="Error: {message}"
							values={{ message: errorByPath[path]?.response?.message ?? errorByPath[path].message }}
						/>
					</Typography>
				</Box>
			) : (
				<Box
					key="loading"
					sx={{
						display: 'flex',
						alignItems: 'center',
						minHeight: '23.5px',
						marginLeft: '10px',
						'& span': {
							marginLeft: '10px'
						}
					}}
				>
					<CircularProgress size={14} />
					<Typography variant="caption" color="textSecondary">
						<FormattedMessage id="words.loading" defaultMessage="Loading" />
					</Typography>
				</Box>
			)
		);
	} else if (!isBlank(keywordByPath[path]) && totalByPath[path] === 0) {
		propsForTreeItem.children.push(
			<Box
				component="section"
				key="noResults"
				sx={{
					color: (theme) => theme.palette.text.secondary,
					display: 'flex',
					alignItems: 'center',
					minHeight: '23.5px',
					marginLeft: '10px',
					'& svg': {
						marginRight: '5px',
						fontSize: '1.1rem'
					}
				}}
			>
				<ErrorOutlineRounded />
				<Typography variant="caption">
					<FormattedMessage id="filter.noResults" defaultMessage="No results match your query" />
				</Typography>
			</Box>
		);
	}
	return (
		// region <TreeItem ... />
		<TreeItem
			key={path}
			itemId={path}
			slots={{
				expandIcon: ArrowRightRoundedIcon,
				collapseIcon: ArrowDropDownRoundedIcon
			}}
			slotProps={{
				expandIcon: {
					role: 'button',
					'aria-label': formatMessage(translations.expand),
					'aria-hidden': 'false',
					onClick: () => onIconClick(path)
				},
				collapseIcon: {
					role: 'button',
					'aria-label': formatMessage(translations.collapse),
					'aria-hidden': 'false',
					onClick: () => onIconClick(path)
				}
			}}
			label={
				<>
					<Box
						component="section"
						role="button"
						onClick={(event) => onLabelClick(event, path)}
						sx={{
							width: '100%',
							display: 'flex',
							alignItems: 'center',
							minHeight: '23.5px',
							'&:hover': {
								backgroundColor: (theme) =>
									theme.palette.mode === 'dark' ? theme.palette.action.hover : theme.palette.grey['A200']
							}
						}}
						onMouseOver={onMouseOver}
						onMouseLeave={onMouseLeave}
						onContextMenu={onContextMenu}
					>
						<ItemDisplay
							sxs={{
								root: {
									flex: 1,
									minWidth: 0,
									minHeight: '23.5px'
								}
							}}
							item={item}
							labelTypographyProps={{ variant: 'body2' }}
							showNavigableAsLinks={showNavigableAsLinks}
							showPublishingTarget={showPublishingTarget}
							showWorkflowState={showWorkflowState}
						/>
						{over && showItemMenu && onOpenItemMenu && (
							<Tooltip title={<FormattedMessage id="words.options" defaultMessage="Options" />}>
								<IconButton
									size="small"
									sx={{ padding: '2px 3px' }}
									data-item-menu
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										onOpenItemMenu(e.currentTarget, path);
									}}
									aria-label={formatMessage({ id: 'words.options', defaultMessage: 'Options' })}
								>
									<MoreVertRoundedIcon />
								</IconButton>
							</Tooltip>
						)}
						{/* If filter is active, or if mouse is over content (and item has children), show Icon */}
						{(showFilter || (over && Boolean(item.childrenCount))) && (
							<Tooltip title={<FormattedMessage id="words.filter" defaultMessage="Filter" />}>
								<IconButton
									size="small"
									sx={{ padding: '2px 3px' }}
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										onClearKeywords();
										onFilterButtonClick();
									}}
									aria-label={formatMessage({ id: 'words.filter', defaultMessage: 'Filter' })}
								>
									<SearchRoundedIcon color={showFilter ? 'primary' : 'action'} />
								</IconButton>
							</Tooltip>
						)}
					</Box>
					{showFilter && (
						<Box component="section" sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
							<SearchBar
								autoFocus
								onClick={(e) => e.stopPropagation()}
								onKeyDown={(e) => e.stopPropagation()}
								onChange={(keyword) => {
									setKeyword(keyword);
									onFilterChange(keyword, path);
								}}
								keyword={keyword}
								placeholder={formatMessage(translations.filter)}
								onActionButtonClick={(e, input) => {
									e.stopPropagation();
									onClearKeywords();
									input.focus();
								}}
								showActionButton={keyword && true}
								classes={{
									root: props.classes?.searchRoot,
									inputInput: props.classes?.searchInput,
									actionIcon: props.classes?.searchCleanButton
								}}
								sxs={{
									root: {
										margin: '5px 10px 5px 0',
										height: '25px',
										width: '100%',
										...sxs?.searchRoot
									},
									inputInput: {
										fontSize: '12px',
										padding: '5px !important',
										...sxs?.searchInput
									},
									actionIcon: {
										fontSize: '12px !important',
										...sxs?.searchCleanButton
									}
								}}
							/>
							<IconButton
								size="small"
								onClick={(e) => {
									e.stopPropagation();
									onClearKeywords();
									setShowFilter(false);
								}}
								className={props.classes?.searchCloseButton}
								sx={{
									marginRight: '10px',
									...sxs?.searchCloseButton
								}}
								aria-label={formatMessage({ defaultMessage: 'Close' })}
							>
								<CloseIconRounded />
							</IconButton>
						</Box>
					)}
				</>
			}
			sx={{
				[`& > .${treeItemClasses.content}`]: {
					pt: 0,
					pb: 0,
					pr: 0,
					alignItems: 'flex-start',
					'&:hover': {
						background: 'none'
					}
				},
				[`& .${treeItemClasses.label}`]: {
					display: 'flex',
					paddingLeft: 0,
					flexWrap: 'wrap',
					overflow: 'hidden',
					'&:hover': {
						background: 'none'
					},
					'& .MuiSvgIcon-root': {
						fontSize: '1.1rem'
					}
				},
				[`& > .${treeItemClasses.content} > .${treeItemClasses.label}`]: {
					...(active[path]
						? {
								backgroundColor: (theme) => theme.palette.action.selected,
								...sxs?.activeItem
							}
						: {})
				},
				[`& .${treeItemClasses.iconContainer}`]: {
					width: '26px',
					marginRight: 0,
					'& svg': {
						fontSize: '23.5px !important',
						color: (theme) => theme.palette.text.secondary
					}
				},
				[`& .${treeItemClasses.focused}`]: {
					background: 'none !important'
				}
			}}
			{...propsForTreeItem}
		/>
		// endregion
	);
}

export default PathNavigatorTreeItem;
