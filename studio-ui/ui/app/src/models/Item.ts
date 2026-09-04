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

import { SystemType } from './SystemType';
import Person from './Person';
import { PublishTargetStatus } from './Publishing';

// region export type ItemStates =
export type ItemStates =
	| 'new'
	| 'modified'
	| 'deleted'
	| 'locked'
	| 'systemProcessing'
	| 'submitted'
	| 'scheduled'
	| 'publishing'
	| 'submittedToStaging'
	| 'submittedToLive'
	| 'staged'
	| 'live'
	| 'disabled'
	| 'translationUpToDate'
	| 'translationPending'
	| 'translationInProgress';
// endregion

// region export type ItemActions =
export type ItemActions =
	| 'view'
	| 'copy'
	| 'history'
	| 'dependencies'
	| 'requestPublish'
	| 'createContent'
	| 'paste'
	| 'edit'
	| 'unlock'
	| 'rename'
	| 'cut'
	| 'upload'
	| 'duplicate'
	| 'changeContentType'
	| 'revert'
	| 'editController'
	| 'editTemplate'
	| 'createFolder'
	| 'delete'
	| 'deleteController'
	| 'deleteTemplate'
	| 'publish'
	| 'schedulePublish';
// endregion

export type VirtualItemActions = 'preview' | 'copyWithChildren' | 'viewPackages';

// region export type AssessRemovalItemActions =
export type AssessRemovalItemActions =
	| 'editCode'
	| 'viewCode'
	| 'viewMedia'
	| 'duplicateAsset'
	| 'createTemplate'
	| 'createController';
// endregion

export type AllItemActions = ItemActions | VirtualItemActions | AssessRemovalItemActions;

export type ItemStateMap = { [key in ItemStates]: boolean };

export type ItemActionsMap = { [key in ItemActions]: boolean };

export interface AuditDashboardItem {
	siteId: string;
	actor: string;
	operation: string;
	operationTimestamp: string; // datetime
	target: string;
}

export interface PublishingDashboardItem {
	siteId: string;
	label: string;
	path: string;
	publisher: string;
	publishedDate: string; // datetime
	environment: string;
}

export interface DashboardItem {}

export interface LegacyItem {
	uri: string;
	name: string;
	browserUri: string;
	contentType: string;
	internalName: string;
	children: LegacyItem[];
	user: string;
	userFirstName: string;
	userLastName: string;
	[prop: string]: any;
}

export interface PasteItem {
	path: string;
	children?: PasteItem[];
}

export interface LightItem {
	path: string;
	label: string;
	systemType: SystemType;
	mimeType: string;
	canApprove?: boolean;
	canRequestPublish?: boolean;
}

export interface ContentItem extends LightItem {
	id: number;
	parentId: number;
	contentTypeId: string;
	previewUrl: string;
	state: number;
	stateMap: ItemStateMap;
	lockOwner: Person;
	localeCode: string;
	translationSourceId: string;
	creator: Person;
	dateCreated: string;
	modifier: Person;
	dateModified: string;
	availableActions: number;
	availableActionsMap: ItemActionsMap;
	childrenCount: number;
	staging: PublishTargetStatus;
	live: PublishTargetStatus;
	savedAsDraft: boolean;
}
