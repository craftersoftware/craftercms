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

import React, { useId } from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import Box from '@mui/material/Box';
import { defineMessages, useIntl } from 'react-intl';
import { TypeBuilderControl } from '../utils';
import Typography from '@mui/material/Typography';
import { StringListEditor } from './StringListEditor';

export interface TypeDestinationPathsSelectorProps extends TypeBuilderControl {
	value: DestinationPaths;
}

const messages = defineMessages({
	includes: { id: 'typeDestinationPaths.includes', defaultMessage: 'Includes' },
	excludes: { id: 'typeDestinationPaths.excludes', defaultMessage: 'Excludes' },
	includesPattern: { id: 'typeDestinationPaths.includesPattern', defaultMessage: 'Includes pattern {index}' },
	excludesPattern: { id: 'typeDestinationPaths.excludesPattern', defaultMessage: 'Excludes pattern {index}' },
	addInclude: { id: 'typeDestinationPaths.addInclude', defaultMessage: 'Add include path' },
	addExclude: { id: 'typeDestinationPaths.addExclude', defaultMessage: 'Add exclude path' },
	removeInclude: { id: 'typeDestinationPaths.removeInclude', defaultMessage: 'Remove include pattern {index}' },
	removeExclude: { id: 'typeDestinationPaths.removeExclude', defaultMessage: 'Remove exclude pattern {index}' }
});

type Destination = 'includes' | 'excludes';
interface DestinationPaths {
	includes: { pattern: string[] };
	excludes: { pattern: string[] };
}
/**
 * Allows users to specify "includes" and "excludes" destination paths for content types.
 */
export function TypeDestinationPathsSelector(props: TypeDestinationPathsSelectorProps) {
	const { field, setValue } = props;
	const { formatMessage } = useIntl();
	const value = props.value ?? { includes: { pattern: [] }, excludes: { pattern: [] } };
	const htmlId = useId();
	const maxLength = field.validations.maxLength?.value;

	const updatePatterns = (prop: Destination, pattern: string[]) => {
		setValue({ ...value, [prop]: { pattern } });
	};

	return (
		<FormsEngineField labelId={htmlId} field={field} max={maxLength}>
			<Box role="group" aria-labelledby={htmlId}>
				{Object.entries(value).map(([key, entry]) => (
					<Box key={key} sx={{ display: 'flex', flexDirection: 'column', rowGap: 2, mt: 2 }}>
						<Typography variant="subtitle2">
							{formatMessage(key === 'includes' ? messages.includes : messages.excludes)}
						</Typography>
						<StringListEditor
							values={entry?.pattern ?? []}
							onChange={(pattern) => updatePatterns(key as Destination, pattern)}
							maxLength={maxLength}
							itemLabel={key === 'includes' ? messages.includesPattern : messages.excludesPattern}
							addLabel={key === 'includes' ? messages.addInclude : messages.addExclude}
							removeLabel={key === 'includes' ? messages.removeInclude : messages.removeExclude}
						/>
					</Box>
				))}
			</Box>
		</FormsEngineField>
	);
}

export default TypeDestinationPathsSelector;
