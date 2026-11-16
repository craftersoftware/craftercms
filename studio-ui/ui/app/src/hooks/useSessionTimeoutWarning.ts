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

import { useCallback, useEffect, useState } from 'react';

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
	// The time is state, refreshed by the interval, so the warning is derived while rendering
	const [now, setNow] = useState(Date.now);
	// The session expiry of the warning that was dismissed. A dismissal only lasts for that warning, so an extended
	// session (a new expiry) brings a new one. Ticking of the countdown does not clear it, which would reopen the final
	// warning right after it was closed.
	const [dismissedFor, setDismissedFor] = useState<number>(null);
	const hasExpiry = active && sessionExpiresAt != null;

	useEffect(() => {
		if (hasExpiry) {
			const interval = setInterval(() => setNow(Date.now()), 1000);
			return () => clearInterval(interval);
		}
	}, [hasExpiry]);

	const remaining = hasExpiry ? sessionExpiresAt - now : Infinity;
	const dismiss = useCallback(() => setDismissedFor(sessionExpiresAt), [sessionExpiresAt]);

	return {
		visible: remaining <= warningLeadTimeMs && dismissedFor !== sessionExpiresAt,
		secondsLeft: hasExpiry ? Math.max(0, Math.ceil(remaining / 1000)) : 0,
		dismiss
	};
}
