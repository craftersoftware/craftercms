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
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v2.dal.item.LightItem;
import org.craftercms.studio.api.v2.service.dependency.DependencyService;
import org.craftercms.studio.model.rest.ResultOne;
import org.craftercms.studio.model.rest.dependency.GetDependenciesRequestBody;
import org.craftercms.studio.model.rest.dependency.GetDependentsRequestBody;
import org.craftercms.studio.model.rest.dependency.GetPublishDependenciesRequestBody;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.beans.ConstructorProperties;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.*;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.*;
import static org.craftercms.studio.model.rest.ApiResponse.OK;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Validated
@RestController
@RequestMapping(API_2 + DEPENDENCY)
public class DependencyController {

	private final DependencyService dependencyService;

	@ConstructorProperties({"dependencyService"})
	public DependencyController(final DependencyService dependencyService) {
		this.dependencyService = dependencyService;
	}

	@PostMapping(value = PATH_PARAM_SITE + PUBLISH_DEPENDENCIES, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Map<String, Collection<LightItem>>> getPublishDependencies(@PathVariable @ValidSiteId String siteId,
																				@RequestBody @Valid GetPublishDependenciesRequestBody request) throws SiteNotFoundException {
		Collection<LightItem> softDeps = dependencyService.getSoftDependencies(siteId, request.getPaths());
		Collection<LightItem> hardDeps = dependencyService.getHardDependencies(siteId, request.getPaths());

		softDeps.removeAll(hardDeps);

		ResultOne<Map<String, Collection<LightItem>>> result = new ResultOne<>();
		result.setResponse(OK);
		Map<String, Collection<LightItem>> items = new HashMap<>();
		items.put(RESULT_KEY_HARD_DEPENDENCIES, hardDeps);
		items.put(RESULT_KEY_SOFT_DEPENDENCIES, softDeps);
		result.setEntity(RESULT_KEY_ITEMS, items);
		return result;
	}

	@PostMapping(value = PATH_PARAM_SITE + DEPENDENT_ITEMS, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Collection<LightItem>> getDependentItems(@PathVariable @ValidSiteId String siteId,
															  @RequestBody @Valid GetDependentsRequestBody request)
			throws ServiceLayerException {
		Collection<LightItem> items = dependencyService.getDependentItems(siteId, request.getPath());
		var result = new ResultOne<Collection<LightItem>>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_ITEMS, items);
		return result;
	}

	@PostMapping(value = PATH_PARAM_SITE + DEPENDENCIES, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Collection<LightItem>> getDependencies(@PathVariable @ValidSiteId String siteId,
															@RequestBody @Valid GetDependenciesRequestBody request)
			throws ServiceLayerException {
		Collection<LightItem> items = dependencyService.getDependencies(siteId, request.getPath());
		var result = new ResultOne<Collection<LightItem>>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_ITEMS, items);
		return result;
	}
}
