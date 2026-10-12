/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

package org.craftercms.engine.graphql.impl.fetchers;

import graphql.language.*;
import graphql.schema.DataFetcher;
import graphql.schema.DataFetchingEnvironment;
import org.apache.commons.collections.MapUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.search.opensearch.client.OpenSearchClientWrapper;
import org.opensearch.client.json.JsonData;
import org.opensearch.client.opensearch._types.SortOrder;
import org.opensearch.client.opensearch._types.query_dsl.BoolQuery;
import org.opensearch.client.opensearch._types.query_dsl.Query;
import org.opensearch.client.opensearch.core.SearchResponse;
import org.opensearch.client.opensearch.core.search.Hit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StopWatch;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

import static org.craftercms.engine.graphql.SchemaUtils.*;

/**
 * Implementation of {@link DataFetcher} that queries OpenSearch to retrieve content based on a content type.
 * @author joseross
 * @since 3.1
 */
@SuppressWarnings("unchecked, rawtypes")
public class ContentTypeBasedDataFetcher extends RequestAwareDataFetcher<Object> {

    private static final Logger logger = LoggerFactory.getLogger(ContentTypeBasedDataFetcher.class);

    private static final String QUERY_FIELD_NAME_CONTENT_TYPE = getOriginalName(FIELD_NAME_CONTENT_TYPE);

    // Lucene regexes always match the entire string, no need to specify ^ or $
    public static final String CONTENT_TYPE_REGEX_PAGE = "/?page/.*";
    public static final String CONTENT_TYPE_REGEX_COMPONENT = "/?component/.*";
    public static final String COMPONENT_INCLUDE_REGEX = ".*\\.item\\.component";

    public static final String DEFAULT_IGNORED_FIELD = "__typename";

    /**
     * The default value for the 'limit' argument
     */
    protected int defaultLimit;

    /**
     * The default value for the 'sortBy' argument
     */
    protected String defaultSortField;

    /**
     * The default value for the 'sortOrder' argument
     */
    protected String defaultSortOrder;

    /**
     * The instance of {@link OpenSearchClientWrapper}
     */
    protected OpenSearchClientWrapper searchClient;

    /**
     * The GraphQL fields that should not be added to the OpenSearch query includes
     */
    protected Set<String> ignoredFields;

    public ContentTypeBasedDataFetcher(final int defaultLimit, final String defaultSortField, final String defaultSortOrder,
                                       final OpenSearchClientWrapper searchClient) {
        this(defaultLimit, defaultSortField, defaultSortOrder, searchClient, new String[] { DEFAULT_IGNORED_FIELD });
    }

    public ContentTypeBasedDataFetcher(final int defaultLimit, final String defaultSortField, final String defaultSortOrder,
                                       final OpenSearchClientWrapper searchClient, final String[] ignoredFields) {
        this.defaultLimit = defaultLimit;
        this.defaultSortField = defaultSortField;
        this.defaultSortOrder = defaultSortOrder;
        this.searchClient = searchClient;
        this.ignoredFields = ignoredFields == null ? Collections.emptySet() :
                Arrays.stream(ignoredFields)
                        .map(StringUtils::trim)
                        .filter(StringUtils::isNotEmpty)
                        .collect(Collectors.toSet());
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Object doGet(final DataFetchingEnvironment env) throws IOException {
        Field field = env.getMergedField().getSingleField();
        String fieldName = field.getName();

        // Get arguments for pagination & sorting
        int offset = Optional.ofNullable(env.<Integer>getArgument(ARG_NAME_OFFSET)).orElse(0);
        int limit = Optional.ofNullable(env.<Integer>getArgument(ARG_NAME_LIMIT)).orElse(defaultLimit);
        String sortBy = Optional.ofNullable(env.<String>getArgument(ARG_NAME_SORT_BY)).orElse(defaultSortField);
        String sortOrder = Optional.ofNullable(env.<String>getArgument(ARG_NAME_SORT_ORDER)).orElse(defaultSortOrder);

        Set<String> queryFieldIncludes = new HashSet<>();
        // Add content-type to includes, we might need it for a GraphQL TypeResolver
        queryFieldIncludes.add(QUERY_FIELD_NAME_CONTENT_TYPE);

        List<Map<String, Object>> items = new LinkedList<>();
        Map<String, Object> result = new HashMap<>(2);
        result.put(FIELD_NAME_ITEMS, items);

        // Setup the ES query
        BoolQuery.Builder query = new BoolQuery.Builder();

        StopWatch watch = new StopWatch(field.getName() + " - " + field.getAlias());

        watch.start("build filters");

        // Filter by the content-type
        switch (fieldName) {
            case FIELD_NAME_CONTENT_ITEMS:
                query.filter(f -> f
                    .exists(e -> e
                        .field(QUERY_FIELD_NAME_CONTENT_TYPE)
                    )
                );
                break;
            case FIELD_NAME_PAGES:
                query.filter(f -> f
                    .regexp(r -> r
                        .field(QUERY_FIELD_NAME_CONTENT_TYPE)
                        .value(CONTENT_TYPE_REGEX_PAGE)
                    )
                );
                break;
            case FIELD_NAME_COMPONENTS:
                query.filter(f -> f
                    .regexp(r -> r
                        .field(QUERY_FIELD_NAME_CONTENT_TYPE)
                        .value(CONTENT_TYPE_REGEX_COMPONENT)
                    )
                );
                break;
            default:
                // Get the content-type name from the field name
                query.filter(f -> f
                    .term(t -> t
                        .field(QUERY_FIELD_NAME_CONTENT_TYPE)
                        .value(v -> v
                            .stringValue(getContentTypeOriginalName(fieldName))
                        )
                    )
                );
                break;
        }

        // Check the selected fields to build the ES query
        Optional<Field> itemsField = field.getSelectionSet().getSelections()
                            .stream()
                            .map(f -> (Field) f)
                            .filter(f -> f.getName().equals(FIELD_NAME_ITEMS))
                            .findFirst();
        if (itemsField.isPresent()) {
            List<Selection> selections = itemsField.get().getSelectionSet().getSelections();
            selections.forEach(selection -> processSelection(StringUtils.EMPTY, selection, query, queryFieldIncludes,
             env));
        }
        watch.stop();

        logger.debug("Executing query: {}", query);

        watch.start("searching items");
        SearchResponse<Map> response = searchClient.search(r -> r
            .query(Query.of(q -> q
                .bool(query.build())
            ))
            // Only fetch the selected fields for better performance
            .source(s -> s
                .filter(f -> f
                    .includes(new ArrayList<>(queryFieldIncludes))
                )
            )
            .from(offset)
            .size(limit)
            .sort(s -> s
                .field(f -> f
                    .field(sortBy)
                    .order(SortOrder._DESERIALIZER.parse(sortOrder.toLowerCase()))
                )
            ),
        Map.class);
        watch.stop();

        watch.start("processing items");
        result.put(FIELD_NAME_TOTAL, response.hits().total().value());
        if (response.hits().total().value() > 0) {
            for(Hit<Map> hit :  response.hits().hits()) {
                items.add(fixItems(hit.source()));
            }
        }
        watch.stop();

        if (logger.isTraceEnabled()) {
            logger.trace(watch.prettyPrint());
        }

        return result;
    }

    /**
     * Adds the required filters to the ES query for the given field
     */
    protected void processSelection(String path, Selection currentSelection, BoolQuery.Builder query,
                                    Set<String> queryFieldIncludes, DataFetchingEnvironment env)  {
        if (currentSelection instanceof Field) {
            // If the current selection is a field
            Field currentField = (Field) currentSelection;

            // Fields in the list of ignored fields are not included in the query, but their filters still apply
            boolean ignored = ignoredFields.contains(currentField.getName());
            // Get the original field name
            String propertyName = getOriginalName(currentField.getName());
            // Build the ES-friendly path
            String fullPath = StringUtils.isEmpty(path)? propertyName : path + "." + propertyName;

            // If the field has sub selection
            if (Objects.nonNull(currentField.getSelectionSet())) {
                if (ignored) {
                    return;
                }
                // If the field is a flattened component
                if (fullPath.matches(COMPONENT_INCLUDE_REGEX)) {
                    // Include the 'content-type' field to make sure the type can be resolved during runtime
                    String contentTypeFieldPath = fullPath + "." + QUERY_FIELD_NAME_CONTENT_TYPE;
                    if (!queryFieldIncludes.contains(contentTypeFieldPath)) {
                        queryFieldIncludes.add(contentTypeFieldPath);
                    }
                }

                // Process recursively and finish
                currentField.getSelectionSet().getSelections()
                    .forEach(selection -> processSelection(fullPath, selection, query, queryFieldIncludes, env));
                return;
            }

            if (!ignored) {
                // Add the field to the list
                logger.debug("Adding selected field '{}' to query", fullPath);
                queryFieldIncludes.add(fullPath);
            }

            // Check the filters to build the ES query
            Optional<Argument> arg =
                currentField.getArguments().stream().filter(a -> a.getName().equals(FILTER_NAME)).findFirst();
            if (arg.isPresent()) {
                logger.debug("Adding filters for field {}", fullPath);
                Value<?> argValue = arg.get().getValue();
                if (argValue instanceof ObjectValue) {
                    List<ObjectField> filters = ((ObjectValue) argValue).getObjectFields();
                    filters.forEach((filter) -> addFieldFilterFromObjectField(fullPath, filter, query, env));
                } else if (argValue instanceof VariableReference &&
                        env.getVariables().containsKey(((VariableReference) argValue).getName())) {
                    Map<String, Object> map =
                            (Map<String, Object>) env.getVariables().get(((VariableReference) argValue).getName());
                    map.entrySet().forEach(filter -> addFieldFilterFromMapEntry(fullPath, filter, query, env));
                }
            }
        } else if (currentSelection instanceof InlineFragment) {
            // If the current selection is an inline fragment, process recursively
            InlineFragment fragment = (InlineFragment) currentSelection;
            fragment.getSelectionSet().getSelections()
                .forEach(selection -> processSelection(path, selection, query, queryFieldIncludes, env));
        } else if (currentSelection instanceof FragmentSpread) {
            // If the current selection is a fragment spread, find the fragment and process recursively
            FragmentSpread fragmentSpread = (FragmentSpread) currentSelection;
            FragmentDefinition fragmentDefinition = env.getFragmentsByName().get(fragmentSpread.getName());
            fragmentDefinition.getSelectionSet().getSelections()
                .forEach(selection -> processSelection(path, selection, query, queryFieldIncludes, env));
        }
    }

    protected void addFieldFilterFromObjectField(String path, ObjectField filter, BoolQuery.Builder query,
                                                 DataFetchingEnvironment env) {
        boolean isVariable = filter.getValue() instanceof VariableReference;
        switch (filter.getName()) {
            case ARG_NAME_NOT:
                BoolQuery.Builder notQueryBuilder = new BoolQuery.Builder();
                if(isVariable) {
                    ((List<Map<String, Object>>) env.getVariables()
                            .get(((VariableReference) filter.getValue()).getName()))
                            .forEach(notFilter -> notFilter.entrySet()
                                    .forEach(entry -> addFieldFilterFromMapEntry(path, entry, notQueryBuilder, env)));
                } else {
                    ((ArrayValue) filter.getValue()).getValues()
                            .forEach(notFilter -> ((ObjectValue) notFilter).getObjectFields()
                                    .forEach(notField -> addFieldFilterFromObjectField(path, notField, notQueryBuilder, env)));
                }
                BoolQuery notQuery = notQueryBuilder.build();
                if (!notQuery.filter().isEmpty()) {
                    notQuery.filter().forEach(query::mustNot);
                }
                break;
            case ARG_NAME_AND:
                if (isVariable) {
                    ((List<Map<String, Object>>) env.getVariables()
                            .get(((VariableReference) filter.getValue()).getName()))
                            .forEach(andFilter -> andFilter.entrySet()
                                    .forEach(entry -> addFieldFilterFromMapEntry(path, entry, query, env)));
                } else {
                    ((ArrayValue) filter.getValue()).getValues()
                            .forEach(andFilter -> ((ObjectValue) andFilter).getObjectFields()
                                    .forEach(andField -> addFieldFilterFromObjectField(path, andField, query, env)));
                }
                break;
            case ARG_NAME_OR:
                BoolQuery.Builder tempQueryBuilder = new BoolQuery.Builder();
                if (isVariable) {
                    ((List<Map<String, Object>>) env.getVariables()
                            .get(((VariableReference) filter.getValue()).getName()))
                            .forEach(orFilter -> orFilter.entrySet()
                                    .forEach(entry -> addFieldFilterFromMapEntry(path, entry, tempQueryBuilder, env)));
                } else {
                    ((ArrayValue) filter.getValue()).getValues().forEach(orFilter ->
                            ((ObjectValue) orFilter).getObjectFields()
                                    .forEach(orField -> addFieldFilterFromObjectField(path, orField, tempQueryBuilder, env)));
                }
                BoolQuery tempQuery = tempQueryBuilder.build();
                if (!tempQuery.filter().isEmpty()) {
                    BoolQuery.Builder orQuery = new BoolQuery.Builder();
                    tempQuery.filter().forEach(orQuery::should);
                    query.filter(f -> f
                        .bool(b -> b
                            .must(Query.of(q -> q
                                .bool(orQuery.build())
                            ))
                        )
                    );
                }
                break;
            default:
                Query builder = getFilterQueryFromObjectField(path, filter, env);
                if (builder != null) {
                    query.filter(builder);
                }
        }
    }

    protected void addFieldFilterFromMapEntry(String path, Map.Entry<String, Object> filter, BoolQuery.Builder query,
                                              DataFetchingEnvironment env) {
        if (filter.getValue() instanceof List) {
            List<Map<String, Object>> actualFilters = (List<Map<String, Object>>) filter.getValue();
            switch (filter.getKey()) {
                case ARG_NAME_NOT:
                    BoolQuery.Builder notQueryBuilder = new BoolQuery.Builder();
                    actualFilters.forEach(notFilter -> notFilter.entrySet()
                            .forEach(notField -> addFieldFilterFromMapEntry(path, notField, notQueryBuilder, env)));
                    BoolQuery notQuery = notQueryBuilder.build();
                    notQuery.filter().forEach(query::mustNot);
                    break;
                case ARG_NAME_AND:
                    actualFilters.forEach(andFilter -> andFilter.entrySet()
                            .forEach(andField -> addFieldFilterFromMapEntry(path, andField, query, env)));
                    break;
                case ARG_NAME_OR:
                    BoolQuery.Builder tempQueryBuilder = new BoolQuery.Builder();
                    BoolQuery.Builder orQueryBuilder = new BoolQuery.Builder();
                    actualFilters.forEach(orFilter -> orFilter.entrySet()
                            .forEach(orField -> addFieldFilterFromMapEntry(path, orField, tempQueryBuilder, env)));
                    BoolQuery tempQuery = tempQueryBuilder.build();
                    tempQuery.filter().forEach(orQueryBuilder::should);
                    BoolQuery orQuery = orQueryBuilder.build();
                    query.filter(f -> f
                        .bool(b -> b
                            .must(Query.of(q -> q
                                .bool(orQuery)
                            ))
                        )
                    );
                    break;
                default:
                    // never happens
            }
        } else {
            query.filter(getFilterQueryFromMapEntry(path, filter));
        }
    }

    protected Query getFilterQueryFromObjectField(String fieldPath, ObjectField filter,
                                                         DataFetchingEnvironment env) {
        Object value = getRealValue(filter.getValue(), env);
        if (value == null) {
            return null;
        }
        switch (filter.getName()) {
            case ARG_NAME_EQUALS:
                return Query.of(q -> q
                    .term(t -> t
                        .field(fieldPath)
                        .value(v -> v
                            .stringValue(value.toString())
                        )
                    )
                );
            case ARG_NAME_MATCHES:
                return Query.of(q -> q
                    .match(m -> m
                        .field(fieldPath)
                        .query(v -> v
                            .stringValue(value.toString())
                        )
                    )
                );
            case ARG_NAME_REGEX:
                return Query.of(q -> q
                    .regexp(r -> r
                        .field(fieldPath)
                        .value(value.toString())
                    )
                );
            case ARG_NAME_LT:
                return Query.of(q -> q
                    .range(r -> r
                        .field(fieldPath)
                        .lt(JsonData.of(value))
                    )
                );
            case ARG_NAME_GT:
                return Query.of(q -> q
                    .range(r -> r
                        .field(fieldPath)
                        .gt(JsonData.of(value))
                    )
                );
            case ARG_NAME_LTE:
                return Query.of(q -> q
                    .range(r -> r
                        .field(fieldPath)
                        .lte(JsonData.of(value))
                    )
                );
            case ARG_NAME_GTE:
                return Query.of(q -> q
                    .range(r -> r
                        .field(fieldPath)
                        .gte(JsonData.of(filter.getValue()))
                    )
                );
            case ARG_NAME_EXISTS:
                boolean exists = (boolean) value;
                if (exists) {
                    return Query.of(q -> q
                        .exists(e -> e
                            .field(fieldPath)
                        )
                    );
                } else {
                    return Query.of(q -> q
                        .bool(b -> b
                            .mustNot(n -> n
                                .exists(e -> e
                                    .field(fieldPath)
                                )
                            )
                        )
                    );
                }
            default:
                // never happens
                return null;
        }
    }

    protected Query getFilterQueryFromMapEntry(String fieldPath, Map.Entry<String, Object> filter) {
        switch (filter.getKey()) {
            case ARG_NAME_EQUALS:
                return Query.of(q -> q
                    .term(t -> t
                        .field(fieldPath)
                        .value(v -> v
                            .stringValue(filter.getValue().toString())
                        )
                    )
                );
            case ARG_NAME_MATCHES:
                return Query.of(q -> q
                    .match(m -> m
                        .field(fieldPath)
                        .query(v -> v
                            .stringValue(filter.getValue().toString())
                        )
                    )
                );
            case ARG_NAME_REGEX:
                return Query.of(q -> q
                    .regexp(r -> r
                        .field(fieldPath)
                        .value(filter.getValue().toString())
                    )
                );
            case ARG_NAME_LT:
                return Query.of(q -> q
                    .range(r -> r
                        .field(fieldPath)
                        .lt(JsonData.of(filter.getValue()))
                    )
                );
            case ARG_NAME_GT:
                return Query.of(q -> q
                    .range(r -> r
                        .field(fieldPath)
                        .gt(JsonData.of(filter.getValue()))
                    )
                );
            case ARG_NAME_LTE:
                return Query.of(q -> q
                    .range(r -> r
                        .field(fieldPath)
                        .lte(JsonData.of(filter.getValue()))
                    )
                );
            case ARG_NAME_GTE:
                return Query.of(q -> q
                    .range(r -> r
                        .field(fieldPath)
                        .gte(JsonData.of(filter.getValue()))
                    )
                );
            case ARG_NAME_EXISTS:
                boolean exists = (boolean) filter.getValue();
                if (exists) {
                    return Query.of(q -> q
                        .exists(e -> e
                            .field(fieldPath)
                        )
                    );
                } else {
                    return Query.of(q -> q
                        .bool(b -> b
                            .mustNot(n -> n
                                .exists(e -> e
                                    .field(fieldPath)
                                )
                            )
                        )
                    );
                }
            default:
                // never happens
                return null;
        }
    }

    /**
     * Extracts a scalar value, this is needed because of GraphQL strict types
     */
    protected Object getRealValue(Value value, DataFetchingEnvironment env) {
        if (value instanceof BooleanValue) {
            return ((BooleanValue)value).isValue();
        } else if (value instanceof FloatValue) {
            return ((FloatValue) value).getValue();
        } else if (value instanceof IntValue) {
            return ((IntValue) value).getValue();
        } else if (value instanceof StringValue) {
            return ((StringValue) value).getValue();
        } else if (value instanceof VariableReference) {
            return env.getVariables().get(((VariableReference) value).getName());
        }
        return null;
    }

    /**
     * Checks for fields containing the 'item' keyword and makes sure they are always a list even if there is only
     * one value. This is needed because the GraphQL schema always needs to return the same type for a field.
     */
    protected Map<String, Object> fixItems(Map<String, Object> map) {
        Map<String, Object> temp = new LinkedHashMap<>();

        map.forEach((key, value) -> {
            String graphQLKey = getGraphQLName(key);
            if (FIELD_NAME_ITEM.equals(key)) {
                if (!(value instanceof List)) {
                    temp.put(graphQLKey, Collections.singletonList(fixItems((Map<String, Object>)value)));
                } else {
                    List<Map<String, Object>> list = (List<Map<String, Object>>) value;
                    temp.put(graphQLKey, list.stream().map(this::fixItems).collect(Collectors.toList()));
                }
            } else if (value instanceof Map) {
                temp.put(graphQLKey, fixItems((Map<String, Object>) value));
            } else {
                temp.put(graphQLKey, value);
            }
        });

        return MapUtils.isNotEmpty(temp)? temp : map;
    }

}
