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

package org.craftercms.engine.service.context;

import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;

/**
 * Describes site list failures for log and exception messages.
 */
final class SiteListErrors {

	private SiteListErrors() {
	}

	/**
	 * Returns the exception message. When the message is blank, returns the exception class name, followed by the
	 * root cause when there is one, e.g. {@code ConnectException: UnresolvedAddressException}.
	 */
	static String describe(Throwable error) {
		if (error == null) {
			return "unknown error";
		}
		if (StringUtils.isNotBlank(error.getMessage())) {
			return error.getMessage();
		}
		String description = typeName(error);
		Throwable rootCause = ExceptionUtils.getRootCause(error);
		if (rootCause != null && rootCause != error) {
			String rootDescription = StringUtils.isNotBlank(rootCause.getMessage())
				? rootCause.getMessage()
				: typeName(rootCause);
			description += ": " + rootDescription;
		}
		return description;
	}

	private static String typeName(Throwable error) {
		String name = error.getClass().getSimpleName();
		return name.isEmpty() ? error.getClass().getName() : name;
	}

}
