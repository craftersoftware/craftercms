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
package org.craftercms.studio.impl.v2.deployment;

import org.craftercms.commons.rest.ManagementToken;
import org.craftercms.commons.rest.RestTemplate;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.http.HttpHeaders;
import org.springframework.http.RequestEntity;

import java.util.List;
import java.util.Map;

import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_MANAGEMENT_DEPLOYER_AUTHORIZATION_TOKEN;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.PREVIEW_DEFAULT_CREATE_TARGET_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.PREVIEW_DEFAULT_DELETE_TARGET_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.PREVIEW_DEFAULT_PREVIEW_DEPLOYER_URL;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.PREVIEW_DUPLICATE_TARGET_URL;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class PreviewDeployerTest {

    private static final String TOKEN = "deployer-secret";
    private static final String SITE = "editorial";
    private static final String CREATE_URL = "http://localhost:9191/api/1/target/create_if_not_exists";
    private static final String DELETE_URL = "http://localhost:9191/api/1/target/delete-if-exists/{siteEnv}/{siteName}";
    private static final String DEPLOY_URL = "http://localhost:9191/api/1/target/deploy/{siteEnv}/{siteName}";
    private static final String DUPLICATE_URL = "http://localhost:9191/api/1/target/duplicate/{siteEnv}/{siteName}";

    @Mock
    private StudioConfiguration studioConfiguration;
    @Mock
    private RestTemplate restTemplate;

    private PreviewDeployer deployer;

    @Before
    public void setUp() {
        when(studioConfiguration.getProperty(anyString())).thenReturn("");
        when(studioConfiguration.getProperty(anyString(), eq(Boolean.class), any())).thenReturn(false);
        when(studioConfiguration.getProperty(CONFIGURATION_MANAGEMENT_DEPLOYER_AUTHORIZATION_TOKEN)).thenReturn(TOKEN);
        when(studioConfiguration.getProperty(PREVIEW_DEFAULT_CREATE_TARGET_URL)).thenReturn(CREATE_URL);
        when(studioConfiguration.getProperty(PREVIEW_DEFAULT_DELETE_TARGET_URL)).thenReturn(DELETE_URL);
        when(studioConfiguration.getProperty(PREVIEW_DEFAULT_PREVIEW_DEPLOYER_URL)).thenReturn(DEPLOY_URL);
        when(studioConfiguration.getProperty(PREVIEW_DUPLICATE_TARGET_URL)).thenReturn(DUPLICATE_URL);
        deployer = new PreviewDeployer(studioConfiguration, restTemplate);
    }

    @Test
    public void createTargetsSendTokenHeader() {
        deployer.createTargets(SITE);

        assertRequests(2);
    }

    @Test
    public void deleteTargetsSendTokenHeader() {
        deployer.deleteTargets(SITE);

        assertRequests(2);
    }

    @Test
    public void deployTargetSendsTokenHeader() {
        deployer.doDeployment(SITE, "preview", true);

        assertRequests(1);
    }

    @Test
    public void duplicateTargetsSendTokenHeader() {
        deployer.duplicateTargets("source", SITE);

        assertRequests(2);
    }

    private void assertRequests(int expectedCalls) {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<RequestEntity<?>> captor = ArgumentCaptor.forClass(RequestEntity.class);
        verify(restTemplate, times(expectedCalls)).exchange(captor.capture(), eq(Map.class));
        List<RequestEntity<?>> requests = captor.getAllValues();
        assertEquals(expectedCalls, requests.size());
        for (RequestEntity<?> request : requests) {
            String query = request.getUrl().getQuery();
            assertFalse(query != null && query.contains(ManagementToken.QUERY_PARAMETER + "="));
            assertFalse(request.getUrl().toString().contains(TOKEN));
            assertEquals(TOKEN, request.getHeaders().getFirst(ManagementToken.HEADER_NAME));
            assertNull(request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION));
        }
    }

}
