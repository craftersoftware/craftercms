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

import org.craftercms.commons.rest.ManagementToken;
import org.craftercms.studio.api.v2.service.marketplace.MarketplaceService;
import org.craftercms.studio.api.v2.service.monitor.MonitorService;
import org.craftercms.studio.api.v2.service.scripting.ScriptingService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.junit.Before;
import org.junit.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_MANAGEMENT_AUTHORIZATION_TOKEN;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class ManagementTokenControllerTest {

	private static final String TOKEN = "studio-token";

	private MockMvc monitoring;
	private MockMvc plugins;

	@Before
	public void setUp() {
		StudioConfiguration configuration = mock(StudioConfiguration.class);
		when(configuration.getProperty(CONFIGURATION_MANAGEMENT_AUTHORIZATION_TOKEN)).thenReturn(TOKEN);
		monitoring = MockMvcBuilders.standaloneSetup(new MonitoringController(configuration, mock(MonitorService.class)))
			.setControllerAdvice(new ExceptionHandlers())
			.build();
		plugins = MockMvcBuilders.standaloneSetup(
				new PluginController(configuration, mock(ScriptingService.class), mock(MarketplaceService.class)))
			.setControllerAdvice(new ExceptionHandlers())
			.build();
	}

	@Test
	public void monitoringAcceptsHeaderAndQuery() throws Exception {
		monitoring.perform(get("/api/2/monitoring/status").header(ManagementToken.HEADER_NAME, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
		monitoring.perform(get("/api/2/monitoring/memory").param(ManagementToken.QUERY_PARAMETER, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
	}

	@Test
	public void monitoringRejectsWrongHeaderEvenWhenQueryIsCorrect() throws Exception {
		monitoring.perform(get("/api/2/monitoring/status")
				.header(ManagementToken.HEADER_NAME, "wrong")
				.param(ManagementToken.QUERY_PARAMETER, TOKEN))
			.andExpect(status().isUnauthorized());
	}

	@Test
	public void pluginReloadAcceptsHeaderAndQuery() throws Exception {
		plugins.perform(get("/api/2/plugin/editorial/script/reload").header(ManagementToken.HEADER_NAME, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
		plugins.perform(get("/api/2/plugin/editorial/script/reload").param(ManagementToken.QUERY_PARAMETER, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
	}

}
