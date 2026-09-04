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
package org.craftercms.engine.util.spring.mvc;

import org.apache.commons.collections4.CollectionUtils;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.accept.ContentNegotiationManager;
import org.springframework.web.servlet.mvc.method.annotation.ExceptionHandlerExceptionResolver;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.ArrayList;
import java.util.List;

/**
 * Bean post processor used to customize some of the beans defined by the Spring tag &lt;mvc:annotation-driven/&gt;,
 * which can't be overwritten.
 *
 * @author avasquez
 */
public class AnnotationDrivenConfigCustomizer implements BeanPostProcessor {

    private ContentNegotiationManager contentNegotiationManager;
    private List<HttpMessageConverter<?>> messageConverters;
    private List<Object> interceptors;

    public void setContentNegotiationManager(ContentNegotiationManager contentNegotiationManager) {
        this.contentNegotiationManager = contentNegotiationManager;
    }

    public void setMessageConverters(List<HttpMessageConverter<?>> messageConverters) {
        this.messageConverters = messageConverters;
    }

    public void setInterceptors(List<Object> interceptors) {
        this.interceptors = interceptors;
    }

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
        if (bean instanceof RequestMappingHandlerAdapter) {
            RequestMappingHandlerAdapter adapter = (RequestMappingHandlerAdapter) bean;
            if (contentNegotiationManager != null) {
                adapter.setContentNegotiationManager(contentNegotiationManager);
            }
            if (CollectionUtils.isNotEmpty(messageConverters)) {
                List<HttpMessageConverter<?>> mergedConverters = new ArrayList<>(messageConverters);
                mergedConverters.addAll(adapter.getMessageConverters());

                adapter.setMessageConverters(mergedConverters);
            }
        } else if (bean instanceof RequestMappingHandlerMapping) {
            RequestMappingHandlerMapping mapping = (RequestMappingHandlerMapping) bean;
            if (CollectionUtils.isNotEmpty(interceptors)) {
                mapping.setInterceptors(interceptors.toArray(new Object[interceptors.size()]));
            }
        } else if (bean instanceof ExceptionHandlerExceptionResolver) {
            ExceptionHandlerExceptionResolver exceptionResolver = (ExceptionHandlerExceptionResolver) bean;
            if (contentNegotiationManager != null) {
                exceptionResolver.setContentNegotiationManager(contentNegotiationManager);
            }
            if (CollectionUtils.isNotEmpty(messageConverters)) {
                List<HttpMessageConverter<?>> mergedConverters = new ArrayList<>(messageConverters);
                mergedConverters.addAll(exceptionResolver.getMessageConverters());

                exceptionResolver.setMessageConverters(mergedConverters);
            }
        }

        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        return bean;
    }

}
