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
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useDispatch } from 'react-redux';
import { useHistoryForwardStack } from '../../hooks/useHistoryForwardStack';
import { useIntl } from 'react-intl';
import Tooltip from '@mui/material/Tooltip';
import { goToNextPage } from '../../state/actions/preview';

export interface PreviewForwardButtonProps extends IconButtonProps {}

export function PreviewForwardButton(props: PreviewForwardButtonProps) {
	const stack = useHistoryForwardStack();
	const dispatch = useDispatch();
	const { formatMessage } = useIntl();
	const onClick = () => {
		dispatch(goToNextPage());
	};

	return (
		<Tooltip title={formatMessage({ id: 'words.forward', defaultMessage: 'Forward' })}>
			<span>
				<IconButton
					disabled={stack.length === 0}
					onClick={onClick}
					{...props}
					size="large"
					aria-label={formatMessage({ id: 'words.forward', defaultMessage: 'Forward' })}
				>
					<ArrowForwardRoundedIcon />
				</IconButton>
			</span>
		</Tooltip>
	);
}

export default PreviewForwardButton;
