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

import 'mocha';
import 'url-search-params-polyfill';
import { expect } from 'chai';

import { crafterConf } from '@craftercms/classes';

import {
	createReduxStore,
	getItem,
	getItemComplete,
	itemsReducer,
	getItemEpic,
	getDescriptor,
	getDescriptorComplete,
	descriptorsReducer,
	getDescriptorEpic,
	getChildren,
	getChildrenComplete,
	childrenReducer,
	getChildrenEpic,
	getTree,
	getTreeComplete,
	treeReducer,
	getTreeEpic,
	getNav,
	getNavComplete,
	navigationReducer,
	getNavEpic,
	getNavBreadcrumb,
	getNavBreadcrumbComplete,
	breadcrumbsReducer,
	getNavBreadcrumbEpic,
	search,
	searchComplete
} from '@craftercms/redux';

import { item, descriptor, children, navItem, navBreadcrumb, tree } from './mock-responses';

import * as nock from 'nock';
import { of } from 'rxjs';

// https://github.com/nock/nock/issues/2397
import fetch, { Headers, Request, Response } from 'node-fetch';

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

describe('Crafter CMS Redux', () => {
	let store;

	beforeEach(() => {
		store = createReduxStore();
		// replace the real XHR object with the mock XHR object before each test
		if (!nock.isActive()) {
			nock.activate();
		}
	});

	// put the real XHR object back and clear the mocks after each test
	afterEach(() => nock.cleanAll());

	describe('ACTIONS', () => {
		describe('getItem Action', () => {
			it('should return the expected GET_ITEM action', (done) => {
				let url = '/site/website/index.xml',
					expectedAction = {
						type: 'GET_ITEM',
						payload: url
					};
				const action = getItem(url);
				expect(action).to.deep.equal(expectedAction);
				done();
			});
		});

		describe('getItemComplete Action', () => {
			it('should return the expected GET_ITEM_COMPLETE action', (done) => {
				let expectedAction = {
					type: 'GET_ITEM_COMPLETE',
					payload: item
				};
				const action = getItemComplete(item);
				expect(action).to.deep.equal(expectedAction);
				done();
			});
		});

		describe('getDescriptor Action', () => {
			it('should return the expected GET_DESCRIPTOR action', (done) => {
				let url = '/site/website/index.xml',
					expectedAction = {
						type: 'GET_DESCRIPTOR',
						payload: url
					};
				const action = getDescriptor(url);
				expect(action).to.deep.equal(expectedAction);
				done();
			});
		});

		describe('getDescriptorComplete Action', () => {
			it('should return the expected GET_DESCRIPTOR_COMPLETE action', (done) => {
				let url: '/site/website/index.xml',
					expectedAction = {
						type: 'GET_DESCRIPTOR_COMPLETE',
						payload: { descriptor, url }
					};
				const action = getDescriptorComplete({ descriptor, url });
				expect(action).to.deep.equal(expectedAction);
				done();
			});
		});

		describe('getChildren Action', () => {
			it('should return the expected GET_CHILDREN action', (done) => {
				let url = '/site/website/',
					expectedAction = {
						type: 'GET_CHILDREN',
						payload: url
					};
				const action = getChildren(url);
				expect(action).to.deep.equal(expectedAction);
				done();
			});
		});

		describe('getChildrenComplete Action', () => {
			it('should return the expected GET_CHILDREN_COMPLETE action', (done) => {
				let url: '/site/website/index.xml',
					expectedAction = {
						type: 'GET_CHILDREN_COMPLETE',
						payload: {
							url,
							children
						}
					};
				const action = getChildrenComplete({ children, url });
				expect(action).to.deep.equal(expectedAction);
				done();
			});
		});

		describe('getTree Action', () => {
			it('should return the expected GET_TREE action', (done) => {
				let url = '/site/website/',
					expectedAction = {
						type: 'GET_TREE',
						payload: {
							url: url
						}
					};
				const action = getTree({ url });
				expect(action).to.deep.equal(expectedAction);
				done();
			});
		});

		describe('getTreeComplete Action', () => {
			it('should return the expected GET_TREE_COMPLETE action', (done) => {
				let expectedAction = {
					type: 'GET_TREE_COMPLETE',
					payload: item
				};
				const action = getTreeComplete(item);
				expect(action).to.deep.equal(expectedAction);
				done();
			});
		});

		describe('getNavTree Action', () => {
			it('should return the expected GET_NAV action', (done) => {
				let url = '/site/website/',
					expectedAction = {
						type: 'GET_NAV',
						payload: {
							url
						}
					};
				const action = getNav({ url });
				expect(action).to.deep.equal(expectedAction);
				done();
			});
		});

		describe('getNavTreeComplete Action', () => {
			it('should return the expected GET_NAV_TREE_COMPLETE action', (done) => {
				let url: '/site/website/index.xml',
					expectedAction = {
						type: 'GET_NAV_COMPLETE',
						payload: navItem
					};
				const action = getNavComplete(navItem);
				expect(action).to.deep.equal(expectedAction);
				done();
			});
		});

		describe('getNavBreadcrumb Action', () => {
			it('should return the expected GET_NAV_BREADCRUMB action', (done) => {
				let url = '/site/website/',
					expectedAction = {
						type: 'GET_NAV_BREADCRUMB',
						payload: {
							url
						}
					};
				const action = getNavBreadcrumb({ url });
				expect(action).to.deep.equal(expectedAction);
				done();
			});
		});

		describe('getNavBreadcrumbComplete Action', () => {
			it('should return the expected GET_NAV_BREADCRUMB_COMPLETE action', (done) => {
				let url: '/site/website/index.xml',
					expectedAction = {
						type: 'GET_NAV_BREADCRUMB_COMPLETE',
						payload: {
							breadcrumb: navBreadcrumb,
							url
						}
					};
				const action = getNavBreadcrumbComplete({
					breadcrumb: navBreadcrumb,
					url
				});
				expect(action).to.deep.equal(expectedAction);
				done();
			});
		});
	});

	describe('REDUCERS', () => {
		describe('getItem Reducer', () => {
			it('should return the expected GET_ITEM reducer', (done) => {
				let url = '/site/website/index.xml',
					action = {
						type: 'GET_ITEM',
						payload: url
					},
					expectedState = {
						loading: {
							[url]: true
						},
						entries: {}
					};

				let newState = itemsReducer(undefined, action);
				expect(newState).to.deep.equal(expectedState);
				done();
			});
		});

		describe('getItemComplete Reducer', () => {
			it('should return the expected GET_ITEM_COMPLETE reducer', (done) => {
				let action = {
						type: 'GET_ITEM_COMPLETE',
						payload: {
							item,
							url: item.url
						}
					},
					expectedState = {
						loading: {
							[item.url]: false
						},
						entries: {
							[item.url]: item
						}
					};

				let newState = itemsReducer(undefined, action);
				expect(newState).to.deep.equal(expectedState);
				done();
			});
		});

		describe('getDescriptor Reducer', () => {
			it('should return the expected GET_DESCRIPTOR reducer', (done) => {
				let url = '/site/website/index.xml',
					action = {
						type: 'GET_DESCRIPTOR',
						payload: url
					},
					expectedState = {
						loading: {
							[url]: true
						},
						entries: {}
					};

				let newState = descriptorsReducer(undefined, action);
				expect(newState).to.deep.equal(expectedState);
				done();
			});
		});

		describe('getDescriptorComplete Reducer', () => {
			it('should return the expected GET_DESCRIPTOR_COMPLETE reducer', (done) => {
				let url = '/site/website',
					action = {
						type: 'GET_DESCRIPTOR_COMPLETE',
						payload: { descriptor, url }
					},
					expectedState = {
						loading: {
							[url]: false
						},
						entries: {
							[url]: descriptor
						}
					};

				let newState = descriptorsReducer(undefined, action);
				expect(newState).to.deep.equal(expectedState);
				done();
			});
		});

		describe('getChildren Reducer', () => {
			it('should return the expected GET_CHILDREN reducer', (done) => {
				let url = '/site/website',
					action = {
						type: 'GET_CHILDREN',
						payload: url
					},
					expectedState = {
						loading: {
							[url]: true
						},
						entries: {}
					};

				let newState = childrenReducer(undefined, action);
				expect(newState).to.deep.equal(expectedState);
				done();
			});
		});

		describe('getChildrenComplete Reducer', () => {
			it('should return the expected GET_CHIDREN_COMPLETE reducer', (done) => {
				let url = '/site/website',
					action = {
						type: 'GET_CHILDREN_COMPLETE',
						payload: { children, url }
					},
					expectedState = {
						loading: {
							[url]: false
						},
						entries: {
							[url]: children
						}
					};

				let newState = childrenReducer(undefined, action);
				expect(newState).to.deep.equal(expectedState);
				done();
			});
		});

		describe('getTree Reducer', () => {
			it('should return the expected GET_TREE reducer', (done) => {
				let url = '/site/website',
					action = {
						type: 'GET_TREE',
						payload: { url }
					},
					expectedState = {
						loading: {
							[url]: true
						},
						entries: {},
						childIds: {}
					};

				let newState = treeReducer(undefined, action);
				expect(newState).to.deep.equal(expectedState);
				done();
			});
		});

		describe('getTreeComplete Reducer', () => {
			it('should return the expected GET_TREE_COMPLETE reducer', (done) => {
				let action = {
						type: 'GET_TREE_COMPLETE',
						payload: {
							tree,
							url: tree.url
						}
					},
					expectedState = {
						loading: {
							[item.url]: false
						},
						entries: {
							[item.url]: { ...tree, children: null }
						},
						childIds: {
							[item.url]: []
						}
					};

				let newState = treeReducer(undefined, action);
				expect(newState).to.deep.equal(expectedState);
				done();
			});
		});

		describe('getNavTree Reducer', () => {
			it('should return the expected GET_NAV reducer', (done) => {
				let url = '/site/website',
					action = {
						type: 'GET_NAV',
						payload: { url }
					},
					expectedState = {
						loading: {
							[url]: true
						},
						entries: {},
						childIds: {}
					};

				let newState = navigationReducer(undefined, action);
				expect(newState).to.deep.equal(expectedState);
				done();
			});
		});

		describe('getNavTreeComplete Reducer', () => {
			it('should return the expected GET_NAV_COMPLETE reducer', (done) => {
				let action = {
						type: 'GET_NAV_COMPLETE',
						payload: {
							nav: navItem,
							url: navItem.url
						}
					},
					expectedState = {
						loading: {
							[navItem.url]: false
						},
						entries: {
							[navItem.url]: { ...navItem, subItems: null }
						},
						childIds: {
							[navItem.url]: []
						}
					};

				let newState = navigationReducer(undefined, action);
				expect(newState).to.deep.equal(expectedState);
				done();
			});
		});

		describe('getNavBreadcrumb Reducer', () => {
			it('should return the expected GET_NAV_BREADCRUMB reducer', (done) => {
				let url = '/site/website',
					action = {
						type: 'GET_NAV_BREADCRUMB',
						payload: { url }
					},
					expectedState = {
						loading: {
							[url]: true
						},
						entries: {}
					};

				let newState = breadcrumbsReducer(undefined, action);
				expect(newState).to.deep.equal(expectedState);
				done();
			});
		});

		describe('getNavBreadcrumbComplete Reducer', () => {
			it('should return the expected GET_NAV_BREADCRUMB_COMPLETE reducer', (done) => {
				let url: string = '/',
					action = {
						type: 'GET_NAV_BREADCRUMB_COMPLETE',
						payload: { breadcrumb: navBreadcrumb, url }
					},
					expectedState = {
						loading: {
							[url]: false
						},
						entries: {
							[url]: navBreadcrumb
						}
					};

				let newState = breadcrumbsReducer(undefined, action);
				expect(newState).to.deep.equal(expectedState);
				done();
			});
		});
	});

	describe('EPICS', () => {
		describe('getItem Epic', () => {
			it('should return the expected GET_ITEM epic', (done) => {
				nock('http://localhost:8080')
					.get('/api/1/site/content_store/item.json')
					.query({
						crafterSite: 'editorial',
						url: '/site/website/index.xml'
					})
					.reply(200, item);

				let url = '/site/website/index.xml',
					actionObs = of({
						type: 'GET_ITEM',
						payload: url
					}),
					expectedResponse = {
						payload: {
							item,
							url
						},
						type: 'GET_ITEM_COMPLETE'
					};

				getItemEpic(actionObs).subscribe(({ payload }) => {
					expect(payload).to.deep.equal(expectedResponse.payload);
					// expect(payload.url.url === item.url);
					// expect(payload.url.descriptorUrl === expectedResponse.payload.url);
					// expect(payload).to.deep.equal(expectedResponse.payload);
					done();
				});
			});
		});

		describe('getDescriptor Epic', () => {
			it('should return the expected GET_DESCRIPTOR epic', (done) => {
				nock('http://localhost:8080')
					.get('/api/1/site/content_store/descriptor.json')
					.query({
						crafterSite: 'editorial',
						flatten: false,
						url: '/site/website/index.xml'
					})
					.reply(200, descriptor);

				let url = '/site/website/index.xml',
					actionObs = of({
						type: 'GET_DESCRIPTOR',
						payload: url
					}),
					expectedResponse = {
						payload: { descriptor, url },
						type: 'GET_DESCRIPTOR_COMPLETE'
					};

				getDescriptorEpic(actionObs).subscribe((response) => {
					expect(response.type).to.equal(expectedResponse.type);
					expect(response.payload.descriptor.page.objectId).to.equal(expectedResponse.payload.descriptor.page.objectId);
					done();
				});
			});
		});

		describe('getChildren Epic', () => {
			it('should return the expected GET_CHILDREN epic', (done) => {
				nock('http://localhost:8080')
					.get('/api/1/site/content_store/children.json')
					.query({
						crafterSite: 'editorial',
						url: '/site/website'
					})
					.reply(200, children);

				let url = '/site/website',
					actionObs = of({
						type: 'GET_CHILDREN',
						payload: url
					}),
					expectedResponse = {
						payload: { children, url },
						type: 'GET_CHILDREN_COMPLETE'
					};

				getChildrenEpic(actionObs).subscribe((response) => {
					expect(response).to.deep.equal(expectedResponse);
					done();
				});
			});
		});

		describe('getTree Epic', () => {
			it('should return the expected GET_TREE epic', (done) => {
				nock('http://localhost:8080')
					.get('/api/1/site/content_store/tree.json')
					.query({
						crafterSite: 'editorial',
						depth: 1,
						url: '/site/website'
					})
					.reply(200, tree);

				let url = '/site/website',
					actionObs = of({
						type: 'GET_TREE',
						payload: { url, depth: 1 }
					}),
					expectedResponse = {
						payload: { tree, url },
						type: 'GET_TREE_COMPLETE'
					};

				getTreeEpic(actionObs).subscribe((response) => {
					expect(response).to.deep.equal(expectedResponse);
					done();
				});
			});
		});

		describe('getNavTree Epic', () => {
			it('should return the expected GET_NAV epic', (done) => {
				nock('http://localhost:8080')
					.get('/api/1/site/navigation/tree.json')
					.query({
						crafterSite: 'editorial',
						currentPageUrl: null,
						depth: 1,
						url: '/site/website'
					})
					.reply(200, navItem);

				let url = '/site/website',
					actionObs = of({
						type: 'GET_NAV',
						payload: { url, depth: 1 }
					}),
					expectedResponse = {
						payload: {
							nav: navItem,
							url
						},
						type: 'GET_NAV_COMPLETE'
					};

				getNavEpic(actionObs).subscribe((response) => {
					expect(response).to.deep.equal(expectedResponse);
					done();
				});
			});
		});

		describe('getNavBreadcrumb Epic', () => {
			it('should return the expected GET_NAV_BREADCRUMB epic', (done) => {
				nock('http://localhost:8080')
					.get('/api/1/site/navigation/breadcrumb.json')
					.query({
						crafterSite: 'editorial',
						url: '/site/website/index.xml',
						root: null
					})
					.reply(200, navBreadcrumb);

				let url = '/site/website/index.xml',
					actionObs = of({
						type: 'GET_NAV_BREADCRUMB',
						payload: { url }
					}),
					expectedResponse = {
						payload: { breadcrumb: navBreadcrumb, url },
						type: 'GET_NAV_BREADCRUMB_COMPLETE'
					};

				getNavBreadcrumbEpic(actionObs).subscribe((response) => {
					expect(response).to.deep.equal(expectedResponse);
					done();
				});
			});
		});
	});
});
