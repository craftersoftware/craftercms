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
	/** Fingerprints (see `fingerprint` in `filter.ts`) of the nodes that are allowed to fail. One per node. */
	nodes: string[];
}

const both: Theme[] = ['light', 'dark'];
const light: Theme[] = ['light'];

const editModePages = [
	'Search',
	'Create Content',
	'Existing Content',
	'Drop Targets',
	'Assets',
	'Audience Targeting',
	'Page Explorer',
	'Device Simulator',
	'Settings'
];

/**
 * The umbrella tickets, one per axe rule, and the screens and themes each one lists. They inventory what still fails once
 * the other a11y PRs have merged. A rule that is not here has no ticket, so it can't be allow-listed: it fails the run.
 */
export const ruleTickets: Record<string, RuleTicket> = {
	'aria-input-field-name': {
		ticket: 'craftersoftware/craftercms-e#1449',
		criterion: '4.1.2 Name, Role, Value',
		scope: { dashboard: both, search: both }
	},
	'aria-prohibited-attr': {
		ticket: 'craftersoftware/craftercms-e#1450',
		criterion: '4.1.2 Name, Role, Value',
		scope: { search: both }
	},
	'button-name': {
		ticket: 'craftersoftware/craftercms-e#1451',
		criterion: '4.1.2 Name, Role, Value',
		scope: { 'edit form': both, preview: light }
	},
	'color-contrast': {
		ticket: 'craftersoftware/craftercms-e#1452',
		criterion: '1.4.3 Contrast (Minimum)',
		scope: { users: both, 'edit form': light }
	},
	label: {
		ticket: 'craftersoftware/craftercms-e#1453',
		criterion: '1.3.1 Info and Relationships; 4.1.2 Name, Role, Value',
		scope: { dashboard: both, search: both }
	},
	'link-in-text-block': {
		ticket: 'craftersoftware/craftercms-e#1454',
		criterion: '1.4.1 Use of Color',
		scope: { 'create project': light, projects: light, 'site tools': light, users: light }
	},
	list: {
		ticket: 'craftersoftware/craftercms-e#1455',
		criterion: '1.3.1 Info and Relationships',
		scope: { dashboard: both, 'edit form': both }
	},
	listitem: {
		ticket: 'craftersoftware/craftercms-e#1456',
		criterion: '1.3.1 Info and Relationships',
		scope: {
			preview: both,
			'tools panel': both,
			'edit mode tools panel': both,
			...Object.fromEntries(editModePages.map((page) => [`edit mode tools panel > ${page}`, both]))
		}
	},
	'nested-interactive': {
		ticket: 'craftersoftware/craftercms-e#1457',
		criterion: '2.1.1 Keyboard',
		scope: { dashboard: both, 'edit form': both }
	},
	'label-content-name-mismatch': {
		ticket: 'craftersoftware/craftercms-e#1458',
		criterion: '2.5.3 Label in Name',
		scope: { 'create project': both }
	}
};

/** True when the rule's ticket lists the screen in that theme. */
export function inTicketScope(rule: string, screen: string, theme: Theme) {
	return Boolean(ruleTickets[rule]?.scope[screen]?.includes(theme));
}

/** Throws on any entry that is not a reviewed, ticketed, in-scope node list. There is no placeholder ticket. */
export function validateAllowList(entries: AllowListEntry[]) {
	const keys = new Set<string>();
	entries.forEach(({ rule, screen, theme, nodes }) => {
		const key = `${rule} on ${theme} ${screen}`;
		if (!ruleTickets[rule]) {
			throw new Error(`Allow-list entry for ${key}: the rule has no umbrella ticket in ruleTickets`);
		}
		if (!inTicketScope(rule, screen, theme)) {
			throw new Error(`Allow-list entry for ${key}: ${ruleTickets[rule].ticket} does not list that screen and theme`);
		}
		if (!Array.isArray(nodes) || !nodes.length || nodes.some((node) => typeof node !== 'string' || !node)) {
			throw new Error(`Allow-list entry for ${key} must list the fingerprint of every node it allows`);
		}
		if (keys.has(key)) throw new Error(`Allow-list entry for ${key} is listed twice`);
		keys.add(key);
	});
	return entries;
}

/**
 * The recorded baseline. Each entry names exact nodes, so a new failure of the same rule on the same screen still fails,
 * and an entry whose node no longer fails is reported as stale. `yarn capture` rewrites the file from a live run.
 */
export const allowList: AllowListEntry[] = validateAllowList(recorded as AllowListEntry[]);
