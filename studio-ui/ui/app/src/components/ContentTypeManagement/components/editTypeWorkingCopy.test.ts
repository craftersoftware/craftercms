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
 * EditTypeView keeps a deep working copy and applies structural updates from the latest
 * state (not a render-time closure). Side effects must run outside setState updaters so
 * React StrictMode cannot double-fire them.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../../test/registerTsLoader.mjs';

const {
	applyTypeStateUpdate,
	createTypeWorkingCopy,
	deleteDataSourceFromType,
	insertDataSourceIntoType,
	reorderTypeSections
} = await import('./editTypeWorkingCopy.ts');
const { createEmptyTypeStructure } = await import('../utils.ts');

function section(id: string, title = id) {
	return { id, title, description: '', fields: [], expandByDefault: true, color: null };
}

function dataSource(id: string) {
	return { id, title: id, type: 'components', interface: '', properties: {} };
}

function makeType() {
	return createEmptyTypeStructure({
		id: '/page/article',
		name: 'Article',
		type: 'page',
		sections: [section('a', 'A'), section('b', 'B'), section('c', 'C')],
		dataSources: [dataSource('ds-a'), dataSource('ds-b')],
		fields: {
			title_s: { id: 'title_s', name: 'Title', type: 'input', fields: {}, properties: {}, validations: {} }
		}
	});
}

describe('editTypeWorkingCopy', () => {
	// Baseline isolation: mutating the working copy must not change props.type (rollback/diff source).
	it('keeps the working copy isolated from the baseline type', () => {
		const baseline = makeType();
		const working = createTypeWorkingCopy(baseline);

		working.name = 'Edited';
		working.sections[0].title = 'Mutated section';
		working.fields.title_s.name = 'Mutated field';
		working.dataSources[0].title = 'Mutated DS';
		working.sections.push(section('d', 'D'));

		assert.equal(baseline.name, 'Article');
		assert.equal(baseline.sections[0].title, 'A');
		assert.equal(baseline.fields.title_s.name, 'Title');
		assert.equal(baseline.dataSources[0].title, 'ds-a');
		assert.equal(baseline.sections.length, 3);
		assert.notEqual(working.sections[0], baseline.sections[0]);
		assert.notEqual(working.fields.title_s, baseline.fields.title_s);
	});

	// Reorder side effect once: compute + setType + after, never inside a StrictMode-doubled updater.
	it('runs the reorder side effect once even when setState updaters would run twice', () => {
		let state = makeType();
		let sideEffectCount = 0;
		const after = () => {
			sideEffectCount += 1;
		};

		// Bad pattern (for contrast): side effect inside an updater StrictMode invokes twice.
		let badCount = 0;
		const setTypeStrictMode = (updater: (current: typeof state) => typeof state) => {
			state = updater(state);
			state = updater(state);
		};
		setTypeStrictMode((current) => {
			badCount += 1;
			return reorderTypeSections(current, [{ key: 'c' }, { key: 'a' }, { key: 'b' }]);
		});
		assert.equal(badCount, 2);

		// Good pattern used by EditTypeView: side effect outside setType.
		state = makeType();
		applyTypeStateUpdate(
			() => state,
			(next) => {
				state = next;
			},
			(current) => reorderTypeSections(current, [{ key: 'c' }, { key: 'a' }, { key: 'b' }]),
			after
		);

		assert.equal(sideEffectCount, 1);
		assert.deepEqual(
			state.sections.map((s) => s.id),
			['c', 'a', 'b']
		);
	});

	// Delete must read current state so a pending insert since the last render is not dropped.
	it('deletes a data source from the current state, preserving pending inserts', () => {
		const renderTimeType = makeType();
		// Simulated pending change applied after the render that closed over `type`.
		let current = insertDataSourceIntoType(renderTimeType, dataSource('ds-pending'), 1);

		// Wrong (historical bug): filter the closed-over render-time snapshot, then spread into an updater.
		const staleDelete = {
			...current,
			dataSources: renderTimeType.dataSources.filter((ds) => ds.id !== 'ds-a')
		};
		assert.equal(
			staleDelete.dataSources.some((ds) => ds.id === 'ds-pending'),
			false,
			'stale closed-over filter drops the pending insert'
		);

		// Right: derive the next list from the updater's current value.
		current = deleteDataSourceFromType(current, 'ds-a');
		assert.deepEqual(
			current.dataSources.map((ds) => ds.id),
			['ds-pending', 'ds-b']
		);
	});
});
