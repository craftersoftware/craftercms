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
package org.craftercms.deployer.impl.rest;

import org.craftercms.commons.rest.ManagementToken;
import org.junit.Before;
import org.junit.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class MonitorControllerTest {

	private static final String TOKEN = "deployer-token";

	private MockMvc mockMvc;

	@Before
	public void setUp() {
		mockMvc = MockMvcBuilders.standaloneSetup(new MonitorController(TOKEN))
			.setControllerAdvice(new ExceptionHandlers())
			.build();
	}

	@Test
	public void statusAcceptsHeaderAndQuery() throws Exception {
		mockMvc.perform(get("/api/1/monitoring/status").header(ManagementToken.HEADER_NAME, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
		mockMvc.perform(get("/api/1/monitoring/status").param(ManagementToken.QUERY_PARAMETER, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
	}

	@Test
	public void wrongHeaderDoesNotFallBackToQuery() throws Exception {
		mockMvc.perform(get("/api/1/monitoring/memory")
				.header(ManagementToken.HEADER_NAME, "wrong")
				.param(ManagementToken.QUERY_PARAMETER, TOKEN))
			.andExpect(status().isUnauthorized());
	}

	@Test
	public void blankHeaderIsRejected() throws Exception {
		mockMvc.perform(get("/api/1/monitoring/status")
				.header(ManagementToken.HEADER_NAME, " ")
				.param(ManagementToken.QUERY_PARAMETER, TOKEN))
			.andExpect(status().isUnauthorized());
	}

}
