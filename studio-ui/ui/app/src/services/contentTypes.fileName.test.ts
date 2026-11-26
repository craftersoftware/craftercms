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
import '../../test/registerTsLoader.mjs';

const { parseLegacyFormDefinition } = await import('./contentTypes.ts');

describe('file-name maxlength mapping', () => {
	// Given a file-name control with a maxlength property, the parser maps it to validations.maxLength
	// so FileName and rename dialogs can enforce the limit (same path as input/textarea).
	it('maps maxlength to validations.maxLength', () => {
		const parsed = parseLegacyFormDefinition({
			'content-type': '/page/article',
			title: 'Article',
			description: '',
			objectType: 'page',
			sections: {
				section: {
					title: 'Main',
					description: '',
					defaultOpen: 'true',
					fields: {
						field: {
							id: 'file-name',
							title: 'File Name',
							description: '',
							type: 'file-name',
							properties: {
								property: { name: 'maxlength', value: '50', type: 'int' }
							}
						}
					}
				}
			}
		} as never);

		const field = parsed.fields['file-name'];
		assert.equal(field.validations.maxLength?.id, 'maxLength');
		assert.equal(field.validations.maxLength?.value, 50);
		assert.equal(field.validations.maxLength?.level, 'required');
	});

	// Hand-edited maxlength that cannot be used as a positive integer: warn once at parse, leave no usable limit.
	it('warns once for an unusable maxlength', () => {
		const warnings: string[] = [];
		const original = console.warn;
		console.warn = (message?: unknown) => {
			warnings.push(String(message));
		};
		try {
			const parsed = parseLegacyFormDefinition({
				'content-type': '/page/article',
				title: 'Article',
				description: '',
				objectType: 'page',
				sections: {
					section: {
						title: 'Main',
						description: '',
						defaultOpen: 'true',
						fields: {
							field: {
								id: 'title_s',
								title: 'Title',
								description: '',
								type: 'input',
								properties: {
									property: { name: 'maxlength', value: 'abc', type: 'int' }
								}
							}
						}
					}
				}
			} as never);

			assert.equal(parsed.fields['title_s'].validations.maxLength?.value, 'abc');
			assert.equal(warnings.length, 1);
			assert.equal(
				warnings[0],
				'[parseLegacyFormDef] Unusable maxlength "abc" on content type "/page/article" field "title_s". No length limit is applied.'
			);
		} finally {
			console.warn = original;
		}
	});
});
