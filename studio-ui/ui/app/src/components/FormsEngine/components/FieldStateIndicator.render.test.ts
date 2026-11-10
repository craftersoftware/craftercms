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
 * The field state icon is the same component on the label and in the table of contents.
 * Complete is a check, an empty required field is an asterisk, and any other failure is a warning triangle.
 * A filled required field keeps a small asterisk on that icon. The words are in the accessible name.
 * An empty optional field with no validator shows nothing.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';

// The emptiness check for an RTE reads text through DOMParser. The test DOM is jsdom's.
globalThis.DOMParser = window.DOMParser;
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { ContentTypeField } from '../../../models/ContentType';

const React = await import('react');
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { Provider: ReduxProvider } = await import('react-redux');
const { configureStore } = await import('@reduxjs/toolkit');
const { atom, createStore, Provider: JotaiProvider } = await import('jotai');
const { Subject } = await import('rxjs');
const { FieldStateIndicator } = await import('./FieldStateIndicator.tsx');
const { FormsEngineField } = await import('./FormsEngineField.tsx');
const { TableOfContents } = await import('./TableOfContents.tsx');
const { FormsEngineFormContextApi, ItemMetaContext, StableFormContext, StableGlobalContext } =
	await import('../lib/formsEngineContext.ts');
const { createFormVisibilityAtoms } = await import('../lib/formVisibility.ts');

const baseIntl = createIntl({ locale: 'en', messages: {}, onError() {} });
const intl = {
	...baseIntl,
	formatMessage: (descriptor: { id?: string; defaultMessage?: string }, values?: Record<string, unknown>) =>
		baseIntl.formatMessage(
			{ ...descriptor, id: descriptor.id ?? String(descriptor.defaultMessage) } as never,
			values as never
		)
};

const reduxStore = configureStore({
	reducer: {
		sites: (state = { active: 'editorial' }) => state,
		content: (state = { itemsByPath: {} }) => state,
		contentTypes: (state = { byId: {}, isFetching: false }) => state
	}
});

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { unmount, host } of mounted.splice(0)) {
		await act(async () => unmount());
		host.remove();
	}
});

async function render(node: React.ReactNode) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	const errors: string[] = [];
	const original = console.error;
	console.error = (...args: unknown[]) => {
		errors.push(args.map(String).join(' '));
		original.apply(console, args);
	};
	try {
		await act(async () => {
			root.render(createElement(RawIntlProvider, { value: intl as never }, node));
		});
	} finally {
		console.error = original;
	}
	mounted.push({ unmount: () => root.unmount(), host });
	return { host, errors };
}

/** Name a screen reader builds: skip aria-hidden, keep the visually hidden state. */
function spoken(root: ParentNode) {
	const walk = (node: Node): string => {
		if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
		if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') return '';
		return Array.from(node.childNodes).map(walk).join('');
	};
	return walk(root).replace(/\s+/g, ' ').trim();
}

function stateIcons(root: ParentNode) {
	return Array.from(root.querySelectorAll('svg')).filter((svg) =>
		/^(CheckRounded|Asterisk|WarningAmberRounded)Icon$/.test(svg.getAttribute('data-testid') ?? '')
	);
}

function stateIcon(root: ParentNode) {
	return stateIcons(root)[0];
}

function indicatorOf(root: ParentNode) {
	const icon = stateIcon(root);
	const hidden = Array.from(root.querySelectorAll('span')).find((span) => span.textContent?.startsWith(', '));
	return {
		icon: icon?.getAttribute('data-testid') ?? '',
		colour: Array.from(icon?.classList ?? []).find((name) => name.startsWith('MuiSvgIcon-color')) ?? '',
		ariaHidden: icon?.getAttribute('aria-hidden') ?? '',
		fill: icon?.getAttribute('fill') ?? '',
		text: hidden?.textContent ?? ''
	};
}

describe('FieldStateIndicator', () => {
	const cases: Array<{
		props: Record<string, unknown>;
		icons: string[];
		colour: string;
		text: string;
	}> = [
		{
			props: { isRequired: true, hasValidator: true, isValid: false, isEmpty: true },
			icons: ['AsteriskIcon'],
			colour: 'MuiSvgIcon-colorError',
			text: ', Required'
		},
		{
			props: { isRequired: true, hasValidator: true, isValid: true, isEmpty: false },
			icons: ['CheckRoundedIcon', 'AsteriskIcon'],
			colour: 'MuiSvgIcon-colorSuccess',
			text: ', Required, complete'
		},
		{
			props: {
				isRequired: true,
				hasValidator: true,
				isValid: false,
				isEmpty: false,
				detail: 'Use letters only.'
			},
			icons: ['WarningAmberRoundedIcon', 'AsteriskIcon'],
			colour: 'MuiSvgIcon-colorError',
			text: ', Required. Use letters only.'
		},
		{
			props: { isRequired: false, hasValidator: true, isValid: false, isEmpty: false },
			icons: ['WarningAmberRoundedIcon'],
			colour: 'MuiSvgIcon-colorError',
			text: ', Invalid'
		},
		{
			props: { isRequired: false, hasValidator: true, isValid: true, isEmpty: false },
			icons: ['CheckRoundedIcon'],
			colour: 'MuiSvgIcon-colorSuccess',
			text: ', Complete'
		}
	];

	for (const entry of cases) {
		it(`renders ${entry.text.trim()} with ${entry.icons.join(' + ')}`, async () => {
			const { host, errors } = await render(createElement(FieldStateIndicator, entry.props as never));
			const icons = stateIcons(host);
			assert.deepEqual(
				icons.map((icon) => icon.getAttribute('data-testid')),
				entry.icons
			);
			for (const icon of icons) {
				assert.equal(icon.getAttribute('aria-hidden'), 'true');
				assert.doesNotMatch(icon.getAttribute('fill') ?? '', /^#/);
			}
			assert.ok(icons[0].classList.contains(entry.colour));
			assert.equal(host.querySelector('[aria-label]'), null);
			assert.equal(icons[0].parentElement?.tagName, 'SPAN');
			const badge = icons[1];
			if (badge) {
				assert.equal(getComputedStyle(badge).position, 'absolute');
				assert.equal(badge.getAttribute('aria-hidden'), 'true');
			}
			const hidden = Array.from(host.querySelectorAll('span')).find(
				(span) => span.textContent === entry.text && span.querySelector('svg') == null
			);
			assert.ok(hidden);
			assert.notEqual(hidden.getAttribute('aria-hidden'), 'true');
			assert.equal(getComputedStyle(hidden).position, 'absolute');
			assert.equal(
				errors.some((message) => /must be able to hold a ref|cannot be given refs/i.test(message)),
				false
			);
		});
	}

	it('hides the words when announce is false', async () => {
		const { host } = await render(
			createElement(FieldStateIndicator, {
				isRequired: true,
				hasValidator: true,
				isValid: false,
				isEmpty: true,
				announce: false
			})
		);
		assert.equal(stateIcon(host)?.getAttribute('data-testid'), 'AsteriskIcon');
		assert.equal(host.textContent?.includes('Required'), false);
	});

	it('renders nothing for an empty optional field with no validator', async () => {
		for (const isValid of [true, false]) {
			const { host } = await render(
				createElement(FieldStateIndicator, { isRequired: false, hasValidator: false, isValid, isEmpty: true })
			);
			assert.equal(host.querySelector('svg'), null);
			assert.equal(spoken(host), '');
		}
	});
});

function fieldOf(id: string, name: string, type: string, required: boolean): ContentTypeField {
	return {
		id,
		name,
		type,
		helpText: '',
		validations: required ? { required: { id: 'required', value: true, level: 'required' } } : {}
	} as ContentTypeField;
}

const surfaces = [
	{
		id: 'complete_s',
		name: 'Title',
		type: 'input',
		required: true,
		value: 'Hello',
		isValid: true,
		message: '',
		icon: 'CheckRoundedIcon',
		text: ', Required, complete',
		spoken: 'Title, Required, complete'
	},
	{
		id: 'required_s',
		name: 'Body',
		type: 'input',
		required: true,
		value: '',
		isValid: false,
		message: 'This field is required.',
		icon: 'AsteriskIcon',
		text: ', Required',
		spoken: 'Body, Required'
	},
	{
		id: 'invalid_s',
		name: 'Summary',
		type: 'input',
		required: false,
		value: '???',
		isValid: false,
		message: 'The value does not match the required pattern.',
		icon: 'WarningAmberRoundedIcon',
		text: ', Invalid',
		spoken: 'Summary, Invalid'
	},
	{
		id: 'optional_s',
		name: 'Note',
		type: 'dropdown',
		required: false,
		value: '',
		isValid: true,
		message: '',
		icon: '',
		text: '',
		spoken: 'Note'
	},
	{
		id: 'flag_s',
		name: 'Agree',
		type: 'checkbox',
		required: true,
		value: false,
		isValid: false,
		message: 'This checkbox must be checked.',
		icon: 'AsteriskIcon',
		text: ', Required',
		spoken: 'Agree, Required'
	},
	{
		id: 'article_s',
		name: 'Article',
		type: 'rte',
		required: true,
		value: '<p></p>',
		isValid: false,
		message: 'This field is required.',
		icon: 'AsteriskIcon',
		text: ', Required',
		spoken: 'Article, Required'
	}
];

describe('field label and table of contents', () => {
	it('render the same indicator, with the state in the name and the error text beside it', async () => {
		const fields = surfaces.map((entry) => fieldOf(entry.id, entry.name, entry.type, entry.required));
		const valueByFieldId: Record<string, ReturnType<typeof atom>> = {};
		const validationByFieldId: Record<string, ReturnType<typeof atom>> = {};
		for (const entry of surfaces) {
			valueByFieldId[entry.id] = atom(entry.value);
			validationByFieldId[entry.id] = atom({
				isValid: entry.isValid,
				messages: entry.message ? [entry.message] : []
			});
		}
		const atoms = {
			valueByFieldId,
			validationByFieldId,
			expandedStateBySectionId: {},
			tableOfContentsDrawerOpen: atom(false),
			...createFormVisibilityAtoms()
		};
		const stable = {
			atoms,
			changedFieldIds: atom(new Set<string>()),
			fieldUpdates$: new Subject(),
			itemMeta: { sourceMap: null },
			originalValues: {},
			props: null,
			state: null,
			itemFormMode: null,
			affectedPluginControlFields: [],
			formControllerState: null,
			getItem: () => null
		};
		const contentType = {
			fields: Object.fromEntries(fields.map((field) => [field.id, field])),
			sections: []
		};
		const jotai = createStore();
		const tree = createElement(
			ReduxProvider,
			{ store: reduxStore },
			createElement(
				JotaiProvider,
				{ store: jotai },
				createElement(
					StableGlobalContext.Provider,
					{ value: { formsStackData: [], api: {} } as never },
					createElement(
						StableFormContext.Provider,
						{ value: stable as never },
						createElement(
							ItemMetaContext.Provider,
							{ value: { sourceMap: null, contentType } as never },
							createElement(
								FormsEngineFormContextApi.Provider,
								{ value: { rollbackField() {} } as never },
								createElement(
									'div',
									null,
									createElement(
										'div',
										{ id: 'labels' },
										fields.map((field) => createElement(FormsEngineField, { key: field.id, field, menu: false }))
									),
									createElement(
										'div',
										{ id: 'override' },
										createElement(FormsEngineField, {
											field: fields[0],
											menu: false,
											isValid: false
										})
									),
									createElement(
										'div',
										{ id: 'toc' },
										createElement(TableOfContents, {
											containerRef: { current: document.createElement('div') },
											fields
										})
									)
								)
							)
						)
					)
				)
			)
		);
		const { host } = await render(tree);
		const labels = host.querySelector('#labels') as HTMLElement;
		const toc = host.querySelector('#toc') as HTMLElement;

		for (const entry of surfaces) {
			const labelField = labels.querySelector(`[data-field-id="${entry.id}"]`) as HTMLElement;
			const tocField = toc.querySelector(`[data-field-id="${entry.id}"]`) as HTMLElement;
			assert.ok(labelField, entry.id);
			assert.ok(tocField, entry.id);
			const labelIndicator = indicatorOf(labelField);
			const tocIndicator = indicatorOf(tocField);
			assert.equal(labelIndicator.icon, tocIndicator.icon);
			assert.equal(labelIndicator.icon, entry.icon);
			assert.equal(labelIndicator.text, '');
			assert.equal(tocIndicator.text, entry.text);
			if (entry.icon) assert.equal(labelIndicator.ariaHidden, 'true');
			const label = labelField.querySelector('label') as HTMLElement;
			assert.equal(spoken(label), entry.name);
			assert.equal(label.textContent?.includes(','), false);
			assert.equal(spoken(tocField), entry.spoken);
			assert.equal(labelField.querySelector('[aria-label]'), null);
			assert.equal(tocField.querySelector('[aria-label]'), null);
			if (entry.message) {
				assert.equal(label.textContent?.includes(entry.message), false);
				assert.equal(labelField.textContent?.includes(entry.message), true);
			}
		}
		const override = host.querySelector('#override [data-field-id="complete_s"]') as HTMLElement;
		assert.equal(stateIcon(override)?.getAttribute('data-testid'), 'WarningAmberRoundedIcon');
		assert.equal(stateIcons(override).length, 2);
		assert.equal(stateIcons(override)[1]?.getAttribute('aria-hidden'), 'true');
		assert.equal(spoken(override.querySelector('label')), 'Title');
		const body = labels.querySelector('[data-field-id="required_s"] label') as HTMLElement;
		assert.equal(spoken(body), 'Body');
		await act(async () => {
			jotai.set(valueByFieldId.required_s, 'Hello');
		});
		assert.equal(spoken(body), 'Body');
	});
});
