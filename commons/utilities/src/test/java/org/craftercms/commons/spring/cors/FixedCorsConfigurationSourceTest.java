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
package org.craftercms.commons.spring.cors;

import org.junit.Test;
import org.springframework.web.cors.CorsConfiguration;

import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

public class FixedCorsConfigurationSourceTest {

    @Test
    public void customHeaderAndMethodListsStayDistinct() {
        FixedCorsConfigurationSource source = new FixedCorsConfigurationSource(
            false,
            "https://studio.example",
            "GET,POST",
            "600",
            "X-Crafter-Management-Token,X-Custom",
            true);

        CorsConfiguration config = source.getCorsConfiguration(null);

        assertEquals(List.of("GET", "POST"), config.getAllowedMethods());
        assertEquals(List.of("X-Crafter-Management-Token", "X-Custom"), config.getAllowedHeaders());
    }

    @Test
    public void disabledCorsReturnsNoConfiguration() {
        FixedCorsConfigurationSource source = new FixedCorsConfigurationSource(
            true, "*", "GET", "0", "X-Crafter-Management-Token", false);

        assertNull(source.getCorsConfiguration(null));
    }

}
