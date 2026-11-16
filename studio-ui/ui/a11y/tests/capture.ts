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

import type { Theme } from './allow-list';
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
