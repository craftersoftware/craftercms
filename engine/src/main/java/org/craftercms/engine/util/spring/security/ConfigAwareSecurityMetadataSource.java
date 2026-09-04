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

package org.craftercms.engine.util.spring.security;

import java.beans.ConstructorProperties;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.lang.Callback;
import org.craftercms.core.util.cache.CacheTemplate;
import org.craftercms.engine.service.context.SiteContext;
import org.craftercms.engine.util.ConfigUtils;
import org.craftercms.engine.util.spring.security.matcher.AntPathRequestMatcher;
import org.springframework.security.access.ConfigAttribute;
import org.springframework.security.access.SecurityConfig;
import org.springframework.security.access.SecurityMetadataSource;
import org.springframework.security.web.FilterInvocation;
import org.springframework.security.web.access.expression.DefaultWebSecurityExpressionHandler;
import org.springframework.security.web.access.expression.ExpressionBasedFilterInvocationSecurityMetadataSource;
import org.springframework.security.web.access.intercept.DefaultFilterInvocationSecurityMetadataSource;
import org.springframework.security.web.access.intercept.FilterInvocationSecurityMetadataSource;
import org.springframework.security.web.util.matcher.RequestMatcher;

import static java.util.Collections.singleton;

/**
 * Implementation of {@link FilterInvocationSecurityMetadataSource} that uses site config.
 *
 * <p>Note: This class delegates the actual work to an instance of
 * {@link ExpressionBasedFilterInvocationSecurityMetadataSource} because the class is final so it can't be extended.</p>
 *
 * @author joseross
 * @since 3.1.5
 */
public class ConfigAwareSecurityMetadataSource implements FilterInvocationSecurityMetadataSource {

    public static final String URL_RESTRICTION_KEY = "security.urlRestrictions.restriction";
    public static final String URL_RESTRICTION_URL_KEY = "url";
    public static final String URL_RESTRICTION_EXPRESSION_KEY = "expression";

    public static final String URL_RESTRICTIONS_CACHE_KEY = "urlRestrictions";

    protected CacheTemplate cacheTemplate;

    @ConstructorProperties({"cacheTemplate"})
    public ConfigAwareSecurityMetadataSource(final CacheTemplate cacheTemplate) {
        this.cacheTemplate = cacheTemplate;
    }

    @Override
    @SuppressWarnings("unchecked")
    public Collection<ConfigAttribute> getAttributes(final Object object) throws IllegalArgumentException {
        Callback<SecurityMetadataSource> callback = () -> {
            HierarchicalConfiguration siteConfig = ConfigUtils.getCurrentConfig();
            if (siteConfig != null) {
                List<HierarchicalConfiguration> restrictionsConfig = siteConfig.configurationsAt(URL_RESTRICTION_KEY);
                if (CollectionUtils.isNotEmpty(restrictionsConfig)) {
                    LinkedHashMap<RequestMatcher, Collection<ConfigAttribute>> map = new LinkedHashMap<>();
                    for (HierarchicalConfiguration restrictionConfig : restrictionsConfig) {
                        String url = restrictionConfig.getString(URL_RESTRICTION_URL_KEY);
                        String expression = restrictionConfig.getString(URL_RESTRICTION_EXPRESSION_KEY);
                        if (StringUtils.isNotEmpty(url) && StringUtils.isNotEmpty(expression)) {
                            AntPathRequestMatcher matcher = new AntPathRequestMatcher(url);
                            map.put(matcher, singleton(new SecurityConfig(expression)));
                        }
                    }
                    return new ExpressionBasedFilterInvocationSecurityMetadataSource(map,
                        new DefaultWebSecurityExpressionHandler());
                }
            }
            return new DefaultFilterInvocationSecurityMetadataSource(new LinkedHashMap<>());
        };

        SiteContext siteContext = SiteContext.getCurrent();
        if (siteContext != null) {
            SecurityMetadataSource metadataSource =
                cacheTemplate.getObject(siteContext.getContext(), callback, URL_RESTRICTIONS_CACHE_KEY);

            return metadataSource.getAttributes(object);
        }
        return null;
    }

    @Override
    public Collection<ConfigAttribute> getAllConfigAttributes() {
        return null;
    }

    @Override
    public boolean supports(final Class<?> clazz) {
        return FilterInvocation.class.isAssignableFrom(clazz);
    }

}
