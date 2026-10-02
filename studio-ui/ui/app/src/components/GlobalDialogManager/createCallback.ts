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

import StandardAction from '../../models/StandardAction';
import { Dispatch } from 'redux';
import { isPlainObject } from '../../utils/object';

// @formatter:off
export function createCallback(action: StandardAction, dispatch: Dispatch): (output?: unknown) => void {
	// prettier-ignore
	return action ? (output: any) => {
    const hasPayload = Boolean(action.payload);
    const hasOutput = Boolean(output) && isPlainObject(output);
    const payload = (hasPayload && !hasOutput)
      // If there's a payload in the original action and there
      // is no output from the resulting callback, simply use the
      // original payload
      ? action.payload
      // Otherwise, if there's no payload but there is an output sent
      // to the resulting callback, use the output as the payload
      : (!hasPayload && hasOutput)
        ? output
        : (
          (hasPayload && hasOutput)
            // If there's an output and a payload, merge them both into a single object.
            // We're supposed to be using objects for all our payloads, otherwise this
            // could fail with literal native values such as strings or numbers.
            ? Array.isArray(action.payload)
              // If it's an array, assume is a BATCH_ACTIONS action payload; each item
              // of the array should be an action, so merge each item with output.
              ? action.payload.map((a) => ({ ...a, payload: { ...a.payload, ...output } }))
              // If it's not an array, it's a single action. Merge with output.
              : { ...action.payload, ...output }
            // Later, we check if there's a payload to add it
            : false
        );
    dispatch({
      type: action.type,
      ...(payload ? { payload } : {})
    });
  } : null;
}
// @formatter:on
