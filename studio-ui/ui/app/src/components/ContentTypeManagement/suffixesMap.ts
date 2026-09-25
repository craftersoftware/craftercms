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

import { defineMessage, MessageDescriptor } from 'react-intl';

export type SuffixesType =
	'_s' | '_t' | '_i' | '_l' | '_b' | '_f' | '_d' | '_dt' | '_to' | '_html' | '_o' | '_en' | '_txt';

export const suffixesMap: Record<SuffixesType, MessageDescriptor> = {
	_s: defineMessage({ defaultMessage: 'For string.' }),
	_t: defineMessage({ defaultMessage: 'For multiple words or tokens.' }),
	_i: defineMessage({ defaultMessage: 'For integer number.' }),
	_l: defineMessage({ defaultMessage: 'For long integer number.' }),
	_b: defineMessage({ defaultMessage: 'For boolean (true or false).' }),
	_f: defineMessage({ defaultMessage: 'For floating point number.' }),
	_d: defineMessage({ defaultMessage: 'For long floating point number.' }),
	_dt: defineMessage({ defaultMessage: 'For date in ISO 8601 date format.' }),
	_to: defineMessage({ defaultMessage: 'For time in HH:mm:ss format.' }),
	_html: defineMessage({ defaultMessage: 'For text with HTML tags.' }),
	_o: defineMessage({ defaultMessage: 'For object.' }),
	_en: defineMessage({ defaultMessage: 'For multiple words or tokens.' }),
	_txt: defineMessage({ defaultMessage: 'For multiple words or tokens.' })
};
