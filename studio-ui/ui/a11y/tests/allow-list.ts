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
 * Known accessibility exceptions: the baseline recorded on upstream/develop before the a11y remediation PRs land.
 * A matching finding is still attached to the report but doesn't fail the run.
 *
 * One entry per axe rule per screen; a screen is the name the test scans (see `screens.spec.ts`), so
 * `edit mode tools panel > Search` is its own screen. Entries are deliberately coarse: axe selectors contain
 * generated class names and React ids that change between runs, so they can't be allow-listed reliably.
 *
 * `themes` narrows an entry to one theme, so a fresh failure in the other theme is still caught.
 *
 * `ticket` is `'TBD'` until the owning ticket is filed, then it must become
 * `craftersoftware/craftercms-e#<number>`. `clearedBy` names the a11y PR (1421-1438) whose combined run no longer
 * reports the finding; delete the entry when that PR merges rather than leaving a stale exception.
 */
export type AllowListTicket = 'TBD' | `craftersoftware/craftercms-e#${number}`;

export interface AllowListEntry {
	/** axe rule id, e.g. `color-contrast`. */
	rule: string;
	/** Screens this exception covers (see `screens.spec.ts`). */
	screens: string[];
	/** Themes this exception covers, so a regression in the other theme still fails. Defaults to both. */
	themes?: ('light' | 'dark')[];
	/** Ticket tracking the fix. */
	ticket: AllowListTicket;
	/** Why the exception exists. */
	reason: string;
	/** a11y PR whose combined run no longer reports this finding. Remove the entry once it has merged. */
	clearedBy?: string;
}

const contrast = 'Text or icon colour does not reach 4.5:1, so it fails SC 1.4.3.';
const linkInText = 'An inline link is distinguishable from its surrounding text by colour alone, which fails SC 1.4.1.';
const formLabel = 'A form control has no programmatic label, which fails SC 1.3.1 and 4.1.2.';
const ariaInputName = 'An ARIA input or combobox has no accessible name, which fails SC 4.1.2.';
const ariaProhibited = 'An ARIA attribute sits on an element whose role does not permit it, which fails SC 4.1.2.';
const buttonName = 'An icon-only button has no accessible name, which fails SC 4.1.2.';
const listChildren = 'A list element has children that are not list items, which fails SC 1.3.1.';
const listitemParent = 'A list item is not inside a list, which fails SC 1.3.1.';
const nestedInteractive =
	'An interactive control is nested inside another one, so the inner control cannot be reached cleanly.';
const requiredParent = 'An element with role="option" has no listbox or group parent, which fails SC 1.3.1 and 4.1.2.';
const requiredChildren = 'A listbox has children that are not options, which fails SC 1.3.1 and 4.1.2.';

export const allowList: AllowListEntry[] = [
	// login
	{ rule: 'color-contrast', screens: ['login'], themes: ['light'], ticket: 'TBD', reason: contrast, clearedBy: '1427' },
	// projects
	{
		rule: 'color-contrast',
		screens: ['projects'],
		themes: ['light'],
		ticket: 'TBD',
		reason: contrast,
		clearedBy: '1427'
	},
	{ rule: 'link-in-text-block', screens: ['projects'], themes: ['light'], ticket: 'TBD', reason: linkInText },
	// users
	{ rule: 'color-contrast', screens: ['users'], ticket: 'TBD', reason: contrast },
	{ rule: 'link-in-text-block', screens: ['users'], themes: ['light'], ticket: 'TBD', reason: linkInText },
	// create project
	{
		rule: 'color-contrast',
		screens: ['create project'],
		themes: ['light'],
		ticket: 'TBD',
		reason: contrast,
		clearedBy: '1427'
	},
	{ rule: 'link-in-text-block', screens: ['create project'], themes: ['light'], ticket: 'TBD', reason: linkInText },
	// dashboard
	{ rule: 'aria-input-field-name', screens: ['dashboard'], ticket: 'TBD', reason: ariaInputName },
	{
		rule: 'color-contrast',
		screens: ['dashboard'],
		themes: ['light'],
		ticket: 'TBD',
		reason: contrast,
		clearedBy: '1427'
	},
	{ rule: 'label', screens: ['dashboard'], ticket: 'TBD', reason: formLabel },
	{ rule: 'list', screens: ['dashboard'], ticket: 'TBD', reason: listChildren },
	{ rule: 'nested-interactive', screens: ['dashboard'], ticket: 'TBD', reason: nestedInteractive },
	// site tools
	{
		rule: 'aria-required-children',
		screens: ['site tools'],
		ticket: 'TBD',
		reason: requiredChildren,
		clearedBy: '1423'
	},
	{
		rule: 'color-contrast',
		screens: ['site tools'],
		themes: ['light'],
		ticket: 'TBD',
		reason: contrast,
		clearedBy: '1427'
	},
	{ rule: 'link-in-text-block', screens: ['site tools'], themes: ['light'], ticket: 'TBD', reason: linkInText },
	// search
	{ rule: 'aria-input-field-name', screens: ['search'], ticket: 'TBD', reason: ariaInputName },
	{ rule: 'aria-prohibited-attr', screens: ['search'], ticket: 'TBD', reason: ariaProhibited },
	{ rule: 'color-contrast', screens: ['search'], themes: ['light'], ticket: 'TBD', reason: contrast },
	{ rule: 'label', screens: ['search'], ticket: 'TBD', reason: formLabel },
	// preview
	{ rule: 'button-name', screens: ['preview'], ticket: 'TBD', reason: buttonName },
	{ rule: 'listitem', screens: ['preview'], ticket: 'TBD', reason: listitemParent },
	// tools panel
	{ rule: 'button-name', screens: ['tools panel'], ticket: 'TBD', reason: buttonName },
	{ rule: 'listitem', screens: ['tools panel'], ticket: 'TBD', reason: listitemParent },
	// tools panel > Dashboard
	{ rule: 'aria-input-field-name', screens: ['tools panel > Dashboard'], ticket: 'TBD', reason: ariaInputName },
	{
		rule: 'color-contrast',
		screens: ['tools panel > Dashboard'],
		themes: ['light'],
		ticket: 'TBD',
		reason: contrast,
		clearedBy: '1427'
	},
	{ rule: 'label', screens: ['tools panel > Dashboard'], ticket: 'TBD', reason: formLabel },
	{ rule: 'list', screens: ['tools panel > Dashboard'], ticket: 'TBD', reason: listChildren },
	{ rule: 'nested-interactive', screens: ['tools panel > Dashboard'], ticket: 'TBD', reason: nestedInteractive },
	// edit mode tools panel
	{ rule: 'button-name', screens: ['edit mode tools panel'], ticket: 'TBD', reason: buttonName },
	{ rule: 'listitem', screens: ['edit mode tools panel'], ticket: 'TBD', reason: listitemParent },
	// edit mode tools panel > Audience Targeting
	{
		rule: 'color-contrast',
		screens: ['edit mode tools panel > Audience Targeting'],
		themes: ['light'],
		ticket: 'TBD',
		reason: contrast
	},
	// edit mode tools panel > Create Content
	{
		rule: 'aria-required-parent',
		screens: ['edit mode tools panel > Create Content'],
		ticket: 'TBD',
		reason: requiredParent
	},
	{ rule: 'button-name', screens: ['edit mode tools panel > Create Content'], ticket: 'TBD', reason: buttonName },
	{ rule: 'list', screens: ['edit mode tools panel > Create Content'], ticket: 'TBD', reason: listChildren },
	{
		rule: 'nested-interactive',
		screens: ['edit mode tools panel > Create Content'],
		ticket: 'TBD',
		reason: nestedInteractive
	},
	// edit mode tools panel > Drop Targets
	{ rule: 'listitem', screens: ['edit mode tools panel > Drop Targets'], ticket: 'TBD', reason: listitemParent },
	// edit mode tools panel > Existing Content
	{
		rule: 'aria-input-field-name',
		screens: ['edit mode tools panel > Existing Content'],
		ticket: 'TBD',
		reason: ariaInputName
	},
	{
		rule: 'aria-required-parent',
		screens: ['edit mode tools panel > Existing Content'],
		ticket: 'TBD',
		reason: requiredParent
	},
	{ rule: 'list', screens: ['edit mode tools panel > Existing Content'], ticket: 'TBD', reason: listChildren },
	// edit mode tools panel > Page Explorer
	{
		rule: 'aria-required-children',
		screens: ['edit mode tools panel > Page Explorer'],
		ticket: 'TBD',
		reason: requiredChildren
	},
	{ rule: 'button-name', screens: ['edit mode tools panel > Page Explorer'], ticket: 'TBD', reason: buttonName },
	{
		rule: 'color-contrast',
		screens: ['edit mode tools panel > Page Explorer'],
		themes: ['light'],
		ticket: 'TBD',
		reason: contrast
	},
	// edit mode tools panel > Search
	{ rule: 'aria-required-parent', screens: ['edit mode tools panel > Search'], ticket: 'TBD', reason: requiredParent },
	{ rule: 'list', screens: ['edit mode tools panel > Search'], ticket: 'TBD', reason: listChildren },
	// edit mode tools panel > Settings
	{
		rule: 'aria-prohibited-attr',
		screens: ['edit mode tools panel > Settings'],
		ticket: 'TBD',
		reason: ariaProhibited
	},
	{ rule: 'label', screens: ['edit mode tools panel > Settings'], ticket: 'TBD', reason: formLabel },
	{ rule: 'list', screens: ['edit mode tools panel > Settings'], ticket: 'TBD', reason: listChildren },
	// edit form
	{ rule: 'button-name', screens: ['edit form'], ticket: 'TBD', reason: buttonName },
	{ rule: 'color-contrast', screens: ['edit form'], themes: ['light'], ticket: 'TBD', reason: contrast },
	{ rule: 'label', screens: ['edit form'], ticket: 'TBD', reason: formLabel, clearedBy: '1421' },
	{ rule: 'list', screens: ['edit form'], ticket: 'TBD', reason: listChildren },
	{ rule: 'nested-interactive', screens: ['edit form'], ticket: 'TBD', reason: nestedInteractive },
	// publish dialog
	{ rule: 'color-contrast', screens: ['publish dialog'], ticket: 'TBD', reason: contrast, clearedBy: '1427' }
];

const ticketFormat = /^craftersoftware\/craftercms-e#\d+$/;
allowList.forEach(({ rule, screens, themes, ticket, reason }) => {
	if (!screens?.length) {
		throw new Error(`Allow-list entry for "${rule}" must name at least one screen`);
	}
	if (ticket !== 'TBD' && !ticketFormat.test(ticket)) {
		throw new Error(`Allow-list entry for "${rule}" must reference its ticket, e.g. craftersoftware/craftercms-e#1234`);
	}
	if (!reason) {
		throw new Error(`Allow-list entry for "${rule}" must explain why the exception exists`);
	}
	if (themes && themes.some((theme) => theme !== 'light' && theme !== 'dark')) {
		throw new Error(`Allow-list entry for "${rule}" must name light, dark or both themes`);
	}
});
