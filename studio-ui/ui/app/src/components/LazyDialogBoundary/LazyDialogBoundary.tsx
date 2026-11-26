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

import { Component, PropsWithChildren } from 'react';
import type { RetryableLazyComponent } from '../../utils/lazyWithRetry';

export type LazyDialogBoundaryProps = PropsWithChildren<{
	/** Whether the dialog is open. A failed dialog is attempted again the next time this goes from false to true. */
	open: boolean;
	/** The `lazyWithRetry` dialog inside, so that its failed import is discarded and the next open imports again. */
	dialog: Pick<RetryableLazyComponent<never>, 'retryLoad'>;
	/** Called once when the dialog fails (e.g. its chunk could not be loaded). Close the dialog from here. */
	onError(error: Error): void;
}>;

interface LazyDialogBoundaryState {
	error: Error | null;
	wasOpen: boolean;
}

/**
 * Contains the failure of a lazily loaded dialog: the dialog renders nothing and the page around it keeps working.
 * It tries again the next time the dialog opens. The `dialog` it is given is retried through `lazyWithRetry`'s
 * `retryLoad`, so that the next open starts a new import instead of reusing the rejected one.
 */
export class LazyDialogBoundary extends Component<LazyDialogBoundaryProps, LazyDialogBoundaryState> {
	state: LazyDialogBoundaryState = { error: null, wasOpen: this.props.open };

	static getDerivedStateFromError(error: Error): Partial<LazyDialogBoundaryState> {
		return { error };
	}

	static getDerivedStateFromProps(
		props: LazyDialogBoundaryProps,
		state: LazyDialogBoundaryState
	): Partial<LazyDialogBoundaryState> | null {
		if (props.open === state.wasOpen) return null;
		return { wasOpen: props.open, error: props.open ? null : state.error };
	}

	componentDidCatch(error: Error) {
		this.props.dialog.retryLoad();
		this.props.onError(error);
	}

	render() {
		return this.state.error ? null : this.props.children;
	}
}

export default LazyDialogBoundary;
