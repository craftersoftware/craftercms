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
 * Identifies a node by axe's CSS path to it, minus the tokens that change without the markup changing: emotion class
 * hashes (`css-1x2y3z`), the hash in tss-react classes (`tss-1x2y3z-root` keeps `-root`) and React/MUI generated ids
 * (`:r1:`, `«r1»`, `_r_1_`, `mui-12`). What remains is the element path, MUI component classes and authored ids.
 */
export function fingerprint(target: NodeResult['target']): string {
	return target
		.map((part) => (Array.isArray(part) ? part.join(' >>> ') : part))
		.join(' >>> ')
		.replace(/\.css-[a-z0-9]+/g, '.css-*')
		.replace(/\.tss-[a-z0-9]+-/g, '.tss-*-')
		.replace(/#(?:\\:r[a-z0-9]+\\:|«r[a-z0-9]+»|_r_[a-z0-9]+_|mui-\d+)[\w-]*/g, '#*')
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
