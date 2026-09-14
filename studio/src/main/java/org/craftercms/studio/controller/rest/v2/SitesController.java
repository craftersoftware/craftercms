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

package org.craftercms.studio.controller.rest.v2;

import jakarta.validation.Valid;
import org.craftercms.commons.plugin.model.PluginDescriptor;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.studio.api.v1.exception.ContentNotFoundException;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteAlreadyExistsException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryCredentialsException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteRepositoryException;
import org.craftercms.studio.api.v1.exception.repository.InvalidRemoteUrlException;
import org.craftercms.studio.api.v1.exception.repository.RemoteRepositoryNotFoundException;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.exception.InvalidSiteStateException;
import org.craftercms.studio.api.v2.exception.configuration.ConfigurationException;
import org.craftercms.studio.api.v2.service.marketplace.MarketplaceService;
import org.craftercms.studio.api.v2.service.policy.PolicyService;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.model.policy.ValidationResult;
import org.craftercms.studio.model.rest.ApiResponse;
import org.craftercms.studio.model.rest.Result;
import org.craftercms.studio.model.rest.ResultList;
import org.craftercms.studio.model.rest.ResultOne;
import org.craftercms.studio.model.rest.marketplace.CreateSiteFromMarketplaceRequest;
import org.craftercms.studio.model.rest.sites.CreateSiteRequest;
import org.craftercms.studio.model.rest.sites.DuplicateSiteRequest;
import org.craftercms.studio.model.rest.sites.UpdateSiteRequest;
import org.craftercms.studio.model.rest.sites.ValidatePolicyRequest;
import org.craftercms.studio.model.site.AllSitesMonitors;
import org.craftercms.studio.model.site.SiteDetails;
import org.craftercms.studio.model.site.SiteMonitor;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.util.Collection;
import java.util.List;

import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.*;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.*;
import static org.craftercms.studio.model.rest.ApiResponse.OK;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Validated
@RestController
@RequestMapping(API_2 + SITES)
public class SitesController {

	private final SitesService sitesService;

	private final MarketplaceService marketplaceService;

	private final PolicyService policyService;

	@ConstructorProperties({"sitesService", "marketplaceService", "policyService"})
	public SitesController(final SitesService sitesService, final MarketplaceService marketplaceService,
						   final PolicyService policyService) {
		this.sitesService = sitesService;
		this.marketplaceService = marketplaceService;
		this.policyService = policyService;
	}

	@GetMapping(value = "/available_blueprints", produces = APPLICATION_JSON_VALUE)
	public ResultList<PluginDescriptor> getAvailableBlueprints() throws ServiceLayerException {
		List<PluginDescriptor> blueprintDescriptors = sitesService.getAvailableBlueprints();
		ResultList<PluginDescriptor> result = new ResultList<>();
		result.setEntities(RESULT_KEY_BLUEPRINTS, blueprintDescriptors);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = "/create_site_from_marketplace", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	@ResponseStatus(code = HttpStatus.CREATED)
	public Result createSite(@Valid @RequestBody CreateSiteFromMarketplaceRequest request)
			throws RemoteRepositoryNotFoundException, InvalidRemoteRepositoryException, ServiceLayerException,
			InvalidRemoteRepositoryCredentialsException, InvalidRemoteUrlException {

		marketplaceService.createSite(request);

		Result result = new Result();
		result.setResponse(ApiResponse.CREATED);
		return result;
	}

	@PostMapping(consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	@ResponseStatus(code = HttpStatus.CREATED)
	public Result createSite(@Valid @RequestBody CreateSiteRequest request)
			throws ServiceLayerException, InvalidRemoteRepositoryCredentialsException, RemoteRepositoryNotFoundException, InvalidRemoteRepositoryException {
		sitesService.createSite(request);
		Result result = new Result();
		result.setResponse(ApiResponse.CREATED);
		return result;
	}

	@PostMapping(value = "/{siteId}", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result updateSite(@ValidSiteId @PathVariable String siteId,
							 @Valid @RequestBody UpdateSiteRequest request)
			throws SiteNotFoundException, SiteAlreadyExistsException, InvalidParametersException {
		sitesService.updateSite(siteId, request.getName(), request.getDescription());

		var result = new Result();
		result.setResponse(OK);

		return result;
	}

	@PostMapping(value = "/{siteId}/unlock", produces = APPLICATION_JSON_VALUE)
	public Result unlockSite(@ValidSiteId @PathVariable String siteId) throws SiteNotFoundException, InvalidSiteStateException {
		sitesService.unlockSite(siteId);
		var result = new Result();
		result.setResponse(OK);
		return result;
	}

	@DeleteMapping(value = "/{siteId}", produces = APPLICATION_JSON_VALUE)
	public Result deleteSite(@ValidSiteId @PathVariable String siteId)
			throws ServiceLayerException {
		sitesService.deleteSite(siteId);

		var result = new Result();
		result.setResponse(ApiResponse.DELETED);
		return result;
	}

	@PostMapping(value = "/{siteId}/policy/validate", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultList<ValidationResult> validatePolicy(@ValidSiteId @PathVariable String siteId,
													   @Valid @RequestBody ValidatePolicyRequest request)
			throws ConfigurationException, IOException, ContentNotFoundException {
		List<ValidationResult> results = policyService.validate(siteId, request.getActions());

		var result = new ResultList<ValidationResult>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_RESULTS, results);
		return result;
	}

	@PostMapping(value = "/{siteId}/duplicate", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	@ResponseStatus(code = HttpStatus.CREATED)
	public Result duplicateSite(@ValidSiteId @PathVariable("siteId") String sourceSiteId, @Valid @RequestBody DuplicateSiteRequest request)
			throws ServiceLayerException {
		sitesService.duplicate(sourceSiteId, request.getSiteId(),
				request.getSiteName(), request.getDescription(),
				request.getSandboxBranch(), request.isReadOnlyBlobStores());

		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = SITE_ID + EXISTS, produces = APPLICATION_JSON_VALUE)
	public ResultOne<Boolean> siteExists(@ValidSiteId @PathVariable String siteId) {
		boolean exists = sitesService.exists(siteId);
		var result = new ResultOne<Boolean>();
		result.setEntity(ResultConstants.RESULT_KEY_EXISTS, exists);
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = SITE_ID, produces = APPLICATION_JSON_VALUE)
	public ResultOne<SiteDetails> getSite(@ValidSiteId @PathVariable String siteId) throws ServiceLayerException {
		SiteDetails site = sitesService.getSiteDetails(siteId);
		var result = new ResultOne<SiteDetails>();
		result.setEntity(ResultConstants.RESULT_KEY_SITE, site);
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = SITE_ID + MONITOR, produces = APPLICATION_JSON_VALUE)
	public ResultList<SiteMonitor> monitorSite(@ValidSiteId @PathVariable String siteId) throws ServiceLayerException {
		Collection<SiteMonitor> siteMonitors = sitesService.monitorSite(siteId);
		ResultList<SiteMonitor> result = new ResultList<>();
		result.setResponse(OK);
		result.setEntities(RESULT_KEY_MONITORS, siteMonitors);
		return result;
	}

	@GetMapping(value = MONITOR, produces = APPLICATION_JSON_VALUE)
	public ResultOne<AllSitesMonitors> monitorAllSites() {
		AllSitesMonitors monitorResult = sitesService.monitorAllSites();
		ResultOne<AllSitesMonitors> result = new ResultOne<>();
		result.setResponse(OK);
		result.setEntity(RESULT_KEY_SITES, monitorResult);
		return result;
	}
}
