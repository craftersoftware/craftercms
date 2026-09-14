/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

import java.beans.ConstructorProperties;

import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime;
import org.craftercms.studio.api.v2.service.content.ContentTypeService;
import org.craftercms.studio.model.contentType.ModelDefinitions;
import static org.craftercms.studio.model.rest.ApiResponse.OK;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/2/model")
public class ModelController {
	private final ContentTypeService contentTypeService;

	@ConstructorProperties({"contentTypeService"})
	public ModelController(ContentTypeService contentTypeService) {
		this.contentTypeService = contentTypeService;
	}

	@PostMapping(value = "/{siteId}/definitions", produces = APPLICATION_JSON_VALUE)
	@LogExecutionTime
	public ModelDefinitions getModelDefinitions(@ValidSiteId @PathVariable("siteId") String siteId) throws ServiceLayerException {
		ModelDefinitions result = new ModelDefinitions(contentTypeService.getAllModelDefinitions(siteId));
		result.setResponse(OK);
		return result;
	}
}
