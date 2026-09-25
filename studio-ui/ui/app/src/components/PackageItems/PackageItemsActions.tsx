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
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { FormattedMessage, useIntl } from 'react-intl';
import Button from '@mui/material/Button';
import ListRoundedIcon from '@mui/icons-material/ListRounded';
import TreeOutlined from '../../icons/TreeOutlined';
import { buttonClasses } from '@mui/material';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded';
import { nnou } from '../../utils/object';
import CheckBoxOutlineBlankRoundedIcon from '@mui/icons-material/CheckBoxOutlineBlankRounded';
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded';

export interface PackageItemsActionsProps {
	isTreeView: boolean;
	onSetIsTreeView(value: boolean): void;
	setExpandedPaths(value: string[] | undefined): void;
	disableTreeView: boolean;
	maxTreeItems: number;
	includeChildren?: boolean;
	setIncludeChildren?(value: boolean): void;
	selectAllDependenciesChecked?: boolean;
	onSelectAllDependencies?(checked: boolean): void;
}

export function PackageItemsActions(props: PackageItemsActionsProps) {
	const {
		isTreeView,
		onSetIsTreeView,
		disableTreeView,
		maxTreeItems,
		setExpandedPaths,
		includeChildren,
		setIncludeChildren,
		selectAllDependenciesChecked,
		onSelectAllDependencies
	} = props;
	const { formatMessage } = useIntl();
	const showSelectAll = Boolean(onSelectAllDependencies);
	return (
		<Box
			sx={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				mr: 1,
				ml: 1
			}}
		>
			<Box
				sx={{
					display: 'flex',
					py: 0.5
				}}
			>
				<Tooltip
					title={
						disableTreeView ? (
							<FormattedMessage
								defaultMessage="Tree view is disabled for packages with more than {maxTreeItems} items due to performance considerations."
								values={{
									maxTreeItems
								}}
							/>
						) : (
							''
						)
					}
				>
					<Box component="span">
						<Button
							size="small"
							startIcon={!disableTreeView && isTreeView ? <ListRoundedIcon /> : <TreeOutlined />}
							sx={{ [`.${buttonClasses.startIcon}`]: { mr: 0.5 } }}
							onClick={() => onSetIsTreeView(!isTreeView)}
							disabled={disableTreeView}
						>
							{!disableTreeView && isTreeView ? (
								<FormattedMessage defaultMessage="List View" />
							) : (
								<FormattedMessage defaultMessage="Tree View" />
							)}
						</Button>
					</Box>
				</Tooltip>
				{!disableTreeView && isTreeView && (
					<>
						<Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />
						<IconButton
							size="small"
							color="primary"
							onClick={() => setExpandedPaths(undefined)}
							aria-label={formatMessage({ defaultMessage: 'Collapse All' })}
						>
							<UnfoldMoreRoundedIcon fontSize="small" />
						</IconButton>
						<IconButton
							size="small"
							color="primary"
							onClick={() => setExpandedPaths([])}
							aria-label={formatMessage({ defaultMessage: 'Expand All' })}
						>
							<UnfoldLessRoundedIcon fontSize="small" />
						</IconButton>
					</>
				)}
			</Box>
			{(nnou(includeChildren) || showSelectAll) && (
				<Box sx={{ display: 'flex', gap: 0.5 }}>
					{showSelectAll && (
						<Button
							size="small"
							startIcon={selectAllDependenciesChecked ? <CheckBoxRoundedIcon /> : <CheckBoxOutlineBlankRoundedIcon />}
							sx={{ [`.${buttonClasses.startIcon}`]: { mr: 0.5 } }}
							onClick={() => onSelectAllDependencies(!selectAllDependenciesChecked)}
						>
							{selectAllDependenciesChecked ? (
								<FormattedMessage defaultMessage="Deselect all" />
							) : (
								<FormattedMessage defaultMessage="Select all" />
							)}
						</Button>
					)}
					{nnou(includeChildren) && (
						<Button
							size="small"
							startIcon={includeChildren ? <CheckBoxRoundedIcon /> : <CheckBoxOutlineBlankRoundedIcon />}
							sx={{ [`.${buttonClasses.startIcon}`]: { mr: 0.5 } }}
							onClick={() => setIncludeChildren(!includeChildren)}
						>
							<FormattedMessage defaultMessage="Include children" />
						</Button>
					)}
				</Box>
			)}
		</Box>
	);
}

export default PackageItemsActions;
