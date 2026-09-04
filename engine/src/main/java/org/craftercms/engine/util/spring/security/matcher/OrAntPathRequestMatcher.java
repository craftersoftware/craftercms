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
package org.craftercms.engine.util.spring.security.matcher;

import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collection;
import java.util.stream.Collectors;

/**
 * RequestMatcher that matches if any of the given ant patterns matches.
 */
public class OrAntPathRequestMatcher implements RequestMatcher {
    private final RequestMatcher matcher;

    public OrAntPathRequestMatcher(final Collection<String> antPatterns) {
        matcher = new OrRequestMatcher(antPatterns.stream()
                .map(AntPathRequestMatcher::new)
                .collect(Collectors.toList()));
    }

    @Override
    public boolean matches(HttpServletRequest request) {
        return matcher.matches(request);
    }
}
