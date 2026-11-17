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

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AllowListEntry, allowList, ruleTickets, validateAllowList } from './allow-list';
import { CAPTURE_FILE_PREFIX } from './axe';
import { CapturedScan, captureMode, latestScans, pruneEntries } from './capture';

const artifacts = join(__dirname, '..', 'report', 'artifacts');
const target = join(__dirname, 'allow-list.json');

/**
 * With `A11Y_CAPTURE=1`, rewrites `allow-list.json` from the scans of this run: every serious or critical node whose rule
 * ticket lists the screen and theme becomes an exception. Entries for screens this run did not scan are kept. Nodes no
 * ticket covers are never recorded; they are listed in `report/capture-summary.md` so someone can ticket or fix them.
 * Review the resulting diff before committing it: it records whatever fails at capture time.
 *
 * With `A11Y_CAPTURE=prune`, only removes: the allowed nodes of the scanned screens that no longer fail go, and nothing
 * is added (`pruneEntries`). This is what a fix PR records.
 *
 * Either way the result is validated before it is written (`validateAllowList`), so a node with no stable fingerprint
 * fails the run with its name instead of leaving a file the next run can't load.
 */
export default async function captureTeardown() {
	const mode = captureMode();
	if (!mode || !existsSync(artifacts)) return;
	// A retry's output lives in a `...-retry1/` directory next to the first attempt's; `latestScans` keeps the highest.
	const scans = latestScans(
		(readdirSync(artifacts, { recursive: true }) as string[])
			.filter((file) => file.split(/[\\/]/).pop()!.startsWith(CAPTURE_FILE_PREFIX))
			.sort()
			.map((file) => JSON.parse(readFileSync(join(artifacts, file), 'utf8')) as CapturedScan)
	);
	if (mode === 'prune') return prune(scans);
	const entries: AllowListEntry[] = allowList.filter((entry) => !scans.has(`${entry.theme} ${entry.screen}`));
	const summary: string[] = ['| Rule | Ticket | Screen | Theme | Nodes |', '| --- | --- | --- | --- | --- |'];
	const unticketed: string[] = [];
	scans.forEach(({ screen, theme, nodes, unticketed: other }) => {
		const byRule = new Map<string, string[]>();
		nodes.forEach(({ rule, fingerprint }) => byRule.set(rule, [...(byRule.get(rule) ?? []), fingerprint]));
		byRule.forEach((fingerprints, rule) => {
			entries.push({ rule, screen, theme, nodes: fingerprints.sort() });
			summary.push(`| ${rule} | ${ruleTickets[rule].ticket} | ${screen} | ${theme} | ${fingerprints.length} |`);
		});
		other.forEach(({ rule, fingerprint }) => unticketed.push(`- ${rule} on ${theme} ${screen}: \`${fingerprint}\``));
	});
	entries.sort(byScreen);
	validateAllowList(entries);
	writeFileSync(target, `${JSON.stringify(entries, null, '\t')}\n`);
	writeFileSync(
		join(artifacts, '..', 'capture-summary.md'),
		`# Captured allow-list\n\nScans: ${scans.size}\n\n${summary.join('\n')}\n\n## Not covered by a ticket\n\n${
			unticketed.join('\n') || 'None.'
		}\n`
	);
	console.log(`Recorded ${entries.length} allow-list entries in ${target}; see report/capture-summary.md`);
}

const byScreen = (a: AllowListEntry, b: AllowListEntry) =>
	`${a.screen} ${a.theme} ${a.rule}`.localeCompare(`${b.screen} ${b.theme} ${b.rule}`);

function prune(scans: ReturnType<typeof latestScans>) {
	const { entries, removed } = pruneEntries(allowList, scans);
	entries.sort(byScreen);
	validateAllowList(entries);
	writeFileSync(target, `${JSON.stringify(entries, null, '\t')}\n`);
	const count = removed.reduce((total, { nodes }) => total + nodes.length, 0);
	writeFileSync(
		join(artifacts, '..', 'capture-summary.md'),
		`# Pruned allow-list\n\nScans: ${scans.size}\n\nRemoved ${count} node(s); nothing was added.\n\n${
			removed
				.map(
					({ rule, screen, theme, nodes }) =>
						`- ${rule} on ${theme} ${screen}: ${nodes.length} node(s)\n${nodes.map((n) => `  - \`${n}\``).join('\n')}`
				)
				.join('\n') || 'None.'
		}\n`
	);
	console.log(`Pruned ${count} node(s) from ${removed.length} allow-list entries; see report/capture-summary.md`);
}
