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

import { createAction } from '@reduxjs/toolkit';
import { Credentials } from '../../models/Credentials';
import { ObtainAuthTokenResponse } from '../../services/auth';
import { AjaxError } from 'rxjs/ajax';

// region Login

export const login = /*#__PURE__*/ createAction<Credentials>('LOGIN');
export const loginComplete = /*#__PURE__*/ createAction('LOGIN_COMPLETE');
export const loginFailed = /*#__PURE__*/ createAction<AjaxError>('LOGIN_FAILED');

// endregion

// region Log Out

export const logout = /*#__PURE__*/ createAction('LOGOUT');
export const logoutComplete = /*#__PURE__*/ createAction<boolean>('LOGOUT_COMPLETE');
export const logoutFailed = /*#__PURE__*/ createAction('LOGOUT_FAILED');

// endregion

// region User Session control

export const refreshAuthToken = /*#__PURE__*/ createAction<{ xsrfToken: string }>('REFRESH_AUTH_TOKEN');
export const refreshAuthTokenComplete =
	/*#__PURE__*/ createAction<ObtainAuthTokenResponse>('REFRESH_AUTH_TOKEN_COMPLETE');
export const refreshAuthTokenFailed = /*#__PURE__*/ createAction('REFRESH_AUTH_TOKEN_FAILED');

// Worker => Tabs
export const sharedWorkerToken = /*#__PURE__*/ createAction<ObtainAuthTokenResponse>('SHARED_WORKER_TOKEN');
export const sharedWorkerUnauthenticated = /*#__PURE__*/ createAction('SHARED_WORKER_UNAUTHENTICATED');
export const sharedWorkerError = /*#__PURE__*/ createAction<{ status: number; message: string }>('SHARED_WORKER_ERROR');

// Tabs => Worker
export const sharedWorkerConnect = /*#__PURE__*/ createAction<{ xsrfToken: string }>('CONNECT');
export const sharedWorkerDisconnect = /*#__PURE__*/ createAction('DISCONNECT');
export const sharedWorkerTimeout = /*#__PURE__*/ createAction('TIMEOUT');
export const sharedWorkerExtendSession = /*#__PURE__*/ createAction<{ xsrfToken: string }>('EXTEND_SESSION');

// endregion
