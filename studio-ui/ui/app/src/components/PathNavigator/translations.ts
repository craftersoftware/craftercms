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

export const translations = {
	...defineMessages({
		previousPage: {
			id: 'pagination.previousPage',
			defaultMessage: 'Previous page'
		},
		nextPage: {
			id: 'pagination.nextPage',
			defaultMessage: 'Next page'
		},
		select: {
			id: 'words.select',
			defaultMessage: 'Select'
		},
		terminateSelection: {
			id: 'craftercms.pages.option.terminateSelection',
			defaultMessage: 'Terminate Selection'
		},
		refresh: {
			id: 'words.refresh',
			defaultMessage: 'Refresh'
		},
		noLocales: {
			id: 'craftercms.pages.option.noLocales',
			defaultMessage: 'The project has no locales declared.'
		}
	}),
	...defineMessages<{
		itemsSelected: { readonly count: number | bigint };
	}>({
		itemsSelected: {
			id: 'craftercms.pages.widget.itemsSelected',
			defaultMessage: '{count, plural, one {{count} Item selected} other {{count} Items selected}}'
		}
	})
};
