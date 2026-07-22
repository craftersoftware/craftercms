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

import { FormattedMessage } from 'react-intl';
import { ContentItem, LightItem } from '../../models/Item';
import { isAsset, isCode } from '../../utils/content';
import React, { ReactNode } from 'react';
import StandardAction from '../../models/StandardAction';
import { EnhancedDialogProps } from '../EnhancedDialog';
import { EnhancedDialogState } from '../../hooks/useEnhancedDialogState';
import ApiResponse from '../../models/ApiResponse';

export interface DependenciesDialogBaseProps {
	// TODO: This should be a mandatory prop. Dialog crashes without it.
	item?: ContentItem;
	rootPath: string;
	// TODO: Revisit/improve these keys. Seem not to be in use outside the
	//  Dialog, but don't want to change at this stage (release is close).
	dependenciesShown?: 'depends-on' | 'depends-on-me';
}

export interface DependenciesDialogProps extends DependenciesDialogBaseProps, EnhancedDialogProps {}

export interface DependenciesDialogStateProps extends DependenciesDialogBaseProps, EnhancedDialogState {
	onClose?: StandardAction;
	onClosed?: StandardAction;
}

export interface DependenciesDialogContainerProps extends DependenciesDialogBaseProps {}

export interface DependenciesListProps {
	dependencies: ContentItem[] | LightItem[];
	compactView: boolean;
	showTypes: string;
	renderAction?(dependency: ContentItem | LightItem): ReactNode;
}

export interface DependenciesDialogUIProps {
	dependencies: ContentItem[];
	item: ContentItem;
	rootPath: string;
	setItem: Function;
	compactView: boolean;
	setCompactView: Function;
	showTypes: string;
	setShowTypes: Function;
	dependenciesShown: string;
	setDependenciesShown: Function;
	isEditableItem: Function;
	handleEditorDisplay(item: ContentItem): void;
	handleHistoryDisplay(item: ContentItem): void;
	contextMenu: any;
	error: ApiResponse;

	handleContextMenuClick(event: React.MouseEvent<HTMLButtonElement>, dependency: ContentItem): void;

	handleContextMenuClose(): void;
}

export const dialogInitialState = {
	dependantItems: null,
	dependencies: null,
	compactView: false,
	showTypes: 'all-deps'
};

export const assetsTypes = {
	'all-deps': {
		label: <FormattedMessage defaultMessage="Show all references" />,
		filter: () => true
	},
	'content-items': {
		label: <FormattedMessage id="dependenciesDialog.contentItems" defaultMessage="Content items only" />,
		filter: (dependency: ContentItem) => dependency.systemType === 'component' || dependency.systemType === 'page'
	},
	assets: {
		label: <FormattedMessage id="dependenciesDialog.assets" defaultMessage="Assets only" />,
		filter: (dependency: ContentItem) => isAsset(dependency.path)
	},
	code: {
		label: <FormattedMessage id="dependenciesDialog.code" defaultMessage="Code only" />,
		filter: (dependency: ContentItem) => isCode(dependency.path)
	}
};
