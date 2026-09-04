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

import { get } from '../utils/ajax';
import { map, shareReplay } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { Api2ResponseFormat } from '../models/ApiResponse';
import { UiBootstrap } from '../models/UiBootstrap';
import { setRequestForgeryToken } from '../utils/auth';

let uiBootstrap$: Observable<UiBootstrap> | null = null;

export function fetchActiveEnvironment(): Observable<string> {
	return get('/studio/api/2/ui/system/active_environment').pipe(map((response) => response?.response?.environment));
}

export function fetchUiBootstrap(): Observable<UiBootstrap> {
	if (!uiBootstrap$) {
		uiBootstrap$ = get<Api2ResponseFormat<{ bootstrap: UiBootstrap }>>('/studio/api/2/ui/bootstrap').pipe(
			map(({ response }) => response.bootstrap),
			// Cache the result to avoid multiple requests
			shareReplay(1)
		);
	}
	return uiBootstrap$;
}

export function applyUiBootstrapSideEffects(bootstrap: UiBootstrap): void {
	if (bootstrap.cookieDomain) {
		document.domain = bootstrap.cookieDomain;
	}
	setRequestForgeryToken(bootstrap.xsrfHeader);
}
