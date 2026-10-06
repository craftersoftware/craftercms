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
package org.craftercms.engine.exception;

import org.craftercms.core.exception.CrafterException;
import org.craftercms.core.exception.HttpStatusCodeAwareException;
import org.springframework.http.HttpStatus;

/**
 * Exception thrown to cause specific HTTP status code errors
 *
 * @author Alfonso Vásquez
 * @see org.craftercms.engine.http.impl.HttpStatusCodeAwareExceptionHandler
 */
public class HttpStatusCodeException extends CrafterException implements HttpStatusCodeAwareException {

	private HttpStatus status;

	public HttpStatusCodeException(int statusCode) {
		this(HttpStatus.valueOf(statusCode));
	}

	public HttpStatusCodeException(int statusCode, String message, Throwable cause) {
		this(HttpStatus.valueOf(statusCode), message, cause);
	}

	public HttpStatusCodeException(int statusCode, String message) {
		this(HttpStatus.valueOf(statusCode), message);
	}

	public HttpStatusCodeException(int statusCode, Throwable cause) {
		this(HttpStatus.valueOf(statusCode), cause);
	}

	public HttpStatusCodeException(HttpStatus status) {
		this.status = status;
	}

	public HttpStatusCodeException(HttpStatus status, String message, Throwable cause) {
		super(message, cause);

		this.status = status;
	}

	public HttpStatusCodeException(HttpStatus status, String message) {
		super(message);

		this.status = status;
	}

	public HttpStatusCodeException(HttpStatus status, Throwable cause) {
		super(cause);

		this.status = status;
	}

	@Override
	public int getStatusCode() {
		return status.value();
	}

	public HttpStatus getStatus() {
		return status;
	}

	@Override
	public String toString() {
		String clazz = getClass().getName();
		String message = getLocalizedMessage();

		if (message != null) {
			message = "[" + status.getReasonPhrase() + "] " + message;
		} else {
			message = "[" + status.getReasonPhrase() + "]";
		}

		return clazz + ": " + message;
	}

}
