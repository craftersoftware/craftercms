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

import { Component, ReactNode } from 'react';
import { retryFailedLoad } from '../../utils/lazyWithRetry';

export interface LoadFailureBoundaryProps {
	/** What to render in place of the children after one of them throws (e.g. a lazy chunk that failed to load). */
	fallback: ReactNode | ((error: unknown) => ReactNode);
	/**
	 * While the fallback is displayed, switching this from `false` to `true` discards the error and renders the children
	 * again. Use it to retry on demand (e.g. the next time a dialog opens) rather than as soon as something changes.
	 */
	retryWhen?: boolean;
	children?: ReactNode;
}

interface LoadFailureBoundaryState {
	error: { value: unknown } | null;
	retryWhen: boolean;
}

/**
 * Contains a failure of its children (typically a `lazy()` chunk that couldn't be downloaded) so it doesn't unmount
 * the rest of the tree. Pair it with `lazyWithRetry` so retrying actually requests the chunk again (a plain `lazy()`
 * re-throws its first failure). To reset it when something specific changes, give it a `key`.
 */
export class LoadFailureBoundary extends Component<LoadFailureBoundaryProps, LoadFailureBoundaryState> {
	state: LoadFailureBoundaryState = { error: null, retryWhen: Boolean(this.props.retryWhen) };

	static getDerivedStateFromError(error: unknown): Partial<LoadFailureBoundaryState> {
		return { error: { value: error } };
	}

	componentDidCatch(error: unknown) {
		// Once the failure has been committed to the screen React has no need for the rejected lazy component anymore, so
		// it can be swapped for a fresh one: whatever renders the children next (a retry, or a new mount) requests it again.
		retryFailedLoad(error);
	}

	static getDerivedStateFromProps(
		props: LoadFailureBoundaryProps,
		state: LoadFailureBoundaryState
	): Partial<LoadFailureBoundaryState> | null {
		const retryWhen = Boolean(props.retryWhen);
		if (retryWhen === state.retryWhen) return null;
		return { retryWhen, error: retryWhen ? null : state.error };
	}

	render() {
		const { error } = this.state;
		if (!error) return this.props.children;
		const { fallback } = this.props;
		return typeof fallback === 'function' ? fallback(error.value) : fallback;
	}
}

export default LoadFailureBoundary;
