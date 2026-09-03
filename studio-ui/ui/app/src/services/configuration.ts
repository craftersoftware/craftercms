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

import { errorSelectorApi1, get, postJSON } from '../utils/ajax';
import { catchError, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { deserialize, entityEncodingTagValueProcessor, fromString, getInnerHtml } from '../utils/xml';
import { ContentTypeField } from '../models/ContentType';
import { reversePluckProps, toQueryString } from '../utils/object';
import ContentInstance from '../models/ContentInstance';
import { ItemHistoryEntry } from '../models/Version';
import LookupTable from '../models/LookupTable';
import GlobalState from '../models/GlobalState';
import { SiteConfigurationFile } from '../models/SiteConfigurationFile';
import { asArray } from '../utils/array';

export type CrafterCMSModules = 'studio' | 'engine';

export function fetchConfigurationXML(
	site: string,
	configPath: string,
	module: CrafterCMSModules,
	environment?: string
): Observable<string> {
	const qs = toQueryString({
		module,
		path: configPath,
		environment
	});
	return get(`/studio/api/2/configuration/${site}/get_configuration${qs}`).pipe(
		map((response) => response?.response?.content)
	);
}

export function fetchConfigurationDOM(
	site: string,
	configPath: string,
	module: CrafterCMSModules,
	environment?: string
): Observable<XMLDocument> {
	return fetchConfigurationXML(site, configPath, module, environment).pipe(map(fromString));
}

/**
 * Fetches the requested configPath XML and deserializes such XML into JSON
 * @param site {string} The site id from which to fetch the configuration from
 * @param configPath {string} The path — inside the module — to the configuration file to fetch
 * @param module {engine | studio} The module from which to fetch the configuration from
 * @param environment {string} Optional environment to fetch the configuration from
 */
export function fetchConfigurationJSON(
	site: string,
	configPath: string,
	module: CrafterCMSModules,
	environment?: string
): Observable<any> {
	return fetchConfigurationXML(site, configPath, module, environment).pipe(
		map((conf) => {
			return deserialize(conf, {
				parseTagValue: false,
				tagValueProcessor: entityEncodingTagValueProcessor
			});
		})
	);
}

/**
 * Persists the content of a configuration file.
 * @param site {string} The site id from which to fetch the configuration from.
 * @param partialPath {string} The path *inside the module*, excluding root (/config) and module (/studio|engine). If full path is `/config/studio/ui.xml`, partial path `/ui.xml`.
 * @param module {engine | studio} The module that owns this configuration file.
 * @param content {string} The content to write.
 * @param environment {string} Optional environment to write to.
 **/
export function writeConfiguration(
	site: string,
	partialPath: string,
	module: CrafterCMSModules,
	content: string,
	environment?: string
): Observable<boolean> {
	return postJSON(`/studio/api/2/configuration/${site}/write_configuration`, {
		module,
		path: partialPath,
		content,
		...(environment && { environment })
	}).pipe(map(() => true));
}

// region AudiencesPanelConfig

export interface ActiveTargetingModel {
	id: string;

	[prop: string]: string;
}

// TODO: asses the location of profile methods.
export function fetchActiveTargetingModel(site?: string): Observable<ContentInstance> {
	return get(`/api/1/profile/get`).pipe(
		map((response) => {
			const data = reversePluckProps(response.response, 'id');
			const id = response.response.id ?? null;

			return {
				craftercms: {
					id,
					path: null,
					label: null,
					locale: null,
					dateCreated: null,
					dateModified: null,
					contentTypeId: null,
					disabled: false,
					sourceMap: {}
				},
				...data
			};
		})
	);
}

export function deserializeActiveTargetingModelData<T extends Object>(
	data: T,
	contentTypeFields: LookupTable<ContentTypeField>
): ContentInstance {
	return {
		craftercms: {
			id: '',
			path: null,
			label: null,
			dateCreated: null,
			dateModified: null,
			contentTypeId: null,
			disabled: false,
			sourceMap: {}
		},
		...data
	};
}

export function setActiveTargetingModel(data): Observable<ActiveTargetingModel> {
	const model = reversePluckProps(data, 'craftercms');
	const qs = toQueryString({ id: data.craftercms.id });
	return postJSON(`/api/1/profile/set${qs}`, model).pipe(map((response) => response?.response));
}

// endregion

export function fetchSiteUiConfig(site: string, environment: string): Observable<string> {
	return fetchConfigurationXML(site, '/ui.xml', 'studio', environment);
}

const legacyToNextMenuIconMap = {
	'fa-sitemap': 'craftercms.icons.Sites',
	'fa-user': '@mui/icons-material/PeopleRounded',
	'fa-users': '@mui/icons-material/SupervisedUserCircleRounded',
	'fa-database': '@mui/icons-material/StorageRounded',
	'fa-bars': '@mui/icons-material/SubjectRounded',
	'fa-level-down': '@mui/icons-material/SettingsApplicationsRounded',
	'fa-align-left': '@mui/icons-material/FormatAlignCenterRounded',
	'fa-globe': '@mui/icons-material/PublicRounded',
	'fa-lock': '@mui/icons-material/LockRounded',
	'fa-key': '@mui/icons-material/VpnKeyRounded'
};

export function fetchGlobalMenuItems(): Observable<GlobalState['globalNavigation']['items']> {
	return get('/studio/api/2/ui/views/global_menu.json').pipe(
		map((response) => {
			const menuItems = response?.response?.menuItems ?? [];
			return [
				...menuItems.map((item) => ({
					...item,
					icon: legacyToNextMenuIconMap[item.icon]
						? { id: legacyToNextMenuIconMap[item.icon] }
						: { baseClass: item.icon.includes('fa') ? `fa ${item.icon}` : item.icon }
				})),
				{ id: 'home.globalMenu.about-us', icon: { id: 'craftercms.icons.About' }, label: 'About' },
				{ id: 'home.globalMenu.settings', icon: { id: '@mui/icons-material/AccountCircleRounded' }, label: 'Account' }
			];
		})
	);
}

export function fetchProductLanguages(): Observable<{ id: string; label: string }[]> {
	return get('/studio/api/2/system/available_languages').pipe(map((response) => response?.response?.languages ?? []));
}

export function fetchHistory(
	site: string,
	path: string,
	environment: string,
	module: string
): Observable<ItemHistoryEntry[]> {
	const parsedPath = encodeURIComponent(path.replace(/(\/config\/)(studio|engine)/g, ''));

	return get(
		`/studio/api/2/configuration/${site}/get_configuration_history.json?path=${parsedPath}&environment=${environment}&module=${module}`
	).pipe(map((response) => response?.response.history.versions));
}

export function fetchCannedMessage(site: string, locale: string, type: string): Observable<string> {
	return get(
		`/studio/api/1/services/api/1/site/get-canned-message.json?site=${site}&locale=${locale}&type=${type}`
	).pipe(
		map((response) => response?.response),
		catchError(errorSelectorApi1)
	);
}

export function fetchSiteLocale(site: string, environment: string): Observable<any> {
	return fetchSiteConfigDOM(site, environment).pipe(
		map((xml) => {
			let settings = {};
			if (xml) {
				const localeXML = xml.querySelector('locale');
				if (localeXML) {
					settings = deserialize(localeXML).locale;
				}
			}
			return settings;
		})
	);
}

export function fetchSiteConfigurationFiles(site: string, environment?: string): Observable<SiteConfigurationFile[]> {
	return fetchConfigurationDOM(site, '/administration/config-list.xml', 'studio', environment).pipe(
		map((xml) => {
			let files = [];
			if (xml) {
				const filesXML = xml.querySelector('files');
				if (filesXML) {
					files = deserialize(filesXML).files.file;
				}
			}
			return asArray(files);
		})
	);
}

export interface StudioSiteConfig extends Pick<
	GlobalState['uiConfig'],
	'cdataEscapedFieldPatterns' | 'upload' | 'locale' | 'publishing' | 'remoteGitBranch'
> {
	site: string;
}

export function fetchSiteConfig(site: string, environment: string): Observable<StudioSiteConfig> {
	return fetchSiteConfigDOM(site, environment).pipe(
		map((dom) => ({
			site,
			cdataEscapedFieldPatterns: Array.from(dom.querySelectorAll('cdata-escaped-field-patterns > pattern'))
				.map(getInnerHtml as (node) => string)
				.filter(Boolean),
			upload: ((node) => (node ? deserialize(node).upload : {}))(dom.querySelector(':scope > upload')),
			locale: ((node) => (node ? deserialize(node).locale : {}))(dom.querySelector(':scope > locale')),
			remoteGitBranch: ((node) => (node ? deserialize(node).remoteGitBranch : null))(
				dom.querySelector(':scope > remoteGitBranch')
			),
			publishing: ((node) => {
				const commentSettings = Object.assign({ required: false }, deserialize(node)?.publishing?.comments);
				return {
					publishCommentRequired: commentSettings['publishing-required'] ?? commentSettings.required,
					deleteCommentRequired: commentSettings['delete-required'] ?? commentSettings.required,
					bulkPublishCommentRequired: commentSettings['bulk-publish-required'] ?? commentSettings.required,
					publishByCommitCommentRequired: commentSettings['publish-by-commit-required'] ?? commentSettings.required,
					publishEverythingCommentRequired: commentSettings['publish-everything-required'] ?? commentSettings.required,
					submissionCommentMaxLength: commentSettings['submission-max-length'] ?? 500
				};
			})(dom.querySelector(':scope > publishing'))
		}))
	);
}

function fetchSiteConfigDOM(site: string, environment: string): Observable<XMLDocument> {
	return fetchConfigurationDOM(site, '/site-config.xml', 'studio', environment);
}

export interface CannedMessage {
	key: string;
	title: string;
	message: string;
}

export function fetchCannedMessages(site: string, environment: string): Observable<CannedMessage[]> {
	return fetchConfigurationDOM(site, '/workflow/notification-config.xml', 'studio', environment).pipe(
		map((dom) => {
			const cannedMessages = [];

			dom.querySelectorAll('cannedMessages > content').forEach((tag) => {
				cannedMessages.push({
					key: tag.getAttribute('key'),
					title: tag.getAttribute('title'),
					message: getInnerHtml(tag)
				});
			});

			return cannedMessages;
		})
	);
}
