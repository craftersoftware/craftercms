/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

import { crafterConf } from '@craftercms/classes';
import {
	composeUrl,
	createLookupTable,
	extendDeep,
	isPlainObject,
	notNullOrUndefined,
	nullOrUndefined
} from '@craftercms/utils';
import { expect } from 'chai';

crafterConf.configure({
	baseUrl: 'http://localhost:8080',
	site: 'editorial'
});

describe('Utilities', () => {
	describe('composeUrl utility', () => {
		// Tests the composeUrl function. Checks that it composes an url with a base url or a crafterConfig and an endpoint.
		it('should compose a url with a base url or a crafterConfig and an endpoint', () => {
			const url = composeUrl('http://localhost:8080/', 'api/1/site');
			const url2 = composeUrl(crafterConf.getConfig(), 'api/1/site');
			const url3 = composeUrl('http://localhost:9090', 'api/2/site');
			const expectedUrl = 'http://localhost:8080/api/1/site';
			expect(url).to.equal(expectedUrl);
			expect(url2).to.equal(expectedUrl);
			expect(url3).to.not.equal(expectedUrl);
		});
	});

	describe('isPlainObject utility', () => {
		// Tests the isPlainObject function. Checks that it returns true if the object is a plain object. Other values like
		// null, undefined, arrays, and strings should return false.
		it('should return true if the object is a plain object', () => {
			expect(isPlainObject({})).to.be.true;
			expect(isPlainObject({ a: 1 })).to.be.true;
			expect(isPlainObject(null)).to.be.false;
			expect(isPlainObject(undefined)).to.be.false;
			expect(isPlainObject([])).to.be.false;
			expect(isPlainObject('test')).to.be.false;
		});
	});

	describe('extendDeep utility', () => {
		// Tests the extendDeep function. Checks that it extends the source object with the target object, where the latter
		// object has precedence.
		it('should extend the target object with the source object', () => {
			const source = { a: 1, b: 2 };
			const target = { b: 3, c: 4 };
			expect(extendDeep(source, target)).to.deep.equal({ b: 3, c: 4, a: 1 });
		});
	});

	describe('nullOrUndefined utility', () => {
		// Tests the nullOrUndefined function. Checks that it returns true only if the value is null or undefined.
		it('should return true if the value is null or undefined', () => {
			expect(nullOrUndefined(null)).to.be.true;
			expect(nullOrUndefined(undefined)).to.be.true;
			expect(nullOrUndefined('test')).to.be.false;
		});
	});

	describe('notNullOrUndefined utility', () => {
		// Tests the notNullOrUndefined function. Checks that it returns true if the value is neither null nor undefined.
		it('should return true if the value is neither null nor undefined', () => {
			expect(notNullOrUndefined(null)).to.be.false;
			expect(notNullOrUndefined(undefined)).to.be.false;
			expect(notNullOrUndefined('test')).to.be.true;
		});
	});

	describe('createLookupTable utility', () => {
		// Tests the createLookupTable function. Checks that it creates a lookup table from a list of objects.
		it('should create a lookup table from a list of objects', () => {
			const list = [
				{ id: 1, name: 'test1' },
				{ id: 2, name: 'test2' },
				{ id: 3, name: 'test3' }
			];
			const table1 = {
				1: { id: 1, name: 'test1' },
				2: { id: 2, name: 'test2' },
				3: { id: 3, name: 'test3' }
			};
			const table2 = {
				test1: { id: 1, name: 'test1' },
				test2: { id: 2, name: 'test2' },
				test3: { id: 3, name: 'test3' }
			};

			const lookupTableById = createLookupTable(list);
			const lookupTableByName = createLookupTable(list, 'name');
			expect(lookupTableById).to.deep.equal(table1);
			expect(lookupTableByName).to.deep.equal(table2);
		});
	});
});
