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

import type { NodeResult, Result } from 'axe-core';
import type { AllowListEntry, Theme } from './allow-list';

export const BLOCKING_IMPACTS = ['serious', 'critical'];

/** One failing node of one axe rule. */
export interface Finding {
	rule: string;
	impact: string;
	help: string;
	fingerprint: string;
	html: string;
}

/** An allow-listed node that did not fail on this scan. */
export interface StaleNode {
	rule: string;
	fingerprint: string;
}

/**
 * A React `useId` or MUI generated id: `:r1:` (React 18, CSS-escaped as `\:r1\:` in an id selector), `«r1»`, `_r_1_`
 * (React 19) and `mui-12`.
 */
const GENERATED_ID = String.raw`(?:\\?:r[a-z0-9]+\\?:|«r[a-z0-9]+»|_r_[a-z0-9]+_|mui-\d+)`;

/** An id selector (`#_r_1_`, `#_r_1_-label`): the token and whatever suffix is derived from it. */
const ID_SELECTOR = new RegExp(`#${GENERATED_ID}[\\w-]*`, 'g');

/** An attribute selector (`[aria-labelledby="_r_1_ _r_2_"]`, `[for=:r1:]`, `[id='_r_1_']`) and its value. */
const ATTRIBUTE_SELECTOR = /\[([^\]=\s]+)\s*([~|^$*]?=)\s*(["']?)([^\]]*?)\3\s*\]/g;

/** Attributes whose value is an id or a list of ids; other values (`href`, `aria-label`, `data-*`) are kept. */
const ID_REFERENCE_ATTRIBUTES = new Set([
	'id',
	'for',
	'form',
	'headers',
	'list',
	'aria-activedescendant',
	'aria-controls',
	'aria-describedby',
	'aria-details',
	'aria-errormessage',
	'aria-flowto',
	'aria-labelledby',
	'aria-owns'
]);

/** A generated id as a whole token of an id reference value, which may hold several space separated ids. */
const GENERATED_ID_IN_VALUE = new RegExp(`(?<!\\S)${GENERATED_ID}[\\w-]*(?!\\S)`, 'g');

/**
 * Identifies a node by axe's CSS path to it, minus the tokens that change without the markup changing: emotion and MUI
 * class hashes (`.css-1x2y3z`, `.mui-1x2y3z`), the hash in tss-react classes (`tss-1x2y3z-root` keeps `-root`) and
 * React/MUI generated ids, in id selectors and as whole tokens of id reference attributes (`aria-labelledby`,
 * `aria-controls`, `for`, `id` and so on). What remains is the element path, the stable `Mui*` component classes and authored ids.
 */
export function fingerprint(target: NodeResult['target']): string {
	return target
		.map((part) => (Array.isArray(part) ? part.join(' >>> ') : part))
		.join(' >>> ')
		.replace(ID_SELECTOR, '#*')
		.replace(ATTRIBUTE_SELECTOR, (match, name, operator, quote, value) =>
			ID_REFERENCE_ATTRIBUTES.has(name)
				? `[${name}${operator}${quote}${value.replace(GENERATED_ID_IN_VALUE, '*')}${quote}]`
				: match
		)
		.replace(/\.css-[a-z0-9]+/g, '.css-*')
		.replace(/\.mui-[a-z0-9]+/g, '.mui-*')
		.replace(/\.tss-[a-z0-9]+-/g, '.tss-*-')
		.trim();
}

/** Serious and critical nodes of the scan, each as its own finding. */
export function blockingFindings(violations: Result[]): Finding[] {
	return violations.flatMap((violation) =>
		violation.nodes
			.filter((node) => BLOCKING_IMPACTS.includes(node.impact ?? violation.impact ?? ''))
			.map((node) => ({
				rule: violation.id,
				impact: node.impact ?? violation.impact ?? '',
				help: violation.help,
				fingerprint: fingerprint(node.target),
				html: node.html
			}))
	);
}

/**
 * Splits a scan's findings into allowed and blocking, node by node. A node is allowed only when an entry for the same
 * rule, screen and theme lists its fingerprint; each listed fingerprint allows one node, so a second node that happens to
 * share it still fails. Listed fingerprints that matched nothing are returned as stale: the node is fixed or changed,
 * and the entry has to be removed or recaptured.
 */
export function applyAllowList(findings: Finding[], entries: AllowListEntry[], screen: string, theme: Theme) {
	const pools = new Map<string, string[]>();
	entries
		.filter((entry) => entry.screen === screen && entry.theme === theme)
		.forEach((entry) => pools.set(entry.rule, [...(pools.get(entry.rule) ?? []), ...entry.nodes]));
	const allowed: Finding[] = [];
	const blocking: Finding[] = [];
	findings.forEach((finding) => {
		const pool = pools.get(finding.rule);
		const index = pool ? pool.indexOf(finding.fingerprint) : -1;
		if (index >= 0) {
			pool!.splice(index, 1);
			allowed.push(finding);
		} else {
			blocking.push(finding);
		}
	});
	const stale: StaleNode[] = [...pools].flatMap(([rule, nodes]) => nodes.map((fingerprint) => ({ rule, fingerprint })));
	return { allowed, blocking, stale };
}
