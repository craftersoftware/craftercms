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
import {
	fetchSiteConfigComplete,
	fetchSiteUiConfig,
	fetchSiteUiConfigComplete,
	fetchSiteUiConfigFailed
} from '../actions/configuration';
import { changeSiteComplete } from '../actions/sites';
import { fetchSiteLocales, fetchSiteLocalesComplete, fetchSiteLocalesFailed } from '../actions/translation';
import { deserialize, fromString, serialize } from '../../utils/xml';
import { applyDeserializedXMLTransforms } from '../../utils/object';
import { getUserLocaleCode, getUserTimeZone } from '../../utils/datetime';
import { asArray } from '../../utils/array';

const initialState: GlobalState['uiConfig'] = {
	error: null,
	isFetching: null,
	currentSite: null,
	siteLocales: {
		error: null,
		isFetching: false,
		localeCodes: null,
		defaultLocaleCode: null
	},
	upload: {
		timeout: 30000,
		maxActiveUploads: 1000,
		maxSimultaneousUploads: 1
	},
	locale: {
		localeCode: getUserLocaleCode(),
		dateTimeFormatOptions: {
			timeZone: getUserTimeZone(),
			day: 'numeric',
			month: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: 'numeric'
		}
	},
	references: null,
	controls: {},
	xml: null,
	publishing: {
		deleteCommentRequired: false,
		bulkPublishCommentRequired: false,
		publishByCommitCommentRequired: false,
		publishCommentRequired: false,
		publishEverythingCommentRequired: false,
		submissionCommentMaxLength: 250
	},
	cdataEscapedFieldPatterns: [],
	remoteGitBranch: null
};

const reducer = createReducer<GlobalState['uiConfig']>(initialState, (builder) => {
	builder
		.addCase(changeSiteComplete, () => ({ ...initialState }))
		.addCase(fetchSiteUiConfig, (state, { payload: { site } }) => ({
			...state,
			isFetching: true,
			currentSite: site,
			xml: null
		}))
		.addCase(fetchSiteUiConfigComplete, (state, { payload }) => {
			let config = payload.config;
			const references = {};
			const controls: GlobalState['uiConfig']['controls'] = {};
			if (config) {
				const configDOM = fromString(config);
				const site = payload.site;
				const arrays = ['tools'];

				configDOM.querySelectorAll('plugin').forEach((tag) => {
					const siteAttr = tag.getAttribute('site');
					if (siteAttr === '{site}' || siteAttr === null) {
						tag.setAttribute('site', site);
					}
				});

				configDOM.querySelectorAll(':scope > references > reference').forEach((tag) => {
					references[tag.id] = applyDeserializedXMLTransforms(deserialize(tag.innerHTML), {
						arrays
					});
				});

				configDOM.querySelectorAll('configuration > reference').forEach((tag) => {
					tag.outerHTML = references[tag.id];
				});

				configDOM.querySelectorAll('widget').forEach((e, index) => e.setAttribute('uiKey', String(index)));

				configDOM
					.querySelectorAll('[id="craftercms.components.ContentTypeManagement"] > configuration > controls')
					.forEach((tag) => {
						const descriptor = deserialize(tag.innerHTML)?.descriptor;
						if (!descriptor) return;
						// Normalize XML-deserialized shapes (single nodes vs arrays, empty fields tag, etc.)
						controls[tag.id] = {
							...descriptor,
							id: tag.id,
							fields: descriptor.fields ? descriptor.fields : {}, // empty <fields /> deserializes as []
							sections: descriptor.sections
								? asArray(descriptor.sections).map((section) => ({
										...section,
										fields: section.fields ? asArray(section.fields) : []
									}))
								: [],
							metadata: {
								...descriptor.metadata,
								suffixes: descriptor.metadata?.suffixes ? asArray(descriptor.metadata.suffixes) : null,
								additionalFields: descriptor.metadata?.additionalFields
									? asArray(descriptor.metadata.additionalFields)
									: null
							}
						};
					});

				config = serialize(configDOM);
			}

			return {
				...state,
				isFetching: false,
				xml: config,
				references,
				controls
			};
		})
		.addCase(fetchSiteUiConfigFailed, (state, { payload }) => ({
			...state,
			error: payload,
			isFetching: false,
			currentSite: null
		}))
		.addCase(fetchSiteLocales, (state) => ({
			...state,
			siteLocales: {
				...state.siteLocales,
				isFetching: true
			}
		}))
		.addCase(fetchSiteLocalesComplete, (state, { payload }) => ({
			...state,
			siteLocales: {
				...state.siteLocales,
				isFetching: false,
				localeCodes: payload.localeCodes ?? [],
				defaultLocaleCode: payload.defaultLocaleCode
			}
		}))
		.addCase(fetchSiteLocalesFailed, (state, { payload }) => ({
			...state,
			siteLocales: {
				...state.siteLocales,
				isFetching: false,
				error: payload
			}
		}))
		.addCase(fetchSiteConfigComplete, (state, { payload }) => {
			const { cdataEscapedFieldPatterns, locale, publishing, upload, remoteGitBranch } = payload;
			return {
				...state,
				upload: {
					...state.upload,
					...upload
				},
				cdataEscapedFieldPatterns,
				locale: {
					...state.locale,
					// If localization config is not present in the config, use the browser's resolved options.
					localeCode: locale?.localeCode || initialState.locale.localeCode,
					dateTimeFormatOptions: locale?.dateTimeFormatOptions || initialState.locale.dateTimeFormatOptions
				},
				publishing: {
					...state.publishing,
					...publishing
				},
				remoteGitBranch
			};
		});
});

export default reducer;
