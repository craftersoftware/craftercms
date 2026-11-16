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

import jakarta.servlet.http.HttpServletRequest;
import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.commons.rest.ManagementToken;
import org.craftercms.studio.api.v2.service.site.SitesService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.model.rest.ApiResponse;
import org.craftercms.studio.model.rest.ResultList;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import java.util.ArrayList;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class SiteManagementControllerTest {

	private static final String TOKEN = "management-token";

	@Mock
	private StudioConfiguration studioConfiguration;
	@Mock
	private SitesService sitesService;
	@Mock
	private HttpServletRequest request;

	private SiteManagementController controller;

	@Before
	public void setUp() {
		when(studioConfiguration.getProperty(StudioConfiguration.CONFIGURATION_MANAGEMENT_SITE_MANAGEMENT_TOKEN))
			.thenReturn(TOKEN);
		controller = new SiteManagementController(studioConfiguration, sitesService);
	}

	@Test
	public void validHeaderReturnsSiteIds() throws Exception {
		when(request.getHeader(ManagementToken.HEADER_NAME)).thenReturn(TOKEN);
		when(sitesService.getDeliverableSiteIds()).thenReturn(List.of("editorial", "editorial-staging"));

		ResultList<String> result = controller.getDeliverableSites(request);

		assertSame(ApiResponse.OK, result.getResponse());
		assertEquals(List.of("editorial", "editorial-staging"),
			new ArrayList<>(result.getEntities().get(ResultConstants.RESULT_KEY_SITES)));
	}

	@Test
	public void missingHeaderIsRejectedEvenWhenQueryTokenMatches() {
		when(request.getHeader(ManagementToken.HEADER_NAME)).thenReturn(null);
		lenient().when(request.getParameter(ManagementToken.QUERY_PARAMETER)).thenReturn(TOKEN);

		assertThrows(InvalidManagementTokenException.class, () -> controller.getDeliverableSites(request));
		verify(sitesService, never()).getDeliverableSiteIds();
	}

	@Test
	public void wrongHeaderIsRejected() {
		when(request.getHeader(ManagementToken.HEADER_NAME)).thenReturn("wrong");

		assertThrows(InvalidManagementTokenException.class, () -> controller.getDeliverableSites(request));
		verify(sitesService, never()).getDeliverableSiteIds();
	}

}
