/*
 * Copyright (C) 2007-2021 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

import { CrafterNamespacedState, StateContainer, CrafterState } from './ReduxStore';

/**
 * @deprecated
 * Please import from 'ReduxStore.ts' instead or directly from the
 * package root. File will be removed on future release.
 **/
type DeprecatedStateContainer<T> = StateContainer<T>;
/**
 * @deprecated
 * Please import from 'ReduxStore.ts' instead or directly from the
 * package root. File will be removed on future release.
 **/
type DeprecatedCrafterState = CrafterState;
/**
 * @deprecated
 * Please import from 'ReduxStore.ts' instead or directly from the
 * package root. File will be removed on future release.
 **/
type DeprecatedCrafterNamespacedState = CrafterNamespacedState;

export {
	DeprecatedStateContainer as StateContainer,
	DeprecatedCrafterState as CrafterState,
	DeprecatedCrafterNamespacedState as CrafterNamespacedStatepero
};
