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
package org.craftercms.studio.impl.v2.service.proxy.internal;

import org.craftercms.commons.rest.ManagementToken;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.junit.Before;
import org.junit.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.net.URI;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_MANAGEMENT_PREVIEW_AUTHORIZATION_TOKEN;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_MANAGEMENT_PREVIEW_PROTECTED_URLS;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class ProxyServiceInternalImplTest {

	private static final String ENGINE_TOKEN = "engine-secret";
	private static final String CLIENT_TOKEN = "client-secret";

	private StudioConfiguration studioConfiguration;
	private ServicesConfig servicesConfig;
	private RestTemplate restTemplate;
	private ProxyServiceInternalImpl proxy;

	@Before
	public void setUp() throws Exception {
		studioConfiguration = mock(StudioConfiguration.class);
		servicesConfig = mock(ServicesConfig.class);
		when(servicesConfig.getAuthoringUrl("editorial")).thenReturn("http://localhost:8080");
		when(studioConfiguration.getProperty(CONFIGURATION_MANAGEMENT_PREVIEW_AUTHORIZATION_TOKEN)).thenReturn(ENGINE_TOKEN);
		when(studioConfiguration.getProperty(CONFIGURATION_MANAGEMENT_PREVIEW_PROTECTED_URLS))
			.thenReturn("/api/1/site/cache/clear, /api/1/monitoring/status.json");
		proxy = new ProxyServiceInternalImpl(studioConfiguration, servicesConfig);
		restTemplate = mock(RestTemplate.class);
		ReflectionTestUtils.setField(proxy, "restTemplate", restTemplate);
		when(restTemplate.exchange(any(URI.class), any(HttpMethod.class), any(HttpEntity.class), eq(Object.class)))
			.thenReturn(new ResponseEntity<>(HttpStatus.OK));
	}

	@Test
	public void protectedUrlDropsClientTokenAndSetsEngineHeader() throws Exception {
		proxy.proxyEngine(null, "editorial", request(
			"/studio/engine/api/1/site/cache/clear", "token=" + CLIENT_TOKEN + "&foo=1"));

		URI uri = capturedUri();
		HttpEntity<?> entity = capturedEntity();
		assertFalse(uri.getRawQuery().contains("token="));
		assertFalse(uri.toString().contains(CLIENT_TOKEN));
		assertFalse(uri.toString().contains(ENGINE_TOKEN));
		assertEquals(ENGINE_TOKEN, entity.getHeaders().getFirst(ManagementToken.HEADER_NAME));
	}

	@Test
	public void unprotectedUrlDoesNotRelayClientToken() throws Exception {
		proxy.proxyEngine(null, "editorial", request(
			"/studio/engine/api/1/content/exists", "token=" + CLIENT_TOKEN));

		URI uri = capturedUri();
		HttpEntity<?> entity = capturedEntity();
		assertFalse(uri.toString().contains("token="));
		assertNull(entity.getHeaders().getFirst(ManagementToken.HEADER_NAME));
	}

	private MockHttpServletRequest request(String uri, String query) {
		MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
		request.setContextPath("/studio");
		request.setQueryString(query);
		request.addHeader(ManagementToken.HEADER_NAME, CLIENT_TOKEN);
		return request;
	}

	private URI capturedUri() {
		return (URI) org.mockito.Mockito.mockingDetails(restTemplate).getInvocations().iterator().next().getArgument(0);
	}

	@SuppressWarnings("rawtypes")
	private HttpEntity capturedEntity() {
		return (HttpEntity) org.mockito.Mockito.mockingDetails(restTemplate).getInvocations().iterator().next().getArgument(2);
	}

}
