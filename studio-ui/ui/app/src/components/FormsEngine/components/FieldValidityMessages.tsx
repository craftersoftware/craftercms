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

import FormHelperText from '@mui/material/FormHelperText';
import { type IntlFormatters, useIntl } from 'react-intl';
import type { FieldValidityMessage } from '../lib/validators';
import { translateIfMessageDescriptor } from '../../ContentTypeManagement/utils';

/**
 * Translates a validity message for a form field.
 *
 * @param messageData {FieldValidityMessage} - The validity message data, which can be a single message
 * or a tuple containing a message and its associated values.
 * @param formatMessage {IntlFormatters['formatMessage']} - The function used to format internationalized messages.
 * @returns {string} - The translated validity message.
 */
export function translateValidityMessage(
	messageData: FieldValidityMessage,
	formatMessage: IntlFormatters['formatMessage']
): string {
	const message = Array.isArray(messageData) ? messageData[0] : messageData;
	const values = Array.isArray(messageData) ? messageData[1] : undefined;
	return translateIfMessageDescriptor(message, formatMessage, values);
}

/** The validator messages shown under a field, one line each. */
export function FieldValidityMessages({ messages }: { messages?: FieldValidityMessage[] }) {
	const { formatMessage } = useIntl();
	return (
		<>
			{messages?.map((messageData, key) => (
				<FormHelperText key={key}>{translateValidityMessage(messageData, formatMessage)}</FormHelperText>
			))}
		</>
	);
}
