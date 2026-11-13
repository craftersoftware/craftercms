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

import { ofType } from 'redux-observable';
import {
	associateTemplate as associateTemplateActionCreator,
	associateTemplateComplete,
	associateTemplateFailed,
	dissociateTemplate as dissociateTemplateActionCreator,
	dissociateTemplateComplete,
	dissociateTemplateFailed,
	fetchComponentsByContentType,
	fetchComponentsByContentTypeComplete,
	fetchComponentsByContentTypeFailed,
	fetchContentTypes,
	fetchContentTypesComplete,
	fetchContentTypesFailed,
	setContentTypeFilter
} from '../actions/preview';
import { exhaustMap, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { fetchItemsByContentType } from '../../services/content';
import { catchAjaxError } from '../../utils/ajax';
import GlobalState from '../../models/GlobalState';
import { Observable } from 'rxjs';
import {
	associateTemplate as associateTemplateService,
	dissociateTemplate as dissociateTemplateService,
	fetchContentTypes as fetchContentTypesService
} from '../../services/contentTypes';
import { CrafterCMSEpic } from '../store';
import { addConfiguredAdditionalFields } from '../../utils/contentType';

export default [
	// region fetchContentTypes
	(action$, state$) =>
		action$.pipe(
			ofType(fetchContentTypes.type),
			withLatestFrom(state$),
			exhaustMap(
				([
					,
					{
						sites: { active: site }
					}
				]) =>
					fetchContentTypesService(site).pipe(map(fetchContentTypesComplete), catchAjaxError(fetchContentTypesFailed))
			)
		),
	// endregion
	// region fetchComponentsByContentType
	(action$, state$: Observable<GlobalState>) =>
		action$.pipe(
			ofType(fetchComponentsByContentType.type, setContentTypeFilter.type),
			withLatestFrom(state$),
			switchMap(([, state]) => {
				// allowedContentTypes is an array of content type IDs that are 'compatible' with preview.
				// For a content type to be compatible, the type should have the 'shareExisting' property set to true.
				// *Note that this is different from the 'shared' property, which means that new content of the type can be created.
				let allowedContentTypes = Object.entries(state.preview.guest?.allowedContentTypes ?? {}).flatMap(
					([key, type]) => (type.sharedExisting ? [key] : [])
				);
				// If '*' is included in allowedContentTypes, it means that all content types are allowed.
				if (allowedContentTypes.includes('*') && state.preview.guest.allowedContentTypes['*'].sharedExisting) {
					allowedContentTypes = Object.values(state.contentTypes.byId)
						.filter((contentType) => contentType.type === 'component' && !contentType.id.includes('/level-descriptor'))
						.map((contentType) => contentType.id);
				}
				const contentTypesById =
					state.uiConfig.isFetching === false
						? addConfiguredAdditionalFields(state.contentTypes.byId, state.uiConfig.controls)
						: state.contentTypes.byId;
				return fetchItemsByContentType(
					state.sites.active,
					state.preview.components.contentTypeFilter === 'compatible'
						? allowedContentTypes
						: state.preview.components.contentTypeFilter,
					contentTypesById,
					state.preview.components.query
				).pipe(map(fetchComponentsByContentTypeComplete), catchAjaxError(fetchComponentsByContentTypeFailed));
			})
		),
	// endregion
	// region associateTemplate
	(action$, state$) =>
		action$.pipe(
			ofType(associateTemplateActionCreator.type),
			withLatestFrom(state$),
			switchMap(
				([
					{ payload },
					{
						sites: { active }
					}
				]) =>
					associateTemplateService(active, payload.contentTypeId, payload.displayTemplate).pipe(
						map(() =>
							associateTemplateComplete({
								contentTypeId: payload.contentTypeId,
								displayTemplate: payload.displayTemplate
							})
						),
						catchAjaxError(associateTemplateFailed)
					)
			)
		),
	// endregion
	// region dissociateTemplate
	(action$, state$) =>
		action$.pipe(
			ofType(dissociateTemplateActionCreator.type),
			withLatestFrom(state$),
			switchMap(
				([
					{ payload },
					{
						sites: { active }
					}
				]) =>
					dissociateTemplateService(active, payload.contentTypeId).pipe(
						map(() => dissociateTemplateComplete({ contentTypeId: payload.contentTypeId })),
						catchAjaxError(dissociateTemplateFailed)
					)
			)
		)
	// endregion
] as CrafterCMSEpic[];
