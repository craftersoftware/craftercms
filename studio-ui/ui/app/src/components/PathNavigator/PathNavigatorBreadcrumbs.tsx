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

import { ContentItem } from '../../models/Item';
import React, { useState } from 'react';
import SearchBar from '../SearchBar/SearchBar';
import MuiBreadcrumbs, { breadcrumbsClasses } from '@mui/material/Breadcrumbs';
import NavigateNextIcon from '@mui/icons-material/NavigateNextRounded';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseIconRounded from '@mui/icons-material/CloseRounded';
import { defineMessages, useIntl } from 'react-intl';
import Box from '@mui/material/Box';
import { PartialSxRecord } from '../../models';

export type PathNavigatorBreadcrumbsClassKey =
	'root' | 'searchRoot' | 'searchInput' | 'searchCleanButton' | 'searchCloseButton';

export interface BreadcrumbsProps {
	breadcrumb: ContentItem[];
	keyword?: string;
	classes?: Partial<Record<PathNavigatorBreadcrumbsClassKey, string>>;
	sxs?: PartialSxRecord<PathNavigatorBreadcrumbsClassKey>;
	onSearch?(keyword: string): void;
	onCrumbSelected(breadcrumb: ContentItem, event: React.SyntheticEvent): void;
}

const messages = defineMessages({
	filter: { id: 'pathNavigator.pathFilterInputPlaceholder', defaultMessage: 'Filter children of {name}...' }
});

// PathBreadcrumbs + PathOptions + (Path)Search
function PathNavigatorBreadcrumbs(props: BreadcrumbsProps) {
	const { formatMessage } = useIntl();
	const { breadcrumb, onCrumbSelected, keyword, onSearch, sxs } = props;
	const [showSearch, setShowSearch] = useState(Boolean(keyword));

	const onChange = (keyword: string) => onSearch(keyword);

	const maxIndex = breadcrumb.length - 1;
	const forceSearch = breadcrumb.length <= 1;

	return (
		<>
			{breadcrumb && breadcrumb.length > 1 && (
				<Box
					component="section"
					className={props.classes?.root}
					sx={{
						display: 'flex',
						alignItems: 'center',
						position: 'relative',
						padding: '0 0 0 10px',
						'& .MuiSvgIcon-root': {
							fontSize: '1.1rem'
						},
						...sxs?.root
					}}
				>
					<MuiBreadcrumbs
						aria-label="Breadcrumbs"
						separator={<NavigateNextIcon fontSize="small" />}
						sx={{
							display: 'flex',
							alignItems: 'center',
							'& li': {
								lineHeight: 1
							},
							[`& .${breadcrumbsClasses.separator}`]: {
								margin: '0 2px'
							}
						}}
					>
						{breadcrumb.map((item: ContentItem, i: number) =>
							maxIndex !== i ? (
								<Link
									key={item.id}
									color="inherit"
									component="button"
									variant="subtitle2"
									underline="always"
									sx={{
										color: (theme) => theme.palette.text.secondary
									}}
									onClick={(e) => onCrumbSelected(item, e)}
									children={item.label}
								/>
							) : (
								<Typography
									key={item.id}
									variant="subtitle2"
									sx={{
										fontWeight: 'bold',
										color: (theme) => theme.palette.text.secondary
									}}
									children={item.label}
								/>
							)
						)}
					</MuiBreadcrumbs>
					<Box sx={{ display: 'flex', marginLeft: 'auto' }}>
						{onSearch && (
							<IconButton size="small" aria-label="search" onClick={() => setShowSearch(true)}>
								<SearchRoundedIcon />
							</IconButton>
						)}
					</Box>
				</Box>
			)}
			{/* This way the searchBar will be shown whenever there's a keyword OR when the user clicks on the search icon */}
			{(((Boolean(keyword) || showSearch) && onSearch) || forceSearch) && (
				<Box
					component="section"
					sx={{
						display: 'flex',
						padding: '0 0 0 10px',
						'& .MuiSvgIcon-root': {
							fontSize: '1.1rem'
						}
					}}
				>
					<SearchBar
						autoFocus={!forceSearch}
						onChange={onChange}
						keyword={keyword}
						placeholder={formatMessage(messages.filter, { name: breadcrumb[breadcrumb.length - 1]?.label })}
						showActionButton={Boolean(keyword)}
						classes={{
							root: props.classes?.searchRoot,
							inputInput: props.classes?.searchInput,
							actionIcon: props.classes?.searchCleanButton
						}}
						sxs={{
							root: {
								margin: '7px 10px 7px 0',
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
					{!forceSearch && (
						<IconButton
							size="small"
							onClick={() => {
								onSearch('');
								setShowSearch(false);
							}}
							className={props.classes?.searchCloseButton}
							sx={{ marginTop: '5px', marginBottom: '5px', marginRight: '10px', ...sxs?.searchCloseButton }}
							aria-label={formatMessage({ defaultMessage: 'Close' })}
						>
							<CloseIconRounded />
						</IconButton>
					)}
				</Box>
			)}
		</>
	);
}

export default PathNavigatorBreadcrumbs;
