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

package org.craftercms.studio.controller.rest.v2;

import jakarta.validation.Valid;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.craftercms.commons.validation.annotations.param.ValidConfigurationPath;
import org.craftercms.commons.validation.annotations.param.ValidExistingContentPath;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.commons.validation.annotations.param.ValidateSecurePathParam;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.service.content.ContentTypeService;
import org.craftercms.studio.api.v2.utils.StudioUtils;
import org.craftercms.studio.model.contentType.ContentType;
import org.craftercms.studio.model.rest.Result;
import org.craftercms.studio.model.rest.ResultList;
import org.craftercms.studio.model.rest.ResultOne;
import org.craftercms.studio.model.rest.contentType.DeleteContentTypeRequest;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.beans.ConstructorProperties;
import java.util.Collection;
import java.util.List;

import static org.apache.commons.lang3.StringUtils.isEmpty;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.*;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.*;
import static org.craftercms.studio.model.rest.ApiResponse.DELETED;
import static org.craftercms.studio.model.rest.ApiResponse.OK;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Validated
@RestController
@RequestMapping(API_2 + CONFIGURATION + CONTENT_TYPES + SITE_ID)
public class ContentTypeController {
	private final ContentTypeService contentTypeService;

	@ConstructorProperties("contentTypeService")
	public ContentTypeController(ContentTypeService contentTypeService) {
		this.contentTypeService = contentTypeService;
	}

	@GetMapping(value = USAGE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Object> getContentTypeUsage(@ValidSiteId @PathVariable String siteId,
												 @ValidConfigurationPath @RequestParam String contentType)
			throws Exception {
		var result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_USAGE, contentTypeService.getContentTypeUsage(siteId, contentType));

		return result;
	}

	@GetMapping(FORM_CONTROLLER)
	public ResponseEntity<Resource> getContentTypeFormController(@ValidSiteId @PathVariable String siteId,
																 @ValidConfigurationPath @RequestParam String contentTypeId) throws ServiceLayerException {
		ImmutablePair<String, Resource> resource = contentTypeService.getContentTypeFormController(siteId, contentTypeId);
		return getResourceResponse(resource.getKey(), resource.getValue());
	}

	@GetMapping(PREVIEW_IMAGE)
	public ResponseEntity<Resource> getContentTypePreviewImage(@ValidSiteId @PathVariable String siteId,
															   @ValidConfigurationPath @ValidateSecurePathParam @RequestParam String contentTypeId)
			throws ServiceLayerException {
		ImmutablePair<String, Resource> resource = contentTypeService.getContentTypePreviewImage(siteId, contentTypeId);
		return getResourceResponse(resource.getKey(), resource.getValue());
	}

	@GetMapping(produces = APPLICATION_JSON_VALUE)
	public ResultList<ContentType> getContentTypes(@ValidSiteId @PathVariable String siteId,
												   @ValidConfigurationPath @RequestParam(required = false) String contentTypeId) throws ServiceLayerException {
		var result = new ResultList<ContentType>();
		result.setResponse(OK);

		Collection<ContentType> contentTypes;
		if (isEmpty(contentTypeId)) {
			contentTypes = contentTypeService.getAllContentTypes(siteId);
		} else {
			contentTypes = List.of(contentTypeService.getContentType(siteId, contentTypeId));
		}
		result.setEntities(RESULT_KEY_CONTENT_TYPES, contentTypes);
		return result;
	}

	@GetMapping(value = ALLOWED_TYPES, produces = APPLICATION_JSON_VALUE)
	public ResultList<String> getAllowedContentTypes(@ValidSiteId @PathVariable String siteId, @ValidExistingContentPath @RequestParam String path) throws ServiceLayerException {
		ResultList<String> result = new ResultList<>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_ALLOWED_TYPES, contentTypeService.getAllowedContentTypes(siteId, path));
		return result;
	}

	@DeleteMapping(consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result deleteContentType(@ValidSiteId @PathVariable String siteId, @RequestBody @Valid DeleteContentTypeRequest request)
			throws ServiceLayerException, AuthenticationException, UserNotFoundException {
		contentTypeService.deleteContentType(siteId, request.getContentType(),
				request.isDeleteDependencies());
		var result = new Result();
		result.setResponse(DELETED);
		return result;
	}

	private ResponseEntity<Resource> getResourceResponse(String name, Resource resource) {
		String mimeType = StudioUtils.getMimeType(name);

		return ResponseEntity
				.ok()
				.header(HttpHeaders.CONTENT_TYPE, mimeType)
				.body(resource);
	}
}
