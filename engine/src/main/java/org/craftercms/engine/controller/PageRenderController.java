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
package org.craftercms.engine.controller;

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.craftercms.commons.lang.UrlUtils;
import org.craftercms.core.exception.CrafterException;
import org.craftercms.core.exception.HttpStatusCodeAwareException;
import org.craftercms.core.service.ContentStoreService;
import org.craftercms.core.util.ExceptionUtils;
import org.craftercms.engine.exception.ScriptException;
import org.craftercms.engine.plugin.PluginService;
import org.craftercms.engine.properties.SiteProperties;
import org.craftercms.engine.scripting.Script;
import org.craftercms.engine.scripting.ScriptFactory;
import org.craftercms.engine.service.context.SiteContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.ModelAndView;
import org.springframework.web.servlet.mvc.AbstractController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.HashMap;
import java.util.Map;

import static java.util.Collections.singletonMap;
import static org.apache.commons.lang3.StringUtils.EMPTY;
import static org.craftercms.core.controller.rest.RestControllerBase.createResponseMessage;
import static org.craftercms.engine.util.GroovyScriptUtils.addControllerScriptVariables;

/**
 * Default controller for rendering Crafter pages. If the site context is the fallback context, a fallback page is
 * always rendered. The controller also tries to find a script controller for the page URL (when not fallback). If
 * one is found, it's executed and its return value is interpreted as a view name to be rendered.
 *
 * @author Alfonso Vasquez
 * @author Dejan Brkic
 */
public class PageRenderController extends AbstractController {

	private static final Log logger = LogFactory.getLog(PageRenderController.class);

	private static final String SCRIPT_URL_FORMAT = "%s.%s.%s"; // {url}.{method}.{scriptExt}

	protected String fallbackPageUrl;
	protected String fallbackMessage;
	protected ContentStoreService storeService;
	protected boolean disableVariableRestrictions;

	protected PluginService pluginService;

	public PageRenderController(String fallbackPageUrl, final ContentStoreService storeService) {
		this.fallbackPageUrl = fallbackPageUrl;
		this.storeService = storeService;
	}

	public void setFallbackMessage(String fallbackMessage) {
		this.fallbackMessage = fallbackMessage;
	}

	public void setDisableVariableRestrictions(boolean disableVariableRestrictions) {
		this.disableVariableRestrictions = disableVariableRestrictions;
	}

	public void setPluginService(PluginService pluginService) {
		this.pluginService = pluginService;
	}

	@Override
	protected ModelAndView handleRequestInternal(HttpServletRequest request, HttpServletResponse response)
		throws Exception {
		String pageUrl;
		SiteContext siteContext = SiteContext.getCurrent();

		if (siteContext != null) {
			if (siteContext.isFallback()) {
				if (logger.isDebugEnabled()) {
					logger.debug("Rendering fallback page [" + fallbackPageUrl + "]");
				}

				return new ModelAndView(fallbackPageUrl, singletonMap(EMPTY, createResponseMessage(fallbackMessage)),
					HttpStatus.NOT_FOUND);
			} else {
				pageUrl = (String) request.getAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE);
				// Spring 6 set this attribute as an empty string in the case of root directory
				// it could be a bug while using PathPattern by default:
				// https://github.com/spring-projects/spring-framework/blob/main/spring-webmvc/src/main/java/org/springframework/web/servlet/handler/AbstractHandlerMapping.java#L583
				if (pageUrl.isEmpty()) {
					pageUrl = "/";
				} else if (pageUrl == null) {
					throw new IllegalStateException(
						"Required request attribute '" + HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE +
							"' is not set");
				}

				Script controllerScript = getControllerScript(siteContext, request, pageUrl);
				if (controllerScript != null) {
					Map<String, Object> model = new HashMap<>();
					Map<String, Object> variables = createScriptVariables(request, response, model);

					pluginService.addPluginVariables(controllerScript.getUrl(), variables::put);

					String viewName = executeScript(controllerScript, variables);

					if (StringUtils.isNotEmpty(viewName)) {
						if (logger.isDebugEnabled()) {
							logger.debug("Rendering view " + viewName + " returned by script " + controllerScript);
						}

						return new ModelAndView(viewName, model);
					} else {
						return null;
					}
				}

				if (SiteProperties.isSpaEnabled()) {
					String viewName = SiteProperties.getSpaViewName();

					if (logger.isDebugEnabled()) {
						logger.debug("SPA mode enabled. Returning default view: " + viewName);
					}

					return new ModelAndView(viewName);
				}

				if (logger.isDebugEnabled()) {
					logger.debug("Rendering page [" + pageUrl + "]");
				}
			}
		} else {
			throw new IllegalStateException("No current site context found");
		}

		return new ModelAndView(pageUrl);
	}

	protected Script getControllerScript(SiteContext siteContext, HttpServletRequest request, String pageUrl) {
		ScriptFactory scriptFactory = siteContext.getScriptFactory();

		if (scriptFactory == null) {
			throw new IllegalStateException("No script factory associated to current site context '" +
				siteContext.getSiteName() + "'");
		}

		String scriptUrl = getScriptUrl(siteContext, scriptFactory, request, pageUrl);

		try {
			// Check controller script exists
			if (storeService.exists(siteContext.getContext(), scriptUrl)) {
				if (logger.isDebugEnabled()) {
					logger.debug("Controller script found for page " + pageUrl + " at " + scriptUrl);
				}

				return scriptFactory.getScript(scriptUrl);
			} else if (logger.isDebugEnabled()) {
				logger.debug("No controller script for page " + pageUrl + " at " + scriptUrl);
			}
		} catch (CrafterException e) {
			logger.error("Error while trying to retrieve controller script at " + scriptUrl, e);
		}

		return null;
	}

	protected String getScriptUrl(SiteContext siteContext, ScriptFactory scriptFactory, HttpServletRequest request,
				      String pageUrl) {
		String method = request.getMethod().toLowerCase();
		String pageUrlNoExt = FilenameUtils.removeExtension(pageUrl);
		String controllerScriptsPath = siteContext.getControllerScriptsPath();

		String baseUrl = UrlUtils.concat(controllerScriptsPath, pageUrlNoExt);

		return String.format(SCRIPT_URL_FORMAT, baseUrl, method, scriptFactory.getScriptFileExtension());
	}

	protected Map<String, Object> createScriptVariables(HttpServletRequest request, HttpServletResponse response,
							    Map<String, Object> model) {
		Map<String, Object> variables = new HashMap<>();
		addControllerScriptVariables(variables, request, response,
			disableVariableRestrictions ? getServletContext() : null, model);

		return variables;
	}

	protected String executeScript(Script script, Map<String, Object> scriptVariables)
		throws Exception {
		try {
			Object result = script.execute(scriptVariables);
			if (result != null) {
				if (result instanceof String) {
					return (String) result;
				} else {
					throw new ScriptException("Expected String view name as return value of controller script " +
						script + ". Actual type of returns value: " +
						result.getClass().getName());
				}
			} else {
				return null;
			}
		} catch (Exception e) {
			logger.error("Error executing controller script at " + script.getUrl(), e);

			Exception cause = (Exception) ExceptionUtils.getThrowableOfType(e, HttpStatusCodeAwareException.class);
			if (cause != null) {
				throw cause;
			} else {
				throw e;
			}
		}
	}

}
