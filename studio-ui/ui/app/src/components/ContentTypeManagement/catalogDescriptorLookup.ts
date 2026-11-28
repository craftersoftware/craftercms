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

import type { BuiltInControlType } from '../FormsEngine/lib/controlMap';
import controlDescriptors from './descriptors/controls';
import dataSourceDescriptors, { type BuiltInDataSourceType } from './descriptors/dataSources';
import type { DescriptorContentType } from './utils';

/**
 * Catalog descriptor lookup. Built-ins win: a plugin or site config entry cannot override a built-in type.
 * The config descriptor is used only when `type` is not a built-in.
 */
export function resolveCatalogDescriptor<T extends string>(
	builtIns: Record<T, DescriptorContentType>,
	type: string,
	configDescriptor?: DescriptorContentType | null
): DescriptorContentType | undefined {
	return builtIns[type as T] ?? configDescriptor ?? undefined;
}

export function resolveControlDescriptor(
	type: string,
	configDescriptor?: DescriptorContentType | null
): DescriptorContentType | undefined {
	return resolveCatalogDescriptor<BuiltInControlType>(controlDescriptors, type, configDescriptor);
}

export function resolveDataSourceDescriptor(
	type: string,
	configDescriptor?: DescriptorContentType | null
): DescriptorContentType | undefined {
	return resolveCatalogDescriptor<BuiltInDataSourceType>(dataSourceDescriptors, type, configDescriptor);
}
