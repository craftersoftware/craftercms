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

import org.apache.commons.fileupload2.core.FileUploadException;
import org.apache.commons.fileupload.util.Streams;
import org.apache.commons.fileupload2.core.FileItemInput;
import org.apache.commons.fileupload2.core.FileItemInputIterator;
import org.apache.commons.fileupload2.jakarta.servlet6.JakartaServletFileUpload;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.config.profiles.ConfigurationProfileNotFoundException;
import org.craftercms.commons.validation.ValidationException;
import org.craftercms.commons.validation.annotations.param.ValidExistingContentPath;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.commons.validation.validators.impl.EsapiValidator;
import org.craftercms.commons.validation.validators.impl.NoTagsValidator;
import org.craftercms.commons.validation.validators.impl.SecurePathValidator;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.WebDavException;
import org.craftercms.studio.api.v1.webdav.WebDavItem;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.service.webdav.WebDavService;
import org.craftercms.studio.model.rest.ApiResponse;
import org.craftercms.studio.model.rest.ResultList;
import org.craftercms.studio.model.rest.ResultOne;
import org.springframework.validation.Validator;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.io.InputStream;

import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.CONTENT_PATH_WRITE;
import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.SITE_ID;
import static org.craftercms.studio.controller.rest.ValidationUtils.validateValue;
import static org.craftercms.studio.controller.rest.v2.RequestConstants.*;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.RESULT_KEY_ITEM;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.RESULT_KEY_ITEMS;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * Rest controller for WebDAV service
 *
 * @author joseross
 * @since 3.1.4
 */
@Validated
@RestController
@RequestMapping("/api/2/webdav/{siteId}")
public class WebdavController {

	/**
	 * The webdav service
	 */
	protected final WebDavService webDavService;

	@ConstructorProperties({"webDavService"})
	public WebdavController(final WebDavService webDavService) {
		this.webDavService = webDavService;
	}

	/**
	 * List items in a WebDAV server
	 *
	 * @param siteId    the id of the site
	 * @param profileId the id of the webdav profile
	 * @param path      the path to list
	 * @param type      the type of items to filter
	 * @return the list of items
	 * @throws WebDavException                       if there is any error connecting to the WebDAV server
	 * @throws SiteNotFoundException                 if site does not exist
	 * @throws ConfigurationProfileNotFoundException if the profile is not found
	 */
	@GetMapping(value = "list", produces = APPLICATION_JSON_VALUE)
	public ResultList<WebDavItem> listItems(
		@NotBlank @ValidSiteId @PathVariable String siteId,
		@NotBlank @RequestParam(REQUEST_PARAM_PROFILE_ID) String profileId,
		@ValidExistingContentPath @RequestParam(value = REQUEST_PARAM_PATH, required = false, defaultValue = StringUtils.EMPTY) String path,
		@RequestParam(value = REQUEST_PARAM_TYPE, required = false, defaultValue = StringUtils.EMPTY) String type)
		throws WebDavException, SiteNotFoundException, ConfigurationProfileNotFoundException {
		ResultList<WebDavItem> result = new ResultList<>();
		result.setEntities(RESULT_KEY_ITEMS, webDavService.list(siteId, profileId, path, type));
		result.setResponse(ApiResponse.OK);

		return result;
	}

	/**
	 * Uploads a file to a WebDAV server
	 *
	 * @param request the request
	 * @return the uploaded item
	 * @throws IOException                           if there is any error reading the content of the file
	 * @throws WebDavException                       if there is any error uploading the file to the WebDAV server
	 * @throws InvalidParametersException            if there is any error parsing the request
	 * @throws SiteNotFoundException                 if site does not exist
	 * @throws ConfigurationProfileNotFoundException if the profile is not found
	 */
	@PostMapping(value = "/upload", produces = APPLICATION_JSON_VALUE)
	public ResultOne<WebDavItem> uploadItem(@ValidSiteId @PathVariable String siteId, HttpServletRequest request) throws IOException, WebDavException,
		InvalidParametersException, SiteNotFoundException, ConfigurationProfileNotFoundException, ValidationException {
		if (!JakartaServletFileUpload.isMultipartContent(request)) {
			throw new InvalidParametersException("The request is not multipart");
		}
		ResultOne<WebDavItem> result = new ResultOne<>();
		try {
			JakartaServletFileUpload upload = new JakartaServletFileUpload();
			FileItemInputIterator iterator = upload.getItemIterator(request);
			String profileId = null;
			String path = null;
			if (!iterator.hasNext()) {
				throw new InvalidParametersException("Request body is empty");
			}
			while (iterator.hasNext()) {
				FileItemInput item = iterator.next();
				String name = item.getFieldName();
				try (InputStream stream = item.getInputStream()) {
					if (item.isFormField()) {
						switch (name) {
							case REQUEST_PARAM_PROFILE_ID:
								profileId = Streams.asString(stream);
								break;
							case REQUEST_PARAM_PATH:
								path = Streams.asString(stream);
							default:
								// Unknown parameter, just skip it...
						}
					} else {
						String filename = item.getName();
						if (StringUtils.isNotEmpty(filename)) {
							filename = FilenameUtils.getName(filename);
						}
						validateUploadParams(siteId, profileId, path, filename);
						result.setEntity(RESULT_KEY_ITEM,
							webDavService.upload(siteId, profileId, path, filename, stream));
						result.setResponse(ApiResponse.OK);
						return result;
					}
				}
			}
			throw new InvalidParametersException("No file was sent in the request body");
		} catch (FileUploadException e) {
			throw new InvalidParametersException("The request body is invalid");
		}
	}

	private void validateUploadParams(String siteId, String profileId, String path, String filename) throws ValidationException {
		Validator pathValidator = new EsapiValidator(CONTENT_PATH_WRITE);
		validateValue(new EsapiValidator(SITE_ID), siteId, REQUEST_PARAM_SITE_ID);
		validateValue(pathValidator, filename, "filename");
		validateValue(pathValidator, path, REQUEST_PARAM_PATH);
		validateValue(new SecurePathValidator(), path, REQUEST_PARAM_PATH);
		validateValue(new NoTagsValidator(), profileId, REQUEST_PARAM_PROFILE_ID);
	}

}
