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
import type { ValueRetriever, ValueSerializer } from '../lib/controlValueTypes';
import type { ValidatorFunctionDef } from '../lib/validators';
import type { ControlProps } from '../types';

/** Cached plugin control: Component, bindings, optional IO/validator hooks, and owning `PluginDescriptor.id`. */
export interface RegisteredControlContribution {
	Component: ComponentType<ControlProps>;
	bindings: readonly DataSourceBinding[];
	/** Owning {@link PluginDescriptor.id} — not the form-definition asset locator `pluginId`. */
	pluginId: string;
	valueRetriever?: ValueRetriever;
	valueSerializer?: ValueSerializer;
	validator?: ValidatorFunctionDef;
}

const registeredControls = new Map<string, RegisteredControlContribution>();

/**
 * Stores an FE2 plugin control contribution by `field.type`.
 *
 * Idempotent for the same owning plugin + Component. Throws if another plugin's descriptor already
 * claims the type (even with an identical Component reference), so binding/IO metadata cannot be
 * overwritten under a retained first owner. Re-entry with the same owner+Component refreshes
 * bindings and optional valueRetriever/valueSerializer/validator.
 */
export function registerControlContribution(controlType: string, contribution: RegisteredControlContribution): void {
	if (!controlType) {
		throw new TypeError('registerControlContribution requires a non-empty control type.');
	}
	const existing = registeredControls.get(controlType);
	if (existing) {
		if (existing.pluginId !== contribution.pluginId) {
			throw new Error(
				`Cannot register control type "${controlType}": already registered by plugin "${existing.pluginId}"` +
					` (attempted by "${contribution.pluginId}").`
			);
		}
		if (existing.Component !== contribution.Component) {
			throw new Error(
				`Cannot register control type "${controlType}": a different component is already registered` +
					` by plugin "${existing.pluginId}".`
			);
		}
		registeredControls.set(controlType, {
			...existing,
			bindings: contribution.bindings,
			valueRetriever: contribution.valueRetriever ?? existing.valueRetriever,
			valueSerializer: contribution.valueSerializer ?? existing.valueSerializer,
			validator: contribution.validator ?? existing.validator
		});
		return;
	}
	registeredControls.set(controlType, contribution);
}

/** Read API for `controlPluginLoader` / hosts after `registerPlugin`. */
export function getRegisteredControlContribution(controlType: string): RegisteredControlContribution | undefined {
	return registeredControls.get(controlType);
}

export function hasRegisteredControl(controlType: string): boolean {
	return registeredControls.has(controlType);
}

/** Plugin control valueRetriever for `field.type`, if contributed. */
export function getPluginControlValueRetriever(controlType: string): ValueRetriever | undefined {
	return registeredControls.get(controlType)?.valueRetriever;
}

/** Plugin control valueSerializer for `field.type`, if contributed. */
export function getPluginControlValueSerializer(controlType: string): ValueSerializer | undefined {
	return registeredControls.get(controlType)?.valueSerializer;
}

/** Plugin control validator for `field.type`, if contributed. */
export function getPluginControlValidator(controlType: string): ValidatorFunctionDef | undefined {
	return registeredControls.get(controlType)?.validator;
}
