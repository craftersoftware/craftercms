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

package org.craftercms.engine.scripting.impl;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.http.HttpUtils;
import org.craftercms.commons.lang.Callback;
import org.craftercms.core.service.ContentStoreService;
import org.craftercms.core.util.cache.CacheTemplate;
import org.craftercms.core.util.cache.impl.CachingAwareList;
import org.craftercms.engine.exception.ConfigurationException;
import org.craftercms.engine.plugin.PluginService;
import org.craftercms.engine.scripting.Script;
import org.craftercms.engine.scripting.ScriptFactory;
import org.craftercms.engine.service.context.SiteContext;
import org.craftercms.engine.util.ConfigUtils;
import org.springframework.security.web.util.matcher.*;
import org.craftercms.engine.util.spring.security.matcher.AntPathRequestMatcher;
import org.springframework.util.AntPathMatcher;
import org.springframework.util.PathMatcher;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Servlet filter that passes the request through a series of scripts that act as filters too.
 *
 * @author avasquez
 */
public class ScriptFilter implements Filter {

    public static final String FILTER_KEY = "filters.filter";
    public static final String SCRIPT_KEY = "script";
    public static final String INCLUDE_MAPPINGS_KEY = "mapping.include";
    public static final String EXCLUDE_MAPPINGS_KEY = "mapping.exclude";

    public static final String FILTER_MAPPINGS_CACHE_KEY = "filterMappings";

    private ServletContext servletContext;
    private final CacheTemplate cacheTemplate;
    protected PathMatcher pathMatcher;
    protected boolean disableVariableRestrictions;

    protected PluginService pluginService;

    protected RequestMatcher excludedUrlsMatcher;

    public ScriptFilter(final CacheTemplate cacheTemplate) {
        pathMatcher = new AntPathMatcher();
        excludedUrlsMatcher = new NegatedRequestMatcher(AnyRequestMatcher.INSTANCE);
        this.cacheTemplate = cacheTemplate;
    }

    public void setPathMatcher(PathMatcher pathMatcher) {
        this.pathMatcher = pathMatcher;
    }

    public void setDisableVariableRestrictions(boolean disableVariableRestrictions) {
        this.disableVariableRestrictions = disableVariableRestrictions;
    }

    public void setPluginService(PluginService pluginService) {
        this.pluginService = pluginService;
    }

    public void setExcludedUrls(String[] excludedUrls) {
        this.excludedUrlsMatcher = new OrRequestMatcher(Arrays.stream(excludedUrls)
                .map(AntPathRequestMatcher::new)
                .collect(Collectors.toList()));
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        this.servletContext = filterConfig.getServletContext();
    }

    @Override
    public void doFilter(final ServletRequest request, final ServletResponse response, final FilterChain originalChain) throws IOException,
        ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        FilterChain chain = originalChain;
        if (!excludedUrlsMatcher.matches(httpRequest)) {
            chain = getScriptFilterChain(httpRequest, originalChain);
        }
        chain.doFilter(request, response);
    }

    protected FilterChain getScriptFilterChain(HttpServletRequest httpRequest, FilterChain chain) {
        List<FilterMapping> filterMappings = getFilterMappings();
        if (CollectionUtils.isNotEmpty(filterMappings)) {
            String requestUri = HttpUtils.getRequestUriWithoutContextPath(httpRequest);
            List<Script> scripts = new ArrayList<>();

            for (FilterMapping mapping : filterMappings) {
                if (!excludeFilter(requestUri, mapping.excludes) && includeFilter(requestUri, mapping.includes)) {
                    scripts.add(mapping.script);
                }
            }

            if (CollectionUtils.isNotEmpty(scripts)) {
                chain = new ScriptFilterChainImpl(scripts.iterator(),
                                                  chain,
                                                  disableVariableRestrictions ? servletContext : null,
                                                  pluginService);
            }
        }
        return chain;
    }

    @Override
    public void destroy() {
    }

    @SuppressWarnings("unchecked")
    protected List<FilterMapping> getFilterMappings() {
        final SiteContext siteContext = SiteContext.getCurrent();
        if (siteContext != null) {
            Callback<List<FilterMapping>> callback = new Callback<>() {

                @Override
                public List<FilterMapping> execute() {
                    HierarchicalConfiguration config = ConfigUtils.getCurrentConfig();
                    CachingAwareList<FilterMapping> mappings = new CachingAwareList<>();

                    if (config != null) {
                        List<HierarchicalConfiguration> filtersConfig = config.configurationsAt(FILTER_KEY);
                        if (CollectionUtils.isNotEmpty(filtersConfig)) {
                            for (HierarchicalConfiguration filterConfig : filtersConfig) {
                                String scriptUrl = filterConfig.getString(SCRIPT_KEY);
                                String[] includes = filterConfig.getStringArray(INCLUDE_MAPPINGS_KEY);
                                String[] excludes = filterConfig.getStringArray(EXCLUDE_MAPPINGS_KEY);

                                if (StringUtils.isNotEmpty(scriptUrl) && ArrayUtils.isNotEmpty(includes)) {
                                    ContentStoreService storeService = siteContext.getStoreService();
                                    ScriptFactory scriptFactory = siteContext.getScriptFactory();

                                    if (!storeService.exists(siteContext.getContext(), scriptUrl)) {
                                        throw new ConfigurationException("No filter script found at " + scriptUrl);
                                    }

                                    FilterMapping mapping = new FilterMapping();
                                    mapping.script = scriptFactory.getScript(scriptUrl);
                                    mapping.includes = includes;
                                    mapping.excludes = excludes;

                                    mappings.add(mapping);
                                }
                            }
                        }
                    }

                    return mappings;
                }

            };

            return cacheTemplate.getObject(siteContext.getContext(), callback, FILTER_MAPPINGS_CACHE_KEY);
        } else {
            return null;
        }
    }

    protected boolean excludeFilter(String requestUri, String[] excludes) {
        if (ArrayUtils.isNotEmpty(excludes)) {
            for (String uriPattern : excludes) {
                if (pathMatcher.match(uriPattern, requestUri)) {
                    return true;
                }
            }
        }

        return false;
    }

    protected boolean includeFilter(String requestUri, String[] includes) {
        if (ArrayUtils.isNotEmpty(includes)) {
            for (String uriPattern : includes) {
                if (pathMatcher.match(uriPattern, requestUri)) {
                    return true;
                }
            }
        }

        return false;
    }

    protected static class FilterMapping {

        private Script script;
        private String[] includes;
        private String[] excludes;

    }

}
