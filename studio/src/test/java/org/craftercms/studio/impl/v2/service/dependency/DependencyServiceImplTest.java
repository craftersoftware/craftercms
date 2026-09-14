/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.studio.impl.v2.service.dependency;

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v2.annotation.precondition.RequireContentExists;
import org.craftercms.studio.api.v2.repository.ContentRepository;
import org.craftercms.studio.impl.v2.service.dependency.internal.DependencyServiceInternalImpl;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import java.lang.reflect.Method;

import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.*;

@RunWith(MockitoJUnitRunner.class)
public class DependencyServiceImplTest {
	private static final String SITE_ID = "sample-site";
	private static final String PATH = "/sample/path";
	private static final String NON_EXIST_CONTENT_PATH = "/sample/non-exist-content-path";

	@Mock
	protected DependencyServiceInternalImpl serviceInternal;

	@Mock
	protected ContentRepository contentRepository;

	@InjectMocks
	protected DependencyServiceImpl dependencyService;

	@Before
	public void setUp() throws ServiceLayerException {
	}

	@Test
	public void getDependentItems() throws ServiceLayerException {
		dependencyService.getDependentItems(SITE_ID, PATH);
		verify(serviceInternal).getDependentItems(SITE_ID, PATH);
	}

	@Test
	public void nonExistSiteIdGetDependentItems() throws NoSuchMethodException {
		Method method = DependencyServiceImpl.class.getMethod("getDependentItems", String.class, String.class);
		assertTrue(method.isAnnotationPresent(RequireContentExists.class));
	}

	@Test
	public void setNonExistContentPathGetDependentItems() throws NoSuchMethodException {
		Method method = DependencyServiceImpl.class.getMethod("getDependentItems", String.class, String.class);
		assertTrue(method.isAnnotationPresent(RequireContentExists.class));
	}
}
