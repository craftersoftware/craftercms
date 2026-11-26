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

import { useState } from 'react';

/**
 * Tells whether a dialog (or similar overlay) has been opened at least once. Use it to mount a lazily loaded dialog
 * only from the first time it opens, and keep it mounted afterwards so its close transition and state are preserved.
 * @param open Whether the dialog is currently open.
 */
export function useOpenedOnce(open: boolean): boolean {
	const [openedOnce, setOpenedOnce] = useState(open);
	if (open && !openedOnce) {
		setOpenedOnce(true);
	}
	return openedOnce || open;
}

export default useOpenedOnce;
