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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';

const {
	blockingFieldName,
	firstBlockingFieldId,
	minimumRequirementsCopy,
	minimumRequirementsNotice,
	missingMinimumSaveRequirements,
	saveButtonTip,
	validationAlertVariant
} = await import('./minimumSaveRequirements.ts');

describe('minimum save requirements', () => {
	it('needs a valid file name and an internal name on a full form', () => {
		const base = { isRepeatMode: false, isEmbedded: false };
		assert.deepEqual(missingMinimumSaveRequirements({ ...base, fileNameValid: true, internalName: 'Home' }), []);
		assert.deepEqual(missingMinimumSaveRequirements({ ...base, fileNameValid: false, internalName: 'Home' }), [
			'fileName'
		]);
		assert.deepEqual(missingMinimumSaveRequirements({ ...base, fileNameValid: true, internalName: '  ' }), [
			'internalName'
		]);
		assert.deepEqual(missingMinimumSaveRequirements({ ...base, fileNameValid: false, internalName: undefined }), [
			'fileName',
			'internalName'
		]);
	});

	it('needs only the internal name on an embedded form, stacked or not', () => {
		const base = { isRepeatMode: false, isEmbedded: true };
		assert.deepEqual(missingMinimumSaveRequirements({ ...base, fileNameValid: false, internalName: 'Card' }), []);
		assert.deepEqual(missingMinimumSaveRequirements({ ...base, fileNameValid: false, internalName: '' }), [
			'internalName'
		]);
	});

	it('needs nothing on a repeat item, which commits in memory', () => {
		assert.deepEqual(
			missingMinimumSaveRequirements({ isRepeatMode: true, isEmbedded: false, fileNameValid: false, internalName: '' }),
			[]
		);
	});
});

describe('minimum requirements copy', () => {
	it('names the blocking fields', () => {
		assert.equal(minimumRequirementsCopy([]), null);
		assert.equal(minimumRequirementsCopy(['fileName']), 'fileName');
		assert.equal(minimumRequirementsCopy(['internalName']), 'internalName');
		assert.equal(minimumRequirementsCopy(['fileName', 'internalName']), 'both');
	});

	it('uses the content type names, and the ids when the type has none', () => {
		const fields = { 'file-name': { name: 'Page URL' }, 'internal-name': { name: 'Label' } };
		assert.deepEqual(minimumRequirementsNotice(['fileName', 'internalName'], fields), {
			copy: 'both',
			fileName: 'Page URL',
			internalName: 'Label'
		});
		assert.deepEqual(minimumRequirementsNotice(['internalName'], undefined), {
			copy: 'internalName',
			fileName: 'file-name',
			internalName: 'internal-name'
		});
		assert.equal(minimumRequirementsNotice([], fields), null);
	});

	it('opens the first blocking field in form order', () => {
		const both = ['fileName', 'internalName'] as const;
		assert.equal(firstBlockingFieldId(both, ['title', 'file-name', 'internal-name']), 'file-name');
		assert.equal(firstBlockingFieldId(both, ['internal-name', 'file-name']), 'internal-name');
		assert.equal(firstBlockingFieldId(['internalName'], ['file-name', 'internal-name']), 'internal-name');
		assert.equal(firstBlockingFieldId(both, []), 'file-name');
		assert.equal(firstBlockingFieldId([], ['file-name']), undefined);
	});

	it('names the field the alert opens with the content type name', () => {
		const notice = { copy: 'both', fileName: 'Page URL', internalName: 'Label' } as const;
		assert.equal(blockingFieldName(notice, 'file-name'), 'Page URL');
		assert.equal(blockingFieldName(notice, 'internal-name'), 'Label');
		assert.equal(blockingFieldName(notice, undefined), undefined);
	});
});

describe('alert variant', () => {
	it('is the must-fix variant whenever the minimum is missing, with or without other errors', () => {
		assert.equal(validationAlertVariant({ missing: ['internalName'], errorCount: 0 }), 'minimumRequirements');
		assert.equal(validationAlertVariant({ missing: ['fileName'], errorCount: 4 }), 'minimumRequirements');
	});

	it('keeps the draft wording when only other fields are invalid', () => {
		assert.equal(validationAlertVariant({ missing: [], errorCount: 2 }), 'draft');
	});

	it('is absent for a clean form', () => {
		assert.equal(validationAlertVariant({ missing: [], errorCount: 0 }), null);
	});
});

describe('save button tip', () => {
	const idle = { blocked: false, disableSave: true, isSubmitting: false, hasPendingChanges: false };

	it('explains the minimum requirements before the idle tip', () => {
		assert.equal(saveButtonTip({ ...idle, blocked: true }), 'minimumRequirements');
		assert.equal(saveButtonTip({ ...idle, blocked: true, hasPendingChanges: true }), 'minimumRequirements');
		assert.equal(saveButtonTip({ ...idle, blocked: true, disableSave: false }), 'minimumRequirements');
	});

	it('says no changes only for an idle form that is disabled', () => {
		assert.equal(saveButtonTip(idle), 'noChanges');
		assert.equal(saveButtonTip({ ...idle, hasPendingChanges: true }), null);
		assert.equal(saveButtonTip({ ...idle, disableSave: false }), null);
	});

	it('stays quiet while a save is running', () => {
		assert.equal(saveButtonTip({ ...idle, isSubmitting: true }), null);
		assert.equal(saveButtonTip({ ...idle, blocked: true, isSubmitting: true }), null);
	});
});
