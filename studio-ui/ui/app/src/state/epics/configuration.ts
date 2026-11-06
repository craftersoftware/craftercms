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
import { exhaustMap, filter, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { catchAjaxError } from '../../utils/ajax';
import {
	fetchSiteConfig,
	fetchSiteConfigComplete,
	fetchSiteConfigFailed,
	fetchSiteUiConfig,
	fetchSiteUiConfigComplete,
	fetchSiteUiConfigFailed
} from '../actions/configuration';
import {
	fetchSiteConfig as fetchSiteConfigService,
	fetchSiteUiConfig as fetchSiteUiConfigService
} from '../../services/configuration';
import { CrafterCMSEpic } from '../store';
import {
	configurationEvent,
	contentTypeUpdated,
	emitSystemEvent,
	emitSystemEvents,
	showSystemNotification
} from '../actions/system';
import { defineMessages, type MessageValue } from 'react-intl';
import { Observable } from 'rxjs';
import StandardAction from '../../models/StandardAction';
import { fetchQuickCreateList } from '../actions/content';

const configurationMessages = defineMessages<{
	localeError: { readonly message: MessageValue };
}>({
	localeError: {
		id: 'configurationMessages.localeError',
		defaultMessage: 'Incorrect locale configuration: {message}. Using browser locale settings. Check site config xml.'
	}
});

function handleSystemEvent(action: StandardAction): StandardAction[] {
	if (action.type !== configurationEvent.type) {
		return [];
	}
	const targetPath = action.payload.targetPath;
	if (targetPath === '/config/studio/ui.xml') {
		return [fetchSiteUiConfig({ site: action.payload.siteId })];
	} else if (targetPath === '/config/studio/site-config.xml') {
		return [fetchSiteConfig()];
	} else if (/^\/config\/studio\/content-types\/.*\/form-definition\.xml$/.test(targetPath)) {
		return [contentTypeUpdated(), fetchQuickCreateList()];
	}
	return [];
}

export default [
	// fetchSiteUiConfig
	(action$, state$) =>
		action$.pipe(
			ofType(fetchSiteUiConfig.type),
			withLatestFrom(state$),
			filter(([, state]) => Boolean(state.sites.active)),
			// A very quick site change may present problematic as the
			// config that would be retrieved would be the first site.
			exhaustMap(([{ payload }, { env }]) =>
				fetchSiteUiConfigService(payload.site, env.activeEnvironment).pipe(
					map((config) => fetchSiteUiConfigComplete({ config, site: payload.site })),
					catchAjaxError(fetchSiteUiConfigFailed)
				)
			)
		),
	// fetchSiteConfig
	(action$, state$, { getIntl }) =>
		action$.pipe(
			ofType(fetchSiteConfig.type),
			withLatestFrom(state$),
			filter(([, state]) => Boolean(state.sites.active)),
			exhaustMap(([, state]) =>
				fetchSiteConfigService(state.sites.active, state.env.activeEnvironment).pipe(
					switchMap((config) => {
						try {
							let localeCode = config.locale?.localeCode || state.uiConfig.locale.localeCode;
							let options = config.locale?.dateTimeFormatOptions || state.uiConfig.locale.dateTimeFormatOptions;
							new Intl.DateTimeFormat(localeCode, options);
							return [fetchSiteConfigComplete(config)];
						} catch (e) {
							return [
								fetchSiteConfigComplete({
									...config,
									locale: {
										...config.locale,
										localeCode: state.uiConfig.locale.localeCode,
										dateTimeFormatOptions: state.uiConfig.locale.dateTimeFormatOptions
									}
								}),
								showSystemNotification({
									message: getIntl().formatMessage(configurationMessages.localeError, { message: (e as Error).message })
								})
							];
						}
					}),
					catchAjaxError(fetchSiteConfigFailed)
				)
			)
		),
	// emitSystemEvent
	(action$) =>
		action$.pipe(
			ofType(emitSystemEvent.type),
			switchMap(({ payload }) => handleSystemEvent(payload))
		),
	// emitSystemEvents
	(action$: Observable<StandardAction<ReturnType<typeof emitSystemEvents>['payload']>>) =>
		action$.pipe(
			ofType(emitSystemEvents.type),
			switchMap((action) => action.payload.events.flatMap((eventAction) => handleSystemEvent(eventAction)))
		)
] as CrafterCMSEpic[];
