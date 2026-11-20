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
package org.craftercms.commons.rest;

import org.junit.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

public class ManagementTokenResolverTest {

    private static final String HEADER_TOKEN = "header-token";
    private static final String QUERY_TOKEN = "query-token";

    @Test
    public void headerIsUsed() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ManagementToken.HEADER_NAME, HEADER_TOKEN);

        assertEquals(HEADER_TOKEN, ManagementTokenResolver.resolve(request));
    }

    @Test
    public void queryIsUsedWhenHeaderIsAbsent() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter(ManagementToken.QUERY_PARAMETER, QUERY_TOKEN);

        assertEquals(QUERY_TOKEN, ManagementTokenResolver.resolve(request));
    }

    @Test
    public void headerWinsWhenBothAreSent() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ManagementToken.HEADER_NAME, HEADER_TOKEN);
        request.setParameter(ManagementToken.QUERY_PARAMETER, QUERY_TOKEN);

        assertEquals(HEADER_TOKEN, ManagementTokenResolver.resolve(request));
    }

    @Test
    public void wrongHeaderDoesNotFallBackToQuery() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ManagementToken.HEADER_NAME, "wrong");
        request.setParameter(ManagementToken.QUERY_PARAMETER, QUERY_TOKEN);

        assertEquals("wrong", ManagementTokenResolver.resolve(request));
    }

    @Test
    public void blankHeaderDoesNotFallBackToQuery() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ManagementToken.HEADER_NAME, "");
        request.setParameter(ManagementToken.QUERY_PARAMETER, QUERY_TOKEN);

        assertEquals("", ManagementTokenResolver.resolve(request));
    }

    @Test
    public void blankQueryIsReturnedWhenHeaderIsAbsent() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter(ManagementToken.QUERY_PARAMETER, "");

        assertEquals("", ManagementTokenResolver.resolve(request));
    }

    @Test
    public void missingTokenIsNull() {
        assertNull(ManagementTokenResolver.resolve(new MockHttpServletRequest()));
        assertNull(ManagementTokenResolver.resolve(null));
    }

}
