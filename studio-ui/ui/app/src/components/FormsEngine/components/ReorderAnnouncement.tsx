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

import Box from '@mui/material/Box';
import visuallyHidden from '@mui/utils/visuallyHidden';

/**
 * Polite live region for the `announcement` from useReorderFocus ("Moved Alpha to position 2 of 3").
 * Render it outside the list and keep it mounted, so the change is what gets read.
 */
export function ReorderAnnouncement({ message }: { message: string }) {
	return (
		<Box component="span" aria-live="polite" sx={visuallyHidden}>
			{message}
		</Box>
	);
}

export default ReorderAnnouncement;
