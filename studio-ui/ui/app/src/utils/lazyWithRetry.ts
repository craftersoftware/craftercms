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

import { ComponentProps, ComponentType, createElement, lazy } from 'react';

const retryByError = new WeakMap<object, () => void>();

/**
 * Makes the component that failed to load with `error` (an error thrown by a `lazyWithRetry` component) request its
 * module again the next time it renders. Does nothing for any other error. Call it once the error has been reported
 * (e.g. from `componentDidCatch`), not while React may still be rendering the failed component.
 */
export function retryFailedLoad(error: unknown): void {
	if (typeof error === 'object' && error !== null) retryByError.get(error)?.();
}

/**
 * Like `lazy()`, but a failed load (e.g. a chunk request that failed because of a transient network error) can be
 * retried. React keeps the rejection of a lazy component forever, so a plain `lazy()` would throw the same error every
 * time it is rendered again. Here the rejected `lazy()` is kept for as long as React needs it to report the failure to
 * the nearest error boundary (replacing it right away would make React retry endlessly), and it is swapped for a fresh
 * one by `retryFailedLoad(error)`. `LoadFailureBoundary` does that as soon as it has caught the error.
 * @param factory Function that loads the module, typically `() => import('...')`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
	factory: () => Promise<{ default: T }>
): ComponentType<ComponentProps<T>> {
	let Lazy = create();
	function create() {
		const component = lazy(() =>
			factory().catch((error) => {
				if (typeof error === 'object' && error !== null) {
					retryByError.set(error, () => {
						if (Lazy === component) Lazy = create();
					});
				}
				throw error;
			})
		);
		return component;
	}
	return function LazyWithRetry(props: ComponentProps<T>) {
		return createElement(Lazy as ComponentType<ComponentProps<T>>, props);
	};
}

export default lazyWithRetry;
