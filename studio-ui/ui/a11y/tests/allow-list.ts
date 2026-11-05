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

/**
 * Known accessibility exceptions. A matching axe violation is still attached to the report but doesn't fail the run.
 * Every entry must link to the ticket that tracks the fix, and be removed once that ticket is resolved.
 */
export interface AllowListEntry {
	/** axe rule id, e.g. `color-contrast`. */
	rule: string;
	/** Ticket tracking the fix, e.g. `craftersoftware/craftercms-e#1234`. */
	ticket: string;
	/** Why the exception exists. */
	reason: string;
	/** Limit the exception to these screens (see `screens.spec.ts`). Defaults to every screen. */
	screens?: string[];
	/** Limit the exception to elements whose axe selector contains this text. Defaults to every element. */
	selector?: string;
}

export const allowList: AllowListEntry[] = [];

const ticketFormat = /^craftersoftware\/craftercms(-e)?#\d+$/;
allowList.forEach(({ rule, ticket }) => {
	if (!ticketFormat.test(ticket)) {
		throw new Error(`Allow-list entry for "${rule}" must reference its ticket, e.g. craftersoftware/craftercms-e#1234`);
	}
});
