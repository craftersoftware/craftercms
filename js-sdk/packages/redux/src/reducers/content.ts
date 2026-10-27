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

import { AnyAction } from 'redux';
import { flattenEntries } from '../utils';

import {
	getItem,
	getItemComplete,
	getDescriptor,
	getDescriptorComplete,
	getChildren,
	getChildrenComplete,
	getTree,
	getTreeComplete,
	getNavComplete,
	getNavBreadcrumbComplete
} from '../actions/content';
import { StateContainer, Item } from '@craftercms/models';
import { internal_getNav, internal_getNavBreadcrumb } from '../actions/content_internal';

export function itemsReducer(
	state = {
		loading: {}, // { all: boolean, [id: string]: boolean }
		entries: {}
	},
	action: AnyAction
): StateContainer<Item> {
	switch (action.type) {
		case getItem.type: {
			return {
				...state,
				loading: {
					...state.loading,
					[action.payload]: true
				}
			};
		}
		case getItemComplete.type: {
			const { item, url } = action.payload;
			return {
				...state,
				loading: {
					...state.loading,
					[url]: false
				},
				entries: {
					...state.entries,
					[url]: item
				}
			};
		}
		default:
			return state;
	}
}

export function descriptorsReducer(
	state = {
		loading: {}, // { all: boolean, [id: string]: boolean }
		entries: {}
	},
	action: AnyAction
): StateContainer<Item> {
	switch (action.type) {
		case getDescriptor.type: {
			return {
				...state,
				loading: {
					...state.loading,
					[action.payload]: true
				}
			};
		}
		case getDescriptorComplete.type: {
			const { descriptor, url } = action.payload;
			return {
				...state,
				loading: {
					...state.loading,
					[url]: false
				},
				entries: {
					...state.entries,
					[url]: descriptor
				}
			};
		}
		default:
			return state;
	}
}

export function childrenReducer(
	state = {
		loading: {}, // { all: boolean, [id: string]: boolean }
		entries: {}
	},
	action: AnyAction
): StateContainer<Item> {
	switch (action.type) {
		case getChildren.type: {
			const url = action.payload;
			return {
				...state,
				loading: {
					...state.loading,
					[url]: true
				}
			};
		}
		case getChildrenComplete.type: {
			const { children, url } = action.payload;
			return {
				...state,
				loading: {
					...state.loading,
					[url]: false
				},
				entries: {
					...state.entries,
					[url]: children
				}
			};
		}
		default:
			return state;
	}
}

export function treeReducer(
	state = {
		loading: {}, // { all: boolean, [id: string]: boolean }
		entries: {},
		childIds: {}
	},
	action: AnyAction
): StateContainer<any> {
	switch (action.type) {
		case getTree.type: {
			const { url } = action.payload;
			return {
				...state,
				loading: {
					...state.loading,
					[url]: true
				}
			};
		}
		case getTreeComplete.type: {
			const { tree, url } = action.payload;
			const flatEntries = typeof tree === 'undefined' ? null : flattenEntries(tree);

			return {
				...state,
				loading: {
					...state.loading,
					[url]: false
				},
				entries: flatEntries ? { ...state.entries, ...flatEntries.entries } : { ...state.entries },
				childIds: flatEntries ? { ...state.childIds, ...flatEntries.childIds } : { ...state.childIds }
			};
		}
		default:
			return state;
	}
}

export function breadcrumbsReducer(
	state = {
		loading: {}, // { all: boolean, [id: string]: boolean }
		entries: {}
	},
	action: AnyAction
): StateContainer<Item> {
	switch (action.type) {
		case internal_getNavBreadcrumb.type: {
			const { url } = action.payload;

			return {
				...state,
				loading: {
					...state.loading,
					[url]: true
				}
			};
		}
		case getNavBreadcrumbComplete.type: {
			const { breadcrumb, url } = action.payload;
			return {
				...state,
				loading: {
					...state.loading,
					[url]: false
				},
				entries: {
					...state.entries,
					[url]: breadcrumb
				}
			};
		}
		default:
			return state;
	}
}

export function navigationReducer(
	state = {
		loading: {}, // { all: boolean, [id: string]: boolean }
		entries: {},
		childIds: {}
	},
	action: AnyAction
): StateContainer<any> {
	switch (action.type) {
		case internal_getNav.type: {
			return {
				...state,
				loading: {
					...state.loading,
					[action.payload.url]: true
				}
			};
		}
		case getNavComplete.type: {
			const { nav, url } = action.payload;
			const flatEntries = typeof nav === 'undefined' ? null : flattenEntries(nav, 'subItems');

			return {
				...state,
				loading: {
					...state.loading,
					[url]: false
				},
				entries: flatEntries ? { ...state.entries, ...flatEntries.entries } : { ...state.entries },
				childIds: flatEntries ? { ...state.childIds, ...flatEntries.childIds } : { ...state.childIds }
			};
		}
		default:
			return state;
	}
}
