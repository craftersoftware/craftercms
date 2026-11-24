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

import { ofType } from 'redux-observable';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import StandardAction from '../../models/StandardAction';
import { batchActions } from '../actions/misc';
import { CrafterCMSEpic } from '../store';

/** Flattens a batchActions payload into individual actions on the epic stream. */
export const batchActionsEpic: CrafterCMSEpic = (action$: Observable<StandardAction<StandardAction[]>>) =>
	action$.pipe(
		ofType(batchActions.type),
		switchMap(({ payload }) => payload)
	);

export default batchActionsEpic;
