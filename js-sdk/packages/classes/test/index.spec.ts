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
import { crafterConf, httpGet, httpPost } from '@craftercms/classes';
import { expect } from 'chai';
import { beforeEach } from 'mocha';
import * as nock from 'nock';
import * as xhr2 from 'xhr2';

// @ts-ignore - Setting global XMLHttpRequest for testing (not available on node)
global.XMLHttpRequest = xhr2.XMLHttpRequest;

// https://github.com/nock/nock/issues/2397
import fetch, { Headers, Request, Response } from 'node-fetch';

if (!globalThis.fetch) {
	(globalThis as any).fetch = fetch;
	(globalThis as any).Headers = Headers;
	(globalThis as any).Request = Request;
	(globalThis as any).Response = Response;
}

describe('CrafterCMS Classes', () => {
	beforeEach(() => {
		// replace the real XHR object with the mock XHR object before each test
		if (!nock.isActive()) {
			nock.activate();
		}
	});
	// put the real XHR object back and clear the mocks after each test
	afterEach(() => nock.cleanAll());

	describe('ConfigManager', () => {
		// Tests that crafterConfig returns a default configuration when no configuration is set.
		// Values from the default configuration are mostly empty. Actual values are tested in next test.
		it('Should have a default configuration', () => {
			const defaultConfig = crafterConf.getConfig();
			expect(defaultConfig).to.be.an('object');
			expect(defaultConfig).to.have.property('site');
			expect(defaultConfig).to.have.property('baseUrl');
			expect(defaultConfig).to.have.property('endpoints');
			expect(defaultConfig).to.have.property('contentTypeRegistry');
			expect(defaultConfig).to.have.property('headers');
		});
		// Tests that after setting a new configuration, the provided values are set.
		// e.g. an endpoint value should be different from the default value.
		it('Should be able to set a new configuration', () => {
			const newConfig = {
				baseUrl: 'http://localhost:8080',
				site: 'editorial',
				searchId: 'test_search_id',
				endpoints: {
					GET_ITEM_URL: '/new_api/content_store/item.json',
					GET_DESCRIPTOR: '/new_api/content_store/descriptor.json',
					GET_CHILDREN: '/new_api/content_store/children.json',
					GET_TREE: '/new_api/content_store/tree.json',
					GET_NAV_TREE: '/new_api/navigation/tree.json',
					GET_BREADCRUMB: '/new_api/navigation/breadcrumb.json',
					TRANSFORM_URL: '/new_api/url/transform.json',
					SEARCH: '/new_api/search/search.json'
				}
			};
			crafterConf.configure(newConfig);
			const updatedConfig = crafterConf.getConfig();
			expect(updatedConfig.site).to.equal(newConfig.site);
			expect(updatedConfig.baseUrl).to.equal(newConfig.baseUrl);
			expect(updatedConfig.endpoints.GET_ITEM_URL).to.equal(newConfig.endpoints.GET_ITEM_URL);
			expect(updatedConfig.endpoints.GET_DESCRIPTOR).to.not.equal('/api/1/content_store/descriptor.json');
		});
		// Tests that the mix method returns a mix of the current configuration (set at the previous tes) and the new values
		// set at this test.
		it('Should return a mix of the current config and the provided config', () => {
			const mixConfig = crafterConf.mix({
				baseUrl: 'http://localhost:3000',
				site: 'test_site'
			});
			expect(mixConfig.site).to.equal('test_site');
			expect(mixConfig.site).to.not.equal('editorial');
			expect(mixConfig.baseUrl).to.equal('http://localhost:3000');
			expect(mixConfig.endpoints.GET_DESCRIPTOR).to.equal('/new_api/content_store/descriptor.json');
			expect(mixConfig.endpoints.GET_DESCRIPTOR).to.not.equal('/api/1/content_store/descriptor.json');
		});
	});

	describe('SDKService', () => {
		describe('httpGet', () => {
			// Test the httpGet method with a mocked GET request.
			it('Should return a response from the GET request', (done) => {
				nock('http://localhost:8080').get('/api/1/test/getItem').query({ id: 1 }).reply(200, { id: 1, name: 'test' });

				httpGet('http://localhost:8080/api/1/test/getItem?id=1').subscribe((response) => {
					expect(response).to.not.be.null;
					expect(response).to.be.an('object');
					expect(response).to.deep.equal({ id: 1, name: 'test' });
					done();
				});
			});
		});

		describe('httpPost', () => {
			// Test the httpPost method with a mocked POST request.
			it('Should return a response from the POST request', (done) => {
				nock('http://localhost:8080').post('/api/1/test/addItem').reply(200, { result: 'success', id: 1 });

				httpPost('http://localhost:8080/api/1/test/addItem', { id: 1, name: 'test' }).subscribe((response) => {
					expect(response).to.be.an('object');
					expect(response).to.deep.equal({ result: 'success', id: 1 });
					done();
				});
			});
		});
	});
});
