/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import { configureStore, EnhancedStore, Middleware } from '@reduxjs/toolkit';
import reducer from './reducers/root';
import GlobalState from '../models/GlobalState';
import { createEpicMiddleware, Epic } from 'redux-observable';
import { StandardAction } from '../models/StandardAction';
import epic from './epics/root';
import { BehaviorSubject, forkJoin, fromEvent, Observable, of } from 'rxjs';
import { catchError, filter, map, switchMap, take, tap } from 'rxjs/operators';
import { fetchGlobalProperties, me } from '../services/users';
import { exists, fetchAll } from '../services/sites';
import LookupTable from '../models/LookupTable';
import { getCurrentIntl } from '../utils/i18n';
import { IntlShape } from 'react-intl';
import { ObtainAuthTokenResponse } from '../services/auth';
import { getSiteCookie, getXSRFToken, removeSiteCookie, setJwt } from '../utils/auth';
import {
	emitSystemEvent,
	globalSocketStatus,
	newProjectReady,
	projectBeingDeleted,
	projectDeleted,
	siteSocketStatus,
	storeInitialized
} from './actions/system';
import User from '../models/User';
import { Site } from '../models/Site';
import {
	sharedWorkerConnect,
	sharedWorkerDisconnect,
	sharedWorkerError,
	sharedWorkerToken,
	sharedWorkerUnauthenticated
} from './actions/auth';
import { SHARED_WORKER_NAME } from '../utils/constants';
import { fetchActiveEnvironment } from '../services/environment';
import { batchActions, dispatchDOMEvent } from './actions/misc';
import { closeSingleFileUploadDialog } from './actions/dialogs';
import { pushDialog, pushNonDialog } from './actions/dialogStack';

export type EpicMiddlewareDependencies = {
	getIntl: () => IntlShape;
	store: CrafterCMSStore;
	worker: SharedWorker;
};

export type CrafterCMSStore = EnhancedStore<GlobalState, StandardAction, any>;

export type CrafterCMSEpic = Epic<StandardAction, StandardAction, GlobalState, EpicMiddlewareDependencies>;

let store$: BehaviorSubject<CrafterCMSStore>;

export function getStore(): Observable<CrafterCMSStore> {
	if (store$) {
		return store$.pipe(
			filter((store) => store !== null),
			take(1)
		);
	} else {
		store$ = new BehaviorSubject(null);
		return registerSharedWorker().pipe(
			tap(({ token }) => setJwt(token)),
			switchMap(({ worker, ...auth }) =>
				of(createStoreSync({ dependencies: { worker } })).pipe(
					switchMap((store) =>
						fetchStateInitialization().pipe(
							tap((requirements) => {
								worker.port.onmessage = (e) => {
									if (e.data?.type) {
										const state = store.getState();
										const action = e.data;
										// System socket events come wrapped in `emitSystemEvent` action.
										const payload =
											(action.type === emitSystemEvent.type ? action.payload.payload : action.payload) ?? {};
										// When a site is switched on a different tab, the socket that powers this tab will switch to that
										// socket "topic". Need to avoid widgets refreshing with data that's not relevant to them.
										if (
											[
												// * * * *
												// Events sent by the worker for global purposes should always go through
												// * * * *
												sharedWorkerToken.type,
												sharedWorkerUnauthenticated.type,
												sharedWorkerError.type,
												sharedWorkerUnauthenticated.type,
												globalSocketStatus.type,
												siteSocketStatus.type
											].includes(action.type) ||
											// Projects lifecycle events (created, deleted, etc.) should always go through.
											payload.eventType === newProjectReady.type ||
											payload.eventType === projectBeingDeleted.type ||
											payload.eventType === projectDeleted.type ||
											// No siteId on the event should be applicable to all sites.
											!payload.siteId ||
											// The event is for the current site.
											payload.siteId === state.sites.active
										) {
											store.dispatch(action);
										}
									}
								};
								store.dispatch(storeInitialized({ auth, ...requirements }));
								store$.next(store);
							})
						)
					)
				)
			),
			switchMap(() => store$.pipe(take(1)))
		);
	}
}

function registerSharedWorker(): Observable<ObtainAuthTokenResponse & { worker: SharedWorker }> {
	if ('SharedWorker' in window) {
		const worker = new SharedWorker(`${import.meta.env.BASE_URL}/shared-worker.js`, {
			name: SHARED_WORKER_NAME,
			credentials: 'same-origin'
		});
		worker.port.start();
		worker.port.postMessage(sharedWorkerConnect({ xsrfToken: getXSRFToken() }));
		window.addEventListener('beforeunload', function () {
			worker.port.postMessage(sharedWorkerDisconnect());
		});
		return fromEvent<MessageEvent>(worker.port, 'message').pipe(
			tap((e) => {
				if (e.data?.type === sharedWorkerUnauthenticated.type) {
					const elem = document.createElement('div');
					elem.style.textAlign = 'center';
					elem.style.margin = '20px 0';
					elem.innerHTML = 'User not authenticated.';
					setTimeout(() => {
						window.location.reload();
					}, 800);
					throw new Error('User not authenticated.');
				}
			}),
			filter((e) => e.data?.type === sharedWorkerToken.type),
			take(1),
			map((e) => ({ ...e?.data?.payload, worker }))
		);
	} else {
		return new Observable((observer) => {
			observer.error(
				['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform)
					? 'iOS is not supported as it lacks essential features. Please use Chrome or Firefox browsers on your desktop.'
					: 'Your browser is not supported as it lacks essential features. Please use Chrome or Firefox.'
			);
		});
	}
}

export function getStoreSync(): CrafterCMSStore {
	return store$?.value;
}

export function createStoreSync(args: { preloadedState?: any; dependencies?: any } = {}): CrafterCMSStore {
	const { preloadedState, dependencies } = args;
	const epicMiddleware = createEpicMiddleware<StandardAction, StandardAction, GlobalState, EpicMiddlewareDependencies>({
		dependencies: {
			getIntl: getCurrentIntl,
			get store() {
				return store;
			},
			...dependencies
		}
	});
	const store = configureStore({
		reducer,
		middleware: (getDefaultMiddleware) =>
			getDefaultMiddleware({
				thunk: false,
				serializableCheck: {
					ignoredPaths: ['dialogStack.byId'],
					ignoredActions: [
						// The SingleFileUpload dialog used via the global dialog manager will dispatch non-serializables.
						// It is often used with dispatchDOMEvent and batchActions.
						batchActions.type,
						dispatchDOMEvent.type,
						closeSingleFileUploadDialog.type,
						pushDialog.type,
						pushNonDialog.type
					]
				}
			}).concat(epicMiddleware as Middleware),
		preloadedState,
		devTools: { name: `Studio Store ${window.location.host}` }
		// devTools: import.meta.env.NODE_ENV === 'production' ? false : { name: 'Studio Store' }
	});
	epicMiddleware.run(epic);
	return store;
}

export function fetchStateInitialization(): Observable<{
	user: User;
	sites: Site[];
	properties: LookupTable<any>;
	activeSiteId: string;
	activeEnvironment: string;
}> {
	const siteCookieValue = getSiteCookie();
	return forkJoin({
		user: me(),
		sites: fetchAll(),
		properties: fetchGlobalProperties(),
		activeSiteId:
			// A site cookie may be set but the site may have been deleted.
			// If there is a cookie with a site name, verify that it still exists.
			siteCookieValue
				? exists(siteCookieValue).pipe(
						// If the site doesn't exist, delete the cookie so it doesn't cause further issues
						tap((siteExists) => !siteExists && removeSiteCookie()),
						map((siteExists) => (siteExists ? siteCookieValue : null)),
						// If the exists check fails (e.g. network/API error), don't break store init
						catchError(() => of(null))
					)
				: of(null),
		activeEnvironment: fetchActiveEnvironment()
	});
}

export default getStore;
