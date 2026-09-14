/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.engine.controller.rest;

import org.craftercms.core.controller.rest.CrafterRestController;
import org.craftercms.core.controller.rest.RestControllerBase;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Map;

import static java.util.Collections.singletonMap;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;


/**
 * Controller to expose general configurations
 *
 * @author joseross
 * @since 3.1.1
 */
@CrafterRestController
@RequestMapping(RestControllerBase.REST_BASE_URI + ConfigRestController.URL_ROOT)
public class ConfigRestController {

	public static final String URL_ROOT = "/config";
	public static final String URL_MODE_PREVIEW = "/preview";

	protected boolean modePreview;

	public ConfigRestController(final boolean modePreview) {
		this.modePreview = modePreview;
	}

	/**
	 * Indicates if the system is currently configured for preview
	 */
	@GetMapping(value = URL_MODE_PREVIEW, produces = APPLICATION_JSON_VALUE)
	public Map<String, Boolean> getModePreview() {
		return singletonMap("preview", modePreview);
	}

}
