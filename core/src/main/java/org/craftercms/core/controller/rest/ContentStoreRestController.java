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
package org.craftercms.core.controller.rest;

import jakarta.servlet.http.HttpServletResponse;
import org.apache.commons.lang3.ArrayUtils;
import org.craftercms.commons.lang.RegexUtils;
import org.craftercms.core.exception.*;
import org.craftercms.core.service.*;
import org.craftercms.core.service.impl.CompositeItemFilter;
import org.craftercms.core.service.impl.ExcludeByUrlItemFilter;
import org.craftercms.core.service.impl.IncludeByUrlItemFilter;
import org.craftercms.core.util.cache.impl.CachingAwareList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

import java.beans.ConstructorProperties;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * REST service that provides several methods to access the Crafter content store.
 *
 * @author avasquez
 */
@RestController
@RequestMapping(RestControllerBase.REST_BASE_URI + ContentStoreRestController.URL_ROOT)
public class ContentStoreRestController extends RestControllerBase implements InitializingBean {

	private static final Logger logger = LoggerFactory.getLogger(ContentStoreRestController.class);

	public static final String URL_ROOT = "/content_store";
	public static final String CACHE_CONTROL_HEADER_NAME = "Cache-Control";
	public static final String MUST_REVALIDATE_HEADER_VALUE = "must-revalidate";
	public static final String REQUEST_PARAM_CONTEXT_ID = "contextId";
	public static final String REQUEST_PARAM_URL = "url";
	public static final String REQUEST_PARAM_TREE_DEPTH = "depth";
	public static final String URL_ITEM = "/item";
	public static final String URL_CHILDREN = "/children";
	public static final String URL_TREE = "/tree";

	private final ContentStoreService storeService;
	private final int treeDepthLimit;
	private String[] allowedUrlPatterns;
	private String[] forbiddenUrlPatterns;

	private ItemFilter itemFilter;

	@ConstructorProperties({"storeService", "treeDepthLimit"})
	public ContentStoreRestController(ContentStoreService storeService, int treeDepthLimit) {
		this.storeService = storeService;
		if (treeDepthLimit < 0 || treeDepthLimit > ContentStoreService.TREE_DEPTH_HARD_LIMIT) {
			this.treeDepthLimit = ContentStoreService.TREE_DEPTH_HARD_LIMIT;
		} else {
			this.treeDepthLimit = treeDepthLimit;
		}
	}

	public void setAllowedUrlPatterns(String[] allowedUrlPatterns) {
		this.allowedUrlPatterns = allowedUrlPatterns;
	}

	public void setForbiddenUrlPatterns(String[] forbiddenUrlPatterns) {
		this.forbiddenUrlPatterns = forbiddenUrlPatterns;
	}

	public void afterPropertiesSet() {
		CompositeItemFilter compositeItemFilter = new CompositeItemFilter();
		compositeItemFilter.setFilters(Arrays.asList(new IncludeByUrlItemFilter(allowedUrlPatterns),
			new ExcludeByUrlItemFilter(forbiddenUrlPatterns)));

		itemFilter = compositeItemFilter;
	}

	@RequestMapping(value = URL_ITEM, method = RequestMethod.GET, produces = APPLICATION_JSON_VALUE)
	public Item getItem(WebRequest request, HttpServletResponse response,
			    @RequestParam(REQUEST_PARAM_CONTEXT_ID) String contextId,
			    @RequestParam(REQUEST_PARAM_URL) String url,
			    @RequestParam(required = false, defaultValue = "false") boolean flatten)
		throws InvalidContextException, StoreException, PathNotFoundException, ForbiddenPathException,
		ItemProcessingException, XmlMergeException, XmlFileParseException {
		checkIfUrlAllowed(url);

		Context context = storeService.getContext(contextId);
		if (context == null) {
			throw new InvalidContextException("No context found for ID " + contextId);
		}

		Item item = storeService.getItem(context, null, url, null, flatten);

		if (item.getCachingTime() != null && checkNotModified(item.getCachingTime(), request, response)) {
			return null;
		} else {
			return item;
		}
	}

	@RequestMapping(value = URL_CHILDREN, method = RequestMethod.GET, produces = APPLICATION_JSON_VALUE)
	public List<Item> getChildren(WebRequest request, HttpServletResponse response,
				      @RequestParam(REQUEST_PARAM_CONTEXT_ID) String contextId,
				      @RequestParam(REQUEST_PARAM_URL) String url,
				      @RequestParam(required = false, defaultValue = "false") boolean flatten)
		throws InvalidContextException, StoreException, PathNotFoundException, ForbiddenPathException,
		ItemProcessingException, XmlMergeException, XmlFileParseException {
		checkIfUrlAllowed(url);

		Context context = storeService.getContext(contextId);
		if (context == null) {
			throw new InvalidContextException("No context found for ID " + contextId);
		}

		CachingAwareList<Item> children =
			(CachingAwareList<Item>) storeService.getChildren(context, null, url, itemFilter, null, flatten);

		if (children.getCachingTime() != null && checkNotModified(children.getCachingTime(), request, response)) {
			return null;
		} else {
			return new ArrayList<>(children);
		}
	}

	@RequestMapping(value = URL_TREE, method = RequestMethod.GET, produces = APPLICATION_JSON_VALUE)
	public Tree getTree(WebRequest request, HttpServletResponse response,
			    @RequestParam(REQUEST_PARAM_CONTEXT_ID) String contextId,
			    @RequestParam(REQUEST_PARAM_URL) String url,
			    @RequestParam(value = REQUEST_PARAM_TREE_DEPTH, required = false) Integer depth,
			    @RequestParam(required = false, defaultValue = "false") boolean flatten)
		throws InvalidContextException, StoreException, PathNotFoundException, ForbiddenPathException,
		ItemProcessingException, XmlMergeException, XmlFileParseException {
		checkIfUrlAllowed(url);

		Context context = storeService.getContext(contextId);
		if (context == null) {
			throw new IllegalArgumentException("No context found for ID " + contextId);
		}

		// tree depth must not exceed the configured limit
		if (depth == null || depth < 0 || depth > treeDepthLimit) {
			depth = treeDepthLimit;
		}

		try {
			Tree tree = storeService.getTree(context, null, url, depth, itemFilter, null, false);
			if (tree.getCachingTime() != null && checkNotModified(tree.getCachingTime(), request, response)) {
				return null;
			} else {
				return tree;
			}
		} catch (OutOfMemoryError error) {
			logger.error("Unable to fulfill the request. Out of memory exception occurred.", error);
			logger.info("Maximum JVM memory is '{}' bytes", Runtime.getRuntime().maxMemory());
			throw new StoreException("Unable to fulfill the request. Out of memory exception occurred.");
		}
	}

	private boolean checkNotModified(long lastModifiedTimestamp, WebRequest request, HttpServletResponse response) {
		response.setHeader(CACHE_CONTROL_HEADER_NAME, MUST_REVALIDATE_HEADER_VALUE);

		return request.checkNotModified(lastModifiedTimestamp);
	}

	private boolean isUrlAllowed(String url) {
		return (ArrayUtils.isEmpty(allowedUrlPatterns) || RegexUtils.matchesAny(url, allowedUrlPatterns)) &&
			(ArrayUtils.isEmpty(forbiddenUrlPatterns) || !RegexUtils.matchesAny(url, forbiddenUrlPatterns));
	}

	private void checkIfUrlAllowed(String url) throws ForbiddenPathException {
		if (!isUrlAllowed(url)) {
			throw new ForbiddenPathException("Access denied to URL " + url);
		}
	}

}
