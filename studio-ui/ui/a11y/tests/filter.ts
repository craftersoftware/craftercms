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

/** A generated `.mui-<hash>` emotion class. MUI's own `.mui-fixed` marker class is not one: it is kept as it is. */
const MUI_HASH_CLASS = /\.mui-(?!fixed(?![a-z0-9]))[a-z0-9]+/g;

/**
 * The name of a transient interaction state class: MUI's global `Mui-focusVisible` and `Mui-focused`, and the component
 * scoped ones some components also emit (`MuiButton-focusVisible`). These follow the keyboard focus and the pointer of
 * whatever the run touched last, not the markup, so they make a fingerprint differ between two scans of the same node.
 * `checkPanelPages` blurs after an Escape so the opener does not keep `Mui-focusVisible`; dropping them here covers any
 * other focus a scan starts with (an autofocused field, a focus a dialog restores).
 *
 * Deterministic state classes are kept on purpose: `Mui-checked`, `Mui-selected`, `Mui-expanded`, `Mui-disabled`,
 * `Mui-error`, `Mui-readOnly`, `Mui-required` and `Mui-active` come from props and data, so they are the same on every
 * run of a baseline project and tell a node in one state from the same node in another (the two `Mui-checked` entries
 * of the edit mode Settings switch). `Mui-active` comes from `TableSortLabel`'s `active` prop and from `StepLabel`,
 * `StepIcon` and `StepConnector`; its one pointer driven use, a `Slider` thumb while dragged, never happens in a scan.
 * MUI emits no class for hover (`MuiTableRow-hover` is the `hover` prop, which is static).
 */
const TRANSIENT_STATE_NAME = String.raw`Mui[A-Za-z]*-(?:focusVisible|focused)`;

const TRANSIENT_STATE_CLASS = new RegExp(`^${TRANSIENT_STATE_NAME}$`);

/** Transient state classes in an axe CSS path. A segment made of nothing else becomes `*` so its position survives. */
const TRANSIENT_STATE_ONLY_SEGMENT = new RegExp(
	String.raw`(^|[\s>+~])(?:\.${TRANSIENT_STATE_NAME})+(?![\w.#\[-])`,
	'g'
);
const TRANSIENT_STATE_SELECTOR = new RegExp(String.raw`\.${TRANSIENT_STATE_NAME}(?![\w-])`, 'g');

/** The start tag of an element: tag name, then attributes whose values may hold `>` inside quotes. */
const START_TAG = /^\s*<([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/;

const START_TAG_ATTRIBUTE = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

/** What `fingerprint` leaves of a generated class or id: the placeholder alone names nothing. */
const GENERATED_NAMES = new Set(['css-*', 'mui-*', '*']);

/** A generated id used as a link's fragment (`href="#_r_1_"`). */
const HREF_GENERATED_FRAGMENT = new RegExp(`#${GENERATED_ID}[\\w-]*$`);

/** Marks where the normalised start tag begins in a fingerprint: the path never contains a space followed by `<`. */
const START_TAG_SEPARATOR = ' <';

/**
 * A class of the start tag, minus what changes without the markup changing: emotion hashes (`css-1x2y3z`, `mui-1x2y3z`)
 * are dropped, and the hash of a tss-react class is replaced (`tss-1x2y3z-root` becomes `tss-*-root`). Mui component
 * classes (`MuiListItem-root`), MUI's `mui-fixed`, authored classes and deterministic state classes (`Mui-checked`)
 * stay. Transient interaction state classes (`Mui-focusVisible`, `Mui-focused`) are dropped, see
 * `TRANSIENT_STATE_NAME`.
 */
function normaliseClass(name: string): string | null {
	if (TRANSIENT_STATE_CLASS.test(name)) return null;
	if (/^css-[a-z0-9]+$/.test(name)) return null;
	if (/^mui-(?!fixed$)[a-z0-9]+$/.test(name)) return null;
	return name.replace(/^css-[a-z0-9]+-/, '').replace(/^tss-[a-z0-9]+-/, 'tss-*-');
}

/**
 * The normalised start tag of an axe node's `html`: the tag name, the `role`, a link's `href` and the classes that are
 * not generated (see `normaliseClass`), sorted. `<li class="mui-1abc MuiListItem-root css-9z" role="listitem"
 * data-x="1">` becomes `<li role="listitem" class="MuiListItem-root">`. Returns `null` when `html` does not start with a
 * tag.
 *
 * The CSS path tells where a node sits (and its position among siblings); the start tag tells what it is, so a
 * different node that happens to be reached by the same path of generated classes does not match.
 */
export function startTag(html: string): string | null {
	const match = START_TAG.exec(html);
	if (!match) return null;
	const attributes = new Map<string, string>();
	for (const [, name, double, single, bare] of match[2].matchAll(START_TAG_ATTRIBUTE)) {
		attributes.set(name.toLowerCase(), double ?? single ?? bare ?? '');
	}
	const classes = [
		...new Set(
			(attributes.get('class') ?? '')
				.split(/\s+/)
				.filter(Boolean)
				.map(normaliseClass)
				.filter((name): name is string => name !== null)
		)
	].sort();
	const tag = match[1].toLowerCase();
	const role = attributes.get('role')?.trim();
	// A plain link has nothing else to tell it from another link at the same position.
	const href = tag === 'a' ? attributes.get('href')?.trim().replace(HREF_GENERATED_FRAGMENT, '#*') : undefined;
	return [
		`<${tag}`,
		...(role ? [`role="${role}"`] : []),
		...(href ? [`href="${href}"`] : []),
		...(classes.length ? [`class="${classes.join(' ')}"`] : [])
	]
		.join(' ')
		.concat('>');
}

/**
 * Identifies a node by axe's CSS path to it, minus the tokens that change without the markup changing: emotion and MUI
 * class hashes (`.css-1x2y3z`, `.mui-1x2y3z`), the hash in tss-react classes (`tss-1x2y3z-root` keeps `-root`) and
 * React/MUI generated ids, in id selectors and as whole tokens of id reference attributes (`aria-labelledby`,
 * `aria-controls`, `for`, `id` and so on). What remains is the element path, the stable `Mui*` component classes,
 * `.mui-fixed` and authored ids. Transient interaction state classes (`.Mui-focusVisible`,
 * `.Mui-focused`) are removed, a segment with nothing else left becoming `*`.
 *
 * With the node's `html`, the normalised start tag follows the path (see `startTag`): `.mui-*:nth-child(3) <div
 * role="listitem">`. Without it, or if it holds no tag, the fingerprint is the path alone.
 */
export function fingerprint(target: NodeResult['target'], html?: string): string {
	const path = target
		.map((part) => (Array.isArray(part) ? part.join(' >>> ') : part))
		.join(' >>> ')
		.replace(ID_SELECTOR, '#*')
		.replace(ATTRIBUTE_SELECTOR, (match, name, operator, quote, value) =>
			ID_REFERENCE_ATTRIBUTES.has(name)
				? `[${name}${operator}${quote}${value.replace(GENERATED_ID_IN_VALUE, '*')}${quote}]`
				: match
		)
		.replace(/\.css-[a-z0-9]+/g, '.css-*')
		.replace(MUI_HASH_CLASS, '.mui-*')
		.replace(/\.tss-[a-z0-9]+-/g, '.tss-*-')
		.replace(TRANSIENT_STATE_ONLY_SEGMENT, '$1*')
		.replace(TRANSIENT_STATE_SELECTOR, '')
		.trim();
	const tag = html === undefined ? null : startTag(html);
	return tag ? `${path} ${tag}` : path;
}

/** A fingerprint split into its CSS path and its normalised start tag (`null` for a path-only fingerprint). */
export function splitFingerprint(value: string): { path: string; startTag: string | null } {
	const index = value.lastIndexOf(START_TAG_SEPARATOR);
	return index >= 0 && /^<[a-z][\w:-]*[^<]*>$/.test(value.slice(index + 1))
		? { path: value.slice(0, index), startTag: value.slice(index + 1) }
		: { path: value, startTag: null };
}

/**
 * What in a fingerprint identifies the node beyond where it sits: a Mui component class, an authored class or id (in the
 * path or the start tag), an attribute selector with a literal value, or the start tag's `role` or a link's `href`. Generated hashes and
 * ids (`.mui-*`, `.css-*`, `#*`, `[for="*"]`), `:nth-child` positions and a bare tag name are not: any other node of the
 * same rule, screen and theme at that position has the same ones.
 */
export function stableTokens(value: string): string[] {
	const { path, startTag: tag } = splitFingerprint(value);
	const tokens: string[] = [];
	path
		.replace(ATTRIBUTE_SELECTOR, (match, _name, _operator, _quote, attributeValue: string) => {
			if (attributeValue.replace(/[\s*]/g, '')) tokens.push(match);
			return ' ';
		})
		.replace(/:nth-(?:last-)?(?:child|of-type)\([^)]*\)/g, ' ')
		.replace(/[.#]([\w*-]+)/g, (match, name: string) => {
			if (!GENERATED_NAMES.has(name)) tokens.push(match);
			return ' ';
		});
	if (tag) {
		const role = /\srole="([^"]+)"/.exec(tag)?.[1];
		if (role) tokens.push(`role=${role}`);
		const href = /\shref="([^"]+)"/.exec(tag)?.[1];
		if (href && href !== '#*') tokens.push(`href=${href}`);
		for (const name of /\sclass="([^"]*)"/.exec(tag)?.[1].split(' ') ?? []) tokens.push(`.${name}`);
	}
	return tokens;
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
				fingerprint: fingerprint(node.target, node.html),
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
