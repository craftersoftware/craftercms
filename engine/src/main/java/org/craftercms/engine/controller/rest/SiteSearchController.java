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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.core.controller.rest.CrafterRestController;
import org.craftercms.core.controller.rest.RestControllerBase;
import org.craftercms.engine.exception.HttpStatusCodeException;
import org.craftercms.engine.search.legacy.SiteAwareOpenSearchService;
import org.opensearch.action.search.SearchResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static java.lang.String.format;

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

    private static final TypeReference<Map<String, Object>> REQUEST_TYPE = new TypeReference<>() {};

    protected final SiteAwareOpenSearchService searchService;
    protected final ObjectMapper objectMapper;
    protected final List<Pattern> restrictedKeyPatterns;

    @ConstructorProperties({"searchService", "objectMapper", "restrictedKeyPatterns"})
    public SiteSearchController(final SiteAwareOpenSearchService searchService, final ObjectMapper objectMapper,
                                final String[] restrictedKeyPatterns) {
        this.searchService = searchService;
        this.objectMapper = objectMapper;
        this.restrictedKeyPatterns = Stream.of(restrictedKeyPatterns)
                .map(StringUtils::trim)
                .filter(StringUtils::isNotEmpty)
                .map(Pattern::compile)
                .toList();
    }

    @PostMapping(value = URL_SEARCH, consumes = MediaType.APPLICATION_JSON_VALUE)
    public void search(@RequestBody JsonNode request, @RequestParam Map<String, Object> parameters,
                       HttpServletResponse response)
            throws IOException {
        // This is needed because we are writing manually the response
        response.setHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);

		if (!request.isObject()){
			throw new HttpStatusCodeException(HttpStatus.BAD_REQUEST, "Search request payload must be a JSON object");
		}
        rejectRestrictedKeys(request);

        Map<String, Object> requestMap = objectMapper.convertValue(request, REQUEST_TYPE);
        SearchResponse searchResponse = searchService.search(requestMap, parameters);

		// Write the response in ES format
		response.setCharacterEncoding(StandardCharsets.UTF_8.toString());
		response.getWriter().write(searchResponse.toString());
	}

	/**
	 * Rejects the request if any nested JSON object contains a restricted key.
	 */
    private void rejectRestrictedKeys(JsonNode node) {
        if (node == null) {
            return;
        }
        if (node.isObject()) {
            var fields = node.properties().iterator();
            while (fields.hasNext()) {
                var field = fields.next();
                if (isRestrictedKey(field.getKey())) {
                    throw new HttpStatusCodeException(HttpStatus.BAD_REQUEST,
                            format("Search request must not contain a '%s' key", field.getKey()));
                }
                rejectRestrictedKeys(field.getValue());
            }
        } else if (node.isArray()) {
            for (JsonNode element : node) {
                rejectRestrictedKeys(element);
            }
        }
    }

	/**
	 * Checks if the given key is restricted.
	 * A key is restricted if it matches any of the restricted key patterns.
	 */
    private boolean isRestrictedKey(String key) {
        return restrictedKeyPatterns.stream().anyMatch(pattern -> pattern.matcher(key).matches());
    }
}
