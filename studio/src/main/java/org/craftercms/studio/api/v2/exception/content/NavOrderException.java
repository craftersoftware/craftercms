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

package org.craftercms.studio.api.v2.exception.content;

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.model.rest.ApiResponse;

/**
 * Exception thrown when an item cannot be reordered because the reference items do not yield a valid order.
 * The {@link ApiResponse} identifies which reorder rule failed.
 */
public class NavOrderException extends ServiceLayerException {

	private final ApiResponse response;

	public NavOrderException(ApiResponse response, String message) {
		super(message);
		this.response = response;
	}

	/**
	 * Returns the API response that describes this reorder failure.
	 */
	public ApiResponse getResponse() {
		return response;
	}

}
