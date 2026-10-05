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
import org.craftercms.deployer.api.DeploymentService;
import org.craftercms.deployer.api.TargetService;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Collections;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@RunWith(MockitoJUnitRunner.class)
public class TargetControllerTest {

    private static final String TOKEN = "secret-token";

    @Mock
    private TargetService targetService;
    @Mock
    private DeploymentService deploymentService;

    private MockMvc mockMvc;

    @Before
    public void setUp() throws Exception {

        TargetController controller = new TargetController(targetService, deploymentService);
        ReflectionTestUtils.setField(controller, "managementToken", TOKEN);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new ExceptionHandlers())
                .build();
    }

    @Test
    public void validHeaderIsAccepted() throws Exception {
        when(targetService.getAllTargets()).thenReturn(Collections.emptyList());
        mockMvc.perform(get(TargetController.BASE_URL + TargetController.GET_ALL_TARGETS_URL)
                        .header(ManagementToken.HEADER_NAME, TOKEN))
                .andExpect(status().isOk());
    }

    @Test
    public void missingHeaderIsRejected() throws Exception {
        mockMvc.perform(get(TargetController.BASE_URL + TargetController.GET_ALL_TARGETS_URL))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void invalidHeaderIsRejected() throws Exception {
        mockMvc.perform(get(TargetController.BASE_URL + TargetController.GET_ALL_TARGETS_URL)
                        .header(ManagementToken.HEADER_NAME, "wrong-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void queryParameterIsRejected() throws Exception {
        mockMvc.perform(get(TargetController.BASE_URL + TargetController.GET_ALL_TARGETS_URL)
                        .param(ManagementToken.QUERY_PARAMETER, TOKEN))
                .andExpect(status().isUnauthorized());
    }

}
