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

import type Monaco from '../../models/Monaco';

export type MonacoEditorOptions = NonNullable<Parameters<Monaco['editor']['create']>[1]>;
export type MonacoDiffEditorOptions = NonNullable<Parameters<Monaco['editor']['createDiffEditor']>[1]>;

/** Monaco's built-in themes; `@monaco-editor/react` used `"light"` as an alias for `"vs"`. */
export function normalizeMonacoTheme(theme?: string): string {
	if (!theme || theme === 'light') {
		return 'vs';
	}
	return theme;
}
