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

import { ofType } from 'redux-observable';
import {
	login,
	loginComplete,
	loginFailed,
	logout,
	refreshAuthToken,
	refreshAuthTokenComplete,
	sharedWorkerError,
	sharedWorkerTimeout,
	sharedWorkerToken,
	sharedWorkerUnauthenticated
} from '../actions/auth';
import { catchError, delay, ignoreElements, map, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import { of } from 'rxjs';
import { AjaxError } from 'rxjs/ajax';
import * as auth from '../../services/auth';
import { getRequestForgeryToken, getXSRFToken, setJwt, setRequestForgeryToken } from '../../utils/auth';
import { CrafterCMSEpic } from '../store';
import { messageSharedWorker, openSiteSocket, showSystemNotification } from '../actions/system';
import { sessionTimeout } from '../actions/user';

const epics: CrafterCMSEpic[] = [
	// region login
	(action$) =>
		action$.pipe(
			ofType(login.type),
			switchMap((action) =>
				auth.login(action.payload).pipe(
					map(() => loginComplete()),
					catchError((error: any) => {
						if (error.name === 'AjaxError') {
							// Using catchError instead of catchAjaxError to avoid the sessionTimeout action being dispatched.
							// sessionTimeout resets auth to initial state, wiping the error state.
							return of(loginFailed(error as AjaxError));
						}
						throw error;
					})
				)
			)
		),
	// endregion
	// region loginComplete
	(action$, state$) =>
		action$.pipe(
			ofType(loginComplete.type),
			withLatestFrom(state$),
			switchMap(([, state]) => {
				const hasActiveSite = Boolean(state.sites.active);
				return [
					messageSharedWorker(refreshAuthToken({ xsrfToken: getXSRFToken() })),
					// This action here assumes this epic is run only when login from session timeout, not on initial login too
					hasActiveSite && messageSharedWorker(openSiteSocket({ site: state.sites.active, xsrfToken: getXSRFToken() }))
				].filter(Boolean);
			})
		),
	// endregion
	// region logout
	(action$, state$) =>
		action$.pipe(
			ofType(logout.type),
			withLatestFrom(state$),
			// Spring requires regular post for logout....
			// tap(([, state]) => (window.location.href = `${state.env.authoringBase}/logout`)),
			tap(([, state]) => {
				const tokenField = document.createElement('input');
				tokenField.type = 'hidden';
				tokenField.name = state.env.xsrfArgument;
				tokenField.value = getRequestForgeryToken();
				const form = document.createElement('form');
				form.method = 'post';
				form.action = state.env.logoutUrl;
				form.appendChild(tokenField);
				document.body.appendChild(form);
				// The timeout purpose is to avoid immediate submission stopping
				// the logout message from getting to the Service Worker
				setTimeout(() => form.submit());
			}),
			map(() => messageSharedWorker(logout()))
		),
	// endregion
	// region sessionTimeout
	(action$) =>
		action$.pipe(
			ofType(sessionTimeout.type),
			tap(() => setRequestForgeryToken()),
			map(() => messageSharedWorker(sharedWorkerTimeout()))
		),
	// endregion
	// region sharedWorkerToken
	(action$) =>
		action$.pipe(
			ofType(sharedWorkerToken.type),
			map(({ payload }) => refreshAuthTokenComplete(payload))
		),
	// endregion
	// region sharedWorkerUnauthenticated
	(action$) =>
		action$.pipe(
			ofType(sharedWorkerUnauthenticated.type),
			delay(300),
			// We need the new set of auth cookies to be set
			// on this window so that if login attempted from the re-login dialog,
			// it won't fail due to outdated XSRF/auth cookies.
			switchMap(() => auth.fetchAuthenticationType().pipe(catchError(() => []))),
			tap(() => setRequestForgeryToken()),
			ignoreElements()
		),
	// endregion
	// region sharedWorkerError
	(action$) =>
		action$.pipe(
			ofType(sharedWorkerError.type),
			map(({ payload }) =>
				showSystemNotification({
					message: `An error occurred communicating with the token refresh service. Error code ${payload.status}: ${payload.message}`
				})
			)
		),
	// endregion
	// region refreshAuthTokenComplete
	(action$) =>
		action$.pipe(
			ofType(refreshAuthTokenComplete.type),
			tap(({ payload }) => setJwt(payload.token)),
			ignoreElements()
		)
	// endregion
];

export default epics;
