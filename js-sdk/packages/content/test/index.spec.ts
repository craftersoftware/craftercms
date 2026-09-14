/*
 * Copyright (C) 2007-2021 Crafter Software Corporation. All Rights Reserved.
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

import {
	ContentStoreService,
	NavigationService,
	UrlTransformationService,
	parseDescriptor,
	extractContent,
	parseProps,
	parseFieldValue,
	preParseSearchResults
} from '@craftercms/content';
import { crafterConf } from '@craftercms/classes';
import 'url-search-params-polyfill';
import { expect } from 'chai';
import { item, descriptor, children, tree, navTree, navBreadcrumb, renderUrl, storeUrl } from './mock-responses';
import * as nock from 'nock';

// https://github.com/nock/nock/issues/2397
import fetch, { Headers, Request, Response } from 'node-fetch';
import { item2, parsedItem, parsedSearchHit, unparsedSearchHit } from '../../../util/mock-responses-common';
import { ContentInstance } from '../../../dist/packages/models';

if (!globalThis.fetch) {
	(globalThis as any).fetch = fetch;
	(globalThis as any).Headers = Headers;
	(globalThis as any).Request = Request;
	(globalThis as any).Response = Response;
}

crafterConf.configure({
	baseUrl: 'http://localhost:8080',
	site: 'editorial'
});

describe('Engine Client', () => {
	// replace the real XHR object with the mock XHR object before each test
	beforeEach(() => {
		if (!nock.isActive()) {
			nock.activate();
		}
	});

	// put the real XHR object back and clear the mocks after each test
	afterEach(() => nock.cleanAll());
	const { baseUrl, site: crafterSite, endpoints } = crafterConf.getConfig();

	describe('Content Store Service', () => {
		describe('getItem', () => {
			// Tests the contentStore getItem method. Checks that it returns the index item of the site editorial.
			it('return the index item', (done) => {
				nock(baseUrl)
					.get(endpoints.GET_ITEM_URL)
					.query({
						crafterSite,
						url: '/site/website/index.xml'
					})
					.reply(200, item);

				ContentStoreService.getItem('/site/website/index.xml').subscribe((respItem) => {
					expect(respItem).to.not.be.null;
					expect(respItem.url).to.equal(item.url);
					expect(respItem.url).to.not.equal(item2.url);
					expect(respItem.descriptorDom.page.objectId).to.equal(item.descriptorDom.page.objectId);
					expect(respItem.descriptorDom.page.objectId).to.not.equal(item2.descriptorDom.page.objectId);
					expect(respItem.descriptorDom.page['internal-name']).to.equal(item.descriptorDom.page['internal-name']);
					expect(respItem).not.to.deep.equal(item2);
					done();
				});
			});
		});

		describe('getDescriptor', () => {
			// Tests the contentStore getDescriptor method. Checks that it returns the index descriptor of the site editorial.
			it('return the index descriptor', (done) => {
				nock(baseUrl)
					.get(endpoints.GET_DESCRIPTOR)
					.query({
						crafterSite,
						flatten: false,
						url: '/site/website/index.xml'
					})
					.reply(200, descriptor);

				ContentStoreService.getDescriptor('/site/website/index.xml').subscribe((respDescriptor) => {
					expect(respDescriptor).to.not.be.null;
					expect(respDescriptor.page.objectId).to.equal(descriptor.page.objectId);
					done();
				});
			});
		});

		describe('getChildren', () => {
			// Tests the contentStore getChildren method. Checks that it returns the children of the index page of the site editorial.
			// The children length at its ids should match the expected values.
			it('return the child pages', (done) => {
				nock(baseUrl)
					.get(endpoints.GET_CHILDREN)
					.query({
						crafterSite,
						url: '/site/website/'
					})
					.reply(200, children);

				ContentStoreService.getChildren('/site/website/').subscribe((respChildren) => {
					const childrenNames = [
						'articles',
						'crafter-level-descriptor.level.xml',
						'entertainment',
						'health',
						'index.xml',
						'search-results',
						'style',
						'technology'
					];
					const allChildrenExist = childrenNames.every((name) => respChildren.find((child) => child.name === name));
					expect(respChildren, `index should have ${children.length} child pages`).to.have.lengthOf(children.length);
					expect(
						allChildrenExist,
						'all children from getChildren response should match the expected children from mock response'
					).to.be.true;
					done();
				});
			});
		});

		describe('getTree', () => {
			// Tests the contentStore getTree method. Checks that it returns the tree of `/articles/2021` folder of the site editorial.
			it('return the page tree', (done) => {
				nock(baseUrl)
					.get(endpoints.GET_TREE)
					.query({
						crafterSite,
						depth: 3,
						url: '/site/website/articles/2021'
					})
					.reply(200, tree);

				ContentStoreService.getTree('/site/website/articles/2021', 3).subscribe((respTree) => {
					expect(respTree.name).to.equal(tree.name);
					expect(respTree.children, `tree should have ${tree.children.length} child pages`).to.have.lengthOf(
						tree.children.length
					);
					expect(respTree.children[0].name).to.equal('1');
					expect(respTree.children[2].name).to.equal('3');
					done();
				});
			});
		});
	});

	describe('Navigation Service', () => {
		describe('getNavTree', () => {
			// Tests the navigation getNavTree method. Checks that it returns the correct navigation tree of the site editorial.
			it('return the nav tree', (done) => {
				nock(baseUrl)
					.get(endpoints.GET_NAV_TREE)
					.query({
						crafterSite,
						currentPageUrl: null,
						depth: 3,
						url: '/site/website'
					})
					.reply(200, navTree);

				NavigationService.getNavTree('/site/website', 3).subscribe((respTree) => {
					expect(respTree.label, 'tree should start at the index').to.equal(navTree.label);
					expect(respTree.subItems, 'tree should have subItems').to.exist;
					expect(respTree.subItems).to.deep.equal(navTree.subItems);
					done();
				});
			});
		});
		describe('getNavBreadcrumb', () => {
			// Tests the navigation getNavBreadcrumb method. Checks that it returns the correct items for the navigation
			// breadcrumb of the site editorial.
			it('return the nav breadcrumb', (done) => {
				nock(baseUrl)
					.get(endpoints.GET_BREADCRUMB)
					.query({
						crafterSite,
						root: null,
						url: '/site/website/style/index.xml'
					})
					.reply(200, navBreadcrumb);

				NavigationService.getNavBreadcrumb('/site/website/style/index.xml').subscribe((respNavBreadcrumb) => {
					expect(respNavBreadcrumb, `breadcrumb should have ${navBreadcrumb.length} items`).to.have.lengthOf(
						navBreadcrumb.length
					);
					expect(respNavBreadcrumb[0].label, `first item should be ${navBreadcrumb[0].label}`).to.equal(
						navBreadcrumb[0].label
					);
					expect(
						respNavBreadcrumb[respNavBreadcrumb.length - 1].label,
						`last item should be ${navBreadcrumb[navBreadcrumb.length - 1].label}`
					).to.equal(navBreadcrumb[navBreadcrumb.length - 1].label);
					done();
				});
			});
		});
	});

	describe('URL Service', () => {
		describe('transform', () => {
			// Tests the urlTransformation transform method. Checks that the response is the expected render url
			// (/site/website/style/index.xml => /style).
			it('return the render url', (done) => {
				nock(baseUrl)
					.get(endpoints.TRANSFORM_URL)
					.query({
						crafterSite,
						transformerName: 'storeUrlToRenderUrl',
						url: '/site/website/style/index.xml'
					})
					.reply(200, `"${renderUrl}"`);

				UrlTransformationService.transform('storeUrlToRenderUrl', '/site/website/style/index.xml').subscribe((url) => {
					expect(url).to.equal(renderUrl);
					done();
				});
			});

			it('return the store url', (done) => {
				// Tests the urlTransformation transform method. Checks that the response is the expected render url
				// (/technology => /site/website/technology/index.xml).
				nock(baseUrl)
					.get(endpoints.TRANSFORM_URL)
					.query({
						crafterSite,
						transformerName: 'renderUrlToStoreUrl',
						url: '/technology'
					})
					.reply(200, `"${storeUrl}"`);

				UrlTransformationService.transform('renderUrlToStoreUrl', '/technology').subscribe((url) => {
					expect(url).to.equal(storeUrl);
					done();
				});
			});
		});
	});
});

describe('Object Utils', () => {
	describe('parseDescriptor util', () => {
		it('should parse the raw descriptor correctly with different options', () => {
			const parsedDescriptor = parseDescriptor(item, { parseFieldValueTypes: true });
			expect(parsedDescriptor).to.not.be.null;
			expect(parsedDescriptor.selected_b).to.equal(true);
			expect(parsedDescriptor.craftercms.label).to.equal(parsedItem.craftercms.label);
			expect(parsedDescriptor.hero_image).to.not.be.undefined;
			expect(parsedDescriptor.craftercms.dateCreated).to.not.be.null;
			expect(parsedDescriptor).to.deep.equal(parsedItem);

			const parsedDescriptorWOptions = parseDescriptor(item, {
				parseFieldValueTypes: false,
				systemPropMap: { 'internal-name': 'itemName' },
				ignoredProps: ['hero_image'],
				systemProps: ['internal-name', 'disabled', 'objectId']
			});
			expect(parsedDescriptorWOptions.selected_b).to.equal('true');
			// @ts-ignore - systemProp 'label' has been changed to 'itemName'
			expect(parsedDescriptorWOptions.craftercms.itemName).to.equal(parsedItem.craftercms.label);
			// 'hero_image' was set to be ignored in the options
			expect(parsedDescriptorWOptions.hero_image).to.be.undefined;
			// 'dateCreated' was not added in the systemProps in the options
			expect(parsedDescriptorWOptions.craftercms.dateCreated).to.be.null;
		});
	});

	describe('parseProps util', () => {
		it('should parse a set of props correctly with different options', () => {
			let parsed: ContentInstance = {
				craftercms: {
					id: null,
					path: null,
					label: null,
					contentTypeId: null,
					dateCreated: null,
					dateModified: null,
					disabled: false
				}
			};
			const parsedProps = parseProps(descriptor.page, parsed, { parseFieldValueTypes: true });
			expect(parsedProps).to.not.be.null;
			expect(parsedProps.selected_b).to.equal(true);
			expect(parsedProps.craftercms.label).to.equal(parsedItem.craftercms.label);
			expect(parsedProps.hero_image).to.equal(parsedItem.hero_image);
			expect(parsedProps.craftercms.dateCreated).to.equal(parsedItem.craftercms.dateCreated);

			const parsedPropsWOptions = parseProps(descriptor.page, parsed, {
				parseFieldValueTypes: false,
				systemPropMap: { 'internal-name': 'itemName' }
			});
			expect(parsedPropsWOptions.selected_b).to.equal('true');
			// @ts-ignore - systemProp 'label' has been changed to 'itemName'
			expect(parsedPropsWOptions.craftercms.itemName).to.equal(parsedItem.craftercms.label);
		});
	});

	describe('parseFieldValue util', () => {
		it('should parse the values based on the propName suffix', () => {
			const parsedInteger = parseFieldValue('myInteger_i', '15');
			const parsedFloating = parseFieldValue('myFloating_f', '15.5');
			const parsedBoolean = parseFieldValue('myBoolean_b', 'true');
			const parsedString = parseFieldValue('myString_s', 'myString');
			const parsedDate = parseFieldValue('myDate_dt', '2021-10-20T00:00:00Z');

			expect(parsedInteger).to.equal(15);
			expect(parsedFloating).to.equal(15.5);
			expect(parsedBoolean).to.equal(true);
			expect(parsedString).to.equal('myString');
			expect(parsedDate).to.equal('2021-10-20T00:00:00Z');
		});
	});

	describe('extractContent util', () => {
		it('should extract the content from the descriptor, independently if the data is a descriptor or an item', () => {
			const contentFromDescriptor = extractContent(descriptor);
			const contentFromItem = extractContent(item);
			expect({ ...contentFromDescriptor, path: item.url }).to.deep.equal(contentFromItem);
		});
	});

	describe('preParseSearchResults util', () => {
		it('should pre-parse the search results correctly', () => {
			const preParsedSearchResult = preParseSearchResults(unparsedSearchHit);
			expect(preParsedSearchResult).to.not.be.null;
			expect(preParsedSearchResult).to.deep.equal = parsedSearchHit;
		});
	});
});
