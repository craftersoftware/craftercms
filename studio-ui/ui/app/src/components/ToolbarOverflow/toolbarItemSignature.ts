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

const configurationIds = new WeakMap<object, number>();
let nextConfigurationId = 1;

/**
 * Identity of a toolbar item's `configuration` for the overflow signature.
 * Objects are compared by reference, so a circular configuration cannot throw the way `JSON.stringify` does.
 * A new object drops cached widths; an in-place edit of the same object does not.
 */
export function configurationReferenceId(configuration: unknown): string {
	if (configuration === null || configuration === undefined) {
		return '';
	}
	if (typeof configuration !== 'object') {
		return `:${String(configuration)}`;
	}
	let id = configurationIds.get(configuration);
	if (id === undefined) {
		id = nextConfigurationId;
		nextConfigurationId += 1;
		configurationIds.set(configuration, id);
	}
	return `#${id}`;
}

export interface ToolbarItemSignaturePart {
	key: string | null;
	typeName: string;
	id?: string;
	uiKey?: string;
	configuration?: unknown;
}

/** One line of the overflow signature. Cached widths are dropped when this changes. */
export function toolbarItemSignature(item: ToolbarItemSignaturePart): string {
	return `${item.key ?? ''}|${item.typeName}|${item.id ?? ''}|${item.uiKey ?? ''}|${configurationReferenceId(item.configuration)}`;
}
