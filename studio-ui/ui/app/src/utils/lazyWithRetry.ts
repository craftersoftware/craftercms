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

import { ComponentType, createElement, lazy } from 'react';

export type RetryableLazyComponent<P> = ComponentType<P> & {
	/**
	 * Discards the rejected import, so that the next render of the component starts a new one. Call it once the
	 * failure has been handled (it is committed to an error boundary): calling it as soon as the import rejects makes
	 * React, which re-renders the suspended component, start yet another import each time and never report the error.
	 */
	retryLoad(): void;
};

/**
 * Like `React.lazy`, but a failed load can be retried. `lazy` keeps the rejected promise forever, so once its chunk
 * request fails every later render throws the same error, even after an error boundary is reset. Call `retryLoad()`
 * on the result (see `LazyDialogBoundary`) and the next render imports again.
 * @param load Dynamic import of the module whose default export is the component.
 */
export function lazyWithRetry<P extends object>(
	load: () => Promise<{ default: ComponentType<P> }>
): RetryableLazyComponent<P> {
	let current = lazy(load);
	const LazyWithRetry = ((props: P) => createElement(current as ComponentType<P>, props)) as RetryableLazyComponent<P>;
	LazyWithRetry.retryLoad = () => {
		current = lazy(load);
	};
	return LazyWithRetry;
}

export default lazyWithRetry;
