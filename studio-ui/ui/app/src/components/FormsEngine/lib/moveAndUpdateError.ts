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

/**
 * move_and_update answers HTTP 403 with the generic "Unauthorized" body. The alert names the target path instead.
 */
export function isMoveAndUpdateForbidden(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) {
		return false;
	}
	const ajaxError = error as { name?: string; status?: number };
	return ajaxError.name === 'AjaxError' && ajaxError.status === 403;
}

export function moveAndUpdateForbiddenDescriptor(targetPath: string) {
	return {
		descriptor: {
			defaultMessage: 'You don\'t have permission to move this item to "{path}".'
		},
		values: { path: targetPath }
	};
}
