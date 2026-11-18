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
import { AllowListEntry, RuleTicket, validateAllowList } from '../allow-list';
import { applyAllowList, blockingFindings, fingerprint, splitFingerprint, stableTokens, startTag } from '../filter';

/** A minimal axe violation with one node per target. */
function violation(
	id: string,
	targets: string[],
	impact: Result['impact'] = 'serious',
	html = '<a class="mui-1abc MuiLink-root" href="/x">'
): Result {
	return {
		id,
		impact,
		help: `${id} help`,
		nodes: targets.map((target) => ({ target: [target], html, impact }))
	} as unknown as Result;
}

const knownNode = '.MuiTypography-root.css-1x2y3z > a';
const knownHtml = '<a class="mui-1abc MuiLink-root" href="/x">';
const known = fingerprint([knownNode], knownHtml);
const entry: AllowListEntry = {
	rule: 'color-contrast',
	screen: 'users',
	theme: 'light',
	nodes: [known]
};

test.describe('allow-list filter', () => {
	test('a second, unrelated failure of the same rule on the same screen and theme still fails', () => {
		const findings = blockingFindings([violation('color-contrast', [knownNode, '#users-grid .MuiChip-label'])]);
		const { allowed, blocking, stale } = applyAllowList(findings, [entry], 'users', 'light');
		expect(allowed.map((f) => f.fingerprint)).toEqual([known]);
		expect(blocking.map((f) => f.fingerprint)).toEqual([fingerprint(['#users-grid .MuiChip-label'], knownHtml)]);
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

	test('generated-id-shaped text in an attribute that is not an id reference is kept', () => {
		expect(fingerprint(['a[href="mui-2-guide"]'])).toBe('a[href="mui-2-guide"]');
		expect(fingerprint(['button[aria-label="Step mui-3"]'])).toBe('button[aria-label="Step mui-3"]');
		expect(fingerprint(['button[aria-label=_r_1_]'])).toBe('button[aria-label=_r_1_]');
		expect(fingerprint(['div[title="_r_1_"]'])).toBe('div[title="_r_1_"]');
		expect(fingerprint(['input[value=":r1:"]'])).toBe('input[value=":r1:"]');
		expect(fingerprint(['div[data-target="_r_1_ _r_2_"]'])).toBe('div[data-target="_r_1_ _r_2_"]');
		expect(fingerprint(['a[href="#_r_1_"]'])).toBe('a[href="#*"]');
	});

	test('a partial token match inside an id reference attribute is kept', () => {
		expect(fingerprint(['div[aria-labelledby="prefix_r_1_"]'])).toBe('div[aria-labelledby="prefix_r_1_"]');
		expect(fingerprint(['div[aria-labelledby="_r_1_!"]'])).toBe('div[aria-labelledby="_r_1_!"]');
		expect(fingerprint(['div[aria-controls="Step mui-3,"]'])).toBe('div[aria-controls="Step mui-3,"]');
		expect(fingerprint(['label[for="x:r1:"]'])).toBe('label[for="x:r1:"]');
		expect(fingerprint(['div[aria-labelledby="_r_1_ title_r_2_"]'])).toBe('div[aria-labelledby="* title_r_2_"]');
		expect(fingerprint(['div[aria-labelledby="_r_1_.suffix"]'])).toBe('div[aria-labelledby="_r_1_.suffix"]');
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
			rule: 'sample-rule',
			screen: 'sample',
			theme: 'light',
			nodes: [
				fingerprint(
					['.mui-1k0n8m7.MuiCardActionArea-root[aria-labelledby="_r_2o_"]'],
					'<button class="mui-1k0n8m7 MuiCardActionArea-root" aria-labelledby="_r_2o_">'
				)
			]
		};
		const next = blockingFindings([
			violation(
				'sample-rule',
				['.mui-zz9y8x.MuiCardActionArea-root[aria-labelledby="_r_3c_"]'],
				'serious',
				'<button class="mui-zz9y8x MuiCardActionArea-root" aria-labelledby="_r_3c_">'
			)
		]);
		const { allowed, blocking, stale } = applyAllowList(next, [recorded], 'sample', 'light');
		expect([allowed.length, blocking.length, stale.length]).toEqual([1, 0, 0]);
	});
});

test.describe('allow-list validation', () => {
	// A fixed ticket table, so these cases don't depend on which real tickets are still open.
	const tickets: Record<string, RuleTicket> = {
		[entry.rule]: {
			ticket: 'craftersoftware/craftercms-e#1',
			criterion: '1.4.3 Contrast (Minimum)',
			scope: { [entry.screen]: ['light', 'dark'], 'edit form': ['light'] }
		}
	};

	test('accepts a ticketed, in-scope node list', () => {
		expect(validateAllowList([entry], tickets)).toEqual([entry]);
	});

	test('rejects a rule with no umbrella ticket', () => {
		expect(() => validateAllowList([{ ...entry, rule: 'aria-required-parent' }], tickets)).toThrow(
			/no umbrella ticket/
		);
	});

	test('rejects a screen or theme the ticket does not list', () => {
		expect(() => validateAllowList([{ ...entry, screen: 'login' }], tickets)).toThrow(/does not list/);
		expect(() => validateAllowList([{ ...entry, screen: 'edit form', theme: 'dark' }], tickets)).toThrow(
			/does not list/
		);
	});

	test('rejects an entry without nodes, and duplicates', () => {
		expect(() => validateAllowList([{ ...entry, nodes: [] }], tickets)).toThrow(/fingerprint of every node/);
		expect(() => validateAllowList([entry, entry], tickets)).toThrow(/listed twice/);
	});
});

test.describe('start tag', () => {
	test('keeps the tag name, role, and Mui and authored classes, and drops generated classes and other attributes', () => {
		expect(
			startTag(
				'<LI class="mui-1abc MuiListItem-root css-9z authored MuiListItem-gutters" role="listitem" data-x="1" id="x">text</LI>'
			)
		).toBe('<li role="listitem" class="MuiListItem-gutters MuiListItem-root authored">');
		expect(startTag('<div class="mui-1abc css-1x2y3z">')).toBe('<div>');
		expect(startTag('<ul>')).toBe('<ul>');
	});

	test('is independent of class order, repeats and generated hashes', () => {
		expect(startTag('<div class="MuiBox-root mui-1abc authored">')).toBe(
			startTag('<div class="authored mui-9zz MuiBox-root MuiBox-root">')!
		);
	});

	test('tss-react classes keep their name, emotion classes with a label keep the label', () => {
		expect(startTag('<div class="tss-1a2b3c-root">')).toBe('<div class="tss-*-root">');
		expect(startTag('<div class="css-1a2b3c-MuiPaper-root">')).toBe('<div class="MuiPaper-root">');
	});

	test('MUI mui-fixed is a real class and is kept', () => {
		expect(startTag('<div class="mui-fixed mui-1abc MuiAppBar-root">')).toBe('<div class="MuiAppBar-root mui-fixed">');
		expect(fingerprint(['.mui-fixed.mui-1abc:nth-child(2)'])).toBe('.mui-fixed.mui-*:nth-child(2)');
		expect(fingerprint(['.mui-fixed > .mui-fixedx'])).toBe('.mui-fixed > .mui-*');
	});

	test("a link's href is part of its start tag, a generated fragment is not, and other tags' hrefs are ignored", () => {
		expect(startTag('<a href="https://craftercms.org/blog" target="_blank">News</a>')).toBe(
			'<a href="https://craftercms.org/blog">'
		);
		expect(startTag('<a class="MuiLink-root" href="#_r_1_">')).toBe('<a href="#*" class="MuiLink-root">');
		expect(startTag('<a>')).toBe('<a>');
		expect(startTag('<link href="/x.css">')).toBe('<link>');
	});

	test('reads attributes with quoted values that hold > and spaces, single quotes and bare values', () => {
		expect(startTag(`<a href="/a>b" title='x y' role=link class="MuiLink-root">`)).toBe(
			'<a role="link" href="/a>b" class="MuiLink-root">'
		);
		expect(startTag('<input disabled class="MuiInput-input" />')).toBe('<input class="MuiInput-input">');
	});

	test('returns null when the html does not start with a tag', () => {
		expect(startTag('')).toBeNull();
		expect(startTag('text <div>')).toBeNull();
		expect(startTag('<!-- c -->')).toBeNull();
	});
});

test.describe('transient interaction state classes', () => {
	test('focus state classes are not part of the start tag', () => {
		expect(startTag('<button class="MuiButtonBase-root MuiButton-root Mui-focusVisible" role="button">')).toBe(
			startTag('<button class="MuiButtonBase-root MuiButton-root" role="button">')
		);
		expect(startTag('<div class="MuiInputBase-root Mui-focused mui-1abc">')).toBe('<div class="MuiInputBase-root">');
		expect(startTag('<span class="MuiSlider-thumb Mui-focusVisible MuiButton-focusVisible">')).toBe(
			'<span class="MuiSlider-thumb">'
		);
		expect(startTag('<li class="MuiTab-root MuiTab-focused">')).toBe('<li class="MuiTab-root">');
	});

	test('deterministic state classes stay, so the Settings switch keeps its two Mui-checked entries distinct', () => {
		const on = '<span class="Mui-checked MuiButtonBase-root MuiSwitch-switchBase mui-1abc">';
		const off = '<span class="MuiButtonBase-root MuiSwitch-switchBase mui-1abc">';
		expect(startTag(on)).toBe('<span class="Mui-checked MuiButtonBase-root MuiSwitch-switchBase">');
		expect(startTag(on)).not.toBe(startTag(off));
		for (const name of [
			'Mui-selected',
			'Mui-expanded',
			'Mui-disabled',
			'Mui-error',
			'Mui-active',
			'MuiStepIcon-active',
			'MuiTableRow-hover'
		]) {
			expect(startTag(`<tr class="${name}">`), name).toBe(`<tr class="${name}">`);
		}
	});

	test('a class that only starts or ends like a state class is kept', () => {
		expect(startTag('<div class="Mui-focusedX Mui-activeness MuiFoo-focusVisibleTrap authored-focused">')).toBe(
			'<div class="Mui-activeness Mui-focusedX MuiFoo-focusVisibleTrap authored-focused">'
		);
	});

	test('the CSS path drops them too, keeping the rest of the segment and the position of a segment left empty', () => {
		expect(fingerprint(['.MuiButtonBase-root.Mui-focusVisible'])).toBe('.MuiButtonBase-root');
		expect(fingerprint(['.Mui-focused.MuiInputBase-root > input'])).toBe('.MuiInputBase-root > input');
		expect(fingerprint(['.MuiTab-root.Mui-focusVisible.mui-1abc:nth-child(2)'])).toBe(
			'.MuiTab-root.mui-*:nth-child(2)'
		);
		expect(fingerprint(['.Mui-focusVisible > span'])).toBe('* > span');
		expect(fingerprint(['li > .Mui-focused:nth-child(2) .Mui-active'])).toBe('li > *:nth-child(2) .Mui-active');
		expect(fingerprint(['.MuiTableSortLabel-root.Mui-active.Mui-focusVisible'])).toBe(
			'.MuiTableSortLabel-root.Mui-active'
		);
		expect(fingerprint(['div.Mui-focused > a'])).toBe('div > a');
		expect(fingerprint(['.Mui-selected > .mui-1abc.MuiBox-root'])).toBe('.Mui-selected > .mui-*.MuiBox-root');
		expect(fingerprint(['.Mui-checked'])).toBe('.Mui-checked');
	});

	test('a node keeps its fingerprint when it picks up focus, and a checked node differs from an unchecked one', () => {
		const target = ['#main .MuiSwitch-root > .MuiSwitch-switchBase'];
		const html = '<span class="MuiButtonBase-root MuiSwitch-switchBase mui-1abc Mui-checked">';
		const focused = html.replace('Mui-checked', 'Mui-checked Mui-focusVisible');
		expect(fingerprint(target, focused)).toBe(fingerprint(target, html));
		expect(fingerprint(['#main .MuiSwitch-switchBase.Mui-focusVisible'], focused)).toBe(
			fingerprint(['#main .MuiSwitch-switchBase'], html)
		);
		expect(fingerprint(target, html.replace(' Mui-checked', ''))).not.toBe(fingerprint(target, html));
	});

	test('an allow-listed node still matches, and is not stale, after it picked up focus', () => {
		const target = '.MuiListItemButton-root.Mui-focusVisible > span';
		const clean = fingerprint(['.MuiListItemButton-root > span'], '<span class="MuiTypography-root">');
		const findings = blockingFindings([
			violation('color-contrast', [target], 'serious', '<span class="MuiTypography-root Mui-focused">')
		]);
		const { allowed, blocking, stale } = applyAllowList(
			findings,
			[{ rule: 'color-contrast', screen: 'users', theme: 'light', nodes: [clean] }],
			'users',
			'light'
		);
		expect(allowed).toHaveLength(1);
		expect(blocking).toEqual([]);
		expect(stale).toEqual([]);
	});

	test('stable tokens do not include transient state classes', () => {
		expect(stableTokens(fingerprint(['.MuiTab-root.Mui-focusVisible'], '<a class="MuiTab-root Mui-focused">'))).toEqual(
			['.MuiTab-root', '.MuiTab-root']
		);
	});
});

test.describe('fingerprints with the start tag', () => {
	const path = '.mui-ybhk9l:nth-child(1)';

	test('follow the path, and split back into the two', () => {
		const value = fingerprint([path], '<div class="mui-1abc" role="listitem">');
		expect(value).toBe('.mui-*:nth-child(1) <div role="listitem">');
		expect(splitFingerprint(value)).toEqual({ path: '.mui-*:nth-child(1)', startTag: '<div role="listitem">' });
		expect(splitFingerprint('ul')).toEqual({ path: 'ul', startTag: null });
		expect(splitFingerprint('a[href="x <b>"]')).toEqual({ path: 'a[href="x <b>"]', startTag: null });
	});

	test('a path alone is what a node without a readable start tag gets', () => {
		expect(fingerprint([path])).toBe('.mui-*:nth-child(1)');
		expect(fingerprint([path], 'not html')).toBe('.mui-*:nth-child(1)');
	});

	test('two different nodes reached by the same hash-only path no longer share a fingerprint', () => {
		const listitem = fingerprint([path], '<div class="mui-1abc" role="listitem">');
		const other = fingerprint([path], '<div class="mui-1abc MuiCard-root">');
		expect(listitem).not.toBe(other);
		const recorded: AllowListEntry = { rule: 'sample-rule', screen: 'sample', theme: 'light', nodes: [listitem] };
		const findings = blockingFindings([
			violation('sample-rule', [path], 'serious', '<div class="mui-1abc MuiCard-root">')
		]);
		const { allowed, blocking, stale } = applyAllowList(findings, [recorded], 'sample', 'light');
		expect([allowed.length, blocking.length, stale.length]).toEqual([0, 1, 1]);
	});

	test('the same node still matches when only generated classes and ids change', () => {
		const recorded: AllowListEntry = {
			rule: 'sample-rule',
			screen: 'sample',
			theme: 'light',
			nodes: [fingerprint(['.mui-ybhk9l:nth-child(1)'], '<div class="mui-ybhk9l" role="listitem">')]
		};
		const findings = blockingFindings([
			violation(
				'sample-rule',
				['.mui-zz9y8x:nth-child(1)'],
				'serious',
				'<div class="mui-zz9y8x" role="listitem" id="_r_3_">'
			)
		]);
		const { allowed, blocking, stale } = applyAllowList(findings, [recorded], 'sample', 'light');
		expect([allowed.length, blocking.length, stale.length]).toEqual([1, 0, 0]);
	});
});

test.describe('stable tokens', () => {
	test('a Mui or authored class, an authored id, a literal attribute value and a role are stable', () => {
		expect(stableTokens('.mui-* > .MuiListItem-root:nth-child(2) <li>')).toEqual(['.MuiListItem-root']);
		expect(stableTokens('.mui-*.avatar <td>')).toEqual(['.avatar']);
		expect(stableTokens('#users-grid > .mui-* <div>')).toEqual(['#users-grid']);
		expect(stableTokens('a[href$="blog"] <a>')).toEqual(['[href$="blog"]']);
		expect(stableTokens('.mui-*:nth-child(1) <div role="listitem">')).toEqual(['role=listitem']);
		expect(stableTokens('.mui-* <div class="MuiCard-root mui-fixed">')).toEqual(['.MuiCard-root', '.mui-fixed']);
		expect(stableTokens('.tss-*-root <div>')).toEqual(['.tss-*-root']);
		expect(stableTokens('a:nth-child(2) <a href="https://github.com/craftercms/craftercms/issues">')).toEqual([
			'href=https://github.com/craftercms/craftercms/issues'
		]);
	});

	test('hashes, ids, positions and a bare tag name are not', () => {
		for (const value of [
			'.mui-*',
			'.mui-*:nth-child(1)',
			'.mui-* > .mui-*:nth-child(8)',
			'.css-*.mui-*',
			'#*',
			'ul',
			'li:nth-child(1)',
			'a:nth-child(2)',
			'button[aria-labelledby="*"]',
			'button[aria-labelledby="* *"]',
			'.mui-*:nth-child(1) <div>',
			'.mui-*:nth-child(1) <li>',
			'#* <input>',
			'ul <ul>',
			'a:nth-child(2) <a>',
			'a:nth-child(2) <a href="#*">'
		]) {
			expect(stableTokens(value), value).toEqual([]);
		}
	});
});

test.describe('allow-list validation of fingerprints', () => {
	const node = (path: string, html: string) => fingerprint([path], html);
	// A fixed ticket. `listitem` is a real rule #1456 removes, and no remaining ticket lists one theme.
	const sample = (nodes: string[]): AllowListEntry => ({
		rule: 'sample-rule',
		screen: 'sample',
		theme: 'light',
		nodes
	});
	const tickets: Record<string, RuleTicket> = {
		'sample-rule': {
			ticket: 'craftersoftware/craftercms-e#1',
			criterion: '1.3.1 Info and Relationships',
			scope: { sample: ['light'] }
		}
	};

	test('accepts nodes the start tag makes identifiable', () => {
		const nodes = [
			node('.mui-ybhk9l:nth-child(1)', '<div class="mui-ybhk9l" role="listitem">'),
			node('.mui-ybhk9l > .mui-o5ytqa:nth-child(8)', '<li class="mui-o5ytqa MuiListItem-root">'),
			node('.MuiListItem-padding', '<li class="MuiListItem-padding">')
		];
		expect(validateAllowList([sample(nodes)], tickets)).toHaveLength(1);
	});

	test('rejects a fingerprint of generated classes and positions only, naming it', () => {
		const weak = [node('.mui-ybhk9l:nth-child(1)', '<div class="mui-ybhk9l">'), node('#_r_1_', '<input>')];
		expect(() =>
			validateAllowList([sample([node('.MuiListItem-padding', '<li class="MuiListItem-padding">'), ...weak])], tickets)
		).toThrow(
			/sample-rule on light sample has 2 fingerprint\(s\) that name no stable node[^]*\.mui-\*:nth-child\(1\) <div>[^]*#\* <input>/
		);
	});

	test('rejects a path-only fingerprint, even one with a class, as the older format', () => {
		expect(() => validateAllowList([sample(['.MuiListItem-padding'])], tickets)).toThrow(/no stable node/);
		expect(() => validateAllowList([sample(['ul'])], tickets)).toThrow(/no stable node/);
	});
});
