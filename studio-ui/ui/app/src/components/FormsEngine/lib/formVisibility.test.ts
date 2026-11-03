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
 * Covers the form visibility model the engine uses at launch and on save.
 * Launch tests check which fields and repeat items a selected-field open keeps,
 * including warnings when the request cannot be applied. Save tests check the
 * single decision that either reveals a hidden error, refuses the write, or
 * continues, and the draft flag that decision hands to the write. Item-launch
 * tests check when Experience Builder opens a repeat item's own form. Scroll tests
 * check that a reveal keeps its field when fieldToScroll is also set, and that
 * a plain fieldToScroll scrolls once the form content is mounted, and again after that target is cleared.
 * Stack tests check a form pushed before its atoms exist, selected-fields mode, the one close
 * decision, lock sharing, reload, which pending flags a parent save clears, and the width and
 * dirty flags of more than one stacked form. A repeat-item launch leaves the parent unscoped.
 * An index past the end scrolls the parent to the repeat and warns.
 * A repeat value that is missing does the same and warns that there is nothing to open.
 * A pending item launch hides the parent body, and that body stays hidden while its drawer is entering.
 * A rejected validity read keeps the last invalid-field ids, and a stale rejection is ignored.
 * Every form with a relevant validation error shows the validation alert, including errors already on screen.
 * Show on that alert opens the full form only when the named field is out of scope.
 * An item form that has its own error does not point that alert at the parent repeat field.
 * They do not render the form.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	baseFieldId,
	childFields,
	applySaveGate,
	decideSaveReveal,
	gateSaveBeforeWrite,
	planSettledFieldScroll,
	draftFlagAfterBeforeSave,
	resolveSaveDraft,
	saveAsDraftFlag,
	fieldVisibility,
	clearRepeatItemScope,
	firstOutOfScopeInvalidField,
	hasChildFields,
	hasFormAtoms,
	validationErrorsAlert,
	itemFormExit,
	itemLaunchBlocksParent,
	itemLaunchFrom,
	parentBodyHiddenForItemLaunch,
	missedItemLaunch,
	repeatItemsMissingWarning,
	settleInvalidFieldRead,
	itemLaunchVisibleChildren,
	scopeToggleVisible,
	repeatFormLock,
	repositorySaveFollowUp,
	selectedItemSavePlan,
	aggregateStackFlags,
	stackedFormCloseAction,
	stackedFormsClosedByReload,
	hiddenInvalidReveal,
	showValidationError,
	isScopeActive,
	itemGroupFieldIds,
	launchScopeWarnings,
	normalizeRepeatIndex,
	openFullForm,
	repeatIndexIgnoredWarning,
	repeatIndexOutOfRangeWarning,
	resolveLaunchVisibility,
	returnToLaunchScope,
	revealField,
	scopeFieldCounts,
	unsupportedRepeatIndexWarning,
	visibilityFromLaunch,
	visibleRepeatItems
} from './formVisibility.ts';
import { clearStackPendingFlags } from './repeatItemForm.ts';

const known = new Set(['title_s', 'body_html', 'articles_o', 'sidebar_s']);
const repeats = new Set(['articles_o']);
const typeFields = {
	title_s: { id: 'title_s' },
	body_html: { id: 'body_html' },
	sidebar_s: { id: 'sidebar_s' },
	articles_o: { id: 'articles_o', fields: { headline_s: { id: 'headline_s' } } }
};

function warningsFrom(run: () => void): string[] {
	const warnings: string[] = [];
	const original = console.warn;
	console.warn = (message?: unknown) => {
		warnings.push(String(message));
	};
	try {
		run();
	} finally {
		console.warn = original;
	}
	return warnings;
}

describe('resolveLaunchVisibility', () => {
	// A zone that names two fields should open on those fields and remember that as the launch scope.
	it('shows only the selected base fields', () => {
		const resolved = resolveLaunchVisibility({
			selectedFields: ['title_s', 'sidebar_s'],
			knownFieldIds: known,
			repeatFieldIds: repeats
		});
		assert.deepEqual(resolved.state.active.fieldIds, ['title_s', 'sidebar_s']);
		assert.equal(resolved.state.active.repeatItem, null);
		assert.deepEqual(resolved.state.launch, resolved.state.active);
	});

	// Experience Builder posts `articles_o.headline_s` plus an index. The form shows that group and one item.
	it('selects the base field for a dotted id and scopes that repeat item', () => {
		const resolved = resolveLaunchVisibility({
			selectedFields: ['articles_o.headline_s'],
			index: '1',
			knownFieldIds: known,
			repeatFieldIds: repeats
		});
		assert.deepEqual(resolved.state.active.fieldIds, ['articles_o']);
		assert.deepEqual(resolved.state.active.repeatItem, { fieldId: 'articles_o', index: 1 });
	});

	// A mixed list should keep the fields that exist and report the ones that do not, so the form is not empty.
	it('keeps the fields that matched and reports the rest', () => {
		const resolved = resolveLaunchVisibility({
			selectedFields: ['title_s', 'gone_s'],
			knownFieldIds: known,
			repeatFieldIds: repeats
		});
		assert.deepEqual(resolved.state.active.fieldIds, ['title_s']);
		assert.deepEqual(resolved.unmatchedFieldIds, ['gone_s']);
		assert.ok(resolved.state.launch);
	});

	// An index only means something on a selected field that has children. A plain field ignores it and says so.
	it('ignores an index that does not belong to a selected field with children', () => {
		const resolved = resolveLaunchVisibility({
			selectedFields: ['title_s'],
			index: 1,
			knownFieldIds: known,
			repeatFieldIds: repeats
		});
		assert.equal(resolved.state.active.repeatItem, null);
		assert.equal(resolved.ignoredRepeatIndex, '1');
		assert.equal(resolved.unsupportedRepeatIndex, undefined);
		assert.match(repeatIndexIgnoredWarning(1), /child fields/);
	});

	// Unknown ids must not produce an empty form. The full form opens, and the first requested id is still a scroll target.
	it('opens the full form and names the first requested field when nothing matches', () => {
		const resolved = resolveLaunchVisibility({
			selectedFields: ['gone_s.nested', 'also_gone_s'],
			knownFieldIds: known,
			repeatFieldIds: repeats
		});
		assert.equal(resolved.state.active.fieldIds, null);
		assert.equal(resolved.state.launch, null);
		assert.deepEqual(resolved.unmatchedFieldIds, ['gone_s', 'also_gone_s']);
		assert.equal(resolved.scrollFieldId, 'gone_s');
	});

	// Nested indexes are not a supported address. The form stays unscoped to an item and the warning names the index.
	it('does not apply a nested repeat index', () => {
		const resolved = resolveLaunchVisibility({
			selectedFields: ['articles_o'],
			index: '1.2',
			knownFieldIds: known,
			repeatFieldIds: repeats
		});
		assert.equal(resolved.state.active.repeatItem, null);
		assert.equal(resolved.unsupportedRepeatIndex, '1.2');
		assert.match(unsupportedRepeatIndexWarning('1.2'), /not supported/);
		assert.equal(normalizeRepeatIndex('1.2'), undefined);
		assert.equal(normalizeRepeatIndex(0), 0);
	});

	// Opening the full form must keep the launch snapshot so "Back to selected fields" can restore it.
	it('opens and restores the full form without dropping the launch scope', () => {
		const resolved = resolveLaunchVisibility({
			selectedFields: ['title_s'],
			knownFieldIds: known,
			repeatFieldIds: repeats
		});
		const opened = openFullForm(resolved.state);
		assert.equal(isScopeActive(opened.active), false);
		assert.deepEqual(opened.launch?.fieldIds, ['title_s']);
		assert.deepEqual(returnToLaunchScope(opened).active.fieldIds, ['title_s']);
	});
});

describe('field shape used for item scope', () => {
	// Item scope is for a field that holds children, not for a hard-coded repeat type name.
	it('treats a field with children as an item group', () => {
		assert.equal(hasChildFields(typeFields.articles_o), true);
		assert.equal(hasChildFields(typeFields.title_s), false);
		assert.equal(hasChildFields(undefined), false);
		assert.deepEqual(childFields(typeFields.articles_o), [{ id: 'headline_s' }]);
		assert.deepEqual([...itemGroupFieldIds(typeFields)], ['articles_o']);
	});
});

describe('fieldVisibility', () => {
	const denied = new Set(['sidebar_s', 'articles_o.headline_s']);

	// A controller deny-list wins over the launch scope: the field is not validated even if it was requested.
	it('hides a denied field even when the launch scope includes it', () => {
		assert.equal(
			fieldVisibility({ fieldId: 'sidebar_s', irrelevantFieldPaths: denied, scopeFieldIds: ['sidebar_s', 'title_s'] }),
			'irrelevant'
		);
	});

	// A field outside the launch scope stays `outOfScope` so save still validates it.
	it('keeps an out-of-scope field distinct so it is still validated', () => {
		assert.equal(fieldVisibility({ fieldId: 'body_html', scopeFieldIds: ['title_s'] }), 'outOfScope');
		assert.equal(fieldVisibility({ fieldId: 'title_s', scopeFieldIds: ['title_s'] }), 'visible');
	});

	// Repeat subfields are denied by a qualified path, so the same id in another group is not hidden.
	it('qualifies a repeat subfield against the deny-list', () => {
		assert.equal(
			fieldVisibility({
				fieldId: 'headline_s',
				parentPath: 'articles_o',
				irrelevantFieldPaths: denied,
				scopeFieldIds: null
			}),
			'irrelevant'
		);
	});

	// The scope notice counts relevant fields, then how many of those the launch left on screen.
	it('counts the fields a scope leaves on screen', () => {
		assert.deepEqual(
			scopeFieldCounts(['title_s', 'body_html', 'sidebar_s'], {
				irrelevantFieldPaths: denied,
				scopeFieldIds: ['title_s']
			}),
			{ showing: 1, total: 2 }
		);
	});

	// Save reveals the first hidden invalid field in section order, and skips a field the controller denied.
	it('names the first out-of-scope invalid field in section order', () => {
		assert.equal(
			firstOutOfScopeInvalidField(['sidebar_s', 'body_html'], ['title_s', 'body_html', 'sidebar_s'], {
				scopeFieldIds: ['title_s']
			}),
			'body_html'
		);
		assert.equal(
			firstOutOfScopeInvalidField(['sidebar_s'], ['title_s', 'sidebar_s'], {
				irrelevantFieldPaths: denied,
				scopeFieldIds: ['title_s']
			}),
			undefined
		);
	});
});

describe('baseFieldId', () => {
	// Dotted zone ids address the group, not the nested control.
	it('strips from the first dot', () => {
		assert.equal(baseFieldId('articles_o.headline_s'), 'articles_o');
		assert.equal(baseFieldId('title_s'), 'title_s');
	});
});

describe('visibleRepeatItems', () => {
	const items = ['one', 'two', 'three'];

	// A scope for a different field must not hide this control's rows.
	it('shows every item when the field is not the scoped one', () => {
		const selection = visibleRepeatItems(items, { fieldId: 'other_o', index: 1 }, 'articles_o');
		assert.equal(selection.scoped, false);
		assert.deepEqual(
			selection.items.map((entry) => entry.index),
			[0, 1, 2]
		);
	});

	// The zone menu's item index shows that row and keeps its original position for edit and delete.
	it('shows only the addressed item', () => {
		const selection = visibleRepeatItems(items, { fieldId: 'articles_o', index: 0 }, 'articles_o');
		assert.equal(selection.scoped, true);
		assert.deepEqual(selection.items, [{ item: 'one', index: 0 }]);
	});

	// An index past the list is not an empty repeat. Every row stays, and the caller can warn.
	it('falls back to every item when the index is past the end', () => {
		const selection = visibleRepeatItems(items, { fieldId: 'articles_o', index: 5 }, 'articles_o');
		assert.equal(selection.scoped, false);
		assert.equal(selection.outOfRangeIndex, 5);
		assert.equal(selection.items.length, 3);
		assert.match(repeatIndexOutOfRangeWarning('articles_o', 5, 3), /Showing all items/);
	});
});

describe('hiddenInvalidReveal', () => {
	const visibility = resolveLaunchVisibility({
		selectedFields: ['title_s', 'articles_o'],
		index: 1,
		knownFieldIds: known,
		repeatFieldIds: repeats
	}).state;

	// A completed save of an error the author cannot see opens the whole form on that field.
	it('opens the full form for an invalid field outside the scope', () => {
		const reveal = hiddenInvalidReveal({
			visibility,
			invalidFieldIds: ['body_html'],
			sectionOrder: ['title_s', 'body_html', 'articles_o']
		});
		assert.equal(reveal?.fieldId, 'body_html');
		assert.equal(isScopeActive(reveal.state.active), false);
		assert.ok(reveal.state.launch);
	});

	// An invalid repeat that is limited to one item drops that limit. It does not open every other field.
	it('clears the item scope when the visible repeat field is invalid', () => {
		const reveal = hiddenInvalidReveal({
			visibility,
			invalidFieldIds: ['articles_o'],
			sectionOrder: ['title_s', 'articles_o', 'body_html']
		});
		assert.equal(reveal?.fieldId, 'articles_o');
		assert.equal(reveal.state.active.repeatItem, null);
		assert.deepEqual(reveal.state.active.fieldIds, ['title_s', 'articles_o']);
		assert.deepEqual(reveal.state.launch?.repeatItem, { fieldId: 'articles_o', index: 1 });
		assert.equal(clearRepeatItemScope(visibility).active.repeatItem, null);
	});

	// A valid form has nothing to reveal.
	it('leaves a valid item-scoped repeat alone', () => {
		assert.equal(
			hiddenInvalidReveal({
				visibility,
				invalidFieldIds: [],
				sectionOrder: ['title_s', 'articles_o']
			}),
			undefined
		);
	});
});

describe('show validation error', () => {
	const scoped = resolveLaunchVisibility({
		selectedFields: ['title_s'],
		knownFieldIds: known,
		repeatFieldIds: repeats
	}).state;

	// The named field is outside the launch scope, so Show opens the full form and scrolls to it.
	it('opens the full form when the named field is out of scope', () => {
		const reveal = showValidationError({ visibility: scoped, fieldId: 'body_html' });
		assert.equal(reveal.fieldId, 'body_html');
		assert.equal(isScopeActive(reveal.state.active), false);
		assert.ok(reveal.state.launch);
	});

	// The named field is already on screen. Show keeps the scope and still names the field to scroll to.
	it('keeps the scope when the named field is on screen', () => {
		const reveal = showValidationError({ visibility: scoped, fieldId: 'title_s' });
		assert.equal(reveal.state, scoped);
		assert.equal(reveal.fieldId, 'title_s');
		assert.equal(isScopeActive(reveal.state.active), true);
	});
});

describe('revealField', () => {
	const visibility = resolveLaunchVisibility({
		selectedFields: ['title_s'],
		knownFieldIds: known,
		repeatFieldIds: repeats
	}).state;

	// View in form and a hidden-invalid save open the form and name the field to scroll to.
	it('opens the full form and names the field to scroll to', () => {
		const reveal = revealField(visibility, 'body_html');
		assert.equal(isScopeActive(reveal.state.active), false);
		assert.deepEqual(reveal.state.launch?.fieldIds, ['title_s']);
		assert.equal(reveal.fieldId, 'body_html');
	});

	// The scope notice opens the full form without pretending there is a field to scroll to.
	it('opens the full form without a field id when none is given', () => {
		const reveal = revealField(visibility);
		assert.equal(isScopeActive(reveal.state.active), false);
		assert.equal(reveal.fieldId, undefined);
	});
});

describe('launch scope installed from the open props', () => {
	// Atom creation is where the launch is applied. The warning is logged once, here, not from a layout effect.
	it('warns when an index is given for a field that has no children', () => {
		let installed: ReturnType<typeof visibilityFromLaunch> | undefined;
		const warnings = warningsFrom(() => {
			installed = visibilityFromLaunch({
				selectedFields: ['title_s'],
				index: 2,
				fields: typeFields
			});
		});
		assert.equal(installed?.state.active.repeatItem, null);
		assert.deepEqual(installed?.state.active.fieldIds, ['title_s']);
		assert.equal(warnings.length, 1);
		assert.match(warnings[0], /ignored/);
		assert.deepEqual(
			launchScopeWarnings(
				resolveLaunchVisibility({
					selectedFields: ['title_s'],
					index: 2,
					knownFieldIds: known,
					repeatFieldIds: repeats
				})
			),
			warnings
		);
	});

	// A selection that matches nothing still asks the scroller for the first requested field, if that field is in the form.
	it('scrolls to the first requested field when the selection matches nothing', () => {
		let installed: ReturnType<typeof visibilityFromLaunch> | undefined;
		const warnings = warningsFrom(() => {
			installed = visibilityFromLaunch({
				selectedFields: ['gone_s'],
				fields: typeFields
			});
		});
		assert.equal(installed?.state.launch, null);
		assert.equal(installed?.scrollFieldId, 'gone_s');
		assert.match(warnings[0], /Opening the full form/);
	});
});

describe('save reveal decision', () => {
	const visibility = resolveLaunchVisibility({
		selectedFields: ['title_s'],
		knownFieldIds: known,
		repeatFieldIds: repeats
	}).state;
	const base = {
		visibility,
		sectionOrder: ['title_s', 'body_html'],
		isRepeatMode: false
	};

	// The error is off screen, so Save opens it and does not write or show Cannot Proceed.
	it('reveals a hidden invalid field on a completed save', () => {
		const decision = decideSaveReveal({ ...base, draft: false, invalidFieldIds: ['body_html'] });
		assert.equal(decision.status, 'revealed');
		assert.equal(decision.reveal?.fieldId, 'body_html');
		assert.equal(isScopeActive(decision.reveal.state.active), false);
	});

	// Errors the author can already see are the Cannot Proceed dialog. Nothing is written.
	it('refuses a completed save whose errors are already visible', () => {
		const decision = decideSaveReveal({ ...base, draft: false, invalidFieldIds: ['title_s'] });
		assert.equal(decision.status, 'invalid');
		assert.equal(decision.reveal, undefined);
	});

	// A valid read writes. A stale invalid flag is not an input to this decision.
	it('writes when the fresh read is valid', () => {
		assert.equal(decideSaveReveal({ ...base, draft: false, invalidFieldIds: [] }).status, 'write');
	});

	// Save as draft writes the hidden errors and does not change the scope.
	it('writes a draft without revealing hidden errors', () => {
		const decision = decideSaveReveal({ ...base, draft: true, invalidFieldIds: ['body_html'] });
		assert.equal(decision.status, 'write');
		assert.equal(decision.reveal, undefined);
	});

	// An item form opened on a field subset uses the same check as any other scoped form.
	it('reveals a hidden invalid field inside a scoped item form', () => {
		const decision = decideSaveReveal({ ...base, draft: false, invalidFieldIds: ['body_html'] });
		assert.equal(decision.status, 'revealed');
		assert.equal(decision.reveal?.fieldId, 'body_html');
	});

	// The pencil opens an item form with no field scope, so there is nothing hidden to reveal.
	it('does not reveal in an item form opened from the pencil', () => {
		const decision = decideSaveReveal({
			draft: false,
			visibility: { active: { fieldIds: null, repeatItem: null }, launch: null },
			invalidFieldIds: ['body_html'],
			sectionOrder: ['body_html']
		});
		assert.equal(decision.status, 'invalid');
	});
});

describe('save gate before the controller hook', () => {
	const visibility = resolveLaunchVisibility({
		selectedFields: ['title_s'],
		knownFieldIds: known,
		repeatFieldIds: repeats
	}).state;

	const run = (invalidFieldIds: string[], steps: { preload: () => void; onBeforeSave: () => void }) =>
		applySaveGate({
			draft: false,
			isRepeatMode: false,
			visibility,
			sectionOrder: ['title_s', 'body_html'],
			readValidity: async () => ({
				isFormInvalid: invalidFieldIds.length > 0,
				invalidFieldIds
			}),
			onReveal() {},
			// save() puts plugin preload and onBeforeSave in this callback, and nowhere earlier.
			preloadAndWrite: async () => {
				steps.preload();
				steps.onBeforeSave();
				return 'saved' as const;
			}
		});

	// A hidden error opens the field. Plugin preload and the controller hook must not run.
	it('does not preload or run onBeforeSave when the save reveals a hidden field', async () => {
		let preloads = 0;
		let beforeSaves = 0;
		const outcome = await run(['body_html'], {
			preload: () => {
				preloads += 1;
			},
			onBeforeSave: () => {
				beforeSaves += 1;
			}
		});
		assert.equal(outcome, 'revealed');
		assert.equal(preloads, 0);
		assert.equal(beforeSaves, 0);
	});

	// Errors already on screen are Cannot Proceed. The hook and the plugin load still must not run.
	it('does not preload or run onBeforeSave when the save is blocked', async () => {
		let preloads = 0;
		let beforeSaves = 0;
		const outcome = await run(['title_s'], {
			preload: () => {
				preloads += 1;
			},
			onBeforeSave: () => {
				beforeSaves += 1;
			}
		});
		assert.equal(outcome, 'invalid');
		assert.equal(preloads, 0);
		assert.equal(beforeSaves, 0);
	});

	// A valid read is the only result that reaches plugin preload and onBeforeSave.
	it('runs preload and onBeforeSave only when the save will write', async () => {
		let preloads = 0;
		let beforeSaves = 0;
		const outcome = await run([], {
			preload: () => {
				preloads += 1;
			},
			onBeforeSave: () => {
				beforeSaves += 1;
			}
		});
		assert.equal(outcome, 'saved');
		assert.equal(preloads, 1);
		assert.equal(beforeSaves, 1);
	});

	// A failed validity read rejects from the gate. save() does not catch it, tag it, or reach the hook.
	it('rejects a failed validity read before onBeforeSave', async () => {
		await assert.rejects(
			gateSaveBeforeWrite({
				draft: false,
				isRepeatMode: false,
				visibility,
				sectionOrder: ['title_s'],
				readValidity: async () => {
					throw new Error('validity read failed');
				}
			}),
			/validity read failed/
		);
	});

	const draftFlagFor = async (options: { draft: boolean; invalidFieldIds: string[] }) => {
		let passed: boolean | undefined;
		const outcome = await applySaveGate({
			draft: options.draft,
			isRepeatMode: false,
			visibility,
			sectionOrder: ['title_s', 'body_html'],
			readValidity: async () => ({
				isFormInvalid: options.invalidFieldIds.length > 0,
				invalidFieldIds: options.invalidFieldIds
			}),
			onReveal() {},
			preloadAndWrite: async (saveAsDraft) => {
				passed = saveAsDraft;
				return 'saved' as const;
			}
		});
		return { outcome, passed };
	};

	// Save as draft with errors still writes. The write callback receives the draft flag, not a raw validity bit.
	it('passes a draft flag when an explicit draft has errors', async () => {
		const result = await draftFlagFor({ draft: true, invalidFieldIds: ['body_html'] });
		assert.equal(result.outcome, 'saved');
		assert.equal(result.passed, true);
	});

	// Save as draft of a valid form writes, and the callback is still told the item is a draft.
	it('passes a draft flag when an explicit draft is valid', async () => {
		const result = await draftFlagFor({ draft: true, invalidFieldIds: [] });
		assert.equal(result.outcome, 'saved');
		assert.equal(result.passed, true);
	});

	// A completed save of a valid form writes, and the callback is told it is not a draft.
	it('passes a non-draft flag for a valid completed save', async () => {
		const result = await draftFlagFor({ draft: false, invalidFieldIds: [] });
		assert.equal(result.outcome, 'saved');
		assert.equal(result.passed, false);
	});

	// onBeforeSave can make a valid form invalid after the gate. save() calls saveAsDraftFlag again for that read.
	it('marks a completed save as a draft when the hook leaves the form invalid', () => {
		assert.equal(saveAsDraftFlag(false, true), true);
		assert.equal(saveAsDraftFlag(false, false), false);
	});

	// The main button is auto. A remembered Save of a valid form writes a normal save.
	it('writes a non-draft when the form is valid and the user last chose Save', async () => {
		const result = await applySaveGate({
			draft: 'auto',
			saveAsDraft: false,
			visibility,
			sectionOrder: ['title_s', 'body_html'],
			readValidity: async () => ({ isFormInvalid: false, invalidFieldIds: [] }),
			onReveal() {},
			preloadAndWrite: async (saveAsDraft) => saveAsDraft
		});
		assert.equal(result, false);
	});

	// A remembered Save Draft of a valid form still writes a draft.
	it('writes a draft when the form is valid and the user last chose Save Draft', async () => {
		const result = await applySaveGate({
			draft: 'auto',
			saveAsDraft: true,
			visibility,
			sectionOrder: ['title_s', 'body_html'],
			readValidity: async () => ({ isFormInvalid: false, invalidFieldIds: [] }),
			onReveal() {},
			preloadAndWrite: async (saveAsDraft) => saveAsDraft
		});
		assert.equal(result, true);
	});

	// Invalid wins over a remembered Save. The main action stores a draft.
	it('writes a draft when the form is invalid regardless of the remembered choice', async () => {
		const result = await applySaveGate({
			draft: 'auto',
			saveAsDraft: false,
			visibility,
			sectionOrder: ['title_s', 'body_html'],
			readValidity: async () => ({ isFormInvalid: true, invalidFieldIds: ['title_s'] }),
			onReveal() {},
			preloadAndWrite: async (saveAsDraft) => saveAsDraft
		});
		assert.equal(result, true);
	});

	// A hidden error on the main button does not open the field. The write is a draft.
	it('writes a draft for a hidden error in auto mode without revealing it', async () => {
		let revealed = false;
		const result = await applySaveGate({
			draft: 'auto',
			saveAsDraft: false,
			visibility,
			sectionOrder: ['title_s', 'body_html'],
			readValidity: async () => ({ isFormInvalid: true, invalidFieldIds: ['body_html'] }),
			onReveal() {
				revealed = true;
			},
			preloadAndWrite: async (saveAsDraft) => saveAsDraft
		});
		assert.equal(revealed, false);
		assert.equal(result, true);
	});

	// onBeforeSave can change validity. The second read uses the remembered choice and the fresh invalid bit.
	it('re-reads the draft flag after onBeforeSave', () => {
		assert.equal(draftFlagAfterBeforeSave('auto', true, false), true);
		assert.equal(draftFlagAfterBeforeSave('auto', false, true), true);
		assert.equal(draftFlagAfterBeforeSave('auto', false, false), false);
		assert.equal(resolveSaveDraft('auto', true, false), true);
	});
});

describe('settled field scroll', () => {
	// View in form and a hidden-invalid save set a pending field. fieldToScroll must not replace that scroll, and a later visibility change must not jump back to it.
	it('keeps the revealed field when fieldToScroll is also set', () => {
		const reveal = planSettledFieldScroll({
			pendingScrollFieldId: 'body_html',
			fieldToScroll: 'title_s',
			clearingPending: false,
			retainSettledScroll: false,
			hasMainContent: true,
			focusPending: true
		});
		assert.equal(reveal.action, 'scroll');
		if (reveal.action !== 'scroll') return;
		assert.equal(reveal.fieldId, 'body_html');
		assert.equal(reveal.focus, true);
		assert.equal(reveal.clearPending, true);
		assert.equal(reveal.rememberFieldToScroll, 'title_s');

		const followUp = planSettledFieldScroll({
			pendingScrollFieldId: null,
			fieldToScroll: 'title_s',
			clearingPending: true,
			retainSettledScroll: true,
			hasMainContent: true,
			focusPending: true
		});
		assert.equal(followUp.action, 'keep');

		const afterVisibilityChange = planSettledFieldScroll({
			pendingScrollFieldId: null,
			fieldToScroll: 'title_s',
			clearingPending: false,
			retainSettledScroll: true,
			hasMainContent: true,
			focusPending: false,
			lastFieldToScroll: reveal.rememberFieldToScroll
		});
		assert.equal(afterVisibilityChange.action, 'keep');
	});

	// A fieldToScroll prop scrolls without moving focus.
	it('scrolls fieldToScroll without focusing', () => {
		const plan = planSettledFieldScroll({
			pendingScrollFieldId: null,
			fieldToScroll: 'title_s',
			clearingPending: false,
			retainSettledScroll: false,
			hasMainContent: true,
			focusPending: false
		});
		assert.equal(plan.action, 'scroll');
		if (plan.action !== 'scroll') return;
		assert.equal(plan.fieldId, 'title_s');
		assert.equal(plan.focus, false);
	});

	// A selection that matches nothing still scrolls to the first requested field, and does not take focus.
	it('scrolls the launch fallback without focusing', () => {
		const plan = planSettledFieldScroll({
			pendingScrollFieldId: 'gone_s',
			fieldToScroll: undefined,
			clearingPending: false,
			retainSettledScroll: false,
			hasMainContent: true,
			focusPending: false
		});
		assert.equal(plan.action, 'scroll');
		if (plan.action !== 'scroll') return;
		assert.equal(plan.fieldId, 'gone_s');
		assert.equal(plan.focus, false);
		assert.equal(plan.clearPending, true);
	});

	// Back to selected fields and a relevance change re-run the effect. The same fieldToScroll must not jump the form.
	it('does not scroll fieldToScroll again when only visibility changes', () => {
		const first = planSettledFieldScroll({
			pendingScrollFieldId: null,
			fieldToScroll: 'title_s',
			clearingPending: false,
			retainSettledScroll: false,
			hasMainContent: true,
			focusPending: false,
			lastFieldToScroll: null
		});
		assert.equal(first.action, 'scroll');
		if (first.action !== 'scroll') return;
		assert.equal(first.fieldId, 'title_s');
		assert.equal(first.rememberFieldToScroll, 'title_s');

		const again = planSettledFieldScroll({
			pendingScrollFieldId: null,
			fieldToScroll: 'title_s',
			clearingPending: false,
			retainSettledScroll: true,
			hasMainContent: true,
			focusPending: false,
			lastFieldToScroll: first.rememberFieldToScroll
		});
		assert.equal(again.action, 'keep');

		const changed = planSettledFieldScroll({
			pendingScrollFieldId: null,
			fieldToScroll: 'body_html',
			clearingPending: false,
			retainSettledScroll: true,
			hasMainContent: true,
			focusPending: false,
			lastFieldToScroll: first.rememberFieldToScroll
		});
		assert.equal(changed.action, 'scroll');
		if (changed.action !== 'scroll') return;
		assert.equal(changed.fieldId, 'body_html');
		assert.equal(changed.focus, false);
	});

	// Clearing the prop forgets the id. Setting that same id later scrolls again.
	it('scrolls the same fieldToScroll again after it is cleared', () => {
		const first = planSettledFieldScroll({
			pendingScrollFieldId: null,
			fieldToScroll: 'title_s',
			clearingPending: false,
			retainSettledScroll: false,
			hasMainContent: true,
			focusPending: false,
			lastFieldToScroll: null
		});
		assert.equal(first.action, 'scroll');
		if (first.action !== 'scroll') return;

		const cleared = planSettledFieldScroll({
			pendingScrollFieldId: null,
			fieldToScroll: null,
			clearingPending: false,
			retainSettledScroll: true,
			hasMainContent: true,
			focusPending: false,
			lastFieldToScroll: first.rememberFieldToScroll
		});
		assert.equal(cleared.rememberFieldToScroll, null);
		assert.equal(cleared.action, 'idle');

		const again = planSettledFieldScroll({
			pendingScrollFieldId: null,
			fieldToScroll: 'title_s',
			clearingPending: false,
			retainSettledScroll: false,
			hasMainContent: true,
			focusPending: false,
			lastFieldToScroll: cleared.rememberFieldToScroll
		});
		assert.equal(again.action, 'scroll');
		if (again.action !== 'scroll') return;
		assert.equal(again.fieldId, 'title_s');
		assert.equal(again.focus, false);
	});

	// The first effect run is before the form body exists. Remembering the id then would skip the scroll after it mounts.
	it('scrolls an initial fieldToScroll once the form content mounts', () => {
		const beforeMount = planSettledFieldScroll({
			pendingScrollFieldId: null,
			fieldToScroll: 'title_s',
			clearingPending: false,
			retainSettledScroll: false,
			hasMainContent: false,
			focusPending: false,
			lastFieldToScroll: null
		});
		assert.equal(beforeMount.action, 'idle');
		assert.equal(beforeMount.rememberFieldToScroll, null);

		const mounted = planSettledFieldScroll({
			pendingScrollFieldId: null,
			fieldToScroll: 'title_s',
			clearingPending: false,
			retainSettledScroll: false,
			hasMainContent: true,
			focusPending: false,
			lastFieldToScroll: beforeMount.rememberFieldToScroll
		});
		assert.equal(mounted.action, 'scroll');
		if (mounted.action !== 'scroll') return;
		assert.equal(mounted.fieldId, 'title_s');
		assert.equal(mounted.focus, false);
		assert.equal(mounted.rememberFieldToScroll, 'title_s');
	});
});

const accountsFields = {
	title_s: { id: 'title_s' },
	accounts_o: { id: 'accounts_o', fields: { icon_s: { id: 'icon_s' }, url_s: { id: 'url_s' } } },
	links_o: { id: 'links_o', fields: { label_s: { id: 'label_s' } } }
};
const accountsKnown = new Set(Object.keys(accountsFields));
const accountsRepeats = new Set(['accounts_o', 'links_o']);

describe('item form launch', () => {
	const resolve = (selectedFields: string[], index?: string | number) =>
		resolveLaunchVisibility({
			selectedFields,
			index,
			knownFieldIds: accountsKnown,
			repeatFieldIds: accountsRepeats,
			fields: accountsFields
		});

	// The Icon zone names the child and the item index. The item form should open on that child.
	// The parent is not filtered to that item.
	it('opens the item form for one child field and leaves the parent unscoped', () => {
		const resolved = resolve(['accounts_o.icon_s'], 0);
		assert.deepEqual(resolved.state.itemForm, { fieldId: 'accounts_o', index: 0, fieldIds: ['icon_s'] });
		assert.deepEqual(itemLaunchFrom(resolved.state, 2), resolved.state.itemForm);
		assert.equal(isScopeActive(resolved.state.active), false);
		assert.equal(resolved.state.launch, null);
	});

	// Several children of the same item stay together on that item form.
	it('opens the item form for several children of one group', () => {
		const resolved = resolve(['accounts_o.icon_s', 'accounts_o.url_s'], '0');
		assert.deepEqual(resolved.state.itemForm?.fieldIds, ['icon_s', 'url_s']);
	});

	// Choosing the repeat item itself, with no child, opens the item form on every field.
	it('opens the whole item when no child field is selected', () => {
		const resolved = resolve(['accounts_o'], 1);
		assert.deepEqual(resolved.state.itemForm, { fieldId: 'accounts_o', index: 1, fieldIds: null });
	});

	// A parent field mixed with an item field cannot be one item form. The parent keeps today's filter.
	it('falls back when the selection mixes a parent field and an item field', () => {
		const resolved = resolve(['title_s', 'accounts_o.icon_s'], 0);
		assert.equal(resolved.state.itemForm, undefined);
		assert.deepEqual(resolved.state.active.repeatItem, { fieldId: 'accounts_o', index: 0 });
	});

	// Two different groups cannot share one index.
	it('falls back when the selection spans two groups', () => {
		const resolved = resolve(['accounts_o.icon_s', 'links_o.label_s'], 0);
		assert.equal(resolved.state.itemForm, undefined);
	});

	// A nested index is how a control inside an item is addressed today. It stays on the parent.
	it('falls back for a nested index', () => {
		const resolved = resolve(['accounts_o.icon_s'], '1.2');
		assert.equal(resolved.state.itemForm, undefined);
		assert.equal(resolved.state.active.repeatItem, null);
		assert.equal(resolved.unsupportedRepeatIndex, '1.2');
	});

	// An index past the list does not open an empty item. The parent shows every item and warns.
	it('does not open the item form when the index is past the end', () => {
		const resolved = resolve(['accounts_o.icon_s'], 5);
		assert.ok(resolved.state.itemForm);
		assert.equal(itemLaunchFrom(resolved.state, 2), null);
	});

	// The parent opens full, scrolled to the repeat, and the warning names how far past the list the index was.
	it('scrolls the parent to the repeat and warns when the item index is past the end', () => {
		const state = resolve(['accounts_o.icon_s'], 5).state;
		const missed = missedItemLaunch(state, [{}, {}]);
		assert.ok(missed);
		assert.equal(missed.reveal.fieldId, 'accounts_o');
		assert.equal(missed.reveal.state.itemForm, null);
		assert.equal(missed.reveal.state.launch, null);
		assert.equal(missed.warning, repeatIndexOutOfRangeWarning('accounts_o', 5, 2));
	});

	// No value atom, or a value that is not a list, still opens the full form and says why.
	it('warns when the repeat has no items to open', () => {
		const state = resolve(['accounts_o.icon_s'], 0).state;
		const missed = missedItemLaunch(state, null);
		assert.ok(missed);
		assert.equal(missed.reveal.fieldId, 'accounts_o');
		assert.equal(missed.reveal.state.itemForm, null);
		assert.equal(missed.reveal.state.launch, null);
		assert.equal(missed.warning, repeatItemsMissingWarning('accounts_o'));
		assert.equal(missed.warning, 'Item launch for "accounts_o" has no repeat items to open. Showing the full form.');
	});

	// A child id that is not on the group is not an item launch.
	it('falls back when a child id is not on the group', () => {
		const resolved = resolve(['accounts_o.missing_s'], 0);
		assert.equal(resolved.state.itemForm, undefined);
	});
});

describe('item form exit', () => {
	const selected = resolveLaunchVisibility({
		selectedFields: ['icon_s'],
		knownFieldIds: new Set(['icon_s', 'url_s']),
		repeatFieldIds: new Set<string>()
	}).state;

	// A whole item and a single child both start in this mode. Dismiss closes the whole dialog.
	it('closes the dialog in selected-fields mode', () => {
		assert.deepEqual(itemFormExit('selected'), { dismiss: 'closeDialog' });
	});

	// Open full form is an author action. Close then returns to the parent.
	it('returns to the parent after the full item form is opened', () => {
		assert.deepEqual(itemFormExit('full'), { dismiss: 'pop' });
		assert.equal(itemFormExit('selected').dismiss, 'closeDialog');
	});

	// A reveal clears the scope. The mode stays selected, so dismiss still closes the dialog.
	it('keeps selected-fields mode when a hidden field is revealed', () => {
		const revealed = revealField(selected, 'url_s');
		assert.equal(isScopeActive(revealed.state.active), false);
		assert.equal(itemFormExit('selected').dismiss, 'closeDialog');
	});

	// The pencil and Add have no mode, so Close returns to the parent.
	it('pops the pencil item form', () => {
		assert.equal(itemFormExit(null).dismiss, 'pop');
	});

	// The toggle stays on the item while it is open. The parent of a repeat-item launch never has one.
	it('shows the scope toggle only on the form that was launched with a field subset', () => {
		const parent = resolveLaunchVisibility({
			selectedFields: ['accounts_o.icon_s'],
			index: 0,
			knownFieldIds: accountsKnown,
			repeatFieldIds: accountsRepeats,
			fields: accountsFields
		}).state;
		const item = resolveLaunchVisibility({
			selectedFields: ['icon_s'],
			knownFieldIds: new Set(['icon_s', 'url_s']),
			repeatFieldIds: new Set<string>()
		}).state;
		const plainField = resolveLaunchVisibility({
			selectedFields: ['title_s'],
			knownFieldIds: accountsKnown,
			repeatFieldIds: accountsRepeats
		}).state;
		assert.equal(scopeToggleVisible(parent), false);
		assert.equal(scopeToggleVisible(item), true);
		assert.equal(scopeToggleVisible(plainField), true);
	});

	// Open full form stays on the item. Closing it does not give the parent a way back to a filter.
	it('leaves the parent full with no back to selected fields after the item full form closes', () => {
		const parent = resolveLaunchVisibility({
			selectedFields: ['accounts_o.icon_s'],
			index: 0,
			knownFieldIds: accountsKnown,
			repeatFieldIds: accountsRepeats,
			fields: accountsFields
		}).state;
		const item = resolveLaunchVisibility({
			selectedFields: ['icon_s'],
			knownFieldIds: new Set(['icon_s', 'url_s']),
			repeatFieldIds: new Set<string>()
		}).state;
		const itemFull = openFullForm(item);
		assert.equal(scopeToggleVisible(itemFull), true);
		assert.equal(isScopeActive(parent.active), false);
		assert.equal(scopeToggleVisible(parent), false);
	});

	// Closing the item after Open full form still names the repeat so the parent can scroll to it.
	it('names the repeat when the parent is scrolled after the item full form closes', () => {
		const parent = resolveLaunchVisibility({
			selectedFields: ['accounts_o.icon_s'],
			index: 0,
			knownFieldIds: accountsKnown,
			repeatFieldIds: accountsRepeats,
			fields: accountsFields
		}).state;
		const next = revealField(parent, 'accounts_o');
		assert.equal(next.fieldId, 'accounts_o');
		assert.equal(next.state.launch, null);
	});

	// The parent must not paint its fields while the item form is about to be pushed.
	it('holds the parent in its loading state while the item launch is pending', () => {
		const pending = resolveLaunchVisibility({
			selectedFields: ['accounts_o.icon_s'],
			index: 0,
			knownFieldIds: accountsKnown,
			repeatFieldIds: accountsRepeats,
			fields: accountsFields
		}).state;
		assert.equal(itemLaunchBlocksParent(pending, 2), true);
		assert.equal(itemLaunchBlocksParent(pending, null), true);
		assert.equal(itemLaunchBlocksParent({ ...pending, itemForm: null }, 2), false);
		assert.equal(itemLaunchBlocksParent(pending, 0), false);
	});

	// Clearing the launch marker starts the slide. The body stays hidden until that drawer has entered.
	it('keeps the parent body hidden while the item drawer is entering', () => {
		assert.equal(parentBodyHiddenForItemLaunch(true, false), true);
		assert.equal(parentBodyHiddenForItemLaunch(false, true), true);
		assert.equal(parentBodyHiddenForItemLaunch(true, true), true);
		assert.equal(parentBodyHiddenForItemLaunch(false, false), false);
	});
});

describe('validation errors alert', () => {
	// A required field outside the launch scope is still an error, and Show names that field.
	it('points at the first invalid field outside the launch scope', () => {
		const alert = validationErrorsAlert({
			localInvalidFieldIds: ['body_html', 'sidebar_s'],
			localSectionOrder: ['title_s', 'body_html', 'sidebar_s']
		});
		assert.deepEqual(alert, { where: 'local', fieldId: 'body_html', count: 2 });
	});

	// A full form with the error already on screen still shows the alert and names that field.
	it('points at an on-screen error on a full form', () => {
		const alert = validationErrorsAlert({
			localInvalidFieldIds: ['title_s'],
			localSectionOrder: ['title_s', 'body_html']
		});
		assert.deepEqual(alert, { where: 'local', fieldId: 'title_s', count: 1 });
	});

	// Section order names the field, even when the invalid list is in another order.
	it('names the first invalid field in section order', () => {
		const alert = validationErrorsAlert({
			localInvalidFieldIds: ['sidebar_s', 'body_html'],
			localSectionOrder: ['title_s', 'body_html', 'sidebar_s']
		});
		assert.equal(alert?.fieldId, 'body_html');
		assert.equal(alert?.count, 2);
	});

	// The controller denied this field. It is not an error the author can fix here.
	it('skips an irrelevant invalid field', () => {
		const alert = validationErrorsAlert({
			localInvalidFieldIds: ['body_html'],
			localSectionOrder: ['title_s', 'body_html'],
			localIrrelevant: new Set(['body_html'])
		});
		assert.equal(alert, null);
	});

	// While a selected-fields item form is open, a parent error on another field still shows.
	it('points at a parent field while a selected item form is open', () => {
		const alert = validationErrorsAlert({
			localInvalidFieldIds: [],
			localSectionOrder: ['icon_s'],
			includeParent: true,
			openRepeatFieldId: 'accounts_o',
			parent: { invalidFieldIds: ['title_s'], sectionOrder: ['title_s', 'accounts_o'] }
		});
		assert.deepEqual(alert, { where: 'parent', fieldId: 'title_s', count: 1 });
	});

	// The item's URL is invalid, so the parent group is invalid too. Show stays on the item field.
	// A separate parent error still counts.
	it('keeps an item error off the parent repeat field', () => {
		const alert = validationErrorsAlert({
			localInvalidFieldIds: ['url_s'],
			localSectionOrder: ['icon_s', 'url_s'],
			includeParent: true,
			openRepeatFieldId: 'accounts_o',
			parent: { invalidFieldIds: ['accounts_o', 'title_s'], sectionOrder: ['title_s', 'accounts_o'] }
		});
		assert.deepEqual(alert, { where: 'local', fieldId: 'url_s', count: 2 });
	});

	// The item is valid. The parent group error is then the author's error, so Show names it.
	it('names the parent repeat field when the item itself is valid', () => {
		const alert = validationErrorsAlert({
			localInvalidFieldIds: [],
			localSectionOrder: ['icon_s', 'url_s'],
			includeParent: true,
			openRepeatFieldId: 'accounts_o',
			parent: { invalidFieldIds: ['accounts_o'], sectionOrder: ['title_s', 'accounts_o'] }
		});
		assert.deepEqual(alert, { where: 'parent', fieldId: 'accounts_o', count: 1 });
	});

	// The pencil uses Done. A parent error must not show on that item form.
	it('ignores parent errors on a pencil item form', () => {
		const alert = validationErrorsAlert({
			localInvalidFieldIds: [],
			localSectionOrder: ['icon_s'],
			includeParent: false,
			parent: { invalidFieldIds: ['title_s'], sectionOrder: ['title_s', 'accounts_o'] }
		});
		assert.equal(alert, null);
	});
});

describe('selected item save', () => {
	const item = resolveLaunchVisibility({
		selectedFields: ['icon_s'],
		knownFieldIds: new Set(['icon_s', 'url_s']),
		repeatFieldIds: new Set<string>()
	}).state;
	const parent = resolveLaunchVisibility({
		selectedFields: ['accounts_o'],
		knownFieldIds: accountsKnown,
		repeatFieldIds: accountsRepeats
	}).state;

	// An error outside the item selection stays in the item. The parent is not saved.
	it('reveals a hidden item field before saving the parent', () => {
		const plan = selectedItemSavePlan({
			draft: false,
			itemVisibility: item,
			itemInvalidFieldIds: ['url_s'],
			itemFieldOrder: ['icon_s', 'url_s'],
			parentVisibility: parent,
			parentInvalidFieldIds: [],
			parentFieldOrder: ['title_s']
		});
		assert.equal(plan.action, 'revealItem');
	});

	// The item is valid and the parent has an error the author cannot see. Nothing is written to the repository.
	it('reveals a hidden parent field without saving', () => {
		const plan = selectedItemSavePlan({
			draft: false,
			itemVisibility: item,
			itemInvalidFieldIds: [],
			itemFieldOrder: ['icon_s'],
			parentVisibility: parent,
			parentInvalidFieldIds: ['title_s'],
			parentFieldOrder: ['title_s', 'accounts_o']
		});
		assert.equal(plan.action, 'revealParent');
		if (plan.action !== 'revealParent') return;
		assert.equal(plan.reveal.fieldId, 'title_s');
		assert.equal(isScopeActive(plan.reveal.state.active), false);
	});

	// A draft still saves. Hidden errors do not stop it.
	it('saves the parent for a draft', () => {
		const plan = selectedItemSavePlan({
			draft: true,
			itemVisibility: item,
			itemInvalidFieldIds: ['url_s'],
			itemFieldOrder: ['icon_s', 'url_s'],
			parentVisibility: parent,
			parentInvalidFieldIds: ['title_s'],
			parentFieldOrder: ['title_s']
		});
		assert.equal(plan.action, 'saveParent');
	});
});

describe('invalid field read', () => {
	// A plugin validator rejected the current read. Report it and leave the ids already on screen.
	it('reports a rejected validity read and keeps the last ids', () => {
		assert.equal(settleInvalidFieldRead({ disposed: false, seq: 1, latest: 1, rejected: true }), 'report');
	});

	// A newer read already finished. This rejection must not replace those ids.
	it('ignores a stale validity rejection', () => {
		assert.equal(settleInvalidFieldRead({ disposed: false, seq: 1, latest: 2, rejected: true }), 'ignore');
	});

	// The reader unmounted. A late rejection must not update state.
	it('ignores a validity rejection after the read is disposed', () => {
		assert.equal(settleInvalidFieldRead({ disposed: true, seq: 1, latest: 1, rejected: true }), 'ignore');
	});

	// The matching successful read is the one that replaces the ids.
	it('applies the current validity read', () => {
		assert.equal(settleInvalidFieldRead({ disposed: false, seq: 2, latest: 2, rejected: false }), 'apply');
		assert.equal(settleInvalidFieldRead({ disposed: false, seq: 1, latest: 2, rejected: false }), 'ignore');
	});
});

describe('stacked form guards', () => {
	// pushForm inserts the entry before prep. The launch, pencil, Add, and node selector all do this.
	it('does not read form visibility before atoms exist', () => {
		const entry: { atoms: { formVisibility: string } | null } = { atoms: null };
		assert.equal(hasFormAtoms(entry), false);
		const visibility = hasFormAtoms(entry) ? entry.atoms.formVisibility : undefined;
		assert.equal(visibility, undefined);
		assert.equal(hasFormAtoms({ atoms: { formVisibility: 'ready' } }), true);
	});

	// Edit and Release Lock on the item update the same atoms the parent reads.
	it('shares the parent lock atoms with the item form', () => {
		const lockResult = { locked: true };
		const readonly = { current: false };
		const shared = repeatFormLock({ lockResult, readonly });
		assert.equal(shared.lockResult, lockResult);
		assert.equal(shared.readonly, readonly);
	});

	// A selected item form asks the dialog, which owns the one unsaved prompt. It does not pop first.
	it('closes the dialog once when a selected item form is dismissed', () => {
		assert.equal(
			stackedFormCloseAction({
				mode: 'selected',
				isRepeatItem: true,
				isSubmitting: false,
				hasPendingChanges: true
			}),
			'closeDialog'
		);
	});

	// A pencil item with edits confirms, then pops. A clean one pops. A save in progress waits.
	it('confirms before popping a dirty pencil item and waits while saving', () => {
		assert.equal(
			stackedFormCloseAction({ mode: null, isRepeatItem: true, isSubmitting: false, hasPendingChanges: true }),
			'confirmPop'
		);
		assert.equal(
			stackedFormCloseAction({ mode: 'full', isRepeatItem: true, isSubmitting: false, hasPendingChanges: false }),
			'pop'
		);
		assert.equal(
			stackedFormCloseAction({ mode: 'selected', isRepeatItem: true, isSubmitting: true, hasPendingChanges: true }),
			'wait'
		);
	});

	// The item itself is not saving. Another form on the stack is, so close must wait.
	it('waits while the stack is submitting', () => {
		assert.equal(
			stackedFormCloseAction({
				mode: 'full',
				isRepeatItem: true,
				isSubmitting: false,
				stackSubmitting: true,
				hasPendingChanges: false
			}),
			'wait'
		);
	});

	// A node selector is not an item launch, so it pops instead of closing the dialog.
	it('pops a node-selector form after confirming when it is dirty', () => {
		assert.equal(
			stackedFormCloseAction({ mode: null, isRepeatItem: false, isSubmitting: false, hasPendingChanges: true }),
			'confirmPop'
		);
	});

	// A form pushed on top of a selected item must not drop the dirty flag or bring the parent strip back.
	it('keeps width and dirty state from every stacked entry', () => {
		assert.deepEqual(
			aggregateStackFlags({
				'1': { pending: true, submitting: false, selected: true },
				'2': { pending: false, submitting: false, selected: false }
			}),
			{ pending: true, submitting: false, fullWidth: true }
		);
	});

	// Reloading the root closes stacked forms so they cannot keep the old atoms. A stacked form does not.
	it('closes every stacked form when the root reloads', () => {
		assert.equal(stackedFormsClosedByReload(3, 0), 2);
		assert.equal(stackedFormsClosedByReload(1, 0), 0);
		assert.equal(stackedFormsClosedByReload(3, 1), 0);
	});

	// A parent save already stored selected-fields edits that still match. A full-mode or pencil item was not written through.
	it('clears pending flags only for selected-fields entries', () => {
		const selectedChanged = new Set(['icon_s']);
		const fullChanged = new Set(['url_s']);
		let selectedPending = true;
		let fullPending = true;
		clearStackPendingFlags([
			{ selected: true, changedFieldIds: selectedChanged, setPending: (value) => (selectedPending = value) },
			{ selected: false, changedFieldIds: fullChanged, setPending: (value) => (fullPending = value) }
		]);
		assert.equal(selectedPending, false);
		assert.equal(selectedChanged.size, 0);
		assert.equal(fullPending, true);
		assert.equal(fullChanged.size, 1);
	});

	// An edit during the save stays dirty. A field that matches the saved checkpoint is dropped, and the parent repeat is marked.
	it('keeps a selected item dirty when it changed during the parent save', () => {
		const changed = new Set(['icon_s', 'url_s']);
		const parentChanged = new Set<string>();
		let pending = true;
		let checkpoint: Record<string, unknown> | null = null;
		clearStackPendingFlags(
			[
				{
					selected: true,
					fieldId: 'accounts_o',
					changedFieldIds: changed,
					savedItem: { icon_s: 'saved', url_s: 'kept' },
					currentItem: { icon_s: 'newer', url_s: 'kept' },
					setCheckpoint: (values) => {
						checkpoint = values;
					},
					setPending: (value) => {
						pending = value;
					}
				}
			],
			parentChanged
		);
		assert.equal(pending, true);
		assert.equal(changed.has('icon_s'), true);
		assert.equal(changed.has('url_s'), false);
		assert.equal(parentChanged.has('accounts_o'), true);
		assert.deepEqual(checkpoint, { icon_s: 'saved', url_s: 'kept' });
	});

	// The author typed the saved Icon back while the save was running, so the old changed-id list is empty.
	it('marks the parent when an undo during the save differs from the snapshot', () => {
		const changed = new Set<string>();
		const parentChanged = new Set<string>();
		let pending = false;
		clearStackPendingFlags(
			[
				{
					selected: true,
					fieldId: 'accounts_o',
					changedFieldIds: changed,
					savedItem: { icon_s: 'new' },
					currentItem: { icon_s: 'old' },
					setPending: (value) => {
						pending = value;
					}
				}
			],
			parentChanged
		);
		assert.equal(changed.has('icon_s'), true);
		assert.equal(pending, true);
		assert.equal(parentChanged.has('accounts_o'), true);
	});

	// Every remaining id matches the save, so the item is clean and the parent repeat is not marked.
	it('clears the item and leaves the parent alone when nothing differs from the save', () => {
		const changed = new Set(['icon_s']);
		const parentChanged = new Set<string>();
		let pending = true;
		clearStackPendingFlags(
			[
				{
					selected: true,
					fieldId: 'accounts_o',
					changedFieldIds: changed,
					savedItem: { icon_s: 'saved' },
					currentItem: { icon_s: 'saved' },
					setPending: (value) => {
						pending = value;
					}
				}
			],
			parentChanged
		);
		assert.equal(changed.size, 0);
		assert.equal(pending, false);
		assert.equal(parentChanged.size, 0);
	});

	// Close and minimize are the checkbox values read when Save is clicked.
	it('minimizes only when close after save is off', () => {
		assert.equal(
			repositorySaveFollowUp({ resultClose: false, closeAfterSave: false, minimizeAfterSave: true }),
			'minimize'
		);
		assert.equal(
			repositorySaveFollowUp({ resultClose: false, closeAfterSave: true, minimizeAfterSave: true }),
			'close'
		);
		assert.equal(
			repositorySaveFollowUp({ resultClose: false, closeAfterSave: false, minimizeAfterSave: false }),
			'stay'
		);
	});
});

describe('item launch visibility', () => {
	// A child the controller hid on this group is not counted. Without the group path it would be.
	it('counts fields with the repeat group path', () => {
		const hidden = scopeFieldCounts(['icon_s', 'url_s'], {
			irrelevantFieldPaths: new Set(['accounts_o.icon_s']),
			parentPath: 'accounts_o',
			scopeFieldIds: ['url_s']
		});
		assert.deepEqual(hidden, { showing: 1, total: 1 });
		const withoutPath = scopeFieldCounts(['icon_s', 'url_s'], {
			irrelevantFieldPaths: new Set(['accounts_o.icon_s']),
			scopeFieldIds: ['url_s']
		});
		assert.equal(withoutPath.total, 2);
	});

	// Every selected child is hidden, so the item form opens on the whole item.
	it('opens the whole item when every selected child is hidden', () => {
		const next = itemLaunchVisibleChildren(
			{ fieldId: 'accounts_o', index: 0, fieldIds: ['icon_s'] },
			new Set(['accounts_o.icon_s'])
		);
		assert.equal(next.fieldIds, null);
	});

	// A hidden child drops out. A child that can be shown stays.
	it('keeps the selected children that can be shown', () => {
		const next = itemLaunchVisibleChildren(
			{ fieldId: 'accounts_o', index: 0, fieldIds: ['icon_s', 'url_s'] },
			new Set(['accounts_o.icon_s'])
		);
		assert.deepEqual(next.fieldIds, ['url_s']);
	});
});
