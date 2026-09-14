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

import 'mocha';
import { expect } from 'chai';
import { crafterConf } from '@craftercms/classes';
import { fetchIsAuthoring, getICEAttributes, getDropZoneAttributes } from '@craftercms/ice';
import { useDropZone, useICE } from '@craftercms/ice/react';
import { iCEAttributes, model } from './mock-responses';
import * as nock from 'nock';
import { renderHook } from '@testing-library/react';
import { JSDOM } from 'jsdom';

// https://github.com/nock/nock/issues/2397
import fetch, { Headers, Request, Response } from 'node-fetch';
import { beforeEach } from 'mocha';

if (!globalThis.fetch) {
	(globalThis as any).fetch = fetch;
	(globalThis as any).Headers = Headers;
	(globalThis as any).Request = Request;
	(globalThis as any).Response = Response;
}

const dom = new JSDOM('<!doctype html><html><body></body></html>');
declare var global: any;
(global as any).document = dom.window.document;
(global as any).window = dom.window;

crafterConf.configure({
	baseUrl: 'http://localhost:8080',
	site: 'editorial'
});

describe('Crafter CMS ICE', () => {
	beforeEach(() => {
		// replace the real XHR object with the mock XHR object before each test
		if (!nock.isActive()) {
			nock.activate();
		}
	});
	// put the real XHR object back and clear the mocks after each test
	afterEach(() => nock.cleanAll());

	describe('getICEAttributes', () => {
		// Test the getICEAttributes function, given a model, check that the correct ICE attributes are returned
		it('should return the correct ICE attributes for a model', () => {
			const attributes = getICEAttributes({ model });
			expect(attributes).to.include.keys('data-studio-ice');
			expect(attributes).to.include.keys('data-studio-ice-path');
			expect(attributes).to.include.keys('data-studio-ice-label');
			expect(attributes).to.include.keys('data-studio-component');
			expect(attributes).to.include.keys('data-studio-component-path');
			expect(attributes).to.deep.equal(iCEAttributes);
		});
		it('should return an empty object if the model is not complete', () => {
			const incompleteModel = {
				craftercms: {
					id: null,
					path: null,
					label: null,
					dateCreated: null,
					dateModified: null,
					contentTypeId: null,
					disabled: null
				}
			};
			const attributes = getICEAttributes({ model: incompleteModel });
			expect(attributes).to.be.empty;
		});
	});

	describe('getDropZoneAttributes', () => {
		// Test the getDropZoneAttributes function, given a model and zone name, check that the correct drop zone attributes
		// are returned. If isAuthoring is false, the function should return an empty object
		it('should return the correct drop zone attributes', () => {
			const attributesAuthoring = getDropZoneAttributes({
				model,
				zoneName: 'testZone'
			});
			const attributesNoAuthoring = getDropZoneAttributes({
				model,
				zoneName: 'testZone',
				isAuthoring: false
			});
			expect(attributesAuthoring['data-studio-components-target']).to.equal('testZone');
			expect(attributesAuthoring['data-studio-components-objectid']).to.equal(model.craftercms.id);
			expect(attributesAuthoring['data-studio-zone-content-type']).to.equal(model.craftercms.contentTypeId);
			expect(attributesNoAuthoring).to.be.empty;
		});
	});

	describe('fetchIsAuthoring', () => {
		// Test the fetchIsAuthoring function to return the preview value, given a CrafterCMS configuration with a mocked GET request.
		it('should return true if the site is in authoring mode', (done) => {
			nock('http://localhost:8080')
				.get('/api/1/config/preview.json')
				.query({
					crafterSite: 'editorial'
				})
				.reply(200, { preview: true });

			fetchIsAuthoring().then((isAuthoring) => {
				expect(isAuthoring).to.be.true;
				done();
			});
		});
	});

	describe('useICE', () => {
		// Test the useICE hook, given a model, check that the correct ICE attributes are returned
		it('should return the ICE attributes for a model using the useICE hook', () => {
			const { result } = renderHook(() => useICE({ model }));
			expect(result.current.props).to.include.keys('data-studio-ice');
			expect(result.current.props).to.include.keys('data-studio-ice-path');
			expect(result.current.props).to.include.keys('data-studio-ice-label');
			expect(result.current.props).to.include.keys('data-studio-component');
			expect(result.current.props).to.include.keys('data-studio-component-path');
			expect(result.current.props).to.deep.equal(iCEAttributes);
		});
	});

	describe('useDropZone', () => {
		// Test the useDropZone hook, given a model and zone name, check that the correct drop zone attributes are returned
		it('should return the drop zone attributes for a model using the useDropZone hook', () => {
			const { result } = renderHook(() => useDropZone({ model, zoneName: 'testZone' }));
			expect(result.current.props['data-studio-components-target']).to.equal('testZone');
			expect(result.current.props['data-studio-components-objectid']).to.equal(model.craftercms.id);
			expect(result.current.props['data-studio-zone-content-type']).to.equal(model.craftercms.contentTypeId);
		});
	});
});
