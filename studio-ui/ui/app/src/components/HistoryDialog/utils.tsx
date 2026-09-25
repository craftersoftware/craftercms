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
import { LookupTable } from '../../models/LookupTable';
import { MessageDescriptor } from 'react-intl';
import translations from './translations';
import React from 'react';
import { ContextMenuOption } from '../ContextMenu';
import { ItemHistoryEntry, VersionsStateProps } from '../../models/Version';
import StandardAction from '../../models/StandardAction';
import { EnhancedDialogProps } from '../EnhancedDialog';
import { EnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import { ApiResponse } from '../../models';

export interface Menu {
	sections: ContextMenuOption[][];
	anchorEl: Element;
	activeItem: ItemHistoryEntry;
}

export interface HistoryDialogBaseProps {
	error: ApiResponse;
}

export interface HistoryDialogProps extends HistoryDialogBaseProps, EnhancedDialogProps {
	versionsBranch: VersionsStateProps;
}

export interface HistoryDialogStateProps extends HistoryDialogBaseProps, EnhancedDialogState {
	onClose?: StandardAction;
	onClosed?: StandardAction;
}

export interface HistoryDialogContainerProps
	extends HistoryDialogBaseProps, Pick<HistoryDialogProps, 'versionsBranch'> {}

export interface PaginationProps {
	count: number;
	page: number;
	rowsPerPage: number;
	onPageChanged(nextPage: number): void;
	onRowsPerPageChange?(nextRowsPerPage: number, e: React.ChangeEvent): void;
}

export const menuOptions: LookupTable<{ id: string; label: MessageDescriptor; values?: any }> = {
	view: {
		id: 'view',
		label: translations.view
	},
	compareTo: {
		id: 'compareTo',
		label: translations.compareTo
	},
	compareToCurrent: {
		id: 'compareToCurrent',
		label: translations.compareToCurrent
	},
	compareToPrevious: {
		id: 'compareToPrevious',
		label: translations.compareToPrevious
	},
	revertToPrevious: {
		id: 'revertToPrevious',
		label: translations.revertToPrevious,
		values: { b: (msg) => <b key="bold">&nbsp;{msg}</b> }
	},
	revertToThisVersion: {
		id: 'revertToThisVersion',
		label: translations.revertToThisVersion,
		values: { b: (msg) => <b key="bold">&nbsp;{msg}</b> }
	}
};

export const menuInitialState = {
	sections: [],
	anchorEl: null,
	activeItem: null
};
