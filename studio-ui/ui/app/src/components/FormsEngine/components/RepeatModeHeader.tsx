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

import React, { useContext } from 'react';
import { ItemMetaContext } from '../lib/formsEngineContext';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { FormattedMessage } from 'react-intl';
import { FormsEngineProps } from '../FormsEngine';
import { formHeaderTitleMinHeight } from './formHeaderMetrics';

export function RepeatModeHeader({ repeat }: { repeat: FormsEngineProps['repeat'] }) {
	const { contentType } = useContext(ItemMetaContext);
	return (
		<Container sx={{ py: 1 }}>
			<Typography variant="h6" component="h3" sx={{ minHeight: formHeaderTitleMinHeight }}>
				{repeat.index === undefined ? (
					<FormattedMessage defaultMessage="New Repeat Item" />
				) : (
					<FormattedMessage defaultMessage="Item # {number}" values={{ number: repeat.index + 1 }} />
				)}
			</Typography>
			<Typography variant="body2" color="textSecondary">
				<FormattedMessage
					defaultMessage="{name} Repeat Group"
					values={{ name: contentType.fields[repeat.fieldId].name }}
				/>
			</Typography>
		</Container>
	);
}

export default RepeatModeHeader;
