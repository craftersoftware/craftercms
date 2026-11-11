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
 * A section in the table of contents carries the warning mark only for a field that is truly
 * invalid and still relevant. A field a form controller hid, or a repeat deny-list entry, never
 * counts, the same as the form's own save gate. A repeat-item editor reuses the parent's
 * sections but only has atoms for the repeat's child fields, so it must not probe the rest.
 */

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';

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
const { TableOfContents } = await import('./TableOfContents.tsx');
const { ItemMetaContext, StableFormContext, StableGlobalContext } = await import('../lib/formsEngineContext.ts');
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

function fieldOf(id: string, name: string): ContentTypeField {
	return { id, name, type: 'input', helpText: '', validations: {} } as ContentTypeField;
}

const invalidState = { isValid: false, messages: ['The value does not match the required pattern.'] };

/** Section rows of the tree, by title. */
function sectionRow(host: HTMLElement, sectionId: string) {
	return host.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement;
}

function hasErrorMark(row: HTMLElement) {
	const label = row.querySelector('.MuiTreeItem-label') as HTMLElement;
	return label.textContent?.includes('Section has errors') ?? false;
}

async function setup(options: {
	sections: Array<{ id: string; title: string; fields: string[] }>;
	contentTypeFields: ContentTypeField[];
	/** Field ids that have atoms. The others stand for fields the form has no state for. */
	withAtoms: string[];
	validation?: Record<string, { isValid: boolean; messages: string[] }>;
	irrelevant?: Set<string> | null;
	repeatFieldId?: string;
	repeatFields?: ContentTypeField[];
	/** Sections start collapsed unless listed. */
	expanded?: string[];
}) {
	const valueByFieldId: Record<string, ReturnType<typeof atom>> = {};
	const validationByFieldId: Record<string, ReturnType<typeof atom>> = {};
	for (const id of options.withAtoms) {
		valueByFieldId[id] = atom('???');
		validationByFieldId[id] = atom(options.validation?.[id] ?? { isValid: true, messages: [] });
	}
	const atoms = {
		valueByFieldId,
		validationByFieldId,
		expandedStateBySectionId: Object.fromEntries(
			options.sections.map((section) => [section.id, atom(options.expanded?.includes(section.id) ?? false)])
		),
		tableOfContentsDrawerOpen: atom(false),
		relevanceVersion: atom(0),
		...createFormVisibilityAtoms()
	};
	const stable = {
		atoms,
		changedFieldIds: atom(new Set<string>()),
		fieldUpdates$: new Subject(),
		itemMeta: { sourceMap: null },
		originalValues: {},
		props: options.repeatFieldId ? { repeat: { fieldId: options.repeatFieldId } } : null,
		state: null,
		itemFormMode: null,
		affectedPluginControlFields: [],
		formControllerState: options.irrelevant ? { irrelevantFieldPaths: options.irrelevant } : null,
		getItem: () => null
	};
	const contentType = {
		fields: Object.fromEntries(options.contentTypeFields.map((field) => [field.id, field])),
		sections: options.sections
	};
	const jotai = createStore();
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
			root.render(
				createElement(
					RawIntlProvider,
					{ value: intl as never },
					createElement(
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
										createElement(TableOfContents, {
											containerRef: { current: document.createElement('div') },
											fields: options.repeatFields
										})
									)
								)
							)
						)
					)
				)
			);
		});
	} finally {
		console.error = original;
	}
	mounted.push({ unmount: () => root.unmount(), host });
	return { host, errors, jotai, atoms, stable };
}

const sections = [{ id: 'sec_main', title: 'Main', fields: ['title_s', 'summary_s'] }];
const contentTypeFields = [fieldOf('title_s', 'Title'), fieldOf('summary_s', 'Summary')];

describe('table of contents section error mark', () => {
	it('marks the section when one of its fields is invalid', async () => {
		const { host } = await setup({
			sections,
			contentTypeFields,
			withAtoms: ['title_s', 'summary_s'],
			validation: { summary_s: invalidState }
		});
		assert.equal(hasErrorMark(sectionRow(host, 'sec_main')), true);
	});

	it('does not mark the section when the only invalid field is controller-hidden', async () => {
		const { host, errors } = await setup({
			sections,
			contentTypeFields,
			withAtoms: ['title_s', 'summary_s'],
			validation: { summary_s: invalidState },
			irrelevant: new Set(['summary_s'])
		});
		assert.equal(hasErrorMark(sectionRow(host, 'sec_main')), false);
		assert.deepEqual(errors, []);
	});

	it('follows the controller when relevance changes after the first render', async () => {
		const { host, atoms, jotai, stable } = await setup({
			sections,
			contentTypeFields,
			withAtoms: ['title_s', 'summary_s'],
			validation: { summary_s: invalidState },
			irrelevant: new Set()
		});
		assert.equal(hasErrorMark(sectionRow(host, 'sec_main')), true);

		await act(async () => {
			(stable.formControllerState as { irrelevantFieldPaths: Set<string> }).irrelevantFieldPaths.add('summary_s');
			jotai.set(atoms.relevanceVersion, (version: number) => version + 1);
		});
		assert.equal(hasErrorMark(sectionRow(host, 'sec_main')), false);

		await act(async () => {
			(stable.formControllerState as { irrelevantFieldPaths: Set<string> }).irrelevantFieldPaths.delete('summary_s');
			jotai.set(atoms.relevanceVersion, (version: number) => version + 1);
		});
		assert.equal(hasErrorMark(sectionRow(host, 'sec_main')), true);
	});
});

describe('table of contents section error mark and expansion', () => {
	function cue(host: HTMLElement) {
		const row = sectionRow(host, 'sec_main');
		const label = row.querySelector('.MuiTreeItem-label') as HTMLElement;
		return { icon: label.querySelector('svg'), text: label.textContent?.includes('Section has errors') ?? false };
	}

	it('shows the cue on a collapsed section: icon, hidden words, and a row laid out like a field row', async () => {
		const { host } = await setup({
			sections,
			contentTypeFields,
			withAtoms: ['title_s', 'summary_s'],
			validation: { summary_s: invalidState }
		});
		const { icon, text } = cue(host);
		assert.ok(icon);
		assert.equal(icon.getAttribute('aria-hidden'), 'true');
		assert.equal(icon.getAttribute('data-testid'), 'WarningAmberRoundedIcon');
		assert.ok(icon.classList.contains('MuiSvgIcon-fontSizeSmall'));
		assert.equal(text, true);
		const label = sectionRow(host, 'sec_main').querySelector('.MuiTreeItem-label') as HTMLElement;
		const rowBox = label.firstElementChild as HTMLElement;
		assert.equal(rowBox.tagName, 'DIV');
		assert.equal(rowBox.firstElementChild?.textContent, 'Main');
		assert.equal(rowBox.lastElementChild?.contains(icon), true);
	});

	it('shows no cue, icon or hidden words, while the section is expanded', async () => {
		const { host } = await setup({
			sections,
			contentTypeFields,
			withAtoms: ['title_s', 'summary_s'],
			validation: { summary_s: invalidState },
			expanded: ['sec_main']
		});
		const { icon, text } = cue(host);
		assert.equal(icon, null);
		assert.equal(text, false);
		assert.equal(sectionRow(host, 'sec_main').querySelector('.MuiTreeItem-label')?.textContent, 'Main');
	});

	it('flips the cue when the section is expanded and collapsed', async () => {
		const { host, atoms, jotai } = await setup({
			sections,
			contentTypeFields,
			withAtoms: ['title_s', 'summary_s'],
			validation: { summary_s: invalidState }
		});
		assert.ok(cue(host).icon);
		await act(async () => jotai.set(atoms.expandedStateBySectionId.sec_main, true));
		assert.equal(cue(host).icon, null);
		assert.equal(cue(host).text, false);
		await act(async () => jotai.set(atoms.expandedStateBySectionId.sec_main, false));
		assert.ok(cue(host).icon);
		assert.equal(cue(host).text, true);
	});
});

describe('table of contents without atoms for a section field', () => {
	it('renders a repeat-item editor that has atoms only for the repeat child fields', async () => {
		const child = fieldOf('child_s', 'Child');
		const { host, errors } = await setup({
			sections,
			contentTypeFields: [...contentTypeFields, child],
			withAtoms: ['child_s'],
			validation: { child_s: invalidState },
			repeatFieldId: 'items_o',
			repeatFields: [child]
		});
		assert.ok(host.querySelector('[data-field-id="child_s"]'));
		assert.equal(host.querySelector('[data-section-id]'), null);
		assert.equal(host.textContent?.includes('Section has errors'), false);
		assert.deepEqual(errors, []);
	});

	it('skips a section field that has no atoms and still marks the section for one that does', async () => {
		const { host, errors } = await setup({
			sections,
			contentTypeFields,
			withAtoms: ['summary_s'],
			validation: { summary_s: invalidState }
		});
		assert.equal(hasErrorMark(sectionRow(host, 'sec_main')), true);
		assert.deepEqual(errors, []);
	});
});
