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

export const initialState: GlobalState['auth'] = {
	error: null,
	active: false,
	expiresAt: null,
	isFetching: false
};

export const INCORRECT_CREDENTIALS_ERROR_CODE = 6004;

const reducer = createReducer<GlobalState['auth']>(initialState, (builder) => {
	builder
		.addCase(storeInitialized, (state, { payload }) => ({
			...state,
			active: true,
			expiresAt: payload.auth.expiresAt
		}))
		.addCase(refreshAuthToken, (state) => ({
			...state,
			isFetching: true
		}))
		.addCase(refreshAuthTokenComplete, (state, { payload }) => ({
			...state,
			active: true,
			isFetching: false,
			expiresAt: payload.expiresAt
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
