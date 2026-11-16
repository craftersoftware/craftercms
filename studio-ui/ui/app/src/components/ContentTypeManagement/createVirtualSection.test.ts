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

import '../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { commonPropertiesSectionId, createVirtualSection, createVirtualTypeForDataSource, createVirtualTypeForField } =
	await import('./utils.ts');
const { controlDescriptors } = await import('./descriptors/controls/index.ts');
const { dataSourceDescriptors } = await import('./descriptors/dataSources/index.ts');

const formatMessage = ((descriptor: { defaultMessage?: string }) => descriptor.defaultMessage) as never;

describe('createVirtualSection ids', () => {
	it('gives new sections unique ids, even when they share a title', () => {
		const sections = Array.from({ length: 50 }, () => createVirtualSection({ title: 'New Section', fields: [] }));
		const ids = sections.map((section) => section.id);
		assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0));
		assert.equal(new Set(ids).size, sections.length);
	});

	it('keeps an id that was provided, including when the section is spread into the call', () => {
		const original = createVirtualSection({ title: 'Details', fields: ['a'] });
		assert.equal(createVirtualSection({ id: 'section-3', title: 'Details', fields: [] }).id, 'section-3');
		assert.equal(createVirtualSection({ ...original }).id, original.id);
	});

	it('generates an id when the data has an undefined, null or empty one', () => {
		for (const id of [undefined, null, '']) {
			const section = createVirtualSection({ id, title: 'Details', fields: [] });
			assert.equal(typeof section.id, 'string');
			assert.ok(section.id.length > 0, `id ${String(id)} is replaced`);
		}
	});
});

describe('section ids in descriptor-derived virtual types', () => {
	const descriptorsByName = {
		...Object.fromEntries(Object.entries(controlDescriptors).map(([name, d]) => [`field ${name}`, d])),
		...Object.fromEntries(Object.entries(dataSourceDescriptors).map(([name, d]) => [`data source ${name}`, d]))
	};

	it('are unique within every field and data source panel', () => {
		const repeated: string[] = [];
		for (const [name, descriptor] of Object.entries(descriptorsByName)) {
			const virtualType = name.startsWith('field ')
				? createVirtualTypeForField(descriptor, formatMessage)
				: createVirtualTypeForDataSource(descriptor, formatMessage);
			const ids = virtualType.sections.map((section) => section.id);
			if (new Set(ids).size !== ids.length) repeated.push(`${name}: ${ids.join(', ')}`);
		}
		assert.deepEqual(repeated, []);
	});

	it('use a Basic Properties section id that no descriptor declares for itself', () => {
		for (const [name, descriptor] of Object.entries(descriptorsByName)) {
			const own = (descriptor.sections ?? []).map((section) => section.id);
			assert.ok(!own.includes(commonPropertiesSectionId), `${name} declares ${commonPropertiesSectionId}`);
		}
	});
});
