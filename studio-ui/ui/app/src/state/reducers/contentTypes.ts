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

import GlobalState from '../../models/GlobalState';
import { createEntityState, createLookupTable } from '../../utils/object';
import { createReducer } from '@reduxjs/toolkit';
import {
	associateTemplateComplete,
	dissociateTemplateComplete,
	fetchContentTypes,
	fetchContentTypesComplete,
	fetchContentTypesFailed,
	updateContentTypeJsController
} from '../actions/preview';
import ContentType from '../../models/ContentType';
import { changeSiteComplete } from '../actions/sites';

const reducer = createReducer<GlobalState['contentTypes']>(createEntityState(), (builder) => {
	builder
		.addCase(changeSiteComplete, () => createEntityState())
		.addCase(fetchContentTypes, (state) => ({
			...state,
			isFetching: true
		}))
		.addCase(fetchContentTypesComplete, (state, { payload: contentTypes }) => ({
			...state,
			byId: createLookupTable<ContentType>(contentTypes),
			isFetching: false,
			error: null
		}))
		.addCase(fetchContentTypesFailed, (state, { payload }) => ({
			...state,
			error: payload.response,
			isFetching: false
		}))
		.addCase(associateTemplateComplete, (state, { payload }) => ({
			...state,
			byId: {
				...state.byId,
				[payload.contentTypeId]: {
					...state.byId[payload.contentTypeId],
					displayTemplate: payload.displayTemplate
				}
			}
		}))
		.addCase(dissociateTemplateComplete, (state, { payload }) => ({
			...state,
			byId: {
				...state.byId,
				[payload.contentTypeId]: {
					...state.byId[payload.contentTypeId],
					displayTemplate: ''
				}
			}
		}))
		.addCase(updateContentTypeJsController, (state, { payload }) => {
			const current = state.byId[payload.contentTypeId];
			if (!current) {
				return state;
			}
			return {
				...state,
				byId: {
					...state.byId,
					[payload.contentTypeId]: {
						...current,
						hasJsController: payload.enabled
					}
				}
			};
		});
});

export default reducer;
