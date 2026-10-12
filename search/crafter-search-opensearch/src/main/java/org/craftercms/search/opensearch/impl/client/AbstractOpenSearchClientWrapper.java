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

package org.craftercms.search.opensearch.impl.client;

import jakarta.json.stream.JsonParser;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.search.opensearch.client.OpenSearchClientWrapper;
import org.craftercms.search.opensearch.exception.OpenSearchException;
import org.craftercms.search.opensearch.exception.TooManyNestedClausesSearchException;
import org.opensearch.client.ResponseException;
import org.opensearch.client.json.JsonpMapper;
import org.opensearch.client.opensearch.OpenSearchClient;
import org.opensearch.client.opensearch._types.ErrorCause;
import org.opensearch.client.opensearch._types.ErrorResponse;
import org.opensearch.client.opensearch._types.SearchType;
import org.opensearch.client.opensearch._types.ShardSearchFailure;
import org.opensearch.client.opensearch._types.ShardStatistics;
import org.opensearch.client.opensearch._types.query_dsl.BoolQuery;
import org.opensearch.client.opensearch._types.query_dsl.Query;
import org.opensearch.client.opensearch.core.SearchRequest;
import org.opensearch.client.opensearch.core.SearchResponse;
import org.opensearch.client.util.ObjectBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Stream;

import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toList;
import static org.apache.commons.collections4.MapUtils.isNotEmpty;

/**
 * Base implementation of {@link OpenSearchClientWrapper}
 * @author joseross
 * @since 4.0.0
 */
public abstract class AbstractOpenSearchClientWrapper implements OpenSearchClientWrapper {

    /**
     * Error returned by OpenSearch when the number of nested clauses exceeds the limit
     */
    protected static final String TOO_MANY_NESTED_CLAUSES_ERROR = "too_many_nested_clauses";

    protected final Logger logger = LoggerFactory.getLogger(getClass());

    public static final String PARAM_NAME_INDEX = "index";
    public static final String PARAM_NAME_SEARCH_TYPE = "search_type";

    /**
     * The OpenSearch client
     */
    protected final OpenSearchClient client;

    /**
     * The filter queries to apply to all searches
     */
    protected String[] filterQueries;

    /**
     * When {@code true}, a search that fails on some shards is treated as a failed search.
     * OpenSearch otherwise returns a successful response with partial results.
     */
    protected final boolean failOnPartialShardFailure;

    public AbstractOpenSearchClientWrapper(OpenSearchClient client) {
        this(client, false);
    }

    public AbstractOpenSearchClientWrapper(OpenSearchClient client, boolean failOnPartialShardFailure) {
        this.client = client;
        this.failOnPartialShardFailure = failOnPartialShardFailure;
    }

    public void setFilterQueries(final String[] filterQueries) {
        this.filterQueries = filterQueries;
    }

    @Override
    public <T> SearchResponse<T> search(SearchRequest request, Class<T> docClass, Map<String, Object> parameters)
            throws IOException, OpenSearchException {
        SearchRequest searchRequest = new SearchRequestWrapper(request, parameters).build();
        try {
            SearchResponse<T> response = client.search(searchRequest, docClass);
            ensureNoShardFailures(searchRequest, response);
            return response;
        } catch (ResponseException e) {
            String errorType = getErrorRootCauseType(e);
            if (TOO_MANY_NESTED_CLAUSES_ERROR.equalsIgnoreCase(errorType)) {
                throw new TooManyNestedClausesSearchException(null, e.getMessage(), e);
            }
            throw e;
        }
    }

    /**
     * OpenSearch returns a successful response when {@code allow_partial_search_results} is enabled and only some
     * shards fail. Treat that as a failed search so callers do not use an incomplete result.
     */
    protected void ensureNoShardFailures(SearchRequest request, SearchResponse<?> response) {
        ShardStatistics shards = response.shards();
        if (shards == null || shards.failed() == 0 ) {
            return;
        }
		if (!failOnPartialShardFailure) {
			logger.warn("Search failed on {} of {} shards, but failOnPartialShardFailure is false. Ignoring shard failures.", shards.failed(), shards.total());
			return;
		}

        String details = shards.failures().stream()
                .map(this::describeShardFailure)
                .collect(joining("; "));
        String indexId = request.index().isEmpty() ? null : String.join(",", request.index());
        String message = String.format("Search failed on %d of %d shards%s",
                shards.failed(), shards.total(), StringUtils.isEmpty(details) ? "" : ": " + details);

        if (shards.failures().stream().anyMatch(failure -> isTooManyNestedClauses(failure.reason()))) {
            throw new TooManyNestedClausesSearchException(indexId, message, null);
        }
        throw new OpenSearchException(indexId, message);
    }

    protected String describeShardFailure(ShardSearchFailure failure) {
        ErrorCause reason = failure.reason();
        String description = reason.type();
        if (StringUtils.isNotEmpty(reason.reason())) {
            description = description + ": " + reason.reason();
        }
        return String.format("[%s][%d] %s", failure.index(), failure.shard(), description);
    }

    protected boolean isTooManyNestedClauses(ErrorCause cause) {
        if (cause == null) {
            return false;
        }
        if (TOO_MANY_NESTED_CLAUSES_ERROR.equalsIgnoreCase(cause.type())) {
            return true;
        }
        return cause.rootCause().stream().anyMatch(root -> TOO_MANY_NESTED_CLAUSES_ERROR.equalsIgnoreCase(root.type()));
    }

    /**
     * Get the error type from an error response
     *
     * @param e the response exception
     * @return the error type, or null if couldn't be determined
     * @throws IOException if there is an error reading the response
     */
    protected String getErrorRootCauseType(ResponseException e) throws IOException {
        if (e == null) {
            return null;
        }
        JsonpMapper mapper = client._transport().jsonpMapper();
        JsonParser parser = mapper.jsonProvider().createParser(e.getResponse().getEntity().getContent());
        ErrorResponse errorResponse = ErrorResponse._DESERIALIZER.deserialize(parser, mapper);
        List<ErrorCause> errorCauses = errorResponse.error().rootCause();
        if (CollectionUtils.isNotEmpty(errorCauses)) {
            return errorCauses.get(0).type();
        }
        return null;
    }

    //TODO: Figure out the right order
    protected RequestUpdates getRequestUpdates(SearchRequest request, Map<String, Object> parameters) {
        RequestUpdates updates = new RequestUpdates();
        updateIndicesOptions(request, parameters, updates);
        updateQuery(request, parameters, updates);
        updateIndex(request, parameters, updates);
        updateSearchType(request, parameters, updates);
        return updates;
    }

    protected void updateIndex(SearchRequest request, Map<String, Object> parameters, RequestUpdates updates) {
        if (isNotEmpty(parameters) && parameters.containsKey(PARAM_NAME_INDEX)) {
            updates.index = Stream.of(parameters.get(PARAM_NAME_INDEX).toString().split(","))
                                .collect(toList());
        }
    }

    protected void updateSearchType(SearchRequest request, Map<String, Object> parameters, RequestUpdates updates) {
        if (isNotEmpty(parameters) && parameters.containsKey(PARAM_NAME_SEARCH_TYPE)) {
            updates.searchType = SearchType._DESERIALIZER.parse(parameters.get(PARAM_NAME_SEARCH_TYPE).toString());
        }
    }

    protected void updateIndicesOptions(SearchRequest request, Map<String, Object> parameters, RequestUpdates updates) {
        if (isNotEmpty(parameters) && parameters.containsKey("ignore_unavailable")) {
            updates.ignoreUnavailable = Boolean.parseBoolean(parameters.get("ignore_unavailable").toString());
        }
    }

    protected void copyQuery(BoolQuery originalQuery, BoolQuery.Builder builder) {
        builder
            .must(originalQuery.must())
            .should(originalQuery.should())
            .filter(originalQuery.filter())
            .mustNot(originalQuery.mustNot())
            .minimumShouldMatch(originalQuery.minimumShouldMatch());
    }

    /**
     * Updates the filter queries for the given request
     * @param request the request to update
     * @param updates the request updates
     */
    protected void updateQuery(SearchRequest request, Map<String, Object> parameters, RequestUpdates updates) {
        if(ArrayUtils.isEmpty(filterQueries)) {
            logger.debug("No additional filter queries configured");
            return;
        }

        Query originalQuery = request.query();
        BoolQuery.Builder builder = new BoolQuery.Builder();
        if (originalQuery != null) {
            if (originalQuery.isBool()) {
                // copy the original query
                copyQuery(originalQuery.bool(), builder);
            } else {
                // wrap the original query
                builder.must(originalQuery);
            }
        }

        for(String filterQuery : filterQueries) {
            logger.debug("Adding filter query: {}", filterQuery);
            builder.filter(f -> f
                .queryString(q -> q
                    .query(filterQuery)
                )
            );
        }

        updates.query = Query.of(q -> q
            .bool(builder.build())
        );
    }

    public static class RequestUpdates {

        protected List<String> index;

        protected List<Map<String, Double>> indicesBoost;

        protected Query query;

        protected SearchType searchType;

        protected Boolean ignoreUnavailable;

        public List<String> getIndex() {
            return index;
        }

        public void setIndex(List<String> index) {
            this.index = index;
        }

        public List<Map<String, Double>> getIndicesBoost() {
            return indicesBoost;
        }

        public void setIndicesBoost(List<Map<String, Double>> indicesBoost) {
            this.indicesBoost = indicesBoost;
        }

        public Query getQuery() {
            return query;
        }

        public void setQuery(Query query) {
            this.query = query;
        }

        public void setQuery(Function<Query.Builder, ObjectBuilder<Query>> fn) {
            this.query = fn.apply(new Query.Builder()).build();
        }

        public SearchType getSearchType() {
            return searchType;
        }

        public void setSearchType(SearchType searchType) {
            this.searchType = searchType;
        }

        public Boolean isIgnoreUnavailable() {
            return ignoreUnavailable;
        }

        public void setIgnoreUnavailable(Boolean ignoreUnavailable) {
            this.ignoreUnavailable = ignoreUnavailable;
        }

    }

    public class SearchRequestWrapper extends SearchRequest.Builder {

        public SearchRequestWrapper(SearchRequest request, Map<String, Object> parameters) {
            // make a copy of the original request
            source(request.source());
            aggregations(request.aggregations());
            allowNoIndices(request.allowNoIndices());
            allowPartialSearchResults(request.allowPartialSearchResults());
            analyzeWildcard(request.analyzeWildcard());
            analyzer(request.analyzer());
            batchedReduceSize(request.batchedReduceSize());
            ccsMinimizeRoundtrips(request.ccsMinimizeRoundtrips());
            collapse(request.collapse());
            defaultOperator(request.defaultOperator());
            df(request.df());
            docvalueFields(request.docvalueFields());
            expandWildcards(request.expandWildcards());
            explain(request.explain());
            fields(request.fields());
            from(request.from());
            highlight(request.highlight());
            ignoreThrottled(request.ignoreThrottled());
            lenient(request.lenient());
            maxConcurrentShardRequests(request.maxConcurrentShardRequests());
            minCompatibleShardNode(request.minCompatibleShardNode());
            minScore(request.minScore());
            postFilter(request.postFilter());
            preFilterShardSize(request.preFilterShardSize());
            preference(request.preference());
            profile(request.profile());
            q(request.q());
            requestCache(request.requestCache());
            rescore(request.rescore());
            routing(request.routing());
            scriptFields(request.scriptFields());
            scroll(request.scroll());
            if (CollectionUtils.isNotEmpty(request.searchAfter())) {
                searchAfter(request.searchAfter());
            }
            seqNoPrimaryTerm(request.seqNoPrimaryTerm());
            size(request.size());
            slice(request.slice());
            sort(request.sort());
            stats(request.stats());
            storedFields(request.storedFields());
            suggest(request.suggest());
            terminateAfter(request.terminateAfter());
            timeout(request.timeout());
            trackScores(request.trackScores());
            trackTotalHits(request.trackTotalHits());
            version(request.version());

            // override values
            RequestUpdates updates = getRequestUpdates(request, parameters);
            ignoreUnavailable(Optional.ofNullable(updates.ignoreUnavailable).orElse(request.ignoreUnavailable()));
            index(Optional.ofNullable(updates.index).orElse(request.index()));
            indicesBoost(Optional.ofNullable(updates.indicesBoost).orElse(request.indicesBoost()));
            query(Optional.ofNullable(updates.query).orElse(request.query()));
            searchType(Optional.ofNullable(updates.searchType).orElse(request.searchType()));
        }

    }

}
