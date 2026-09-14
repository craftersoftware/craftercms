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

package org.craftercms.engine.controller.rest.multitenant;

import jakarta.servlet.http.HttpServletResponse;
import org.craftercms.core.controller.rest.CrafterRestController;
import org.craftercms.core.controller.rest.RestControllerBase;
import org.craftercms.engine.service.context.ReloadableMappingsSiteResolver;
import org.craftercms.engine.service.context.SiteResolver;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import java.util.Collections;
import java.util.Map;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * REST controller for operations related to site mappings.
 *
 * @author avasquez
 */
@CrafterRestController
@RequestMapping(RestControllerBase.REST_BASE_URI + SiteMappingsRestController.URL_ROOT)
public class SiteMappingsRestController {

	public static final String URL_ROOT = "/site/mappings";
	public static final String URL_RELOAD = "/reload";

	private SiteResolver siteResolver;

	public SiteMappingsRestController(SiteResolver siteResolver) {
		this.siteResolver = siteResolver;
	}

	@RequestMapping(value = URL_RELOAD, method = RequestMethod.GET, produces = APPLICATION_JSON_VALUE)
	public Map<String, String> reloadMappings(HttpServletResponse response) {
		if (siteResolver instanceof ReloadableMappingsSiteResolver) {
			((ReloadableMappingsSiteResolver) siteResolver).reloadMappings();

			return Collections.singletonMap(RestControllerBase.MESSAGE_MODEL_ATTRIBUTE_NAME, "Mappings reloaded");
		} else {
			response.setStatus(HttpServletResponse.SC_BAD_REQUEST);

			return Collections.singletonMap(RestControllerBase.MESSAGE_MODEL_ATTRIBUTE_NAME,
				"The current resolver is not a " +
					ReloadableMappingsSiteResolver.class.getSimpleName() +
					". No mappings to reload");
		}
	}

}
