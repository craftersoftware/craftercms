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
package org.craftercms.engine.controller.rest;

import jakarta.servlet.http.HttpServletRequest;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.core.cache.CacheStatistics;
import org.craftercms.core.controller.rest.CrafterRestController;
import org.craftercms.core.controller.rest.RestControllerBase;
import org.craftercms.engine.controller.rest.cache.SiteCacheRestOperations;
import org.craftercms.engine.exception.InvalidCacheTypeException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;

import java.beans.ConstructorProperties;
import java.util.Map;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * REST controller for site cache operations. The controller uses a map of cache types mapped to
 * {@link org.craftercms.engine.controller.rest.cache.SiteCacheRestOperations}, which allows REST operation
 * implementations for different types of caches.
 *
 * @author avasquez
 */
@CrafterRestController
@RequestMapping(RestControllerBase.REST_BASE_URI + SiteCacheRestController.URL_ROOT)
public class SiteCacheRestController extends RestControllerBase {

	private static final Log logger = LogFactory.getLog(SiteCacheRestController.class);

	public static final String URL_ROOT = "/site/cache";
	public static final String URL_CLEAR = "/clear";
	public static final String URL_STATS = "/statistics";

	protected final Map<String, SiteCacheRestOperations> cacheRestOperationsPerCacheType;
	protected final String defaultCacheType;
	protected final String configuredToken;

	@ConstructorProperties({"cacheRestOperationsPerCacheType", "defaultCacheType", "configuredToken"})
	public SiteCacheRestController(final Map<String, SiteCacheRestOperations> cacheRestOperationsPerCacheType,
								   final String defaultCacheType, final String configuredToken) {
		this.cacheRestOperationsPerCacheType = cacheRestOperationsPerCacheType;
		this.defaultCacheType = defaultCacheType;
		this.configuredToken = configuredToken;
	}

	@RequestMapping(value = URL_CLEAR, method = RequestMethod.GET, produces = APPLICATION_JSON_VALUE)
	public Map<String, Object> clear(HttpServletRequest request, @RequestParam String token,
									 @RequestParam(required = false) String cacheType) throws InvalidManagementTokenException {
		validateToken(token);

		return createResponseMessage(getCacheRestOperations(cacheType).clear(request));
	}

	@RequestMapping(value = URL_STATS, method = RequestMethod.GET, produces = APPLICATION_JSON_VALUE)
	public CacheStatistics getStatistics(@RequestParam String token,
										 @RequestParam(required = false) String cacheType) throws InvalidManagementTokenException {
		validateToken(token);

		return getCacheRestOperations(cacheType).getStatistics();
	}

	@ExceptionHandler(InvalidCacheTypeException.class)
	public ResponseEntity<Map<String, Object>> handleInvalidCacheTypeException(InvalidCacheTypeException ex) {
		return ResponseEntity.badRequest().body(createResponseMessage(ex.getMessage()));
	}

	protected SiteCacheRestOperations getCacheRestOperations(String cacheType) {
		if (StringUtils.isEmpty(cacheType)) {
			cacheType = defaultCacheType;
		}

		var restOperations = cacheRestOperationsPerCacheType.get(cacheType);
		if (restOperations == null) {
			throw new InvalidCacheTypeException("Unrecognized cache type '" + cacheType + "'.");
		} else {
			return restOperations;
		}
	}

	protected final void validateToken(String requestToken) throws InvalidManagementTokenException {
		if (!StringUtils.equals(requestToken, configuredToken)) {
			throw new InvalidManagementTokenException("Management authorization failed, invalid token.");
		}
	}

}
