/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.craftercms.core.exception.HttpStatusCodeAwareException;
import org.craftercms.core.util.ExceptionUtils;
import org.craftercms.engine.exception.PreviewAccessException;
import org.craftercms.engine.http.ExceptionHandler;

import java.io.IOException;

import static org.craftercms.commons.http.HttpUtils.getFullRequestUri;
import static org.craftercms.commons.lang.UrlUtils.cleanUrlForLog;

/**
 * Handler for {@code HttpStatusCodeException}s.
 *
 * @author Alfonso Vásquez
 */
public class HttpStatusCodeAwareExceptionHandler implements ExceptionHandler {

	private static final Log logger = LogFactory.getLog(HttpStatusCodeAwareExceptionHandler.class);

	@Override
	public boolean handle(HttpServletRequest request, HttpServletResponse response, Exception ex) throws IOException {
		HttpStatusCodeAwareException httpStatusCodeAwareEx =
			ExceptionUtils.getThrowableOfType(ex, HttpStatusCodeAwareException.class);

		if (httpStatusCodeAwareEx == null) {
			return false;
		}

		String message = String.format("%s %s failed", request.getMethod(), cleanUrlForLog(getFullRequestUri(request, true)));
		if (httpStatusCodeAwareEx instanceof PreviewAccessException previewException) {
			logger.debug(message, previewException);
		} else {
			ex = (Exception) httpStatusCodeAwareEx;
			logger.error(message, ex);
		}

		response.sendError(httpStatusCodeAwareEx.getStatusCode(), getResponseMessage(ex));
		return true;
	}

	/**
	 * Get a response message key depends on the exception to resolve by the template
	 *
	 * @param ex the exception
	 * @return response message
	 */
	private static String getResponseMessage(Exception ex) {
		if (ex instanceof PreviewAccessException) {
			return PreviewAccessException.class.getSimpleName();
		}

		return ex.getMessage();
	}

}
