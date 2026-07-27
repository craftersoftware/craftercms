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

import { styled } from '@mui/material/styles';
import MuiList from '@mui/material/List';
import MuiListItemAvatar from '@mui/material/ListItemAvatar';
import Checkbox from '@mui/material/Checkbox';
import MuiCheckbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import React, { PropsWithChildren, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import MuiListItem from '@mui/material/ListItem';
import MuiListItemIcon from '@mui/material/ListItemIcon';
import MuiListSubheader from '@mui/material/ListSubheader';
import CheckRounded from '@mui/icons-material/CheckRounded';
import Box, { BoxProps } from '@mui/material/Box';
import { UNDEFINED } from '../../utils/constants';
import { getInitials, toColor } from '../../utils/string';
import Person from '../../models/Person';
import Avatar from '@mui/material/Avatar';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { defineMessages, FormattedMessage, MessageDescriptor, useIntl } from 'react-intl';
import { Pagination } from '../Pagination';
import { Activity, AllItemActions, PackageActions, PublishPackage } from '../../models';
import { SxProps } from '@mui/system';
import { useDispatch } from 'react-redux';
import { getOffsetLeft, getOffsetTop } from '@mui/material/Popover';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import Tooltip from '@mui/material/Tooltip';
import { getPersonFullName, reversePluckProps } from '../../utils/object';
import { showItemMegaMenu } from '../../state/actions/dialogs';
import useSpreadState from '../../hooks/useSpreadState';
import { ContextMenu, ContextMenuOption } from '../ContextMenu';
import { generatePackageOptions, packageActionDispatcher } from '../../utils/packageActions';
import { LIVE_COLOUR, STAGING_COLOUR } from '../ItemPublishingTargetIcon/styles';
import { asLocalizedDateTime } from '../../utils/datetime';
import useLocale from '../../hooks/useLocale';
import { useTheme } from '@mui/material/styles';
import { fetchPackage } from '../../services/publishing';
import useActiveSiteId from '../../hooks/useActiveSiteId';
import { pushErrorDialog } from '../../utils/system';
import { extractErrorPayload } from '../../utils/ajax';
import { Subscription } from 'rxjs';

export const actionsToBeShown: AllItemActions[] = [
	'edit',
	'delete',
	'publish',
	'requestPublish',
	'dependencies',
	'history'
];

export const List = styled(MuiList)({ paddingTop: 0 });

export const ListSubheader = styled(MuiListSubheader)({ paddingLeft: 0, paddingRight: 0, lineHeight: 2 });

export const ListItem = styled(MuiListItem)({ padding: 0 });

export const ListItemIcon = styled(MuiListItemIcon)({ marginRight: 0 });

export const ListItemAvatar = styled(MuiListItemAvatar)({ minWidth: 50 });

export const DenseCheckbox = styled(MuiCheckbox)({ padding: '5px' });

export const DashletAvatar = styled(Avatar)({ width: 40, height: 40 });

export interface PersonAvatarProps {
	person: Person;
	sx?: SxProps;
}

export function PersonAvatar(props: PersonAvatarProps) {
	const { person, sx } = props;
	const backgroundColor = toColor(person.username);
	return (
		<DashletAvatar
			src={person.avatar ?? UNDEFINED}
			children={person.avatar ? UNDEFINED : getInitials(person)}
			sx={{ backgroundColor, color: (theme) => theme.palette.getContrastText(backgroundColor), ...sx }}
		/>
	);
}

export const getItemSkeleton = ({
	numOfItems = 1,
	showCheckbox = false,
	showAvatar = false
}: Partial<{ numOfItems: number; showCheckbox: boolean; showAvatar: boolean }>) => (
	<List>
		{new Array(numOfItems).fill(null).map((nothing, index) => (
			<ListItem key={index} sx={{ pl: 2, pr: 2 }}>
				{showCheckbox && (
					<ListItemIcon>
						<Checkbox edge="start" disabled />
					</ListItemIcon>
				)}
				{showAvatar && (
					<ListItemAvatar>
						<DashletAvatar />
					</ListItemAvatar>
				)}
				<ListItemText
					primary={<Skeleton variant="text" />}
					secondary={
						<Typography color="text.secondary" variant="body2">
							<Skeleton variant="text" />
						</Typography>
					}
				/>
			</ListItem>
		))}
	</List>
);

export type DashletEmptyMessageProps = PropsWithChildren<{ sx?: BoxProps['sx'] }>;

export const DashletEmptyMessage = ({ children, sx }: DashletEmptyMessageProps) => (
	<Box display="flex" flexDirection="column" alignItems="center" sx={{ mt: 2, ...sx }}>
		<CheckRounded sx={{ color: 'success.main', mb: 1 }} />
		<Typography color="text.secondary" variant="body2">
			{children}
		</Typography>
	</Box>
);

export interface PersonFullNameProps {
	person: Person;
}

export function PersonFullName({ person }: PersonFullNameProps) {
	return <Typography variant="h6">{getPersonFullName(person)}</Typography>;
}

export function Pager(props: {
	totalPages: number;
	totalItems: number;
	currentPage: number;
	rowsPerPage: number;
	onPagePickerChange(page: number): void;
	onPageChange(page: number): void;
	onRowsPerPageChange(rowsPerPage: number): void;
}) {
	const { totalPages, totalItems, currentPage, rowsPerPage, onPagePickerChange, onPageChange, onRowsPerPageChange } =
		props;

	return (
		<>
			<Select
				variant="standard"
				disableUnderline
				value={`${currentPage}`}
				onChange={(e) => onPagePickerChange(parseInt(e.target.value))}
				sx={{ fontSize: (theme) => theme.typography.fontSize }}
			>
				{new Array(totalPages).fill(null).map((nothing, index) => (
					<MenuItem value={index} sx={{ fontSize: (theme) => theme.typography.fontSize }} key={index}>
						{currentPage === index ? (
							<FormattedMessage defaultMessage="Page {pageNumber}" values={{ pageNumber: index + 1 }} />
						) : (
							<FormattedMessage defaultMessage="Go to page {pageNumber}" values={{ pageNumber: index + 1 }} />
						)}
					</MenuItem>
				))}
			</Select>
			<Pagination
				count={totalItems}
				onPageChange={(e, page) => onPageChange(page)}
				page={currentPage}
				rowsPerPage={rowsPerPage}
				onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value))}
				mode="table"
			/>
		</>
	);
}

export function DashletItemOptions(props: { path: string; iconButtonProps?: IconButtonProps }) {
	const { path, iconButtonProps } = props;
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();

	const onOpenItemMegaMenu = (element: Element) => {
		const anchorRect = element.getBoundingClientRect();
		const top = anchorRect.top + getOffsetTop(anchorRect, 'top');
		const left = anchorRect.left + getOffsetLeft(anchorRect, 'left');
		dispatch(
			showItemMegaMenu({
				path,
				anchorReference: 'anchorPosition',
				anchorPosition: { top, left }
			})
		);
	};

	return (
		<Tooltip title={<FormattedMessage defaultMessage="Options" />}>
			<IconButton
				size="small"
				onClick={(e) => {
					e.stopPropagation();
					onOpenItemMegaMenu(e.currentTarget);
				}}
				aria-label={formatMessage({ defaultMessage: 'Options' })}
				{...iconButtonProps}
			>
				<MoreVertRoundedIcon />
			</IconButton>
		</Tooltip>
	);
}

export function usePackageContextMenu() {
	const [contextMenu, setContextMenu] = useSpreadState<{
		el: HTMLButtonElement | null;
		package: PublishPackage | null;
		options: ContextMenuOption[];
	}>({
		el: null,
		package: null,
		options: []
	});
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const position = contextMenu.el?.getBoundingClientRect();
	const theme = useTheme();
	const transitionDuration = theme.transitions.duration.standard;
	const siteId = useActiveSiteId();
	const subscriptionRef = useRef<Subscription | null>(null);
	const [isFetchingPackage, setIsFetchingPackage] = useState<boolean>(false);

	const handleContextMenuClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>, pkg: PublishPackage) => {
			// https://github.com/craftersoftware/craftercms/issues/8552 - Because of a limitation in the back end, the packages at
			// this point may not have the full AA. So we need to fetch the package to generate the proper set of options.
			const currentTarget = e.currentTarget;
			subscriptionRef.current?.unsubscribe();
			setContextMenu({ el: currentTarget });
			setIsFetchingPackage(true);
			subscriptionRef.current = fetchPackage(siteId, pkg.id).subscribe({
				next(publishPackage) {
					setIsFetchingPackage(false);
					const contextMenuOptions = generatePackageOptions([publishPackage], {
						includeOnly: ['view', 'resubmit']
					}).map((option) => ({
						id: option.id,
						label: formatMessage(option.label as MessageDescriptor)
					}));
					setContextMenu({ package: publishPackage, options: contextMenuOptions });
				},
				error(error) {
					setIsFetchingPackage(false);
					dispatch(pushErrorDialog({ props: { error: extractErrorPayload(error) } }));
				}
			});
		},
		[formatMessage, setContextMenu, siteId, dispatch]
	);

	useEffect(() => {
		return () => {
			// Cleanup on unmount
			subscriptionRef.current?.unsubscribe();
		};
	}, []);

	const handleContextMenuClose = useCallback(() => {
		setContextMenu({
			el: null,
			package: null
		});
	}, [setContextMenu]);

	const handleOptionClicked = useCallback(
		(option: PackageActions, pkg: PublishPackage) => {
			handleContextMenuClose();
			packageActionDispatcher({
				pkg,
				option,
				dispatch
			});
		},
		[dispatch, handleContextMenuClose]
	);

	useEffect(() => {
		if (!contextMenu.el) {
			// If contextMenu.el is null (meaning the menu is closed), clear the options after the transition has ended.
			// This is done to prevent the 'No options available' to show while closing the menu (if options is cleared at the same time as el).
			const timeout = setTimeout(() => {
				setContextMenu({
					options: []
				});
			}, transitionDuration);
			return () => clearTimeout(timeout);
		}
	}, [contextMenu.el, setContextMenu, transitionDuration]);

	const contextMenuElement = (
		<ContextMenu
			open={Boolean(contextMenu.el)}
			anchorReference={'anchorPosition'}
			anchorPosition={{ top: position?.bottom ?? 0, left: position?.left ?? 0 }}
			onClose={handleContextMenuClose}
			options={[contextMenu.options]}
			onMenuItemClicked={(option) => handleOptionClicked(option as PackageActions, contextMenu.package!)}
			transitionDuration={transitionDuration}
			isLoading={isFetchingPackage}
		/>
	);
	return {
		contextMenu,
		openContextMenu: handleContextMenuClick,
		closeContextMenu: handleContextMenuClose,
		setContextMenu,
		contextMenuElement
	};
}

const submittedPackageDetailMessages = defineMessages({
	staging: { id: 'words.staging', defaultMessage: 'Staging' },
	live: { id: 'words.live', defaultMessage: 'Live' }
});

/**
 * Displays details about a submitted package, including the submitter's name,
 * the publishing target (live or staging), and the submission date.
 *
 * @param {Object} props - The component props.
 * @param {PublishPackage} props.pkg - The package data containing submission details.
 */
export function SubmittedPackageDetail({ pkg }: { pkg: PublishPackage }) {
	const { formatMessage } = useIntl();
	const locale = useLocale();

	return (
		<FormattedMessage
			defaultMessage="Submitted by {name} to go {publishingTarget, select, live { <render_target>live</render_target>} other {<render_target>staging</render_target>}} on {submittedDate}"
			values={{
				name: pkg.submitter?.username,
				publishingTarget: pkg.target,
				render_target(target: ReactNode[]) {
					return (
						<Box component="span" color={target[0] === 'live' ? LIVE_COLOUR : STAGING_COLOUR}>
							{submittedPackageDetailMessages[target[0] as string]
								? formatMessage(submittedPackageDetailMessages[target[0] as string]).toLowerCase()
								: target[0]}
						</Box>
					);
				},
				submittedDate: asLocalizedDateTime(
					pkg.schedule ?? pkg.submittedOn,
					locale.localeCode,
					locale.dateTimeFormatOptions
				)
			}}
		/>
	);
}
