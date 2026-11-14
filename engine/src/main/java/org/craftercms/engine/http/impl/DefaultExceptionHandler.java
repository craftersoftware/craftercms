/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.engine.http.impl;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.craftercms.engine.http.ExceptionHandler;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

import static org.craftercms.commons.http.HttpUtils.getFullRequestUri;
import static org.craftercms.commons.lang.UrlUtils.cleanUrlForLog;
import static org.craftercms.commons.rest.RequestLogSanitizer.sanitizeUri;

/**
 * Default {@link org.craftercms.engine.http.ExceptionHandler}, which logs all exceptions and sends a HTTP 500 status.
 *
 * @author Alfonso Vásquez
 */
public class DefaultExceptionHandler implements ExceptionHandler {

	private static final Log logger = LogFactory.getLog(DefaultExceptionHandler.class);

	public static final String EXCEPTION_ATTRIBUTE = "exception";

	@Override
	public boolean handle(HttpServletRequest request, HttpServletResponse response, Exception ex) throws IOException {
		logger.error(request.getMethod() + " " + cleanUrlForLog(sanitizeUri(getFullRequestUri(request, true))) + " failed", ex);

		request.setAttribute(EXCEPTION_ATTRIBUTE, ex);
		response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);

		return true;
	}

}
