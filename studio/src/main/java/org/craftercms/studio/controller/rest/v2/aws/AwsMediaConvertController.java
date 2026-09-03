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

package org.craftercms.studio.controller.rest.v2.aws;

import org.apache.commons.fileupload2.core.FileUploadException;
import org.apache.commons.fileupload.util.Streams;
import org.apache.commons.fileupload2.core.FileItemInput;
import org.apache.commons.fileupload2.core.FileItemInputIterator;
import org.apache.commons.fileupload2.jakarta.servlet6.JakartaServletFileUpload;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.config.profiles.ConfigurationProfileNotFoundException;
import org.craftercms.commons.validation.ValidationException;
import org.craftercms.commons.validation.validators.impl.EsapiValidator;
import org.craftercms.commons.validation.validators.impl.NoTagsValidator;
import org.craftercms.studio.api.v1.exception.AwsException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.service.aws.mediaconvert.AwsMediaConvertService;
import org.craftercms.studio.model.aws.mediaconvert.MediaConvertResult;
import org.craftercms.studio.model.rest.ApiResponse;
import org.craftercms.studio.model.rest.ResultOne;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.Validator;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
import java.io.InputStream;

import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.*;
import static org.craftercms.studio.controller.rest.v2.RequestConstants.REQUEST_PARAM_SITE_ID;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.RESULT_KEY_ITEM;
import static org.craftercms.studio.controller.rest.ValidationUtils.validateValue;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * Rest controller for AWS MediaConvert
 *
 * @author joseross
 * @since 3.1.1
 */
@RestController
@RequestMapping("/api/2/aws/{siteId}/mediaconvert")
public class AwsMediaConvertController {

	public static final String INPUT_PROFILE_PARAM = "inputProfileId";
	public static final String OUTPUT_PROFILE_PARAM = "outputProfileId";

	@Autowired
	protected AwsMediaConvertService mediaConvertService;

	/**
	 * Uploads a file to S3 and triggers a MediaConvert job
	 *
	 * @param request the request
	 * @return the result of triggering the job
	 * @throws IOException                           if there is any error reading the content of the file
	 * @throws AwsException                          if there is any error uploading the file or triggering the job
	 * @throws InvalidParametersException            if there is any error parsing the request
	 * @throws SiteNotFoundException                 if the site is not found
	 * @throws ConfigurationProfileNotFoundException if the profile is not found
	 */
	@PostMapping(value = "/upload", produces = APPLICATION_JSON_VALUE)
	public ResultOne<MediaConvertResult> uploadVideo(@PathVariable String siteId, HttpServletRequest request)
		throws IOException, AwsException, InvalidParametersException, ConfigurationProfileNotFoundException, SiteNotFoundException, ValidationException {
		if (!JakartaServletFileUpload.isMultipartContent(request)) {
			throw new InvalidParametersException("The request is not multipart");
		}
		ResultOne<MediaConvertResult> result = new ResultOne<>();
		try {
			JakartaServletFileUpload upload = new JakartaServletFileUpload();
			FileItemInputIterator iterator = upload.getItemIterator(request);
			String inputProfileId = null;
			String outputProfileId = null;
			while (iterator.hasNext()) {
				FileItemInput item = iterator.next();
				String name = item.getFieldName();
				try (InputStream stream = item.getInputStream()) {
					if (item.isFormField()) {
						switch (name) {
							case INPUT_PROFILE_PARAM:
								inputProfileId = Streams.asString(stream);
								break;
							case OUTPUT_PROFILE_PARAM:
								outputProfileId = Streams.asString(stream);
								break;
							default:
								// Unknown parameter, just skip it...
						}
					} else {
						if (StringUtils.isAnyEmpty(siteId, inputProfileId, outputProfileId)) {
							throw new InvalidParametersException("Missing one or more required parameters: "
								+ "siteId, inputProfileId or outputProfileId");
						}
						String filename = item.getName();
						if (StringUtils.isNotEmpty(filename)) {
							filename = FilenameUtils.getName(filename);
						}
						validateUploadParams(siteId, inputProfileId, outputProfileId, filename);
						result.setEntity(RESULT_KEY_ITEM,
							mediaConvertService
								.uploadVideo(siteId, inputProfileId, outputProfileId, filename, stream));
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

	private void validateUploadParams(String siteId, String inputProfileId, String outputProfileId, String filename) throws ValidationException {
		Validator pathValidator = new EsapiValidator(CONTENT_PATH_WRITE);
		validateValue(new EsapiValidator(SITE_ID), siteId, REQUEST_PARAM_SITE_ID);
		validateValue(pathValidator, filename, "filename");
		validateValue(new NoTagsValidator(), inputProfileId, INPUT_PROFILE_PARAM);
		validateValue(new NoTagsValidator(), outputProfileId, OUTPUT_PROFILE_PARAM);
	}

}
