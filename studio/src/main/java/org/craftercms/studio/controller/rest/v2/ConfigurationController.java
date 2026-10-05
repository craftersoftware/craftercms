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

import java.beans.ConstructorProperties;
import java.io.InputStream;
import static java.nio.charset.StandardCharsets.UTF_8;

import org.apache.commons.io.IOUtils;
import static org.apache.commons.lang3.Strings.CS;
import org.craftercms.commons.validation.annotations.param.EsapiValidatedParam;
import static org.craftercms.commons.validation.annotations.param.EsapiValidationType.ALPHANUMERIC;
import org.craftercms.commons.validation.annotations.param.ValidConfigurationPath;
import org.craftercms.commons.validation.annotations.param.ValidSiteId;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.security.AuthenticationException;
import org.craftercms.studio.api.v1.exception.security.UserNotFoundException;
import org.craftercms.studio.api.v2.annotation.logging.LogExecutionTime;
import org.craftercms.studio.api.v2.service.config.ConfigurationService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_GLOBAL_SYSTEM_SITE;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.API_2;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.CLEAR_CACHE;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.CONFIGURATION;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.GET_CONFIGURATION;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.GET_CONFIGURATION_HISTORY;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.TRANSLATION;
import static org.craftercms.studio.controller.rest.v2.RequestMappingConstants.WRITE_CONFIGURATION;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.RESULT_KEY_CONFIG;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.RESULT_KEY_HISTORY;
import org.craftercms.studio.model.config.TranslationConfiguration;
import static org.craftercms.studio.model.rest.ApiResponse.OK;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;
import org.craftercms.studio.model.rest.ConfigurationHistory;
import org.craftercms.studio.model.rest.Result;
import org.craftercms.studio.model.rest.ResultOne;
import org.craftercms.studio.model.rest.WriteConfigurationRequest;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping(API_2 + CONFIGURATION)
public class ConfigurationController {

	private final ConfigurationService configurationService;
	private final StudioConfiguration studioConfiguration;

	@ConstructorProperties({"configurationService", "studioConfiguration"})
	public ConfigurationController(ConfigurationService configurationService, StudioConfiguration studioConfiguration) {
		this.configurationService = configurationService;
		this.studioConfiguration = studioConfiguration;
	}

	@GetMapping(value = CLEAR_CACHE, produces = APPLICATION_JSON_VALUE)
	public Result clearCache(@ValidSiteId @PathVariable String siteId) {
		configurationService.invalidateConfiguration(siteId);
		var result = new Result();
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = GET_CONFIGURATION, produces = APPLICATION_JSON_VALUE)
	@LogExecutionTime
	public ResultOne<String> getConfiguration(@ValidSiteId @PathVariable String siteId,
						  @EsapiValidatedParam(type = ALPHANUMERIC) @RequestParam(name = "module", required = true) String module,
						  @ValidConfigurationPath @RequestParam(name = "path", required = true) String path,
						  @EsapiValidatedParam(type = ALPHANUMERIC) @RequestParam(name = "environment", required = false) String environment)
			throws ServiceLayerException {
		final String content;
		if (CS.equals(siteId, studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE))) {
			content = configurationService.getGlobalConfigurationAsString(path);
		} else {
			content = configurationService.getConfigurationAsString(siteId, module, path, environment);
		}

		ResultOne<String> result = new ResultOne<>();
		result.setEntity("content", content);
		result.setResponse(OK);
		return result;
	}

	@PostMapping(value = WRITE_CONFIGURATION, consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public Result writeConfiguration(@ValidSiteId @PathVariable String siteId,
									 @Validated @RequestBody WriteConfigurationRequest wcRequest)
		throws ServiceLayerException, UserNotFoundException, AuthenticationException {
		InputStream is = IOUtils.toInputStream(wcRequest.getContent(), UTF_8);
		if (CS.equals(siteId, studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE))) {
			configurationService.writeGlobalConfiguration(wcRequest.getPath(), is);
		} else {
			configurationService.writeConfiguration(siteId, wcRequest.getModule(), wcRequest.getPath(),
				wcRequest.getEnvironment(), is);
		}
		Result result = new Result();
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = GET_CONFIGURATION_HISTORY, produces = APPLICATION_JSON_VALUE)
	public ResultOne<ConfigurationHistory> getConfigurationHistory(@ValidSiteId @PathVariable String siteId,
								       @EsapiValidatedParam(type = ALPHANUMERIC) @RequestParam(name = "module", required = true) String module,
								       @ValidConfigurationPath @RequestParam(name = "path", required = true) String path,
								       @EsapiValidatedParam(type = ALPHANUMERIC) @RequestParam(name = "environment", required = false) String environment)
		throws ServiceLayerException, UserNotFoundException {
		ConfigurationHistory history = configurationService.getConfigurationHistory(siteId, module, path, environment);

		ResultOne<ConfigurationHistory> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_HISTORY, history);
		result.setResponse(OK);
		return result;
	}

	@GetMapping(value = TRANSLATION, produces = APPLICATION_JSON_VALUE)
	public ResultOne<TranslationConfiguration> getTranslationConfiguration(@ValidSiteId @PathVariable String siteId) throws ServiceLayerException {
		ResultOne<TranslationConfiguration> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_CONFIG, configurationService.getTranslationConfiguration(siteId));
		result.setResponse(OK);
		return result;
	}

}
