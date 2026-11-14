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
package org.craftercms.core.controller.rest;

import org.craftercms.commons.rest.ManagementToken;
import org.craftercms.core.service.CacheService;
import org.craftercms.core.service.ContentStoreService;
import org.craftercms.core.util.cache.CacheTemplate;
import org.junit.Before;
import org.junit.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class CacheRestControllerTest {

	private static final String TOKEN = "core-token";

	private MockMvc mockMvc;

	@Before
	public void setUp() {
		CacheTemplate cacheTemplate = mock(CacheTemplate.class);
		when(cacheTemplate.getCacheService()).thenReturn(mock(CacheService.class));
		CacheRestController controller = new CacheRestController(cacheTemplate, mock(ContentStoreService.class), TOKEN);
		mockMvc = MockMvcBuilders.standaloneSetup(controller)
			.setControllerAdvice(new ExceptionHandlers())
			.addPlaceholderValue("crafter.core.rest.base.uri", "/api/1")
			.build();
	}

	@Test
	public void clearAllAcceptsHeaderAndQuery() throws Exception {
		mockMvc.perform(get("/api/1/cache/clear_all").header(ManagementToken.HEADER_NAME, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
		mockMvc.perform(get("/api/1/cache/clear_all").param(ManagementToken.QUERY_PARAMETER, TOKEN)
				.accept(MediaType.APPLICATION_JSON))
			.andExpect(status().isOk());
	}

	@Test
	public void wrongHeaderDoesNotFallBackToQuery() throws Exception {
		mockMvc.perform(get("/api/1/cache/clear_all")
				.header(ManagementToken.HEADER_NAME, "wrong")
				.param(ManagementToken.QUERY_PARAMETER, TOKEN))
			.andExpect(status().isUnauthorized());
	}

}
