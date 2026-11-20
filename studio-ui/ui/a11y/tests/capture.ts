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

import type { AllowListEntry, Theme } from './allow-list';
import type { Finding } from './filter';

/** Written by `checkA11y` with `A11Y_CAPTURE=1`, one per scan and attempt. */
export interface CapturedScan {
	screen: string;
	theme: Theme;
	/** Playwright's retry index of the attempt that wrote this record: 0 for the first attempt. Absent in older files. */
	retry?: number;
	nodes: Finding[];
	unticketed: Finding[];
}

/**
 * One scan per screen and theme: the one from the highest retry, since a retry only runs after the previous attempt
 * failed. Among scans of the same retry, the later one in the input wins. The attempt is read from the record, not from
 * the file's path: `x-light-retry1/...` sorts before `x-light/...` ('-' < '/'), so path order would keep the failed
 * first attempt.
 */
export function latestScans(scans: CapturedScan[]) {
	const latest = new Map<string, CapturedScan>();
	scans.forEach((scan) => {
		const key = `${scan.theme} ${scan.screen}`;
		const current = latest.get(key);
		if (!current || (scan.retry ?? 0) >= (current.retry ?? 0)) latest.set(key, scan);
	});
	return latest;
}

/**
 * What `A11Y_CAPTURE` asks for: `prune` removes the allow-list nodes the run no longer finds and records nothing new; any
 * other value records the run (the baseline is rewritten from it). Unset or empty is a normal run.
 */
export type CaptureMode = 'capture' | 'prune';

export function captureMode(value = process.env.A11Y_CAPTURE): CaptureMode | null {
	if (!value) return null;
	return value.trim().toLowerCase() === 'prune' ? 'prune' : 'capture';
}

/** What a prune removed: the entries it dropped and the nodes it took out of entries that stay. */
export interface Pruned {
	rule: string;
	screen: string;
	theme: Theme;
	nodes: string[];
}

/**
 * The allow-list minus the nodes that were fixed: for every screen and theme the run scanned, each allowed fingerprint
 * that no failing node of its rule matched is removed (one node per fingerprint, as `applyAllowList` matches), and an
 * entry left with no nodes goes. Nothing is added: a node that fails and is not listed stays a blocking failure, and
 * entries for screens the run did not scan are kept as they are. Use it in a fix PR, where the failures the PR fixed are
 * the only change to record.
 */
export function pruneEntries(entries: AllowListEntry[], scans: Map<string, CapturedScan>) {
	const kept: AllowListEntry[] = [];
	const removed: Pruned[] = [];
	entries.forEach((entry) => {
		const scan = scans.get(`${entry.theme} ${entry.screen}`);
		if (!scan) return void kept.push(entry);
		// Every failing node of the rule on this screen, in any ticket scope, so a prune can't drop a node still failing.
		const failing = [...scan.nodes, ...scan.unticketed]
			.filter((node) => node.rule === entry.rule)
			.map((node) => node.fingerprint);
		const nodes: string[] = [];
		const gone: string[] = [];
		entry.nodes.forEach((node) => {
			const index = failing.indexOf(node);
			if (index >= 0) {
				failing.splice(index, 1);
				nodes.push(node);
			} else {
				gone.push(node);
			}
		});
		if (gone.length) removed.push({ rule: entry.rule, screen: entry.screen, theme: entry.theme, nodes: gone });
		if (nodes.length) kept.push({ ...entry, nodes });
	});
	return { entries: kept, removed };
}
