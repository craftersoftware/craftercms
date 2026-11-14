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
package org.craftercms.engine.controller.rest;

import org.craftercms.commons.rest.ManagementToken;
import org.craftercms.core.controller.rest.ExceptionHandlers;
import org.craftercms.engine.controller.rest.cache.SiteCacheRestOperations;
import org.craftercms.engine.service.SiteHealthCheckService;
import org.craftercms.engine.service.context.SiteContextManager;
import org.junit.Before;
import org.junit.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Map;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class ManagementTokenRestControllerTest {

	private static final String TOKEN = "engine-token";

	private MockMvc monitoring;
	private MockMvc siteContext;
	private MockMvc siteCache;

	@Before
	public void setUp() {
		SiteHealthCheckService health = mock(SiteHealthCheckService.class);
		when(health.healthCheck()).thenReturn(true);
		monitoring = mockMvc(new MonitoringController(health, TOKEN));

		SiteContextManager contextManager = mock(SiteContextManager.class);
		siteContext = mockMvc(new SiteContextRestController(contextManager, TOKEN));

		SiteCacheRestOperations operations = mock(SiteCacheRestOperations.class);
		when(operations.clear(org.mockito.ArgumentMatchers.any())).thenReturn("cleared");
		siteCache = mockMvc(new SiteCacheRestController(Map.of("system", operations), "system", TOKEN));
	}

	@Test
	public void monitoringAcceptsHeaderAndQuery() throws Exception {
		monitoring.perform(get("/api/1/monitoring/memory").header(ManagementToken.HEADER_NAME, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
		monitoring.perform(get("/api/1/monitoring/status").param(ManagementToken.QUERY_PARAMETER, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
	}

	@Test
	public void monitoringRejectsWrongHeaderEvenWhenQueryIsCorrect() throws Exception {
		monitoring.perform(get("/api/1/monitoring/status")
				.header(ManagementToken.HEADER_NAME, "wrong")
				.param(ManagementToken.QUERY_PARAMETER, TOKEN))
			.andExpect(status().isUnauthorized());
	}

	@Test
	public void siteContextAcceptsHeaderAndQuery() throws Exception {
		siteContext.perform(get("/api/1/site/context/rebuild_all").header(ManagementToken.HEADER_NAME, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
		siteContext.perform(get("/api/1/site/context/rebuild_all").param(ManagementToken.QUERY_PARAMETER, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
	}

	@Test
	public void siteCacheAcceptsHeaderAndRejectsBlankHeader() throws Exception {
		siteCache.perform(get("/api/1/site/cache/clear").header(ManagementToken.HEADER_NAME, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
		siteCache.perform(get("/api/1/site/cache/clear")
				.header(ManagementToken.HEADER_NAME, "")
				.param(ManagementToken.QUERY_PARAMETER, TOKEN))
			.andExpect(status().isUnauthorized());
	}

	private MockMvc mockMvc(Object controller) {
		return MockMvcBuilders.standaloneSetup(controller)
			.setControllerAdvice(new ExceptionHandlers())
			.addPlaceholderValue("crafter.core.rest.base.uri", "/api/1")
			.build();
	}

}
