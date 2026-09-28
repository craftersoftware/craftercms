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
import MenuItem from '@mui/material/MenuItem';
import { FormattedMessage, useIntl } from 'react-intl';
import Select, { selectClasses } from '@mui/material/Select';
import { isBlank } from '../../utils/string';
import { changeSite } from '../../state/actions/sites';
import { setSiteCookie } from '../../utils/auth';
import { useDispatch } from 'react-redux';
import { useEnv } from '../../hooks/useEnv';
import { useSiteList } from '../../hooks/useSiteList';
import { getSystemLink } from '../../utils/system';
import { PREVIEW_URL_PATH } from '../../utils/constants';
import useMinimizedDialogWarning from '../../hooks/useMinimizedDialogWarning';
import SiteStatusIndicator from '../SiteStatusIndicator/SiteStatusIndicator';
import { previewSwitch } from '../../services/security';
import { BaseSelectProps } from '@mui/material/Select';
import { PartialSxRecord } from '../../models';
import { outlinedInputClasses } from '@mui/material/OutlinedInput';

export interface SiteSwitcherSelectProps extends BaseSelectProps {
	site: string;
	sxs?: PartialSxRecord<'menuRoot' | 'menuItem' | 'input' | 'select'>;
}

function SiteSwitcherSelect(props: SiteSwitcherSelectProps) {
	const { site, sxs, ...rest } = props;
	const sites = useSiteList();
	const { authoringBase, useBaseDomain } = useEnv();
	const dispatch = useDispatch();
	const checkMinimized = useMinimizedDialogWarning();
	const { formatMessage } = useIntl();

	const onSiteChange = ({ target: { value } }) => {
		if (!isBlank(value) && site !== value && !checkMinimized()) {
			if (window.location.href.includes(PREVIEW_URL_PATH)) {
				dispatch(changeSite(value));
			} else {
				setSiteCookie(value, useBaseDomain);
				previewSwitch().subscribe(() => {
					window.location.href = getSystemLink({
						site: value,
						systemLinkId: 'preview',
						authoringBase
					});
				});
			}
		}
	};

	return (
		<Select
			displayEmpty
			variant="outlined"
			{...rest}
			className={props.className}
			sx={{
				maxWidth: 150,
				background: 'transparent',
				[`.${outlinedInputClasses.notchedOutline}`]: { border: 0 },
				...sxs?.menuRoot,
				[`& .${selectClasses.select}`]: {
					border: 'none',
					background: 'transparent',
					padding: '10px 10px',
					'&:focus:invalid, &:focus': {
						border: 'none',
						boxShadow: 'none'
					},
					...sxs?.select
				}
			}}
			value={site}
			onChange={onSiteChange}
			slotProps={{
				input: {
					'aria-label': formatMessage({ defaultMessage: 'Select site' })
				}
			}}
		>
			{sites.length === 0 && (
				<MenuItem value="">
					<FormattedMessage id="siteSwitcherSelected.siteSelectorNoSiteSelected" defaultMessage="Choose site" />
				</MenuItem>
			)}
			{sites.map(({ id, name, state }) => (
				<MenuItem
					key={id}
					value={id}
					sx={{
						maxWidth: 390,
						whiteSpace: 'nowrap',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						display: 'block'
					}}
					disabled={state !== 'READY'}
				>
					{name}
					{state !== 'READY' && <SiteStatusIndicator state={state} size={16} sx={{ float: 'right', ml: 1 }} />}
				</MenuItem>
			))}
		</Select>
	);
}

export default SiteSwitcherSelect;
