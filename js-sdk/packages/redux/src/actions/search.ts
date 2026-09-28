/*
 * Copyright (C) 2007-2021 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

import { Query } from '@craftercms/search';
import { createAction } from '@reduxjs/toolkit';

export const SEARCH_COMPLETE = 'CRAFTERCMS_SEARCH_COMPLETE';

export const search = /*#__PURE__*/ createAction<Query>('CRAFTERCMS_SEARCH');

export const searchComplete = /*#__PURE__*/ createAction<{ queryId: string; response? }>(SEARCH_COMPLETE);
