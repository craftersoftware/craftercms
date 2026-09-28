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

import { ofType, StateObservable } from 'redux-observable';
import { map, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import { setSiteCookie } from '../../utils/auth';
import { fetchAll } from '../../services/sites';
import { catchAjaxError, extractErrorPayload } from '../../utils/ajax';
import {
	changeSite,
	changeSiteComplete,
	fetchSites as fetchSitesAction,
	fetchSitesComplete,
	fetchSitesFailed
} from '../actions/sites';
import GlobalState from '../../models/GlobalState';
import { CrafterCMSEpic } from '../store';
import { previewSwitch } from '../../services/security';
import { merge, of } from 'rxjs';
import { blockUI, unblockUI } from '../actions/system';

export default [
	// region Change site
	(action$, state$: StateObservable<GlobalState>) =>
		action$.pipe(
			ofType(changeSite.type),
			withLatestFrom(state$),
			tap(
				([
					{
						payload: { nextSite }
					},
					{
						env: { useBaseDomain }
					}
				]) => setSiteCookie(nextSite, useBaseDomain)
			),
			switchMap(
				([
					{
						payload: { nextSite, nextUrl }
					},
					state
				]) =>
					merge(
						of(blockUI({ progress: 'indeterminate' })),
						previewSwitch().pipe(
							switchMap(() => [unblockUI(), changeSiteComplete({ nextSite, nextUrl })]),
							catchAjaxError(() => {
								setSiteCookie(state.sites.active, state.env.useBaseDomain);
								return of(unblockUI());
							})
						)
					)
			)
		),
	// endregion
	// region Fetch sites
	(action$) =>
		action$.pipe(
			ofType(fetchSitesAction.type),
			switchMap(() =>
				fetchAll().pipe(
					map(fetchSitesComplete),
					catchAjaxError((error) => fetchSitesFailed({ error: extractErrorPayload(error) }))
				)
			)
		)
	// endregion
] as CrafterCMSEpic[];
