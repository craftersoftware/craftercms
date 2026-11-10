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

import { createContext } from 'react';

/** Site-config `<form-engine>` postfix rules for Type Builder (variable input and later save validation). */
export interface FieldNamePostfixContextProps {
	fieldNamePostfix: boolean;
	ignorePostfixFields: string[];
}

export const FieldNamePostfixContext = createContext<FieldNamePostfixContextProps | null>(null);
