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

import { GlobalState } from '../../models/GlobalState';
import { createReducer } from '@reduxjs/toolkit';
import { sessionTimeout } from '../actions/user';
import {
	login,
	loginFailed,
	logoutComplete,
	refreshAuthToken,
	refreshAuthTokenComplete,
	refreshAuthTokenFailed,
	sharedWorkerUnauthenticated
} from '../actions/auth';
import { storeInitialized } from '../actions/system';
import { applyClientLocalExpiry } from '../../utils/clientLocalExpiry';
import type { ObtainAuthTokenResponse } from '../../services/auth';

export const initialState: GlobalState['auth'] = {
	error: null,
	active: false,
	expiresAt: null,
	sessionExpiresAt: null,
	canExtendSession: true,
	isFetching: false
};

export const INCORRECT_CREDENTIALS_ERROR_CODE = 6004;

/** Client-local expiries for auth state. Seconds remaining win over the server's absolute timestamps. */
function storedTokenTimes(auth: ObtainAuthTokenResponse) {
	const local = applyClientLocalExpiry(auth);
	return {
		expiresAt: local.expiresAt,
		sessionExpiresAt: local.sessionExpiresAt ?? null,
		canExtendSession: local.canExtendSession ?? true
	};
}

const reducer = createReducer<GlobalState['auth']>(initialState, (builder) => {
	builder
		.addCase(storeInitialized, (state, { payload }) => ({
			...state,
			active: true,
			...storedTokenTimes(payload.auth)
		}))
		.addCase(refreshAuthToken, (state) => ({
			...state,
			isFetching: true
		}))
		.addCase(refreshAuthTokenComplete, (state, { payload }) => ({
			...state,
			active: true,
			isFetching: false,
			...storedTokenTimes(payload)
		}))
		.addCase(refreshAuthTokenFailed, (state) => ({
			...state,
			active: false,
			isFetching: false
		}))
		.addCase(sessionTimeout, () => initialState)
		.addCase(sharedWorkerUnauthenticated, () => initialState)
		.addCase(login, (state) => ({ ...state, isFetching: true, error: null }))
		.addCase(loginFailed, (state, action) => ({
			...state,
			isFetching: false,
			error:
				action.payload?.status === 401
					? {
							code: INCORRECT_CREDENTIALS_ERROR_CODE,
							message: 'Incorrect password',
							remedialAction: 'Please use correct password'
						}
					: {
							code: 1000,
							message: 'Internal System Failure',
							remedialAction: 'Please try again momentarily or contact support'
						}
		}))
		.addCase(logoutComplete, () => initialState);
});

export default reducer;
