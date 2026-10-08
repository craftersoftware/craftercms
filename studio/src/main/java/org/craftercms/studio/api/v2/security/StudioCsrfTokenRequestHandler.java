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
package org.craftercms.studio.api.v2.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;

import java.util.function.Supplier;

/**
 * This class is an implementation of the CsrfTokenRequestHandler interface.
 * It is responsible for handling CSRF token requests and resolving CSRF token values.
 * It uses an instance of XorCsrfTokenRequestAttributeHandler as a delegate to handle requests and resolve token values.
 */
public class StudioCsrfTokenRequestHandler implements CsrfTokenRequestHandler {
    /**
     * Raw Csrf token length
     */
    private static final int CSRF_RAW_STRING_LENGTH = 36;

    /**
     * delegate to use as the request handler
     */
    private final XorCsrfTokenRequestAttributeHandler delegate = new XorCsrfTokenRequestAttributeHandler();

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, Supplier<CsrfToken> csrfToken) {
        delegate.handle(request, response, csrfToken);
    }

    @Override
    public String resolveCsrfTokenValue(HttpServletRequest request, CsrfToken csrfToken) {
        String tokenValue = CsrfTokenRequestHandler.super.resolveCsrfTokenValue(request, csrfToken);
        if (tokenValue != null && tokenValue.length() == CSRF_RAW_STRING_LENGTH) {
            return tokenValue;
        }
        return delegate.resolveCsrfTokenValue(request, csrfToken);
    }
}
