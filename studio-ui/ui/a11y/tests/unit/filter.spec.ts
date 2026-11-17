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

test.describe('fingerprint normalisation', () => {
	test('React useId ids are normalised in attribute selectors, not only in #id', () => {
		for (const attribute of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'for', 'id']) {
			expect(fingerprint([`button[${attribute}="_r_2g_"]`]), attribute).toBe(`button[${attribute}="*"]`);
			expect(fingerprint([`button[${attribute}="_r_2g_"]`]), attribute).toBe(
				fingerprint([`button[${attribute}="_r_9z_"]`])
			);
		}
	});

	test('older React and MUI generated ids are normalised in attribute selectors', () => {
		expect(fingerprint(['input[id=":r1:"]'])).toBe('input[id="*"]');
		expect(fingerprint(['input[id=":r1a:"]'])).toBe(fingerprint(['input[id=":r2b:"]']));
		expect(fingerprint(['input[id="\\:r1\\:"]'])).toBe('input[id="*"]');
		expect(fingerprint(['label[for=«r1»]'])).toBe('label[for=*]');
		expect(fingerprint(["input[id='mui-42']"])).toBe("input[id='*']");
		expect(fingerprint(['div[aria-controls=_r_1_]'])).toBe('div[aria-controls=*]');
	});

	test('every generated id in a list value is normalised, and ids derived from one keep their suffix out', () => {
		expect(fingerprint(['span[aria-labelledby="_r_1_ _r_2_"]'])).toBe('span[aria-labelledby="* *"]');
		expect(fingerprint(['span[aria-labelledby="_r_1_ authored-title"]'])).toBe(
			'span[aria-labelledby="* authored-title"]'
		);
		expect(fingerprint(['#_r_1_-label'])).toBe('#*');
		expect(fingerprint(['#\\:r1\\:-label'])).toBe('#*');
	});

	test('authored ids and non-id attribute values are kept', () => {
		expect(fingerprint(['input[id="username"]'])).toBe('input[id="username"]');
		expect(fingerprint(['label[for="email"]'])).toBe('label[for="email"]');
		expect(fingerprint(['span[aria-labelledby="dialog-title"]'])).toBe('span[aria-labelledby="dialog-title"]');
		expect(fingerprint(['a[href$="blog"]'])).toBe('a[href$="blog"]');
		expect(fingerprint(['input[id="_r_1_"]'])).not.toBe(fingerprint(['input[name="_r_1_"]']));
		expect(fingerprint(['input[id="_r_1_"]'])).not.toBe(fingerprint(['input[id="username"]']));
	});

	test('emotion and MUI generated classes do not change the fingerprint, Mui component classes do', () => {
		expect(fingerprint(['.mui-1k0n8m7.MuiCardActionArea-root'])).toBe('.mui-*.MuiCardActionArea-root');
		expect(fingerprint(['.mui-ybhk9l.MuiListItemButton-root:nth-child(1) > .mui-o5ytqa.MuiListItemIcon-root'])).toBe(
			fingerprint(['.mui-1vcal46.MuiListItemButton-root:nth-child(1) > .mui-huimn3.MuiListItemIcon-root'])
		);
		expect(fingerprint(['.css-1abc2de.MuiBox-root'])).toBe(fingerprint(['.css-9zz8yy.MuiBox-root']));
		expect(fingerprint(['.PrivateSwitchBase-input.mui-j8yymo'])).toBe('.PrivateSwitchBase-input.mui-*');
		expect(fingerprint(['.MuiTableCell-alignCenter.avatar > .MuiAvatar-root'])).toBe(
			'.MuiTableCell-alignCenter.avatar > .MuiAvatar-root'
		);
	});

	test('nodes that differ in the element path stay distinct once hashes are removed', () => {
		const a = fingerprint(['.mui-ybhk9l.MuiListItemButton-root:nth-child(1) > .MuiCheckbox-root']);
		const b = fingerprint(['.mui-ybhk9l.MuiListItemButton-root:nth-child(2) > .MuiCheckbox-root']);
		const c = fingerprint(['.mui-ybhk9l.MuiListItemButton-root:nth-child(1) > .MuiSwitch-root']);
		expect(new Set([a, b, c]).size).toBe(3);
	});

	test('an allow-listed node still matches when only its generated ids and classes change', () => {
		const recorded: AllowListEntry = {
			rule: 'label-content-name-mismatch',
			screen: 'create project',
			theme: 'light',
			nodes: [fingerprint(['.mui-1k0n8m7.MuiCardActionArea-root[aria-labelledby="_r_2o_"]'])]
		};
		const next = blockingFindings([
			violation('label-content-name-mismatch', ['.mui-zz9y8x.MuiCardActionArea-root[aria-labelledby="_r_3c_"]'])
		]);
		const { allowed, blocking, stale } = applyAllowList(next, [recorded], 'create project', 'light');
		expect([allowed.length, blocking.length, stale.length]).toEqual([1, 0, 0]);
	});
});

test.describe('allow-list validation', () => {
	test('accepts a ticketed, in-scope node list', () => {
		expect(validateAllowList([entry])).toEqual([entry]);
	});

	test('lists the tools panel Dashboard and the edit mode Existing Content and Settings pages under their tickets', () => {
		const node = ['x'];
		const scoped = [
			...['aria-input-field-name', 'label', 'list', 'nested-interactive'].map((rule) => ({
				rule,
				screen: 'tools panel > Dashboard'
			})),
			{ rule: 'aria-input-field-name', screen: 'edit mode tools panel > Existing Content' },
			...['aria-prohibited-attr', 'label', 'list'].map((rule) => ({ rule, screen: 'edit mode tools panel > Settings' }))
		];
		for (const theme of ['light', 'dark'] as const) {
			const entries = scoped.map((scope) => ({ ...scope, theme, nodes: node }));
			expect(validateAllowList(entries)).toHaveLength(scoped.length);
		}
		expect(() =>
			validateAllowList([
				{ rule: 'nested-interactive', screen: 'edit mode tools panel > Settings', theme: 'light', nodes: node }
			])
		).toThrow(/does not list/);
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
