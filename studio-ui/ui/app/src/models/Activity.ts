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

import { ContentItem } from './Item';

// Omitting UNKNOWN, APPROVE & APPROVE_SCHEDULED for now.
export type Activities =
	| 'CREATE'
	| 'UPDATE'
	| 'DELETE'
	| 'MOVE'
	| 'REQUEST_PUBLISH'
	| 'APPROVE_PUBLISH_PACKAGE'
	| 'REJECT_PUBLISH_PACKAGE'
	| 'REVERT'
	| 'PUBLISH_ITEM_LIST_COMPLETE'
	| 'INITIAL_PUBLISH_COMPLETE'
	| 'CANCEL_PUBLISH_PACKAGE'
	| 'PUBLISH'
	| 'PUBLISH_ALL_COMPLETE'
	| 'UPDATE_PUBLISH_PACKAGE';

export interface Activity {
	id: number;
	person: {
		username: string;
		firstName: string;
		lastName: string;
		avatar: string;
	};
	actionType: Activities;
	actionTimestamp: string;
	item: Pick<ContentItem, 'path' | 'label' | 'previewUrl' | 'systemType'>;
	package: any; // TODO: Type package
}

export default Activity;
