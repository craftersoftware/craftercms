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

import { useCallback, useEffect, useRef, useState } from 'react';

export interface SessionTimeoutWarningState {
	/** Whether the warning should be shown. */
	visible: boolean;
	/** Seconds left before the session expires. */
	secondsLeft: number;
	/** Dismisses the current warning, which stays dismissed until the next one. */
	dismiss: () => void;
}

/**
 * Watches the clock until the session is about to expire (WCAG 2.1 SC 2.2.1 Timing Adjustable).
 *
 * Watches the clock rather than waiting for `sessionExpiresAt` to change, because the worker refreshes the token when
 * the warning is due and that refresh may report the same expiry.
 *
 * @param active whether the user has a session
 * @param sessionExpiresAt the earliest moment at which the session may expire, null if there is nothing to warn about
 * @param warningLeadTimeMs how long before the expiry the warning starts
 */
export function useSessionTimeoutWarning(
	active: boolean,
	sessionExpiresAt: number,
	warningLeadTimeMs: number
): SessionTimeoutWarningState {
	const [visible, setVisible] = useState(false);
	const [secondsLeft, setSecondsLeft] = useState(0);
	const [dismissed, setDismissed] = useState(false);
	// Whether the last tick was already inside the warning window, so a dismissal only lasts for the current warning
	const wasWarned = useRef(false);

	useEffect(() => {
		if (!active || sessionExpiresAt == null) {
			setVisible(false);
			return;
		}
		wasWarned.current = false;
		const update = () => {
			const remaining = sessionExpiresAt - Date.now();
			const shouldWarn = remaining <= warningLeadTimeMs;
			setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
			// A new warning (this one starting, or a new session expiry) is not dismissed. Clearing the dismissal on
			// every tick would reopen the final warning right after it was closed.
			if (shouldWarn && !wasWarned.current) {
				setDismissed(false);
			}
			wasWarned.current = shouldWarn;
			setVisible(shouldWarn);
		};
		update();
		const interval = setInterval(update, 1000);
		return () => clearInterval(interval);
	}, [active, sessionExpiresAt, warningLeadTimeMs]);

	const dismiss = useCallback(() => setDismissed(true), []);

	return { visible: visible && !dismissed, secondsLeft, dismiss };
}
