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

import { crafterConf, SDKService } from '@craftercms/classes';
import { CrafterConfig } from '@craftercms/models';
import { composeUrl } from '@craftercms/utils';
import { Observable } from 'rxjs';

export type UrlTransformers =
	| 'storeUrlToRenderUrl'
	| 'renderUrlToStoreUrl'
	| 'renderUrlToTargetedStoreUrl'
	| 'storeUrlToFullRenderUrl'
	| 'toWebAppRelativeUrl'
	| 'toServletRelativeUrl'
	| 'toFullUrl'
	| 'toFullHttpsUrl'
	| 'folderToIndexUrl'
	| 'toTargetedUrl'
	| 'toCurrentTargetedUrl';

/**
 * Transforms a URL, based on the current site's UrlTransformationEngine.
 * @param {string} transformerName - Name of the transformer to apply
 * @param {string} url - URL that will be transformed
 */
export function urlTransform(transformerName: UrlTransformers, url: string): Observable<string>;
export function urlTransform(
	transformerName: UrlTransformers,
	url: string,
	config: Partial<CrafterConfig>
): Observable<string>;
export function urlTransform(
	transformerName: UrlTransformers,
	url: string,
	config?: Partial<CrafterConfig>
): Observable<string> {
	config = crafterConf.mix(config);
	const requestURL = composeUrl(config, config.endpoints.TRANSFORM_URL);
	return SDKService.httpGet<string>(
		requestURL,
		{
			crafterSite: config.site,
			transformerName,
			url
		},
		config.headers
	);
}

/**
 * URL Transformation Service API
 */
export const UrlTransformationService = {
	transform: urlTransform,
	urlTransform
};

export default UrlTransformationService;
