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

import jakarta.servlet.http.HttpServletResponse;
import org.craftercms.core.controller.rest.CrafterRestController;
import org.craftercms.core.controller.rest.RestControllerBase;
import org.craftercms.engine.search.legacy.SiteAwareOpenSearchService;
import org.opensearch.action.search.SearchResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * REST controller to expose the Search service
 *
 * @author joseross
 */
@CrafterRestController
@RequestMapping({RestControllerBase.REST_BASE_URI + SiteSearchController.URL_ROOT, RestControllerBase.REST_BASE_URI + SiteSearchController.URL_ES_ROOT})
public class SiteSearchController extends RestControllerBase {

	public static final String URL_ROOT = "/site/search";
	// We use this for backwards compatibility with the old search endpoint
	public static final String URL_ES_ROOT = "/site/elasticsearch";
	public static final String URL_SEARCH = "/search";

	protected final SiteAwareOpenSearchService searchService;

	@ConstructorProperties({"searchService"})
	public SiteSearchController(final SiteAwareOpenSearchService searchService) {
		this.searchService = searchService;
	}

	@PostMapping(value = URL_SEARCH, consumes = MediaType.APPLICATION_JSON_VALUE)
	public void search(@RequestBody Map<String, Object> request, @RequestParam Map<String, Object> parameters,
			   HttpServletResponse response)
		throws IOException {
		// This is needed because we are writing manually the response
		response.setHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);

		// Execute the query
		SearchResponse searchResponse = searchService.search(request, parameters);

		// Write the response in ES format
		response.setCharacterEncoding(StandardCharsets.UTF_8.toString());
		response.getWriter().write(searchResponse.toString());
	}

}
