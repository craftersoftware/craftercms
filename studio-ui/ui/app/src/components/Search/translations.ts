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
	noResults: {
		id: 'search.noResults',
		defaultMessage: 'No Results Were Found.'
	},
	changeQuery: {
		id: 'search.changeQuery',
		defaultMessage: 'Try changing your query.'
	},
	videoProcessed: {
		id: 'search.videoProcessed',
		defaultMessage: 'Video is being processed, preview will be available when processing is complete'
	},
	resultsSelected: {
		id: 'search.resultsSelected',
		defaultMessage: '{count, plural, one {{count} item selected} other {{count} items selected}}'
	},
	resultsStatus: {
		id: 'search.resultsStatus',
		defaultMessage: '{from}-{to} of {count} results{keywordLength, plural, =0 {}other{ for “{keyword}”}}'
	},
	itemsPerPage: {
		id: 'search.itemsPerPage',
		defaultMessage: 'Items per page:'
	},
	noPermissions: {
		id: 'search.noPermissions',
		defaultMessage: 'No permissions available.'
	},
	edit: {
		id: 'words.edit',
		defaultMessage: 'Edit'
	},
	delete: {
		id: 'words.delete',
		defaultMessage: 'Delete'
	},
	preview: {
		id: 'search.goToPreview',
		defaultMessage: 'Go to page'
	},
	search: {
		id: 'words.search',
		defaultMessage: 'Search'
	},
	cancel: {
		id: 'words.cancel',
		defaultMessage: 'Cancel'
	},
	acceptSelection: {
		id: 'search.acceptSelection',
		defaultMessage: 'Accept Selection'
	},
	clearSelected: {
		id: 'search.clearSelected',
		defaultMessage: 'Clear {count} selected'
	},
	nextPage: {
		id: 'pagination.nextPage',
		defaultMessage: 'Next page'
	},
	previousPage: {
		id: 'pagination.previousPage',
		defaultMessage: 'Previous page'
	},
	unknownError: {
		id: 'siteSearch.unknownErrorSearching',
		defaultMessage: 'An error occurred with the search service.'
	}
});
