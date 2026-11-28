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

package org.craftercms.studio.impl.v2.dal;

import org.junit.BeforeClass;
import org.junit.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.beans.factory.xml.XmlBeanDefinitionReader;

import java.util.Arrays;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

/**
 * Verifies that the database beans in database-context.xml depend on the {@link EmbeddedDatabaseGuard} bean.
 * Only the bean definitions are loaded, no bean is instantiated.
 */
public class EmbeddedDatabaseGuardWiringTest {

	private static final String GUARD_BEAN = "embeddedDatabaseGuard";

	private static DefaultListableBeanFactory beanFactory;

	@BeforeClass
	public static void loadBeanDefinitions() {
		beanFactory = new DefaultListableBeanFactory();
		new XmlBeanDefinitionReader(beanFactory).loadBeanDefinitions("classpath:crafter/studio/database-context.xml");
	}

	@Test
	public void guardBeanIsDefined() {
		assertEquals(EmbeddedDatabaseGuard.class.getName(), beanFactory.getBeanDefinition(GUARD_BEAN).getBeanClassName());
		assertEquals("check", beanFactory.getBeanDefinition(GUARD_BEAN).getInitMethodName());
	}

	@Test
	public void dataSourceDependsOnGuard() {
		assertDependsOnGuard("dataSource");
	}

	@Test
	public void scriptRunnerDataSourceDependsOnGuard() {
		assertDependsOnGuard("scriptRunnerDataSource");
	}

	@Test
	public void studioMariaDBServiceDependsOnGuard() {
		assertDependsOnGuard("studioMariaDBService");
	}

	private static void assertDependsOnGuard(String beanName) {
		String[] dependsOn = beanFactory.getBeanDefinition(beanName).getDependsOn();
		assertNotNull(beanName + " has no depends-on", dependsOn);
		assertTrue(beanName + " depends-on " + Arrays.toString(dependsOn),
				Arrays.asList(dependsOn).contains(GUARD_BEAN));
	}
}
