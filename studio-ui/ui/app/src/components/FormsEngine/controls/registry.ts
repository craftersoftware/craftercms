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

import type { ComponentType } from 'react';
import type { DataSourceBinding } from '../dataSources/types';
import type { ControlProps } from '../types';

/** Cached plugin control: Component, normalized bindings, and owning `pluginId` (for conflict errors). */
export interface RegisteredControlContribution {
	Component: ComponentType<ControlProps>;
	bindings: readonly DataSourceBinding[];
	pluginId: string;
}

const registeredControls = new Map<string, RegisteredControlContribution>();

/**
 * Stores an FE2 plugin control Component + bindings by `field.type`.
 *
 * Idempotent for the same Component; throws if another plugin claims the same type with a different
 * Component. Complements binding registration — both are installed by `registerPlugin`.
 */
export function registerControlContribution(controlType: string, contribution: RegisteredControlContribution): void {
	if (!controlType) {
		throw new TypeError('registerControlContribution requires a non-empty control type.');
	}
	const existing = registeredControls.get(controlType);
	if (existing && existing.Component !== contribution.Component) {
		throw new Error(
			`Cannot register control type "${controlType}": a different component is already registered` +
				` (plugin "${existing.pluginId}" vs "${contribution.pluginId}").`
		);
	}
	if (!existing) {
		registeredControls.set(controlType, contribution);
	}
}

/** Read API for `controlPluginLoader` / hosts after `registerPlugin`. */
export function getRegisteredControlContribution(controlType: string): RegisteredControlContribution | undefined {
	return registeredControls.get(controlType);
}

export function hasRegisteredControl(controlType: string): boolean {
	return registeredControls.has(controlType);
}
