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

import { defineMessages } from 'react-intl';

export const translations = defineMessages({
	browse: {
		// Translation not used in code but powers i18n for `ui.xml`
		id: 'previewBrowseComponentsPanelTitle',
		defaultMessage: 'Existing Content'
	},
	noResults: {
		id: 'previewBrowseComponentsPanel.noResults',
		defaultMessage: ' No results found.'
	},
	previousPage: {
		id: 'previewBrowseComponentsPanel.previousPage',
		defaultMessage: 'previous page'
	},
	nextPage: {
		id: 'previewBrowseComponentsPanel.nextPage',
		defaultMessage: 'next page'
	},
	loading: {
		id: 'words.loading',
		defaultMessage: 'Loading'
	},
	allContentTypes: {
		id: 'previewBrowseComponentsPanel.allContentType',
		defaultMessage: 'All Content types'
	},
	filter: {
		id: 'previewBrowseComponentsPanel.filter',
		defaultMessage: 'Filter...'
	},
	contentType: {
		id: 'searchFilter.contentType',
		defaultMessage: 'Content Type'
	}
});

export default translations;
