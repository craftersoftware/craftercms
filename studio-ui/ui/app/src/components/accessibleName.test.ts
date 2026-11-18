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

import '../../test/stringListDomSetup.mjs';
import '../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { accessibleName } = await import('../../test/accessibleName.ts');

describe('accessibleName', () => {
	it('falls back to aria-label when no aria-labelledby id resolves', () => {
		const node = document.createElement('div');
		node.setAttribute('aria-labelledby', 'nope1 nope2');
		node.setAttribute('aria-label', 'Fallback');
		document.body.appendChild(node);
		try {
			assert.equal(accessibleName(node), 'Fallback');
		} finally {
			node.remove();
		}
	});
});
