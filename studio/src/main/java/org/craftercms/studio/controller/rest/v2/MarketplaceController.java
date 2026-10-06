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

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.PositiveOrZero;
import org.craftercms.commons.validation.annotations.param.EsapiValidatedParam;
import org.craftercms.commons.validation.annotations.param.ValidExistingContentPath;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v2.exception.marketplace.MarketplaceException;
import org.craftercms.studio.api.v2.service.marketplace.Constants;
import org.craftercms.studio.api.v2.service.marketplace.MarketplaceService;
import org.craftercms.studio.api.v2.service.marketplace.registry.PluginRecord;
import org.craftercms.studio.model.rest.ApiResponse;
import org.craftercms.studio.model.rest.PaginatedResultList;
import org.craftercms.studio.model.rest.Result;
import org.craftercms.studio.model.rest.ResultList;
import org.craftercms.studio.model.rest.marketplace.InstallPluginRequest;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.beans.ConstructorProperties;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.SEARCH_KEYWORDS;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.RESULT_KEY_ITEMS;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.RESULT_KEY_PLUGINS;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * REST controller that provides access to Marketplace operations
 *
 * @author joseross
 * @since 3.1.2
 */
@Validated
@RestController
@RequestMapping("/api/2/marketplace")
public class MarketplaceController {

	protected final MarketplaceService marketplaceService;

	@ConstructorProperties({"marketplaceService"})
	public MarketplaceController(final MarketplaceService marketplaceService) {
		this.marketplaceService = marketplaceService;
	}

	@SuppressWarnings("unchecked")
	@GetMapping(value = "/search", produces = APPLICATION_JSON_VALUE)
	public PaginatedResultList<Map<String, Object>> searchPlugins(@RequestParam(required = false) String type,
								      @EsapiValidatedParam(type = SEARCH_KEYWORDS)
								      @RequestParam(required = false) String keywords,
								      @RequestParam(required = false, defaultValue = "false") boolean showIncompatible,
								      @PositiveOrZero @RequestParam(required = false, defaultValue = "0") long offset,
								      @PositiveOrZero @RequestParam(required = false, defaultValue = "10") long limit)
		throws MarketplaceException {
		Map<String, Object> page = marketplaceService.searchPlugins(type, keywords, showIncompatible, offset, limit);

		PaginatedResultList<Map<String, Object>> result = new PaginatedResultList<>();

		result.setResponse(ApiResponse.OK);
		result.setEntities(RESULT_KEY_PLUGINS, (List<Map<String, Object>>) page.get(Constants.RESULT_ITEMS));
		result.setTotal((int) page.get(Constants.RESULT_TOTAL));
		result.setOffset((int) offset);
		result.setLimit((int) limit);

		return result;
	}

	@GetMapping(value = "/{siteId}/installed", produces = APPLICATION_JSON_VALUE)
	public ResultList<PluginRecord> getInstalledPlugins(@PathVariable @ValidSiteId String siteId) throws MarketplaceException {
		ResultList<PluginRecord> result = new ResultList<>();
		result.setResponse(ApiResponse.OK);
		result.setEntities(RESULT_KEY_PLUGINS, marketplaceService.getInstalledPlugins(siteId));
		return result;
	}

	@PostMapping(value = "/{siteId}/install", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result installPlugin(@PathVariable @ValidSiteId String siteId, @Valid @RequestBody InstallPluginRequest request) throws MarketplaceException {
		marketplaceService.installPlugin(siteId, request.getPluginId(), request.getPluginVersion(),
			request.getParameters());

		Result result = new Result();
		result.setResponse(ApiResponse.OK);
		return result;
	}

	@GetMapping(value = "/{siteId}/usage", produces = APPLICATION_JSON_VALUE)
	public ResultList<String> getDependantItems(@PathVariable @ValidSiteId String siteId, @RequestParam String pluginId)
		throws ServiceLayerException {
		ResultList<String> result = new ResultList<>();
		result.setResponse(ApiResponse.OK);
		result.setEntities(RESULT_KEY_ITEMS, marketplaceService.getPluginUsage(siteId, pluginId));
		return result;
	}

	@PostMapping(value = "/{siteId}/remove", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result removePlugin(@PathVariable @ValidSiteId String siteId, @Valid @RequestBody RemovePluginRequest request) throws ServiceLayerException {
		marketplaceService.removePlugin(siteId, request.getPluginId(), request.isForce());

		Result result = new Result();
		result.setResponse(ApiResponse.OK);
		return result;
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	protected static class RemovePluginRequest {

		@NotEmpty
		protected String pluginId;

		protected boolean force;

		public String getPluginId() {
			return pluginId;
		}

		public void setPluginId(String pluginId) {
			this.pluginId = pluginId;
		}

		public boolean isForce() {
			return force;
		}

		public void setForce(boolean force) {
			this.force = force;
		}

	}

	@PostMapping(value = "/{siteId}/copy", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result copyPlugin(@PathVariable @ValidSiteId String siteId, @Valid @RequestBody CopyPluginRequest request) throws MarketplaceException {
		marketplaceService.copyPlugin(siteId, request.getPath(), request.getParameters());

		Result result = new Result();
		result.setResponse(ApiResponse.OK);
		return result;
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	protected static class CopyPluginRequest {

		@NotEmpty
		@ValidExistingContentPath
		protected String path;

		protected Map<String, String> parameters = new HashMap<>();

		public String getPath() {
			return path;
		}

		public void setPath(String path) {
			this.path = path;
		}

		public Map<String, String> getParameters() {
			return parameters;
		}

		public void setParameters(Map<String, String> parameters) {
			this.parameters = parameters;
		}

	}

}
