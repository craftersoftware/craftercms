import StandardAction from '../../models/StandardAction';
import { ContentItem, LightItem } from '../../models/Item';
import React from 'react';
import LookupTable from '../../models/LookupTable';
import { SelectionListProps } from '../DependencySelection/SelectionList';
import { EnhancedDialogProps } from '../EnhancedDialog';
import { EnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import ApiResponse from '../../models/ApiResponse';

export interface DeleteDialogBaseProps {
	items: ContentItem[];
	isFetching: boolean;
	error: ApiResponse;
}

export interface DeleteDialogProps extends DeleteDialogBaseProps, EnhancedDialogProps {
	onSuccess?(response?: any): any;
}

export interface DeleteDialogStateProps extends DeleteDialogBaseProps, EnhancedDialogState {
	onClose?: StandardAction;
	onClosed?: StandardAction;
	onSuccess?: StandardAction;
}

export interface DeleteDialogContainerProps
	extends DeleteDialogBaseProps, Pick<DeleteDialogProps, 'isSubmitting' | 'onClose' | 'onSuccess'> {}

export interface DeleteDialogContentUIProps {
	items: ContentItem[];
	childItems: LightItem[];
	dependentItems: LightItem[];
	title: string;
	comment: string;
	selectedItems: LookupTable<boolean>;
	isCommentRequired: boolean;
	isDisabled: boolean;
	isConfirmDeleteChecked: boolean;
	onInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, fieldId: string): void;
	onItemClicked: SelectionListProps['onItemClicked'];
	onSelectAllClicked: SelectionListProps['onSelectAllClicked'];
	onConfirmDeleteChange(event: React.ChangeEvent, checked: boolean): void;
	onEditDependantClick: SelectionListProps['onEditClick'];
}

export interface DeleteDialogUIProps extends DeleteDialogContentUIProps {
	isSubmitting: boolean;
	isSubmitButtonDisabled: boolean;
	error: ApiResponse;
	submitError: ApiResponse;
	setSubmitError?(error: ApiResponse): void;
	isFetching: boolean;
	onSubmit(): void;
	onCloseButtonClick?(e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
}
