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
 * Root-only is decided by descriptor metadata.rootOnly.
 * System types such as Internal Name declare that flag on their own descriptor.
 * Page Nav Order is the same path (rootOnly only; no remapped storage type).
 * A remapped system field (Internal Name stored as type input / id internal-name) loses
 * that descriptor when looked up by type, so callers also check readOnlyFieldsIds.
 * A plain input has neither rootOnly nor a reserved id.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import '../../../test/registerTsLoader.mjs';

const { isRootOnlyControl, isFieldRootOnly, readOnlyFieldsIds } = await import('./utils.ts');
const { controlDescriptors } = await import('./descriptors/controls/index.ts');

describe('isRootOnlyControl', () => {
	// The Internal Name system type keeps its own descriptor with rootOnly.
	it('treats the internal-name system type as root-only', () => {
		assert.equal(isRootOnlyControl(controlDescriptors['internal-name']), true);
	});

	// Internal Name is remapped to type input with a fixed id. Looking up by the remapped
	// type yields the input descriptor (not rootOnly); reserved field ids still mark it root-only.
	it('treats a remapped internal-name field as root-only via its reserved id', () => {
		const remappedDescriptor = controlDescriptors['input'];
		assert.equal(isRootOnlyControl(remappedDescriptor), false);
		assert.equal(isFieldRootOnly({ id: 'internal-name' }, remappedDescriptor), true);
		assert.equal(isFieldRootOnly({ id: 'placeInNav' }, controlDescriptors['checkbox']), true);
		assert.equal(isFieldRootOnly({ id: 'title_s' }, remappedDescriptor), false);
	});

	// page-nav-order is root-only only through metadata.rootOnly on its descriptor.
	it('treats page-nav-order as root-only through metadata.rootOnly', () => {
		assert.equal(controlDescriptors['page-nav-order'].metadata?.rootOnly, true);
		assert.equal(isRootOnlyControl(controlDescriptors['page-nav-order']), true);
	});

	// A normal input has no rootOnly flag and is not a reserved system field id.
	it('does not treat a plain input as root-only', () => {
		assert.equal(isRootOnlyControl(controlDescriptors['input']), false);
		assert.equal((readOnlyFieldsIds as string[]).includes('input'), false);
	});
});
