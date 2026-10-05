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
package org.craftercms.engine.view;

import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.craftercms.core.exception.HttpStatusCodeAwareException;
import org.craftercms.core.util.ExceptionUtils;
import org.craftercms.core.util.cache.CachingAwareObject;
import org.craftercms.engine.exception.RenderingException;
import org.craftercms.engine.model.SiteItem;
import org.craftercms.engine.scripting.Script;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.View;
import org.springframework.web.servlet.ViewResolver;
import org.springframework.web.servlet.view.AbstractView;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.craftercms.engine.util.GroovyScriptUtils.addSiteItemScriptVariables;

/**
 * @author Alfonso Vásquez
 */
public class CrafterPageView extends AbstractView implements CachingAwareObject, InitializingBean {

	private static final Log logger = LogFactory.getLog(CrafterPageView.class);

	public static final String PAGE_URL_ATTRIBUTE_NAME = "pageUrl";

	public static final String DEFAULT_CONTENT_TYPE = "text/html;charset=UTF-8";
	public static final String DEFAULT_CHARSET = "UTF-8";

	@Deprecated
	public static final String KEY_MODEL = "model";
	public static final String KEY_CONTENT_MODEL = "contentModel";

	protected transient String scope;
	protected transient Object key;
	protected transient Long cachingTime;

	protected SiteItem page;
	protected Locale locale;
	protected String pageViewNameXPathQuery;
	protected String mimeTypeXPathQuery;
	protected List<Script> scripts;
	protected ViewResolver delegatedViewResolver;
	protected boolean disableVariableRestrictions;

	public CrafterPageView(SiteItem page, Locale locale, String pageViewNameXPathQuery, String mimeTypeXPathQuery,
			       List<Script> scripts, ViewResolver delegatedViewResolver) {
		this.page = page;
		this.locale = locale;
		this.pageViewNameXPathQuery = pageViewNameXPathQuery;
		this.mimeTypeXPathQuery = mimeTypeXPathQuery;
		this.scripts = scripts;
		this.delegatedViewResolver = delegatedViewResolver;
	}

	public SiteItem getPage() {
		return page;
	}

	@Override
	public String getScope() {
		return scope;
	}

	@Override
	public void setScope(String scope) {
		this.scope = scope;
	}

	@Override
	public Object getKey() {
		return key;
	}

	@Override
	public void setKey(Object key) {
		this.key = key;
	}

	@Override
	public Long getCachingTime() {
		return cachingTime;
	}

	@Override
	public void setCachingTime(Long cachingTime) {
		this.cachingTime = cachingTime;
	}

	public void setDisableVariableRestrictions(boolean disableVariableRestrictions) {
		this.disableVariableRestrictions = disableVariableRestrictions;
	}

	@Override
	public String toString() {
		return "CrafterPageView[" +
			"page=" + page +
			", locale=" + locale +
			']';
	}

	@Override
	public void afterPropertiesSet() throws Exception {
		String mimeType = getMimeType();
		if (isNotEmpty(mimeType)) {
			setContentType(MediaType.parseMediaType(mimeType).toString() + ";charset=" + DEFAULT_CHARSET);
		} else {
			setContentType(DEFAULT_CONTENT_TYPE);
		}
	}

	@Override
	protected void renderMergedOutputModel(Map<String, Object> model, HttpServletRequest request,
					       HttpServletResponse response) throws Exception {
		request.setAttribute(PAGE_URL_ATTRIBUTE_NAME, page.getStoreUrl());

		Map<String, Object> scriptVariables = createScriptVariables(request, response, model);

		if (CollectionUtils.isNotEmpty(scripts)) {
			for (Script script : scripts) {
				executeScript(script, scriptVariables);

				// If the response has been already committed by one of the scripts, stop and don't render the view
				if (response.isCommitted()) {
					logger.debug("Response already committed by script");

					return;
				}
			}
		}

		model.put(KEY_MODEL, page);
		model.put(KEY_CONTENT_MODEL, page);

		renderActualView(getPageViewName(), model, request, response);
	}

	protected void executeScript(Script script, Map<String, Object> scriptVariables) throws Exception {
		try {
			script.execute(scriptVariables);
		} catch (Exception e) {
			logger.error("Error executing page script at " + script.getUrl(), e);

			Exception cause = (Exception) ExceptionUtils.getThrowableOfType(e, HttpStatusCodeAwareException.class);
			if (cause != null) {
				throw cause;
			} else {
				throw e;
			}
		}
	}

	protected Map<String, Object> createScriptVariables(HttpServletRequest request, HttpServletResponse response,
							    Map<String, Object> model) {
		Map<String, Object> variables = new HashMap<>();
		addSiteItemScriptVariables(variables, request, response, disableVariableRestrictions ? getServletContext() : null,
			page, model);

		return variables;
	}

	protected String getPageViewName() throws RenderingException {
		String pageViewName = page.queryValue(pageViewNameXPathQuery).trim();
		if (isNotEmpty(pageViewName)) {
			return pageViewName;
		}
		throw new RenderingException("No view name found for " + page);
	}

	protected String getMimeType() {
		return page.queryValue(mimeTypeXPathQuery);
	}

	protected void renderActualView(String pageViewName, Map<String, Object> model, HttpServletRequest request,
					HttpServletResponse response) throws Exception {
		View actualView = delegatedViewResolver.resolveViewName(pageViewName, locale);
		if (actualView == null) {
			throw new RenderingException("No view was resolved for page view name '" + pageViewName + "'");
		}
		if (actualView instanceof AbstractView) {
			((AbstractView) actualView).setContentType(getContentType());
		}

		actualView.render(model, request, response);
	}

}
