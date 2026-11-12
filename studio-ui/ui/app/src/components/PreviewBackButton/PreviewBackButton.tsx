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

import React from 'react';
import { IconButton, IconButtonProps } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useDispatch } from 'react-redux';
import { useHistoryBackStack } from '../../hooks/useHistoryBackStack';
import { useIntl } from 'react-intl';
import Tooltip from '@mui/material/Tooltip';
import { goToLastPage } from '../../state/actions/preview';
import { useSelection } from '../../hooks/useSelection';

export interface PreviewBackButtonProps extends IconButtonProps {}

export function PreviewBackButton(props: PreviewBackButtonProps) {
	const currentUrlPath = useSelection((state) => state.previewNavigation.currentUrlPath);
	const stack = useHistoryBackStack();
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const onClick = () => {
		dispatch(goToLastPage());
	};

	return (
		<Tooltip title={formatMessage({ id: 'words.back', defaultMessage: 'Back' })}>
			<span>
				<IconButton
					disabled={stack.length === 0 || (stack.length === 1 && currentUrlPath === stack[0])}
					onClick={onClick}
					size="large"
					aria-label={formatMessage({ id: 'words.back', defaultMessage: 'Back' })}
					{...props}
				>
					<ArrowBackRoundedIcon />
				</IconButton>
			</span>
		</Tooltip>
	);
}

export default PreviewBackButton;
