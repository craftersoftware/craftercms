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

import { visuallyHidden } from '@mui/utils';
import React, { useEffect, useState } from 'react';

export interface PoliteStatusProps {
	/** Empty string keeps the region mounted without changing its text. */
	message: string;
}

/**
 * Polite status region for counts and progress (WCAG 4.1.3).
 * Clears then writes so a repeated message is still a text change.
 * Same 40ms gap as FormsEngine's FormValidationAnnouncer. This component does not
 * announce invalid-Save field counts; that stays on the form's own region.
 */
export function PoliteStatus(props: PoliteStatusProps) {
	const { message } = props;
	const [announcement, setAnnouncement] = useState('');

	useEffect(() => {
		const text = message.trim();
		// Empty the region, then write. Both updates are deferred so a repeat is a text change.
		let reveal: number | undefined;
		const clear = window.setTimeout(() => {
			setAnnouncement('');
			if (!text) return;
			reveal = window.setTimeout(() => setAnnouncement(text), 40);
		}, 0);
		return () => {
			window.clearTimeout(clear);
			if (reveal !== undefined) window.clearTimeout(reveal);
		};
	}, [message]);

	return (
		<div role="status" aria-live="polite" aria-atomic="true" style={visuallyHidden}>
			{announcement}
		</div>
	);
}

export default PoliteStatus;
