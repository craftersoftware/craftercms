/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.engine.controller.rest;

import jakarta.servlet.ServletContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.apache.http.HttpStatus;
import org.craftercms.commons.lang.UrlUtils;
import org.craftercms.commons.validation.ValidationException;
import org.craftercms.commons.validation.ValidationRuntimeException;
import org.craftercms.core.exception.HttpStatusCodeAwareException;
import org.craftercms.core.service.ContentStoreService;
import org.craftercms.core.util.ExceptionUtils;
import org.craftercms.engine.exception.HttpStatusCodeException;
import org.craftercms.engine.exception.ScriptNotFoundException;
import org.craftercms.engine.plugin.PluginService;
import org.craftercms.engine.scripting.ScriptFactory;
import org.craftercms.engine.scripting.ScriptUrlTemplateScanner;
import org.craftercms.engine.service.context.SiteContext;
import org.craftercms.engine.util.GroovyScriptUtils;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.ServletContextAware;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.util.UriTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static java.lang.String.format;
import static java.util.Collections.singletonMap;
import static org.craftercms.engine.controller.rest.RestScriptsController.API_1_SERVICES_ROOT;
import static org.craftercms.engine.controller.rest.RestScriptsController.API_ROOT;
import static org.craftercms.engine.util.GroovyScriptUtils.addRestScriptVariables;

/**
 * Controller for REST script requests.
 *
 * @author Alfonso Vásquez
 */
@RestController
@RequestMapping(path = {API_ROOT, API_1_SERVICES_ROOT})
public class RestScriptsController implements ServletContextAware {

	private static final Log logger = LogFactory.getLog(RestScriptsController.class);

	public static final String DEFAULT_RESPONSE_BODY_MODEL_ATTR_NAME = "responseBody";
	public static final String DEFAULT_ERROR_MESSAGE_MODEL_ATTR_NAME = "message";

	private static final String SCRIPT_URL_FORMAT = "%s.%s.%s"; // {url}.{method}.{scriptExt}

	protected static final String API_ROOT = "/api";

	protected static final String API_1_SERVICES_ROOT = "/api/1/services";

	protected String responseBodyModelAttributeName;
	protected String errorMessageModelAttributeName;
	protected ScriptUrlTemplateScanner urlTemplateScanner;
	protected boolean disableVariableRestrictions;

	protected PluginService pluginService;
	private ServletContext servletContext;

	private AntPathMatcher antPathMatcher;

	public RestScriptsController() {
		responseBodyModelAttributeName = DEFAULT_RESPONSE_BODY_MODEL_ATTR_NAME;
		errorMessageModelAttributeName = DEFAULT_ERROR_MESSAGE_MODEL_ATTR_NAME;
		this.antPathMatcher = new AntPathMatcher();
	}

	public void setResponseBodyModelAttributeName(String responseBodyModelAttributeName) {
		this.responseBodyModelAttributeName = responseBodyModelAttributeName;
	}

	public void setErrorMessageModelAttributeName(String errorMessageModelAttributeName) {
		this.errorMessageModelAttributeName = errorMessageModelAttributeName;
	}

	public void setUrlTemplateScanner(ScriptUrlTemplateScanner urlTemplateScanner) {
		this.urlTemplateScanner = urlTemplateScanner;
	}

	public void setDisableVariableRestrictions(boolean disableVariableRestrictions) {
		this.disableVariableRestrictions = disableVariableRestrictions;
	}

	public void setPluginService(PluginService pluginService) {
		this.pluginService = pluginService;
	}

	@RequestMapping(path = "/**", produces = {MediaType.APPLICATION_JSON_VALUE})
	protected ResponseEntity handleRequest(final HttpServletRequest request, final HttpServletResponse response) {
		SiteContext siteContext = SiteContext.getCurrent();
		ScriptFactory scriptFactory = siteContext.getScriptFactory();

		if (scriptFactory == null) {
			throw new IllegalStateException(format("No script factory associate to current site context '%s'",
				siteContext.getSiteName()));
		}

		String serviceUrl = getServiceUrl(request);
		String scriptUrl = getScriptUrl(scriptFactory, siteContext, request, serviceUrl);
		Map<String, Object> scriptVariables = createScriptVariables(request, response);

		pluginService.addPluginVariables(scriptUrl, scriptVariables::put);

		scriptUrl = parseScriptUrlForVariables(siteContext, scriptUrl, scriptVariables);

		Object responseBody = executeScript(scriptFactory, scriptVariables, response, scriptUrl);

		return ResponseEntity.status(response.getStatus()).body(responseBody);
	}

	protected String getServiceUrl(HttpServletRequest request) {
		String url = (String) request.getAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE);
		if (StringUtils.isEmpty(url)) {
			throw new IllegalStateException(
				format("Required request attribute '%s' is not set", HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE));
		}
		String pattern = (String) request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
		return antPathMatcher.extractPathWithinPattern(pattern, url);
	}

	protected String parseScriptUrlForVariables(SiteContext siteContext, String scriptUrl,
						    Map<String, Object> variables) {
		ContentStoreService storeService = siteContext.getStoreService();
		if (!storeService.exists(siteContext.getContext(), scriptUrl) && urlTemplateScanner != null) {
			List<UriTemplate> urlTemplates = urlTemplateScanner.scan(siteContext);
			if (CollectionUtils.isNotEmpty(urlTemplates)) {
				for (UriTemplate template : urlTemplates) {
					if (template.matches(scriptUrl)) {
						Map<String, String> pathVars = template.match(scriptUrl);
						String actualScriptUrl = template.toString();

						variables.put(GroovyScriptUtils.VARIABLE_PATH_VARS, pathVars);

						return actualScriptUrl;
					}
				}
			}
		}

		return scriptUrl;
	}

	protected String getScriptUrl(ScriptFactory scriptFactory, SiteContext siteContext, HttpServletRequest request,
				      String serviceUrl) {
		String baseUrl = UrlUtils.concat(siteContext.getRestScriptsPath(), FilenameUtils.removeExtension(serviceUrl));

		return format(SCRIPT_URL_FORMAT, baseUrl, request.getMethod().toLowerCase(), scriptFactory.getScriptFileExtension());
	}

	protected Map<String, Object> createScriptVariables(HttpServletRequest request, HttpServletResponse response) {
		Map<String, Object> variables = new HashMap<>();
		addRestScriptVariables(variables, request, response, disableVariableRestrictions ? servletContext : null);

		return variables;
	}

	protected Object executeScript(ScriptFactory scriptFactory, Map<String, Object> scriptVariables, HttpServletResponse response,
				       String scriptUrl) {
		try {
			return scriptFactory.getScript(scriptUrl).execute(scriptVariables);
		} catch (ScriptNotFoundException e) {
			logger.error(format("Script not found at '%s'", scriptUrl));
			throw new HttpStatusCodeException(HttpStatus.SC_NOT_FOUND, e);
		} catch (Exception e) {
			logger.error(format("Error executing REST script at '%s'", scriptUrl), e);

			Throwable cause = checkHttpStatusCodeAwareException(e, response);

			if (cause == null) {
				cause = checkValidationException(e, response);
				if (cause == null) {
					response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
				}
			}

			return singletonMap(errorMessageModelAttributeName, cause != null ? cause.getMessage() : e.getMessage());
		}
	}

	protected Throwable checkHttpStatusCodeAwareException(Exception e, HttpServletResponse response) {
		HttpStatusCodeAwareException cause = ExceptionUtils.getThrowableOfType(e, HttpStatusCodeAwareException.class);
		if (cause != null) {
			response.setStatus(cause.getStatusCode());

			return (Throwable) cause;
		} else {
			return null;
		}
	}

	protected Throwable checkValidationException(Exception e, HttpServletResponse response) {
		Throwable cause = ExceptionUtils.getRootCause(e);
		if (cause instanceof ValidationException || cause instanceof ValidationRuntimeException) {
			response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

			return cause;
		}
		return null;
	}

	@Override
	public void setServletContext(ServletContext servletContext) {
		this.servletContext = servletContext;
	}
}
