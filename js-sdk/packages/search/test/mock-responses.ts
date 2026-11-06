/*
 * Copyright (C) 2007-2021 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

export const searchResponse = {
	total: {
		value: 33,
		relation: 'eq'
	},
	max_score: 1,
	hits: [
		{
			_index: 'editorial-preview_v1',
			_id: 'bdbe541a5b59b0898eee7a581472dd16',
			_score: 1,
			_source: {
				createdDate_dt: '2017-03-28T22:27:45.000Z',
				crafterPublishedDate_dt: '2024-04-03T17:14:25.648473023Z',
				rootId: 'editorial:/site/components/articles-widget/latest-articles-widget.xml',
				lastModifiedDate: '2017-03-28T22:27:45.000Z',
				'internal-name': 'Latest Articles Widget',
				objectGroupId: 'cb76',
				localId: '/site/components/articles-widget/latest-articles-widget.xml',
				max_articles_i: '3',
				crafterSite: 'editorial',
				crafterPublishedDate: '2024-04-03T17:14:25.648473023Z',
				createdDate: '2017-03-28T22:27:45.000Z',
				lastModifiedDate_dt: '2017-03-28T22:27:45.000Z',
				'merge-strategy': 'inherit-levels',
				title_t: 'Latest Articles',
				'content-type': '/component/articles-widget',
				'display-template': '/templates/web/components/articles-widget.ftl',
				id: 'editorial:/site/components/articles-widget/latest-articles-widget.xml',
				'file-name': 'latest-articles-widget.xml',
				inheritsFrom_smv: [
					'/crafter-level-descriptor.level.xml',
					'/site/crafter-level-descriptor.level.xml',
					'/site/components/crafter-level-descriptor.level.xml',
					'/site/components/articles-widget/crafter-level-descriptor.level.xml'
				],
				objectId: 'cb760193-06a0-e1d9-6653-0f0dd1e2650e',
				scripts_o: {
					item: [
						{
							value: 'latest-articles.groovy',
							key: '/scripts/components/latest-articles.groovy'
						}
					]
				}
			}
		}
	]
};

export const noResultsResponse = {
	total: {
		value: 0,
		relation: 'eq'
	},
	max_score: null,
	hits: []
};
