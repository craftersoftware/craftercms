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

import { createAction } from '@reduxjs/toolkit';
import { Version } from '../../models/monitoring/Version';
import { AjaxError } from 'rxjs/ajax';
import StandardAction from '../../models/StandardAction';
import { UiBootstrap } from '../../models/UiBootstrap';

export const fetchSystemVersion = /*#__PURE__*/ createAction<StandardAction>('FETCH_SYSTEM_VERSION');
export const fetchSystemVersionComplete = /*#__PURE__*/ createAction<Version>('FETCH_SYSTEM_VERSION_COMPLETE');
export const fetchSystemVersionFailed = /*#__PURE__*/ createAction<AjaxError>('FETCH_SYSTEM_VERSION_FAILED');
export const uiBootstrapLoaded = /*#__PURE__*/ createAction<UiBootstrap>('UI_BOOTSTRAP_LOADED');