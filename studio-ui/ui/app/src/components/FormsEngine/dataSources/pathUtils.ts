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

import type { DataSourceFieldContext } from './types';

/**
 * Applies `{...}` path macros via `ctx.expandPath` when the field context provides it; otherwise
 * leaves the configured path as authored (modules must not assume expansion always runs).
 */
export function expandPathOrRaw(ctx: Pick<DataSourceFieldContext, 'expandPath'>, path: string): string {
	if (!path) return path;
	return ctx.expandPath ? ctx.expandPath(path) : path;
}

/**
 * Appends `/.+` for Studio search’s recursive path matcher.
 * Trailing slashes are stripped first so `folder` and `folder/` match the same.
 */
export function toSearchPath(path: string): string {
	if (!path) return path;
	const trimmed = path.replace(/\/+$/, '');
	return `${trimmed}/.+`;
}
