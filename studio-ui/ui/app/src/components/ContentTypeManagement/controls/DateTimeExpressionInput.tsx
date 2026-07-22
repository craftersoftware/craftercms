/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import OutlinedInput, { OutlinedInputProps } from '@mui/material/OutlinedInput';
import React, { useId } from 'react';
import FormsEngineField from '../../FormsEngine/components/FormsEngineField';
import Tooltip from '@mui/material/Tooltip';
import { FormattedMessage, useIntl } from 'react-intl';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import { TypeBuilderControl } from '../utils';
import IconButton from '@mui/material/IconButton';

export interface TextProps extends TypeBuilderControl {
	value: string;
}

const DATE_TIME_FORMAT_OFFSET =
	'[now] [+ or -] [number] [days | weeks | years | hours | minutes | d | w | y | h | m]';
const DATE_TIME_FORMAT_DAY = '[day-of-week | {day-of-week}] or {macro} [optional HH:mm[:ss]]';
const DATE_TIME_EXAMPLE =
	"'now', 'now+5days', 'now-30m', '+2d', '-2w', 'monday', '{friday} 09:00', '{now+2days} 09:30:15'";
const TIME_FORMAT = 'now[+ or -][number][hours | minutes]';
const TIME_EXAMPLE = "'now', 'now+5hours', 'now-30minutes'";

/**
 * Component for rendering an input field that accepts date-time or time expressions.
 */
export function DateTimeExpressionInput(props: TextProps) {
	const { field, value, setValue, readonly, autoFocus } = props;
	const htmlId = useId();
	const maxLength = field.validations?.maxLength?.value;
	const type: 'dateTime' | 'time' = field.validations?.type?.value ?? 'dateTime';
	const { formatMessage } = useIntl();

	const handleChange: OutlinedInputProps['onChange'] = (e) => setValue(e.currentTarget.value);
	return (
		<FormsEngineField htmlFor={htmlId} field={field} max={maxLength} length={value.length}>
			<OutlinedInput
				autoFocus={autoFocus}
				id={htmlId}
				fullWidth
				inputProps={{ maxLength }}
				value={value}
				onChange={handleChange}
				disabled={readonly}
				endAdornment={
					<Tooltip
						title={
							<Box display="flex" flexDirection="column" gap={1}>
								<Box>
									<FormattedMessage defaultMessage="Date expression to process:" />
								</Box>
								{type === 'dateTime' ? (
									<>
										<Box>{DATE_TIME_FORMAT_OFFSET}</Box>
										<Box>
											<FormattedMessage defaultMessage="or" />
										</Box>
										<Box>{DATE_TIME_FORMAT_DAY}</Box>
									</>
								) : (
									<Box>{TIME_FORMAT}</Box>
								)}
								<Box>
									<FormattedMessage defaultMessage="e.g." />: {type === 'dateTime' ? DATE_TIME_EXAMPLE : TIME_EXAMPLE}
								</Box>
								{type === 'dateTime' && (
									<Box>
										<FormattedMessage defaultMessage="When the field disallows past dates, a static time that resolves to a past datetime (e.g. '{now} 00:00') falls back to the current time instead." />
									</Box>
								)}
							</Box>
						}
					>
						<IconButton
							size="small"
							edge="end"
							aria-label={formatMessage({ defaultMessage: 'Date/time expression help' })}
						>
							<InfoOutlinedIcon sx={{ cursor: 'pointer' }} />
						</IconButton>
					</Tooltip>
				}
			/>
		</FormsEngineField>
	);
}

export default DateTimeExpressionInput;
