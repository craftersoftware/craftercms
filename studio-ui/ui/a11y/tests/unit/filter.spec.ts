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

import { expect, test } from '@playwright/test';
import type { Result } from 'axe-core';
import { AllowListEntry, validateAllowList } from '../allow-list';
import { applyAllowList, blockingFindings, fingerprint } from '../filter';

/** A minimal axe violation with one node per target. */
function violation(id: string, targets: string[], impact: Result['impact'] = 'serious'): Result {
	return {
		id,
		impact,
		help: `${id} help`,
		nodes: targets.map((target) => ({ target: [target], html: `<x data-t="${target}">`, impact }))
	} as unknown as Result;
}

const knownNode = '.MuiTypography-root.css-1x2y3z > a';
const entry: AllowListEntry = {
	rule: 'color-contrast',
	screen: 'users',
	theme: 'light',
	nodes: [fingerprint([knownNode])]
};

test.describe('allow-list filter', () => {
	test('a second, unrelated failure of the same rule on the same screen and theme still fails', () => {
		const findings = blockingFindings([violation('color-contrast', [knownNode, '#users-grid .MuiChip-label'])]);
		const { allowed, blocking, stale } = applyAllowList(findings, [entry], 'users', 'light');
		expect(allowed.map((f) => f.fingerprint)).toEqual([fingerprint([knownNode])]);
		expect(blocking.map((f) => f.fingerprint)).toEqual(['#users-grid .MuiChip-label']);
		expect(stale).toEqual([]);
	});

	test('each fingerprint allows one node, so a duplicate of the known node fails', () => {
		const findings = blockingFindings([violation('color-contrast', [knownNode, knownNode])]);
		const { allowed, blocking } = applyAllowList(findings, [entry], 'users', 'light');
		expect(allowed).toHaveLength(1);
		expect(blocking).toHaveLength(1);
	});

	test('an entry only applies to its own screen and theme', () => {
		const findings = blockingFindings([violation('color-contrast', [knownNode])]);
		expect(applyAllowList(findings, [entry], 'users', 'dark').blocking).toHaveLength(1);
		expect(applyAllowList(findings, [entry], 'projects', 'light').blocking).toHaveLength(1);
		expect(
			applyAllowList(blockingFindings([violation('label', [knownNode])]), [entry], 'users', 'light').blocking
		).toHaveLength(1);
	});

	test('an allowed node that no longer fails is reported as stale', () => {
		const { allowed, blocking, stale } = applyAllowList([], [entry], 'users', 'light');
		expect(allowed).toEqual([]);
		expect(blocking).toEqual([]);
		expect(stale).toEqual([{ rule: 'color-contrast', fingerprint: entry.nodes[0] }]);
	});

	test('moderate and minor nodes are not blocking', () => {
		expect(blockingFindings([violation('region', ['main'], 'moderate')])).toEqual([]);
	});

	test('fingerprints ignore generated class hashes and ids, not the element path', () => {
		expect(fingerprint(['.MuiButton-root.css-1abc2de > span'])).toBe(
			fingerprint(['.MuiButton-root.css-9zz8yy > span'])
		);
		expect(fingerprint(['.tss-1a2b3c-root > li'])).toBe('.tss-*-root > li');
		expect(fingerprint(['#\\:r1a\\:-label'])).toBe('#*');
		expect(fingerprint(['#_r_7_'])).toBe('#*');
		expect(fingerprint(['#mui-42'])).toBe('#*');
		expect(fingerprint(['#username'])).toBe('#username');
		expect(fingerprint(['li:nth-child(2) > a'])).not.toBe(fingerprint(['li:nth-child(3) > a']));
	});
});

test.describe('allow-list validation', () => {
	test('accepts a ticketed, in-scope node list', () => {
		expect(validateAllowList([entry])).toEqual([entry]);
	});

	test('rejects a rule with no umbrella ticket', () => {
		expect(() => validateAllowList([{ ...entry, rule: 'aria-required-parent' }])).toThrow(/no umbrella ticket/);
	});

	test('rejects a screen or theme the ticket does not list', () => {
		expect(() => validateAllowList([{ ...entry, screen: 'login' }])).toThrow(/does not list/);
		expect(() => validateAllowList([{ ...entry, rule: 'link-in-text-block', theme: 'dark' }])).toThrow(/does not list/);
	});

	test('rejects an entry without nodes, and duplicates', () => {
		expect(() => validateAllowList([{ ...entry, nodes: [] }])).toThrow(/fingerprint of every node/);
		expect(() => validateAllowList([entry, entry])).toThrow(/listed twice/);
	});
});
