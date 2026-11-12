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
	applyMiddleware,
	compose,
	Store,
	createStore,
	combineReducers,
	AnyAction,
	ReducersMapObject,
	Middleware
} from 'redux';
import { combineEpics, createEpicMiddleware, Epic } from 'redux-observable';

import { log } from '@craftercms/utils';
import { CrafterState, CrafterNamespacedState, LookupTable, Item } from '@craftercms/models';
import { allEpics, allReducers } from '@craftercms/redux';

/**
 * Retrieves a crafter-redux store based on a config, combining craftercms states/epics with
 * optional extra states/epics from config
 */
export function createReduxStore(
	config: {
		namespace?: string;
		namespaceCrafterState?: boolean;
		reducerMixin?: ReducersMapObject<any, any>;
		epicsArray?: Epic[];
		additionalMiddleWare?: Middleware[];
		reduxDevTools?: boolean;
	} = {}
) {
	config = Object.assign(
		{},
		{
			namespace: 'craftercms',
			reduxDevTools: true,
			namespaceCrafterState: false
		},
		config
	);

	const epicMiddleware = createEpicMiddleware();

	const enhancers = config.reduxDevTools
		? (typeof window !== 'undefined' && window['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__']) || compose
		: compose;

	// if config has namespaceCrafterState set to true, combines crafter reducers into namespace, plus config reducers
	// (if available), otherwise, combines crafter reducers directly on root of state.
	const reducer = config.namespaceCrafterState
		? <ReducersMapObject<CrafterNamespacedState, AnyAction>>{ [config.namespace]: combineReducers(allReducers) }
		: <ReducersMapObject<CrafterState, AnyAction>>allReducers;

	var middlewares = config.additionalMiddleWare ? [epicMiddleware, ...config.additionalMiddleWare] : [epicMiddleware];

	const store: Store = createStore(
		config.reducerMixin ? combineReducers({ ...reducer, ...config.reducerMixin }) : combineReducers(reducer),
		enhancers(applyMiddleware(...middlewares))
	);

	epicMiddleware.run(
		config.epicsArray ? combineEpics(...allEpics.concat(config.epicsArray)) : combineEpics(...allEpics)
	);

	return store;
}

/**
 * Creates a redux store with all the crafter-redux details attached. Optionally, custom app reducers and/or epics
 * may be supplied to create the store as required by client application. Crafter state props may be nested under
 * a namespace by setting the namespaceCrafterSate flag to true. The specific namespace (craftercms by default) may
 * also be customised by supplying the namespace property to the config object.
 * @param {Store<CrafterNamespacedState>} store
 * @returns {CrafterState}
 */
export function getState(store: Store<CrafterNamespacedState>): CrafterState {
	const state = store.getState();
	if ('craftercms' in state) {
		validateCrafterStore(state.craftercms);
		return state.craftercms;
	} else {
		validateCrafterStore(store);
		return state;
	}
}

function validateCrafterStore(store: Object) {
	if (!('studioConfig' in store)) {
		// TODO
		// * Link to right page when we have it.
		// * Improve copy
		log(
			'Missing craftercms store properties on the app store. ' +
				"Make sure you've configured the state and reducers appropriately. " +
				'See http://docs.craftercms.com/ for more',
			log.ERROR
		);
	}
}

/**
 * Flattens a collection, returning its entries and childIds per entry
 * @param {Item} item
 * @param {string} childrenProperty
 * @returns {LookupTable}
 */
export function flattenEntries(item: Item, childrenProperty: string = 'children'): LookupTable<any> {
	let entries: LookupTable<any> = {},
		childIds: LookupTable<any> = {},
		children,
		noChildren = { ...item },
		itemUrl = item['url'];

	//Removes children to store in entries.
	noChildren[childrenProperty] = null;
	entries[itemUrl] = noChildren;

	childIds[itemUrl] = [];

	children = item[childrenProperty] ? [...item[childrenProperty]] : [];

	//If item has children
	if (children && children.length > 0) {
		for (let child of children) {
			//Adds child url (id) into childIds
			childIds[itemUrl].push(child.url);

			//Recursive call
			let newState = flattenEntries(child, childrenProperty);
			//Assigns values from lookupTable got from recursive call
			(entries = Object.assign(entries, newState.entries)), (childIds = Object.assign(childIds, newState.childIds));
		}
	}

	return {
		entries,
		childIds
	};
}
