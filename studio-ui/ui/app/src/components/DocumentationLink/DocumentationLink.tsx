/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import { useIntl } from 'react-intl';
import { messages } from '../LauncherSection/utils';

export const DOCUMENTATION_URL = 'https://craftercms.com/docs';

/**
 * Icon-only help control. The tooltip text is the accessible name (same string as the
 * historical launcher tile), so it is not a description and `describeChild` stays off.
 */
export function DocumentationLink() {
	const { formatMessage } = useIntl();
	const label = formatMessage(messages.docs);
	return (
		<Tooltip title={label}>
			<IconButton
				component="a"
				href={DOCUMENTATION_URL}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={label}
				size="large"
				sx={{
					'&:focus-visible': {
						outline: '2px solid',
						outlineColor: 'primary.main',
						outlineOffset: 2
					}
				}}
			>
				<MenuBookOutlined />
			</IconButton>
		</Tooltip>
	);
}

export default DocumentationLink;
