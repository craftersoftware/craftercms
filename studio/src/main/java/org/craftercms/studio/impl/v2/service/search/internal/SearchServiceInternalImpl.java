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

package org.craftercms.studio.impl.v2.service.search.internal;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.collections4.MapUtils;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.tree.ImmutableNode;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.configuration.ServicesConfig;
import org.craftercms.studio.api.v1.to.FacetRangeTO;
import org.craftercms.studio.api.v1.to.FacetTO;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.service.search.SearchService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.impl.v1.util.ContentUtils;
import org.craftercms.studio.impl.v2.service.search.PermissionAwareSearchService;
import org.craftercms.studio.model.search.*;
import org.opensearch.client.json.JsonData;
import org.opensearch.client.opensearch._types.SortOrder;
import org.opensearch.client.opensearch._types.aggregations.*;
import org.opensearch.client.opensearch._types.query_dsl.BoolQuery;
import org.opensearch.client.opensearch._types.query_dsl.MatchQuery;
import org.opensearch.client.opensearch._types.query_dsl.RangeQuery;
import org.opensearch.client.opensearch._types.query_dsl.TextQueryType;
import org.opensearch.client.opensearch.core.SearchRequest;
import org.opensearch.client.opensearch.core.SearchResponse;
import org.opensearch.client.opensearch.core.search.Highlight;
import org.slf4j.Logger;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static java.lang.String.format;
import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toMap;
import static org.apache.commons.lang3.Strings.CS;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.*;
import static org.slf4j.LoggerFactory.getLogger;

/**
 * Internal implementation of {@link org.craftercms.studio.api.v2.service.search.SearchService}
 *
 * @author joseross
 */
public class SearchServiceInternalImpl implements SearchService {

	private final static Logger logger = getLogger(SearchServiceInternalImpl.class);
	public static final String CONFIG_KEY_FIELDS = "studio.search.fields.search";
	public static final String CONFIG_KEY_FACETS = "studio.search.facets";
	public static final String CONFIG_KEY_TYPES = "studio.search.types";

	public static final String CONFIG_KEY_NAME = "name";
	public static final String CONFIG_KEY_FIELD = "field";

	public static final String CONFIG_KEY_FACET_DATE = "date";
	public static final String CONFIG_KEY_FACET_MULTIPLE = "multiple";
	public static final String CONFIG_KEY_FACET_RANGES = "ranges";
	public static final String CONFIG_KEY_FACET_RANGE_LABEL = "label";
	public static final String CONFIG_KEY_FACET_RANGE_FROM = "from";
	public static final String CONFIG_KEY_FACET_RANGE_TO = "to";

	public static final String CONFIG_KEY_TYPE_MATCHES = "matches";

	public static final String CONFIG_KEY_FIELD_BOOST = "boost";

	public static final String FACET_RANGE_MIN = "min";
	public static final String FACET_RANGE_MAX = "max";

	public static final String DEFAULT_MIME_TYPE = "application/xml";

	public static final Pattern EXACT_MATCH_PATTERN = Pattern.compile(".*(\"([^\"]+)\").*");
	public static final Pattern PATH_MATCH_PATTERN = Pattern.compile("^[a-zA-Z0-9._/-]*$");

	/**
	 * Corresponds to 'index.max_result_window' default value
	 */
	public static final int MAX_RESULT_WINDOW = 10000;

	/**
	 * Name of the field for paths
	 */
	protected String pathFieldName;

	/**
	 * Name of the field for internal name
	 */
	protected String internalNameFieldName;

	/**
	 * Name of the field for last edit date
	 */
	protected String lastEditFieldName;

	/**
	 * Name of the field for last edit user
	 */
	protected String lastEditorFieldName;

	/**
	 * Name of the field for size
	 */
	protected String sizeFieldName;

	/**
	 * Name of the field for mimeType
	 */
	protected String mimeTypeName;

	/**
	 * List of fields to include during searching
	 */
	protected Map<String, String> searchFields;

	/**
	 * List of fields to include during highlighting
	 */
	protected String[] highlightFields;

	/**
	 * Number of characters to include for snippets
	 */
	protected int snippetSize;

	/**
	 * Number of snippets to generate for each file
	 */
	protected int numberOfSnippets;

	/**
	 * Default label used for unknown file types
	 */
	protected String defaultType;

	/**
	 * The Search service
	 */
	protected final PermissionAwareSearchService searchService;

	/**
	 * The Studio configuration
	 */
	protected final StudioConfiguration studioConfiguration;

	/**
	 * The site configuration
	 */
	protected final ServicesConfig servicesConfig;

	/**
	 * Configurations for facets
	 */
	protected Map<String, FacetTO> facets;

	/**
	 * Configurations for types
	 */
	protected Map<String, HierarchicalConfiguration<ImmutableNode>> types;
	private String keywordSplitRegex;

	@ConstructorProperties({"searchService", "studioConfiguration", "servicesConfig"})
	public SearchServiceInternalImpl(final PermissionAwareSearchService searchService, final StudioConfiguration studioConfiguration,
					 final ServicesConfig servicesConfig) {
		this.searchService = searchService;
		this.studioConfiguration = studioConfiguration;
		this.servicesConfig = servicesConfig;
	}

	/**
	 * Loads facets and type mapping from the global configuration
	 */
	public void init() {
		loadFieldsFromGlobalConfiguration();
		loadTypesFromGlobalConfiguration();
		loadFacetsFromGlobalConfiguration();
		loadConfigsFromGlobalConfiguration();
	}

	private void loadConfigsFromGlobalConfiguration() {
		this.pathFieldName = studioConfiguration.getProperty(SEARCH_PATH_FIELD_NAME);
		this.internalNameFieldName = studioConfiguration.getProperty(SEARCH_INTERNAL_NAME_FIELD_NAME);
		this.lastEditFieldName = studioConfiguration.getProperty(SEARCH_LAST_EDIT_FIELD_NAME);
		this.lastEditorFieldName = studioConfiguration.getProperty(SEARCH_LAST_EDITOR_FIELD_NAME);
		this.sizeFieldName = studioConfiguration.getProperty(SEARCH_SIZE_FIELD_NAME);
		this.mimeTypeName = studioConfiguration.getProperty(SEARCH_MIME_TYPE_FIELD_NAME);
		this.highlightFields = studioConfiguration.getArray(SEARCH_HIGHLIGHT_FIELDS, String.class);
		this.snippetSize = studioConfiguration.getProperty(SEARCH_SNIPPETS_SIZE, Integer.class);
		this.numberOfSnippets = studioConfiguration.getProperty(SEARCH_NUMBER_OF_SNIPPETS, Integer.class);
		this.defaultType = studioConfiguration.getProperty(SEARCH_DEFAULT_TYPE);
		this.keywordSplitRegex = studioConfiguration.getProperty(SEARCH_KEYWORD_SPLIT_REGEX);
	}

	protected String addBoosting(String field, float boosting) {
		return format("%s^%s", field, boosting);
	}

	protected void loadFieldsFromGlobalConfiguration() {
		searchFields = new TreeMap<>();

		List<HierarchicalConfiguration<ImmutableNode>> fieldsConfig =
			studioConfiguration.getSubConfigs(CONFIG_KEY_FIELDS);

		if (CollectionUtils.isNotEmpty(fieldsConfig)) {
			fieldsConfig.forEach(fieldConfig -> {
				String field = fieldConfig.getString(CONFIG_KEY_NAME);
				String boostedField = addBoosting(field, fieldConfig.getFloat(CONFIG_KEY_FIELD_BOOST));
				searchFields.put(field, boostedField);
			});
		}
	}

	/**
	 * Loads the facets from the global configuration
	 */
	protected void loadFacetsFromGlobalConfiguration() {
		facets = new HashMap<>();

		List<HierarchicalConfiguration<ImmutableNode>> facetsConfig =
			studioConfiguration.getSubConfigs(CONFIG_KEY_FACETS);

		if (CollectionUtils.isNotEmpty(facetsConfig)) {
			facetsConfig.forEach(facetConfig -> {
				FacetTO facet = new FacetTO();
				facet.setName(facetConfig.getString(CONFIG_KEY_NAME));
				facet.setField(facetConfig.getString(CONFIG_KEY_FIELD));
				facet.setDate(facetConfig.getBoolean(CONFIG_KEY_FACET_DATE, false));
				facet.setMultiple(facetConfig.getBoolean(CONFIG_KEY_FACET_MULTIPLE, false));

				List<HierarchicalConfiguration<ImmutableNode>> ranges =
					facetConfig.configurationsAt(CONFIG_KEY_FACET_RANGES);

				if (CollectionUtils.isNotEmpty(ranges)) {
					facet.setRanges(
						ranges.stream().map(rangeConfig -> {
								FacetRangeTO range = new FacetRangeTO();
								range.setLabel(rangeConfig.getString(CONFIG_KEY_FACET_RANGE_LABEL));
								if (rangeConfig.containsKey(CONFIG_KEY_FACET_RANGE_FROM) &&
									rangeConfig.containsKey(CONFIG_KEY_FACET_RANGE_TO)) {
									range.setFrom(rangeConfig.getString(CONFIG_KEY_FACET_RANGE_FROM));
									range.setTo(rangeConfig.getString(CONFIG_KEY_FACET_RANGE_TO));
								} else if (rangeConfig.containsKey(CONFIG_KEY_FACET_RANGE_FROM)) {
									range.setFrom(rangeConfig.getString(CONFIG_KEY_FACET_RANGE_FROM));
								} else {
									range.setTo(rangeConfig.getString(CONFIG_KEY_FACET_RANGE_TO));
								}
								return range;
							})
							.collect(Collectors.toList())
					);
				}
				facets.put(facet.getName(), facet);
			});
		}
	}

	/**
	 * Loads the type mapping from the global configuration
	 */
	protected void loadTypesFromGlobalConfiguration() {
		types = new LinkedHashMap<>();

		List<HierarchicalConfiguration<ImmutableNode>> typesConfig =
			studioConfiguration.getSubConfigs(CONFIG_KEY_TYPES);

		typesConfig.forEach(type -> types.put(type.getString(CONFIG_KEY_NAME), type));

	}

	/**
	 * Maps the information from OpenSearch for a single {@link SearchResultItem}
	 *
	 * @param source     the fields returned by OpenSearch
	 * @param highlights the highlights returned by OpenSearch
	 * @return the search item object
	 */
	protected SearchResultItem processSearchHit(String siteId, Map<String, Object> source, Map<String, List<String>> highlights,
						    List<String> additionalFields) {
		SearchResultItem item = new SearchResultItem();
		item.setPath((String) source.get(pathFieldName));
		item.setName((String) source.get(internalNameFieldName));
		if (source.get(lastEditFieldName) != null) {
			item.setLastModified(Instant.parse((String) source.get(lastEditFieldName)));
		}
		if (source.get(lastEditorFieldName) != null) {
			item.setLastModifier(source.get(lastEditorFieldName).toString());
		}
		if (source.get(sizeFieldName) != null) {
			item.setSize(Long.parseLong(source.get(sizeFieldName).toString()));
		}
		item.setType(getItemType(source));
		item.setMimeType(getMimeType(source));
		item.setSnippets(getItemSnippets(highlights));
		item.setAdditionalFields(additionalFields.stream().collect(toMap(identity(), source::get)));
		try {
			item.setPreviewUrl(ContentUtils.getPreviewUrl(servicesConfig, siteId, item.getPath()));
		} catch (SiteNotFoundException e) {
			logger.error("Error getting preview url for item {}, site not found", item.getPath(), e);
		}
		return item;
	}

	/**
	 * Adds the required filters based on the given parameters
	 *
	 * @param query      the query to update
	 * @param params     the parameters to add
	 * @param siteFacets the facets configured for the site
	 */
	@SuppressWarnings("unchecked")
	protected void updateFilters(BoolQuery.Builder query, SearchParams params, Map<String, FacetTO> siteFacets) {
		BoolQuery.Builder builder = params.isOrOperator() ? new BoolQuery.Builder() : query;
		params.getFilters().forEach((filter, value) -> {
			FacetTO facetConfig;
			if (MapUtils.isNotEmpty(siteFacets)) {
				facetConfig = siteFacets.getOrDefault(filter, facets.get(filter));
			} else {
				facetConfig = facets.get(filter);
			}
			if (Objects.nonNull(facetConfig)) {
				String fieldName = facetConfig.getField();
				if (facetConfig.isRange()) {
					RangeQuery.Builder rangeQuery = new RangeQuery.Builder();
					Map<String, Object> range = (Map<String, Object>) value;
					rangeQuery
						.field(fieldName);
					Object min = range.get(FACET_RANGE_MIN);
					if (min != null) {
						rangeQuery.gte(JsonData.of(min));
					}
					Object max = range.get(FACET_RANGE_MAX);
					if (max != null) {
						rangeQuery.lt(JsonData.of(max));
					}

					if (params.isOrOperator()) {
						builder.should(rangeQuery.build().toQuery());
					} else {
						builder.filter(rangeQuery.build().toQuery());
					}
				} else if (facetConfig.isMultiple() && value instanceof List) {
					List<Object> values = (List<Object>) value;
					BoolQuery.Builder orQuery = new BoolQuery.Builder();
					values.forEach(val -> orQuery.should(s -> s
						.match(m -> m
							.field(fieldName)
							.query(v -> v
								.stringValue(val.toString())
							)
						)
					));
					BoolQuery.Builder qb = new BoolQuery.Builder().must(orQuery.build().toQuery());
					if (params.isOrOperator()) {
						builder.should(qb.build().toQuery());
					} else {
						builder.filter(qb.build().toQuery());
					}
				} else {
					MatchQuery qb = MatchQuery.of(m -> m
						.field(fieldName)
						.query(v -> v
							.stringValue(value.toString())
						)
					);
					if (params.isOrOperator()) {
						builder.should(qb.toQuery());
					} else {
						builder.filter(qb.toQuery());
					}
				}
			}
		});
		if (params.isOrOperator()) {
			query.filter(BoolQuery.of(b -> b
				.must(builder.build().toQuery())).toQuery()
			);
		}
	}

	/**
	 * Adds the configured highlighting to the given itemListBuilder
	 *
	 * @param builder the search itemListBuilder to update
	 */
	protected void updateHighlighting(SearchRequest.Builder builder) {
		Highlight.Builder highlight = new Highlight.Builder();
		for (String field : highlightFields) {
			highlight.fields(field, f -> f
				.fragmentSize(snippetSize)
				.numberOfFragments(numberOfSnippets)
			);
		}
		builder.highlight(highlight.build());
	}

	/**
	 * Maps the OpenSearch {@link SearchResponse} to a {@link SearchResult} object
	 *
	 * @param response the response to map
	 * @return the search result object
	 */
	@SuppressWarnings("unchecked,rawtypes")
	protected SearchResult processResults(String siteId, SearchResponse<Map> response, Map<String, FacetTO> siteFacets,
					      List<String> additionalFields) {
		SearchResult result = new SearchResult();
		result.setTotal(response.hits().total().value());

		List<SearchResultItem> items = response.hits().hits().stream()
			.filter(hit -> Objects.nonNull(hit.source()))
			.map(hit -> processSearchHit(siteId, hit.source(), hit.highlight(), additionalFields))
			.collect(Collectors.toList());

		result.setItems(items);

		result.setFacets(processAggregations(response, siteFacets));

		return result;
	}

	private void validateResultWindow(final int offset, final int limit) throws InvalidParametersException {
		int resultWindow = offset + limit;
		// Here we check if either window is exceeded or (offset + limit) caused an int overflow
		if (resultWindow > MAX_RESULT_WINDOW || resultWindow < offset) {
			throw new InvalidParametersException("Maximum supported result window (offset + limit) is " + MAX_RESULT_WINDOW);
		}
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	@SuppressWarnings("rawtypes")
	public SearchResult search(final String siteId, final SearchParams params, final int maxExpansions)
		throws ServiceLayerException {
		validateResultWindow(params.getOffset(), params.getLimit());

		Map<String, FacetTO> siteFacets = servicesConfig.getFacets(siteId);
		BoolQuery.Builder queryBuilder = new BoolQuery.Builder();
		Map<String, String> boostedFields = new TreeMap<>(searchFields);
		servicesConfig.getSearchFields(siteId).forEach((field, value) ->
			boostedFields.put(field, addBoosting(field, value)));

		// A Lucene query, this was added to support the custom query for content monitoring, could be replaced later
		if (StringUtils.isNotEmpty(params.getQuery())) {
			queryBuilder.must(m -> m
				.queryString(q -> q
					.query(params.getQuery())
				)
			);
		}

		// Do not replace special characters, this will allow ES to handle them per field
		String rawKeywords = params.getKeywords();

		if (StringUtils.isNotEmpty(rawKeywords)) {
			// Check if the user requests an exact match with quotes
			Matcher matcher = EXACT_MATCH_PATTERN.matcher(rawKeywords);
			if (matcher.matches()) {
				// A match query without synonyms and no fuzziness is as close as we can get to an exact match
				queryBuilder.must(q -> q
					.multiMatch(m -> m
						.query(matcher.group(2))
						.autoGenerateSynonymsPhraseQuery(false)
						.type(TextQueryType.Phrase)
						.fuzzyTranspositions(false)
						.fields(List.copyOf(boostedFields.values()))
					)
				);
				// Remove the quoted section from the keywords to continue processing
				rawKeywords = CS.remove(rawKeywords, matcher.group(1));
			}


			if (StringUtils.isNotEmpty(rawKeywords)) {
				// Search for the combination of all keywords and a wildcard on the last one
				// (no custom fields in this one because it only works on text fields)
				String finalRawKeywords = rawKeywords;
				queryBuilder.should(q -> q
					.multiMatch(m -> m
						.query(finalRawKeywords)
						.type(TextQueryType.PhrasePrefix)
						.maxExpansions(maxExpansions)
						.fields(List.copyOf(searchFields.values()))
					)
				);

				String[] keywords = rawKeywords.split(keywordSplitRegex);
				if (ArrayUtils.isNotEmpty(keywords)) {
					for (String keyword : keywords) {
						queryBuilder
							// Search in the configured fields
							.should(q -> q
								.multiMatch(m -> m
									.query(keyword)
									.fields(List.copyOf(boostedFields.values()))
								)
							);

						if (PATH_MATCH_PATTERN.matcher(keyword).matches()) {
							// Search in the path, regex is required because the path is indexed as string
							queryBuilder
								.should(q -> q
									.regexp(r -> r
										.field(pathFieldName)
										.value(format(".*%s.*", keyword))
									)
								);
						}
					}
				}
			}
		}

		if (StringUtils.isNotEmpty(params.getPath())) {
			queryBuilder.filter(q -> q
				.regexp(r -> r
					.field(pathFieldName)
					.value(params.getPath())
				)
			);
		}

		if (MapUtils.isNotEmpty(params.getFilters())) {
			updateFilters(queryBuilder, params, siteFacets);
		}

		// We need to copy it because the itemListBuilder is immutable and there is no other way to check the queries
		BoolQuery query = queryBuilder.build();
		BoolQuery.Builder finalBuilder = new BoolQuery.Builder()
			.must(query.must())
			.mustNot(query.mustNot())
			.should(query.should())
			.filter(query.filter());

		if (CollectionUtils.isNotEmpty(query.should()) &&
			(CollectionUtils.isNotEmpty(query.must()) || CollectionUtils.isNotEmpty(query.filter()))) {
			finalBuilder.minimumShouldMatch("1");
		}

		SearchRequest.Builder builder = new SearchRequest.Builder()
			.query(finalBuilder.build().toQuery())
			.from(params.getOffset())
			.size(params.getLimit())
			.sort(s -> s
				.field(f -> f
					.field(getSortFieldName(params.getSortBy()))
					.order(SortOrder._DESERIALIZER.parse(params.getSortOrder().toLowerCase()))
				)
			);

		if (ArrayUtils.isNotEmpty(highlightFields)) {
			updateHighlighting(builder);
		}

		buildAggregations(builder, siteFacets);

		SearchRequest request = builder.build();

		try {
			SearchResponse<Map> response = searchService.search(siteId, request, Map.class);
			return processResults(siteId, response, siteFacets, params.getAdditionalFields());
		} catch (IOException e) {
			throw new ServiceLayerException("Error connecting to OpenSearch", e);
		} catch (Exception e) {
			throw new ServiceLayerException("Error executing search in OpenSearch", e);
		}
	}

	/**
	 * Adds the aggregations needed to the given itemListBuilder
	 *
	 * @param builder    the search source itemListBuilder
	 * @param siteFacets the facets from the site configuration
	 */
	protected void buildAggregations(SearchRequest.Builder builder, Map<String, FacetTO> siteFacets) {
		Map<String, FacetTO> mergedFacets = new HashMap<>(facets);
		if (MapUtils.isNotEmpty(siteFacets)) {
			mergedFacets.putAll(siteFacets);
		}
		mergedFacets.forEach((name, facet) -> {
			if (facet.isRange() && facet.isDate()) {
				DateRangeAggregation.Builder aggregation = new DateRangeAggregation.Builder()
					.field(facet.getField())
					.keyed(true);
				for (FacetRangeTO range : facet.getRanges()) {
					aggregation.ranges(r -> {
						r.key(range.getLabel());
						if (range.getFrom() != null) {
							r.from(f -> f
								.expr(range.getFrom())
							);
						}
						if (range.getTo() != null) {
							r.to(t -> t
								.expr(range.getTo())
							);
						}
						return r;
					});
				}

				builder.aggregations(name, aggregation.build().toAggregation());
			} else if (facet.isRange()) {
				RangeAggregation.Builder aggregation = new RangeAggregation.Builder()
					.field(facet.getField())
					.keyed(true);
				for (FacetRangeTO range : facet.getRanges()) {
					aggregation.ranges(r -> {
						r.key(range.getLabel());
						if (range.getFrom() != null) {
							r.from(JsonData.of(range.getFrom()));
						}
						if (range.getTo() != null) {
							r.to(JsonData.of(range.getTo()));
						}
						return r;
					});
				}

				builder.aggregations(name, aggregation.build().toAggregation());
			} else {
				builder.aggregations(name, a -> a
					.terms(t -> t
						.field(facet.getField())
						.minDocCount(1L)
						.size(1000)
					)
				);
			}
		});
	}

	/**
	 * Maps the field name from the configured facets, if it's not found returns the same value.
	 *
	 * @param name the facet name
	 * @return name of the field to sort
	 */
	protected String getSortFieldName(String name) {
		String field = name;
		if (facets.containsKey(field)) {
			field = facets.get(field).getField();
		}
		return field;
	}

	/**
	 * Maps the OpenSearch aggregations to {@link SearchFacet} objects
	 *
	 * @param response the OpenSearch response to map
	 * @return the list of search facet objects
	 */
	@SuppressWarnings("unchecked, rawtypes")
	private List<SearchFacet> processAggregations(final SearchResponse<Map> response, Map<String, FacetTO> siteFacets) {
		Map<String, FacetTO> mergedFacets = new HashMap<>(facets);
		if (MapUtils.isNotEmpty(siteFacets)) {
			mergedFacets.putAll(siteFacets);
		}
		List<SearchFacet> facets = new LinkedList<>();
		Map<String, Aggregate> aggregations = response.aggregations();
		if (aggregations != null) {
			aggregations.forEach((name, aggregation) -> {
				SearchFacet facet = new SearchFacet();
				facet.setName(name);
				facet.setMultiple(mergedFacets.get(name).isMultiple());
				Map values = new LinkedHashMap();
				if (aggregation.isSterms()) {
					StringTermsAggregate terms = aggregation.sterms();
					terms.buckets().array().forEach(bucket ->
						values.put(bucket.key(), bucket.docCount()));
				} else if (aggregation.isRange()) {
					RangeAggregate range = aggregation.range();
					for (Map.Entry<String, RangeBucket> entry : range.buckets().keyed().entrySet()) {
						RangeBucket bucket = entry.getValue();
						SearchFacetRange rangeValues = new SearchFacetRange();
						rangeValues.setCount(bucket.docCount());
						if (bucket.from() != null) {
							rangeValues.setFrom(bucket.from());
						}
						if (bucket.to() != null) {
							rangeValues.setTo(bucket.to());
						}
						values.put(entry.getKey(), rangeValues);
					}
					facet.setRange(true);
				} else if (aggregation.isDateRange()) {
					DateRangeAggregate range = aggregation.dateRange();
					for (Map.Entry<String, RangeBucket> entry : range.buckets().keyed().entrySet()) {
						RangeBucket bucket = entry.getValue();
						SearchFacetRange rangeValues = new SearchFacetRange();
						rangeValues.setCount(bucket.docCount());
						if (bucket.from() != null && bucket.fromAsString() != null) {
							Instant instant = Instant.parse(bucket.fromAsString());
							LocalDate date = LocalDateTime.ofInstant(instant, ZoneOffset.UTC).toLocalDate();
							rangeValues.setFrom(date.toString());
						}
						if (bucket.to() != null && bucket.toAsString() != null) {
							Instant instant2 = Instant.parse(bucket.toAsString());
							LocalDate date2 = LocalDateTime.ofInstant(instant2, ZoneOffset.UTC).toLocalDate();
							rangeValues.setTo(date2.toString());
						}
						values.put(entry.getKey(), rangeValues);
					}
					facet.setRange(true);
					facet.setDate(true);
				}
				if (MapUtils.isNotEmpty(values)) {
					facet.setValues(values);
					facets.add(facet);
				}
			});
		}
		return facets;
	}

	/**
	 * Maps the item type for the given source based on the configuration
	 *
	 * @param source the source to map
	 * @return the item type
	 */
	protected String getItemType(Map<String, Object> source) {
		if (MapUtils.isNotEmpty(types)) {
			for (HierarchicalConfiguration<ImmutableNode> typeConfig : types.values()) {
				String fieldName = typeConfig.getString(CONFIG_KEY_FIELD);
				if (source.containsKey(fieldName)) {
					String fieldValue = source.get(fieldName).toString();
					if (StringUtils.isNotEmpty(fieldValue) &&
						fieldValue.matches(typeConfig.getString(CONFIG_KEY_TYPE_MATCHES))) {
						return typeConfig.getString(CONFIG_KEY_NAME);
					}
				}
			}
		}
		return defaultType;
	}

	/**
	 * Maps the OpenSearch highlighting to simple text snippets
	 *
	 * @param highlights the highlighting to map
	 * @return the list of snippets
	 */
	protected List<String> getItemSnippets(Map<String, List<String>> highlights) {
		if (MapUtils.isNotEmpty(highlights)) {
			List<String> snippets = new LinkedList<>();
			highlights.values().forEach(snippets::addAll);
			return snippets;
		}
		return null;
	}

	/**
	 * Finds the mime type for the given item
	 *
	 * @param source the item to map
	 * @return the mime type
	 */
	protected String getMimeType(Map<String, Object> source) {
		if (source.containsKey(mimeTypeName)) {
			return source.get(mimeTypeName).toString();
		} else {
			return DEFAULT_MIME_TYPE;
		}
	}

}
