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

import { defineMessages, type MessageValue, type MessageTag } from 'react-intl';

export const translations = {
	...defineMessages({
		previousPage: {
			id: 'pagination.PreviousPage',
			defaultMessage: 'Previous page'
		},
		nextPage: {
			id: 'pagination.nextPage',
			defaultMessage: 'Next page'
		},
		view: {
			id: 'words.view',
			defaultMessage: 'View'
		},
		compareTo: {
			id: 'historyDialog.options.compareTo',
			defaultMessage: 'Compare to...'
		},
		compareToCurrent: {
			id: 'historyDialog.options.compareToCurrent',
			defaultMessage: 'Compare to current'
		},
		compareToPrevious: {
			id: 'historyDialog.options.compareToPrevious',
			defaultMessage: 'Compare to previous'
		},
		backToHistoryList: {
			id: 'historyDialog.back.selectRevision',
			defaultMessage: 'Back to history list'
		},
		confirmRevertTitle: {
			id: 'historyDialog.confirmRevertTitle',
			defaultMessage: 'Revert confirmation'
		}
	}),
	...defineMessages<{
		revertToPrevious: { readonly b: MessageTag };
		revertToThisVersion: { readonly b: MessageTag };
		confirmRevertBody: { readonly versionTitle: MessageValue };
	}>({
		revertToPrevious: {
			id: 'historyDialog.options.revertToPrevious',
			defaultMessage: 'Revert to <b>previous</b>'
		},
		revertToThisVersion: {
			id: 'historyDialog.options.revertToThisVersion',
			defaultMessage: 'Revert to <b>this version</b>'
		},
		confirmRevertBody: {
			id: 'historyDialog.confirmRevertBody',
			defaultMessage: 'Are you sure you want to revert to {versionTitle}?'
		}
	})
};

export default translations;
