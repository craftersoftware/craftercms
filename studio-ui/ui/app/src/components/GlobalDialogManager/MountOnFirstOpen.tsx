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

import React, { ReactNode, Suspense, useState } from 'react';

export interface MountOnFirstOpenProps {
	open: boolean;
	children: ReactNode;
}

/**
 * Renders its children (usually a `lazy()` dialog) only once `open` has been `true` at least once. Rendering a lazy
 * component is what triggers the download of its chunk, even if the dialog is closed, so dialogs that are always present
 * in the tree but closed most of the time should be hosted by this component.
 *
 * Once opened, children remain mounted. This is on purpose: it lets the dialog play its exit transition, call `onClosed`
 * and keep the state it had before (the same as when it was always mounted). Each host has its own `Suspense` boundary so
 * the first load of the chunk doesn't hide any sibling that is already on screen.
 **/
export function MountOnFirstOpen(props: MountOnFirstOpenProps) {
	const { open, children } = props;
	const [hasBeenOpen, setHasBeenOpen] = useState(Boolean(open));
	if (open && !hasBeenOpen) {
		setHasBeenOpen(true);
	}
	return open || hasBeenOpen ? <Suspense fallback="">{children}</Suspense> : null;
}

export default MountOnFirstOpen;
