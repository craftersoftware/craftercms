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

import groovy.util.ResourceException;
import groovy.util.ScriptException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.exception.configuration.ConfigurationException;
import org.craftercms.studio.api.v2.service.marketplace.MarketplaceService;
import org.craftercms.studio.api.v2.service.scripting.ScriptingService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.model.rest.ApiResponse;
import org.craftercms.studio.model.rest.Result;
import org.craftercms.studio.model.rest.ResultOne;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.HandlerMapping;

import java.beans.ConstructorProperties;

import static org.apache.commons.io.FilenameUtils.removeExtension;
import static org.apache.commons.lang3.StringUtils.removeStart;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.RESULT_KEY_RESULT;
import static org.craftercms.studio.model.rest.ApiResponse.OK;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * Controller that executes Rest scripts from plugins
 *
 * @author joseross
 * @since 3.1.1
 */
@Validated
@RestController
@RequestMapping("/api/2/plugin")
public class PluginController extends ManagementTokenAware {

	protected final ScriptingService scriptingService;

	protected final MarketplaceService marketplaceService;

	@ConstructorProperties({"studioConfiguration", "scriptingService", "marketplaceService"})
	public PluginController(StudioConfiguration studioConfiguration,
				ScriptingService scriptingService, MarketplaceService marketplaceService) {
		super(studioConfiguration);
		this.scriptingService = scriptingService;
		this.marketplaceService = marketplaceService;
	}

	@GetMapping(value = "/{siteId}/get_configuration", produces = APPLICATION_JSON_VALUE)
	public ResultOne<String> getPluginConfiguration(@ValidSiteId @PathVariable String siteId, String pluginId) throws ServiceLayerException {
		String content = marketplaceService.getPluginConfigurationAsString(siteId, pluginId);

		ResultOne<String> result = new ResultOne<>();
		result.setEntity("content", content);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = "/{siteId}/write_configuration", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result writeConfiguration(@ValidSiteId @PathVariable String siteId, @Valid @RequestBody WriteConfigurationRequest request)
		throws UserNotFoundException, ServiceLayerException, AuthenticationException {
		marketplaceService.writePluginConfiguration(siteId, request.getPluginId(), request.getContent());

		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	/**
	 * Reloads the groovy classes for the given site
	 */
	@GetMapping(value = "/{siteId}/script/reload", produces = APPLICATION_JSON_VALUE)
	public Result reloadClasses(@ValidSiteId @PathVariable String siteId, @RequestParam String token)
		throws InvalidParametersException, InvalidManagementTokenException {
		validateToken(token);

		scriptingService.reload(siteId);

		var result = new Result();
		result.setResponse(ApiResponse.OK);

		return result;
	}

	/**
	 * Executes a rest script for the given site
	 */
	@RequestMapping(value = "/{siteId}/script/**")
	public ResultOne<Object> runScript(@ValidSiteId @PathVariable String siteId, HttpServletRequest request, HttpServletResponse response)
		throws ResourceException, ScriptException, ConfigurationException {
		// No better way to do this for now, later can be replaced by "/script/{*scriptUrl}"
		var scriptUrl = (String) request.getAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE);
		scriptUrl = removeStart(removeExtension(scriptUrl), "/api/2/plugin/" + siteId + "/script");

		// Add the binding with the right values
		// Execute the script
		var object = scriptingService.executeRestScript(siteId, scriptUrl, request, response);

		// Check if the script already committed the response
		if (response.isCommitted()) {
			// Stop the execution
			return null;
		}

		// Wrap the response in a proper result
		var result = new ResultOne<>();
		result.setEntity(RESULT_KEY_RESULT, object);
		result.setResponse(ApiResponse.OK);

		return result;
	}

	public static class WriteConfigurationRequest {

		@NotEmpty
		private String pluginId;

		@NotEmpty
		private String content;

		public String getPluginId() {
			return pluginId;
		}

		public void setPluginId(String pluginId) {
			this.pluginId = pluginId;
		}

		public String getContent() {
			return content;
		}

		public void setContent(String content) {
			this.content = content;
		}

	}

}
