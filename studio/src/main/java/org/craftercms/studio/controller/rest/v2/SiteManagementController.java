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

import jakarta.servlet.http.HttpServletRequest;
import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.commons.rest.ManagementToken;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.model.rest.ResultList;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.beans.ConstructorProperties;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_MANAGEMENT_SITE_MANAGEMENT_TOKEN;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.API_2;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.MANAGEMENT_SITES;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.RESULT_KEY_SITES;
import static org.craftercms.studio.model.rest.ApiResponse.OK;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * Management API used by serverless delivery to discover sites.
 */
@Validated
@RestController
@RequestMapping(API_2 + MANAGEMENT_SITES)
public class SiteManagementController extends ManagementTokenAware {

	private final SitesService sitesService;

	@ConstructorProperties({"studioConfiguration", "sitesService"})
	public SiteManagementController(StudioConfiguration studioConfiguration, SitesService sitesService) {
		super(studioConfiguration);
		this.sitesService = sitesService;
	}

	@Override
	protected String getConfiguredToken() {
		return studioConfiguration.getProperty(CONFIGURATION_MANAGEMENT_SITE_MANAGEMENT_TOKEN);
	}

	@GetMapping(produces = APPLICATION_JSON_VALUE)
	public ResultList<String> getDeliverableSites(HttpServletRequest request)
			throws InvalidManagementTokenException {
		validateHeaderToken(request.getHeader(ManagementToken.HEADER_NAME));
		ResultList<String> result = new ResultList<>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_SITES, sitesService.getDeliverableSiteIds());
		return result;
	}

}
