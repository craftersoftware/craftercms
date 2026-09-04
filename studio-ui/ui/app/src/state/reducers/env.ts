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

import { createReducer } from '@reduxjs/toolkit';
import { GlobalState } from '../../models/GlobalState';
import { fetchSystemVersionComplete, uiBootstrapLoaded } from '../actions/env';
import { Version } from '../../models/monitoring/Version';
import { siteSocketStatus, storeInitialized } from '../actions/system';
import { UiBootstrap } from '../../models/UiBootstrap';

export function mapUiBootstrapToEnv(
	bootstrap: UiBootstrap
): Pick<
	GlobalState['env'],
	| 'xsrfHeader'
	| 'xsrfArgument'
	| 'useBaseDomain'
	| 'activeEnvironment'
	| 'passwordRequirementsMinComplexity'
	| 'footerHtml'
	| 'guestBase'
> {
	return {
		xsrfHeader: bootstrap.xsrfHeader,
		xsrfArgument: bootstrap.xsrfArgument,
		useBaseDomain: bootstrap.useBaseDomain,
		activeEnvironment: bootstrap.environment,
		passwordRequirementsMinComplexity: bootstrap.passwordRequirementsMinComplexity,
		footerHtml: bootstrap.footerHtml ?? '',
		guestBase: bootstrap.previewAppBaseUri || window.location.origin
	};
}

export const envInitialState: GlobalState['env'] = ((origin: string) => ({
	authoringBase: import.meta.env.VITE_AUTHORING_BASE ?? `${origin}/studio`,
	logoutUrl: import.meta.env.VITE_AUTHORING_BASE
		? `${import.meta.env.VITE_AUTHORING_BASE}/logout`
		: `${origin}/studio/logout`,
	guestBase: import.meta.env.VITE_GUEST_BASE ?? origin,
	xsrfHeader: 'X-XSRF-TOKEN',
	xsrfArgument: '_csrf',
	useBaseDomain: false,
	siteCookieName: 'crafterSite',
	previewLandingBase: import.meta.env.VITE_PREVIEW_LANDING ?? `${origin}/studio/preview-landing`,
	version: null,
	packageBuild: null,
	packageVersion: null,
	packageBuildDate: null,
	activeEnvironment: null,
	passwordRequirementsMinComplexity: 4,
	footerHtml: '',
	socketConnected: false
}))(window.location.origin);

const reducer = createReducer<GlobalState['env']>(envInitialState, (builder) => {
	builder
		.addCase(uiBootstrapLoaded, (state, { payload }) => ({
			...state,
			...mapUiBootstrapToEnv(payload)
		}))
		.addCase(fetchSystemVersionComplete, (state, { payload }: { payload: Version }) => ({
			...state,
			version: payload.packageVersion.replace('-SNAPSHOT', ''),
			packageBuild: payload.packageBuild,
			packageVersion: payload.packageVersion,
			packageBuildDate: payload.packageBuildDate
		}))
		.addCase(storeInitialized, (state, { payload }) => ({
			...state,
			activeEnvironment: payload.activeEnvironment
		}))
		.addCase(siteSocketStatus, (state, { payload }) => ({
			...state,
			socketConnected: payload.connected
		}));
});

export default reducer;
