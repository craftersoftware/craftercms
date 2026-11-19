/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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

import { contentTypeCreated, contentTypeUpdated, emitSystemEvent } from '../../../state/actions/system';

/**
 * Host-bus system event for a successful Type Builder save.
 * New types emit CONTENT_TYPE_CREATED; existing types emit CONTENT_TYPE_UPDATED.
 */
export function contentTypeSaveSystemEvent(isNew: boolean, contentTypeId: string) {
	return emitSystemEvent(isNew ? contentTypeCreated({ contentTypeId }) : contentTypeUpdated({ contentTypeId }));
}
