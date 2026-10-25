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

import { defineMessages, useIntl } from 'react-intl';
import { useDispatch } from 'react-redux';
import React, { useEffect, useState } from 'react';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import SiteExplorer from '../../icons/SiteExplorer';
import { popDialog, pushDialog } from '../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { createComponentId } from '../../utils/system';

const messages = defineMessages({
	searchIn: {
		id: 'pathSelector.inputPlaceholderText',
		defaultMessage: 'Select path'
	}
});

export interface PathSelectorProps {
	value: string;
	disabled?: boolean;
	stripXmlIndex?: boolean;
	/** The minimum outer path allowed */
	rootPath?: string;
	onPathSelected(path: string): void;
}

export function PathSelector(props: PathSelectorProps) {
	const { onPathSelected, value, disabled = false, stripXmlIndex = true, rootPath } = props;
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const [path, setPath] = useState<string>(value ?? '');

	useEffect(() => {
		setPath(value ?? '');
	}, [value]);

	const onClean = (e) => {
		e.stopPropagation();
		e.preventDefault();
		let cleanPath = rootPath ?? '';
		setPath(cleanPath);
		onPathSelected(cleanPath);
	};

	const onOpenPathSelectionDialog = () => {
		const dialogId = nanoid();
		dispatch(
			pushDialog({
				id: dialogId,
				component: createComponentId('PathSelectionDialog'),
				props: {
					rootPath: rootPath ?? `/${path.split('/')[1] ?? ''}`,
					initialPath: path,
					showCreateFolderOption: false,
					allowSwitchingRootPath: !Boolean(rootPath),
					stripXmlIndex,
					onClosed: () => dispatch(popDialog({ id: dialogId })),
					onOk: ({ path }) => {
						setPath(path);
						onPathSelected(path);
						dispatch(popDialog({ id: dialogId }));
					}
				}
			})
		);
	};

	return (
		<Paper
			variant="outlined"
			sx={{
				flex: 1,
				minHeight: 40,
				display: 'flex',
				alignItems: 'center',
				padding: '0 0 0 10px',
				opacity: disabled ? 0.7 : 1,
				'&:hover': {
					borderColor: (theme) => (disabled ? undefined : theme.palette.action.active)
				}
			}}
		>
			<ButtonBase
				disabled={disabled}
				onClick={onOpenPathSelectionDialog}
				// With no path the visible text is the name. A label that left it out would fail 2.5.3.
				aria-label={
					path
						? formatMessage({ id: 'pathSelector.searchInPath', defaultMessage: 'Search in path: {path}' }, { path })
						: undefined
				}
				sx={{
					flex: 1,
					minHeight: 40,
					display: 'flex',
					justifyContent: 'flex-start',
					alignItems: 'center',
					gap: '5px',
					textAlign: 'left',
					cursor: disabled ? 'default' : 'pointer',
					'&:focus-visible, &.Mui-focusVisible': {
						outline: (theme) => `2px solid ${theme.palette.primary.main}`,
						outlineOffset: '-2px'
					}
				}}
			>
				{disabled ? null : <SiteExplorer sx={{ color: 'text.secondary' }} />}
				<Typography
					variant="body2"
					noWrap
					sx={{ flex: 1, color: path ? 'text.primary' : 'text.secondary', textAlign: 'left' }}
				>
					{path || formatMessage(messages.searchIn)}
				</Typography>
			</ButtonBase>
			{!disabled && value ? (
				<IconButton size="small" onClick={onClean} aria-label={formatMessage({ defaultMessage: 'Clear path' })}>
					<CloseIcon />
				</IconButton>
			) : null}
		</Paper>
	);
}

export default PathSelector;
