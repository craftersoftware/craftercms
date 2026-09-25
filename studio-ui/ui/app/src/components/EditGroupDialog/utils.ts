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

import Group from '../../models/Group';
import React from 'react';
import User from '../../models/User';
import { EnhancedDialogProps } from '../EnhancedDialog';
import { LookupTable, PaginationOptions } from '../../models';
import { useTransferListStateReturn } from '../TransferList/utils';

export interface EditGroupBaseProps {
	group?: Group;
}

export interface EditGroupDialogProps extends EditGroupBaseProps, EnhancedDialogProps {
	onGroupSaved(group: Group): void;
	onGroupDeleted(group: Group): void;
}

export interface EditGroupDialogContainerProps
	extends
		EditGroupBaseProps,
		Pick<EditGroupDialogProps, 'onClose' | 'onGroupSaved' | 'onGroupDeleted' | 'isSubmitting'> {}

export interface GroupEditDialogUIProps {
	group?: Group;
	groupNameError: boolean;
	title: React.ReactNode;
	subtitle?: React.ReactNode;
	isEdit: boolean;
	isDirty: boolean;
	onCloseButtonClick?(e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
	onDeleteGroup?(group: Group): void;
	onSave(): void;
	submitOk: boolean;
	onChangeValue(value: { key: string; value: string }): void;
	onAddMembers?(): void;
	onRemoveMembers?(): void;
	users?: User[];
	members?: User[];
	membersLookup?: LookupTable<boolean>;
	inProgressIds?: (string | number)[];
	transferListState: useTransferListStateReturn;
	sourceItemsAllChecked: boolean;
	onFilterUsers(keyword: string): void;
	onFetchMoreUsers(options?: Partial<PaginationOptions & { keyword?: string }>): Promise<void>;
	hasMoreUsers: boolean;
	disableAddMembers: boolean;
	isSubmitting: boolean;
}
