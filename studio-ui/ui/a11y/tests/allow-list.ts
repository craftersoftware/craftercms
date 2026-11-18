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

import recorded from './allow-list.json';
import { captureMode } from './capture';
import { splitFingerprint, stableTokens } from './filter';

export type Theme = 'light' | 'dark';

export interface RuleTicket {
	/** Umbrella ticket that tracks every remaining finding of the rule. */
	ticket: `craftersoftware/craftercms-e#${number}`;
	/** Success criterion the rule maps to. */
	criterion: string;
	/** Screens and themes the ticket lists. An exception outside this scope is rejected at load. */
	scope: Record<string, Theme[]>;
}

/** One reviewed exception: the exact failing nodes of one rule on one screen in one theme. */
export interface AllowListEntry {
	/** axe rule id, e.g. `color-contrast`. */
	rule: string;
	/** Screen key, as passed to `checkA11y` (see `screens.spec.ts`). */
	screen: string;
	theme: Theme;
	/** Fingerprints (see `fingerprint` in `filter.ts`: CSS path plus normalised start tag) of the nodes that are allowed to fail. One per node. */
	nodes: string[];
}

const both: Theme[] = ['light', 'dark'];

/**
 * The umbrella tickets, one per axe rule, and the screens and themes each one lists. They inventory what still fails once
 * the other a11y PRs have merged. A rule that is not here has no ticket, so it can't be allow-listed: it fails the run.
 */
export const ruleTickets: Record<string, RuleTicket> = {
	'aria-prohibited-attr': {
		ticket: 'craftersoftware/craftercms-e#1450',
		criterion: '4.1.2 Name, Role, Value',
		scope: { 'edit mode tools panel > Settings': both }
	},
	label: {
		ticket: 'craftersoftware/craftercms-e#1453',
		criterion: '1.3.1 Info and Relationships; 4.1.2 Name, Role, Value',
		scope: { 'edit mode tools panel > Settings': both }
	},
	list: {
		ticket: 'craftersoftware/craftercms-e#1455',
		criterion: '1.3.1 Info and Relationships',
		scope: { 'edit mode tools panel > Settings': both }
	}
};

/** True when the rule's ticket lists the screen in that theme. */
export function inTicketScope(rule: string, screen: string, theme: Theme, tickets = ruleTickets) {
	return Boolean(tickets[rule]?.scope[screen]?.includes(theme));
}

/**
 * Throws on any entry that is not a reviewed, ticketed, in-scope node list. There is no placeholder ticket.
 * `tickets` defaults to `ruleTickets`. The unit tests pass a fixed table so they don't depend on which tickets are open.
 */
export function validateAllowList(entries: AllowListEntry[], tickets = ruleTickets) {
	const keys = new Set<string>();
	entries.forEach(({ rule, screen, theme, nodes }) => {
		const key = `${rule} on ${theme} ${screen}`;
		if (!tickets[rule]) {
			throw new Error(`Allow-list entry for ${key}: the rule has no umbrella ticket in ruleTickets`);
		}
		if (!inTicketScope(rule, screen, theme, tickets)) {
			throw new Error(`Allow-list entry for ${key}: ${tickets[rule].ticket} does not list that screen and theme`);
		}
		if (!Array.isArray(nodes) || !nodes.length || nodes.some((node) => typeof node !== 'string' || !node)) {
			throw new Error(`Allow-list entry for ${key} must list the fingerprint of every node it allows`);
		}
		const unstable = nodes.filter((node) => !splitFingerprint(node).startTag || !stableTokens(node).length);
		if (unstable.length) {
			throw new Error(
				`Allow-list entry for ${key} has ${unstable.length} fingerprint(s) that name no stable node, so a different node ` +
					`of the rule would match: each needs a normalised start tag (see fingerprint in filter.ts) holding a Mui or ` +
					`authored class, a role, an authored id or a literal attribute value. Give the node one, or fix it.\n` +
					unstable.map((node) => `  ${node}`).join('\n')
			);
		}
		if (keys.has(key)) throw new Error(`Allow-list entry for ${key} is listed twice`);
		keys.add(key);
	});
	return entries;
}

/**
 * The recorded baseline. Each entry names exact nodes, so a new failure of the same rule on the same screen still fails,
 * and an entry whose node no longer fails is reported as stale. `yarn capture` rewrites the file from a live run, and
 * `yarn capture:prune` removes the nodes a fix made stale. A capture loads the file unvalidated, so it can replace one in
 * an older format; `capture-teardown.ts` validates what it writes.
 */
export const allowList: AllowListEntry[] =
	captureMode() === 'capture' ? (recorded as AllowListEntry[]) : validateAllowList(recorded as AllowListEntry[]);
