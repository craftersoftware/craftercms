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

import { ajax, AjaxError, AjaxResponse, AjaxConfig } from 'rxjs/ajax';
import { catchError } from 'rxjs/operators';
import { reversePluckProps } from './object';
import { Observable, ObservableInput, of } from 'rxjs';
import { sessionTimeout } from '../state/actions/user';
import StandardAction from '../models/StandardAction';
import { UNDEFINED } from './constants';
import { ApiResponse } from '../models';

type Headers = Record<string, any>;

const HEADERS = {};
export const CONTENT_TYPE_JSON = { 'Content-Type': 'application/json' };
export const OMIT_GLOBAL_HEADERS = Symbol('OmitGlobalHeaders');

export function setGlobalHeaders(props: object): void {
	Object.assign(HEADERS, props);
}

export function removeGlobalHeaders(...headersToDelete: string[]): void {
	headersToDelete.forEach((header) => {
		delete HEADERS[header];
	});
}

export function getGlobalHeaders(): Record<string, string> {
	return { ...HEADERS };
}

/**
 * Merges the supplied `headers` object with the current global headers and returns the resulting object.
 **/
function mergeHeaders(headers: Record<string, string> | typeof OMIT_GLOBAL_HEADERS = {}): Record<string, string> {
	if (!headers || headers === OMIT_GLOBAL_HEADERS) {
		return UNDEFINED;
	} else if (Object.values(headers as any).includes(OMIT_GLOBAL_HEADERS)) {
		return headers;
	}
	return Object.assign({}, HEADERS, headers);
}

export function get<T = any>(url: string, headers?: Headers): Observable<AjaxResponse<T>> {
	return ajax.get<T>(url, mergeHeaders(headers));
}

export function getText<T = any>(url: string, headers?: Headers): Observable<AjaxResponse<T>> {
	return ajax({
		url,
		headers: mergeHeaders(headers),
		responseType: 'text'
	});
}

export function getBinary<T = Blob>(
	url: string,
	headers?: Headers,
	responseType: XMLHttpRequestResponseType = 'arraybuffer'
): Observable<AjaxResponse<T>> {
	return ajax({
		url,
		responseType,
		headers: mergeHeaders(headers)
	});
}

export function post<T = any>(url: string, body?: any, headers?: Headers): Observable<AjaxResponse<T>> {
	return ajax.post<T>(url, body, mergeHeaders(headers));
}

export function postJSON<T = any>(url: string, body: any, headers?: Headers): Observable<AjaxResponse<T>> {
	return ajax.post<T>(url, body, mergeHeaders({ ...CONTENT_TYPE_JSON, ...headers }));
}

export function patch<T = any>(url: string, body: any, headers?: Headers): Observable<AjaxResponse<T>> {
	return ajax.patch<T>(url, body, mergeHeaders(headers));
}

export function patchJSON<T = any>(url: string, body: any, headers?: Headers): Observable<AjaxResponse<T>> {
	return ajax.patch<T>(url, body, mergeHeaders({ ...CONTENT_TYPE_JSON, ...headers }));
}

export function put<T = any>(url: string, body: any, headers?: Headers): Observable<AjaxResponse<T>> {
	return ajax.put<T>(url, body, mergeHeaders(headers));
}

export function del<T = any>(url: string, headers?: Headers): Observable<AjaxResponse<T>> {
	return ajax.delete<T>(url, mergeHeaders(headers));
}

function ajaxWithCrafterHeaders<T = any>(url: string): Observable<AjaxResponse<T>>;
function ajaxWithCrafterHeaders<T = any>(request: AjaxConfig): Observable<AjaxResponse<T>>;
function ajaxWithCrafterHeaders<T = any>(urlOrRequest: string | AjaxConfig): Observable<AjaxResponse<T>> {
	if (typeof urlOrRequest === 'string') {
		return ajax(urlOrRequest);
	} else {
		return ajax({ ...urlOrRequest, headers: mergeHeaders(urlOrRequest.headers) });
	}
}

export { ajaxWithCrafterHeaders as ajax };

export const catchAjaxError = (
	fetchFailedCreator: any,
	...moreActionCreators: Array<(error: Partial<AjaxError>) => StandardAction>
) =>
	catchError((error: any) => {
		if (error.name === 'AjaxError') {
			const ajaxError: Partial<AjaxError> = reversePluckProps(error, 'xhr', 'request') as any;
			ajaxError.response = ajaxError.response?.response ?? {
				code: ajaxError.status,
				message: 'An unknown error has occurred.'
			};
			const actions = [fetchFailedCreator(ajaxError), ...moreActionCreators.map((ac) => ac(ajaxError))];
			if (ajaxError.status === 401) {
				actions.push(sessionTimeout());
			}
			return of(...actions);
		} else {
			console.error('[ajax/catchAjaxError] An epic threw and hence it will be disabled. Check logic.', error);
			throw error;
		}
	});

export const errorSelectorApi1: <T, O extends ObservableInput<any>>(err: any, caught: Observable<T>) => O = (
	error: any
) => {
	let response: any = {
		code: 1000,
		message: 'Internal system failure',
		remedialAction: 'Contact support'
	};
	if (error.name === 'AjaxError') {
		switch (error.status) {
			case 400:
				// eslint-disable-next-line no-throw-literal
				response = {
					code: 1001,
					message: 'Invalid parameter(s)',
					remedialAction: "Check API and make sure you're sending the correct parameters"
				};
				break;
			case 401:
				// eslint-disable-next-line no-throw-literal
				response = {
					code: 2000,
					message: 'Unauthenticated',
					remedialAction: 'Please login first'
				};
				break;
			case 403:
				// eslint-disable-next-line no-throw-literal
				response = {
					code: 2001,
					message: 'Unauthorized',
					remedialAction: "You don't have permission to perform this task, please contact your administrator"
				};
				break;
			case 404: {
				// eslint-disable-next-line no-throw-literal
				response = {
					code: 404,
					message: 'Resource not found'
				};
				break;
			}
		}
	}
	error.response = { response };
	throw error;
};

export const extractErrorPayload = (error: AjaxError): ApiResponse => {
	const response = error?.response?.response ?? error?.response;
	return typeof response === 'string'
		? { code: error?.status, message: response }
		: (response ?? {
				code: error?.status,
				message: 'An unknown error has occurred.'
			});
};
