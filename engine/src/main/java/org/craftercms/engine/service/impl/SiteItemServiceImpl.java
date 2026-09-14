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
package org.craftercms.engine.service.impl;

import org.apache.commons.collections.MapUtils;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.collections4.Predicate;
import org.apache.commons.collections4.PredicateUtils;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.converters.Converter;
import org.craftercms.core.processors.ItemProcessor;
import org.craftercms.core.processors.impl.ItemProcessorPipeline;
import org.craftercms.core.service.Content;
import org.craftercms.core.service.ContentStoreService;
import org.craftercms.core.service.Item;
import org.craftercms.core.service.ItemFilter;
import org.craftercms.core.service.Tree;
import org.craftercms.core.service.impl.CompositeItemFilter;
import org.craftercms.engine.model.DefaultSiteItem;
import org.craftercms.engine.model.EmbeddedSiteItem;
import org.craftercms.engine.model.SiteItem;
import org.craftercms.engine.service.SiteItemService;
import org.craftercms.engine.service.context.SiteContext;
import org.craftercms.engine.service.filter.ExcludeByNameItemFilter;
import org.craftercms.engine.service.filter.ExpectedNodeValueItemFilter;
import org.craftercms.engine.service.filter.IncludeByNameItemFilter;
import org.dom4j.Element;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.craftercms.engine.util.LocaleUtils.resolveLocalePath;

/**
 * Default implementation of {@link SiteItemService}.
 *
 * @author Alfonso Vásquez
 */
public class SiteItemServiceImpl implements SiteItemService {

	protected ContentStoreService storeService;
	protected List<Predicate<Item>> defaultPredicates;
	protected List<ItemFilter> defaultFilters;
	protected List<ItemProcessor> defaultProcessors;
	protected Converter<Element, Object> modelFieldConverter;
	protected Comparator<SiteItem> sortComparator;

	public SiteItemServiceImpl(ContentStoreService storeService, Converter<Element, Object> modelFieldConverter) {
		this.storeService = storeService;
		this.modelFieldConverter = modelFieldConverter;
	}

	public void setDefaultPredicates(List<Predicate<Item>> defaultPredicates) {
		this.defaultPredicates = defaultPredicates;
	}

	public void setDefaultFilters(List<ItemFilter> defaultFilters) {
		this.defaultFilters = defaultFilters;
	}

	public void setDefaultProcessors(List<ItemProcessor> defaultProcessors) {
		this.defaultProcessors = defaultProcessors;
	}

	public void setSortComparator(Comparator<SiteItem> sortComparator) {
		this.sortComparator = sortComparator;
	}

	@Override
	public Content getRawContent(String url) {
		return storeService.findContent(getSiteContext().getContext(), url);
	}

	@Override
	public SiteItem getSiteItem(final SiteItem parent, final Element element) {
		return new EmbeddedSiteItem(parent, element, modelFieldConverter);
	}

	@Override
	public SiteItem getSiteItem(String url) {
		return getSiteItem(url, null);
	}

	@Override
	public SiteItem getSiteItem(String url, ItemProcessor processor) {
		return getSiteItem(url, processor, null);
	}

	@Override
	public SiteItem getSiteItem(String url, ItemProcessor processor, Predicate<Item> predicate) {
		SiteContext context = getSiteContext();
		url = resolveLocalePath(url, u -> storeService.exists(context.getContext(), u));

		if (!storeService.exists(context.getContext(), url)) {
			return null;
		}

		if (CollectionUtils.isNotEmpty(defaultPredicates)) {
			List<Predicate<Item>> predicates = new ArrayList<>(defaultPredicates);

			if (predicate != null) {
				predicates.add(predicate);
			}

			predicate = PredicateUtils.allPredicate(predicates);
		}
		if (CollectionUtils.isNotEmpty(defaultProcessors)) {
			ItemProcessorPipeline processorPipeline = new ItemProcessorPipeline(new ArrayList<>(defaultProcessors));

			if (processor != null) {
				processorPipeline.addProcessor(processor);
			}

			processor = processorPipeline;
		}

		Item item = storeService.findItem(context.getContext(), null, url, processor);
		if (item != null && (predicate == null || predicate.evaluate(item))) {
			return createItemWrapper(new Item(item));
		} else {
			return null;
		}
	}

	@Override
	public SiteItem getSiteTree(String url, int depth) {
		return getSiteTree(url, depth, null, (ItemProcessor) null);
	}

	@Override
	public SiteItem getSiteTree(String url, int depth, ItemFilter filter, ItemProcessor processor) {
		if (CollectionUtils.isNotEmpty(defaultFilters)) {
			CompositeItemFilter compositeFilter = new CompositeItemFilter(new ArrayList<>(defaultFilters));

			if (filter != null) {
				compositeFilter.addFilter(filter);
			}

			filter = compositeFilter;
		}

		if (CollectionUtils.isNotEmpty(defaultProcessors)) {
			ItemProcessorPipeline processorPipeline = new ItemProcessorPipeline(new ArrayList<>(defaultProcessors));

			if (processor != null) {
				processorPipeline.addProcessor(processor);
			}

			processor = processorPipeline;
		}

		Tree tree = storeService.findTree(getSiteContext().getContext(), null, url, depth, filter, processor);
		if (tree != null) {
			return createItemWrapper(new Tree(tree));
		} else {
			return null;
		}
	}

	@Deprecated
	@Override
	public SiteItem getSiteTree(String url, int depth, String includeByNameRegex, String excludeByNameRegex) {
		return getSiteTree(url, depth, includeByNameRegex, excludeByNameRegex, (Map<String, String>) null);
	}

	@Deprecated
	@Override
	public SiteItem getSiteTree(String url, int depth, String includeByNameRegex, String excludeByNameRegex,
				    String[]... nodeXPathAndExpectedValuePairs) {
		Map<String, String> nodeXPathAndExpectedValuePairMap = null;

		if (ArrayUtils.isNotEmpty(nodeXPathAndExpectedValuePairs)) {
			nodeXPathAndExpectedValuePairMap = new HashMap<>();

			for (String[] nodeXPathAndExpectedValuePair : nodeXPathAndExpectedValuePairs) {
				String nodeXPathQuery = nodeXPathAndExpectedValuePair[0];
				String expectedNodeValueRegex = nodeXPathAndExpectedValuePair[1];

				nodeXPathAndExpectedValuePairMap.put(nodeXPathQuery, expectedNodeValueRegex);
			}
		}

		return getSiteTree(url, depth, includeByNameRegex, excludeByNameRegex, nodeXPathAndExpectedValuePairMap);
	}

	@Deprecated
	@Override
	public SiteItem getSiteTree(String url, int depth, String includeByNameRegex, String excludeByNameRegex,
				    Map<String, String> nodeXPathAndExpectedValuePairs) {
		CompositeItemFilter compositeFilter = new CompositeItemFilter();

		if (CollectionUtils.isNotEmpty(defaultFilters)) {
			for (ItemFilter defaultFilter : defaultFilters) {
				compositeFilter.addFilter(defaultFilter);
			}
		}

		if (StringUtils.isNotEmpty(includeByNameRegex)) {
			compositeFilter.addFilter(new IncludeByNameItemFilter(includeByNameRegex));
		}
		if (StringUtils.isNotEmpty(excludeByNameRegex)) {
			compositeFilter.addFilter(new ExcludeByNameItemFilter(excludeByNameRegex));
		}

		if (MapUtils.isNotEmpty(nodeXPathAndExpectedValuePairs)) {
			for (Map.Entry<String, String> pair : nodeXPathAndExpectedValuePairs.entrySet()) {
				compositeFilter.addFilter(new ExpectedNodeValueItemFilter(pair.getKey(), pair.getValue()));
			}
		}

		Tree tree = storeService.findTree(getSiteContext().getContext(), null, url, depth, compositeFilter, null);
		if (tree != null) {
			return createItemWrapper(new Tree(tree));
		} else {
			return null;
		}
	}

	@Override
	public boolean exists(String path) {
		return storeService.exists(getSiteContext().getContext(), path);
	}

	protected SiteContext getSiteContext() {
		SiteContext siteContext = SiteContext.getCurrent();
		if (siteContext == null) {
			throw new IllegalStateException("No current site context found");
		}

		return siteContext;
	}

	protected SiteItem createItemWrapper(Item item) {
		return new DefaultSiteItem(item, modelFieldConverter, sortComparator);
	}

}
