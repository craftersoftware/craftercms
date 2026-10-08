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
package org.craftercms.commons.spring;

import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.beans.factory.support.BeanDefinitionRegistryPostProcessor;

import java.util.List;

/**
 * This bean is used to set the infrastructure role to the beans.
 * This indicates Spring that these beans are not required to be post-processed.
 */
public class InfrastructureConfigurerBean implements BeanDefinitionRegistryPostProcessor {

    private List<String> beanNames;

    public void setBeanNames(List<String> beanNames) {
        this.beanNames = beanNames;
    }

    @Override
    public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) throws BeansException {
		// Set infrastructure role to beans
		for (String name : beanNames) {
			BeanDefinition beanDefinition = registry.getBeanDefinition(name);
			beanDefinition.setRole(BeanDefinition.ROLE_INFRASTRUCTURE);
		}
    }
}
