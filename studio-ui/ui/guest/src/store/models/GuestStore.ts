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

import { EnhancedStore } from '@reduxjs/toolkit';
import { GuestStandardAction } from './GuestStandardAction';
import { DropZone, ICERecord } from '../../models/InContextEditing';
import { LookupTable } from '@craftercms/studio-ui/models/LookupTable';
import { StateObservable } from 'redux-observable';
import ContentType from '@craftercms/studio-ui/models/ContentType';
import { ContentInstance } from '@craftercms/studio-ui/models/ContentInstance';
import { EditingStatus } from '../../constants';
import { RteConfig } from '../../models/Rte';
import Person from '@craftercms/studio-ui/models/Person';
import { SearchItem } from '@craftercms/studio-ui/models';

interface T {
	[K: string]: any;
}

// TODO: Types
export interface GuestState {
	dragContext: {
		targetIndex: number;
		inZone: boolean;
		invalidDrop?: boolean;
		dropZone?: DropZone;
		players: any[];
		siblings: any[];
		containers: any[];
		over?: any;
		prev?: any;
		next?: any;
		coordinates?: any;
		// TODO: Dragged seems to be an ICE record, but there's code looking for dragged.path
		dragged: ICERecord | DataTransferItem | SearchItem;
		dropZones: DropZone[];
		scrolling?: boolean;
		contentType?: ContentType;
		instance?: ContentInstance;
		isInstanceDuplicateInZone?: boolean;
	};
	hostCheckedIn: boolean;
	status: EditingStatus;
	editMode: boolean;
	highlightMode: string;
	authoringBase: string;
	editModePadding: boolean;
	editable: T;
	draggable: T;
	highlighted: T;
	uploading: LookupTable;
	// TODO: Move items and instances to state and out of content controller.
	// models: LookupTable<ContentInstance>;
	// itemsByPath: LookupTable<ContentItem>;
	lockedPaths: LookupTable<{ user: Person }>;
	externallyModifiedPaths: LookupTable<{ user: Person }>;
	contentTypes: LookupTable<ContentType>;
	fieldSwitcher?: {
		iceId: number;
		currentElement: number;
		registryEntryIds: number[];
	};
	rteConfig: RteConfig;
	activeSite: string;
	username: string;
	/** Set while drop targets are listed so Insert here can run without a drag. */
	keyboardPlacement: {
		contentType: ContentType;
		instance?: ContentInstance;
	} | null;
}

export type GuestStateObservable = StateObservable<GuestState>;

export type GuestStore = EnhancedStore<GuestState, GuestStandardAction>;
