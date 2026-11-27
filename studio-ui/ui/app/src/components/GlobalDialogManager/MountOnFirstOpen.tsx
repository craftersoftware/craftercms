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

import React, { ReactNode, Suspense } from 'react';
import { FormattedMessage } from 'react-intl';
import { useOpenedOnce } from '../../hooks/useOpenedOnce';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import LoadFailureBoundary from '../ErrorBoundary/LoadFailureBoundary';
import AlertDialog from '../AlertDialog';
import PrimaryButton from '../PrimaryButton';

export interface MountOnFirstOpenProps {
	open: boolean;
	children: ReactNode;
	/** Closes the dialog. Used by the message shown when the dialog's code fails to load. */
	onClose?(): void;
	/** Called once the message shown when the dialog's code fails to load is gone, in place of the dialog's own `onClosed`. */
	onClosed?(): void;
}

/**
 * Renders its children (usually a `lazy()` dialog) only once `open` has been `true` at least once. Rendering a lazy
 * component is what triggers the download of its chunk, even if the dialog is closed, so dialogs that are always present
 * in the tree but closed most of the time should be hosted by this component.
 *
 * Once opened, children remain mounted. This is on purpose: it lets the dialog play its exit transition, call `onClosed`
 * and keep the state it had before (the same as when it was always mounted). Each host has its own `Suspense` boundary so
 * the first load of the chunk doesn't hide any sibling that is already on screen.
 *
 * If the children throw while loading (e.g. the chunk request fails), the failure stays here: a message is shown in
 * place of the dialog, and the next time `open` becomes `true` the load is attempted again. For that retry to request
 * the chunk anew, declare the lazy dialog with `lazyWithRetry` instead of `lazy`.
 **/
export function MountOnFirstOpen(props: MountOnFirstOpenProps) {
	const { open, children, onClose, onClosed } = props;
	const mounted = useOpenedOnce(open);
	const openRef = useUpdateRefs(open);
	const onClosedRef = useUpdateRefs(onClosed);
	// The message is also removed, without having been closed by the user, when the dialog opens again and retries the
	// load. In that case the dialog is open again, so its `onClosed` (which resets its state) must not run.
	const onMessageClosed = () => {
		if (!openRef.current) onClosedRef.current?.();
	};
	return mounted ? (
		<LoadFailureBoundary
			retryWhen={open}
			fallback={<LoadFailedDialog open={open} onClose={onClose} onClosed={onMessageClosed} />}
		>
			<Suspense fallback="">{children}</Suspense>
		</LoadFailureBoundary>
	) : null;
}

function LoadFailedDialog(props: { open: boolean; onClose?(): void; onClosed?(): void }) {
	const { open, onClose, onClosed } = props;
	return (
		<AlertDialog
			open={open}
			onClose={() => onClose?.()}
			onClosed={onClosed}
			body={<FormattedMessage defaultMessage="This dialog could not be loaded. Check your connection and try again." />}
			buttons={
				<PrimaryButton fullWidth onClick={() => onClose?.()}>
					<FormattedMessage defaultMessage="Close" />
				</PrimaryButton>
			}
		/>
	);
}

export default MountOnFirstOpen;
