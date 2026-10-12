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

import org.craftercms.search.opensearch.exception.OpenSearchException;
import org.craftercms.search.opensearch.exception.TooManyNestedClausesSearchException;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.opensearch.client.opensearch.OpenSearchClient;
import org.opensearch.client.opensearch._types.ShardSearchFailure;
import org.opensearch.client.opensearch.core.SearchRequest;
import org.opensearch.client.opensearch.core.SearchResponse;

import java.io.IOException;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Tests for shard-failure handling in {@link AbstractOpenSearchClientWrapper}.
 */
@RunWith(MockitoJUnitRunner.class)
public class AbstractOpenSearchClientWrapperTest {

    @Mock
    private OpenSearchClient client;

    private AbstractOpenSearchClientWrapper wrapper;

    @Before
    public void setUp() {
        wrapper = client(false);
    }

    @Test
    public void searchReturnsResponseWhenAllShardsSucceed() throws IOException {
        SearchResponse<String> response = searchResponse(5, 5, 0, List.of());
        when(client.search(any(SearchRequest.class), eq(String.class))).thenReturn(response);

        SearchResponse<String> result = wrapper.search(SearchRequest.of(r -> r.index("test-index")), String.class);

        assertSame(response, result);
    }

    @Test
    public void searchReturnsPartialResultsWhenShardFailureIsIgnored() throws IOException {
        SearchResponse<String> response = searchResponse(5, 4, 1, List.of(shardFailure(
                "test-index", 2, "query_shard_exception", "failed to create query")));
        when(client.search(any(SearchRequest.class), eq(String.class))).thenReturn(response);

        SearchResponse<String> result = wrapper.search(SearchRequest.of(r -> r.index("test-index")), String.class);

        assertSame(response, result);
    }

    @Test
    public void searchFailsWhenAShardFails() throws IOException {
        wrapper = client(true);
        SearchResponse<String> response = searchResponse(5, 4, 1, List.of(shardFailure(
                "test-index", 2, "query_shard_exception", "failed to create query")));
        when(client.search(any(SearchRequest.class), eq(String.class))).thenReturn(response);

        try {
            wrapper.search(SearchRequest.of(r -> r.index("test-index")), String.class);
            fail("Expected a shard failure to fail the search");
        } catch (OpenSearchException e) {
            assertEquals(OpenSearchException.class, e.getClass());
            assertEquals("test-index", e.getIndexId());
            assertEquals("[test-index] Search failed on 1 of 5 shards: " +
                    "[test-index][2] query_shard_exception: failed to create query", e.getMessage());
        }
    }

    @Test
    public void searchReportsTooManyNestedClausesFromAFailedShard() throws IOException {
        wrapper = client(true);
        SearchResponse<String> response = searchResponse(5, 4, 1, List.of(shardFailure(
                "test-index", 0, "too_many_nested_clauses", "too many nested clauses")));
        when(client.search(any(SearchRequest.class), eq(String.class))).thenReturn(response);

        try {
            wrapper.search(SearchRequest.of(r -> r.index("test-index")), String.class);
            fail("Expected a nested-clause shard failure");
        } catch (TooManyNestedClausesSearchException e) {
            assertEquals("test-index", e.getIndexId());
        }
    }

    private AbstractOpenSearchClientWrapper client(boolean failOnPartialShardFailure) {
        return new AbstractOpenSearchClientWrapper(client, failOnPartialShardFailure) {
        };
    }

    private static SearchResponse<String> searchResponse(int total, int successful, int failed,
                                                         List<ShardSearchFailure> failures) {
        return SearchResponse.searchResponseOf(r -> r
                .took(1)
                .timedOut(false)
                .shards(s -> s
                        .total(total)
                        .successful(successful)
                        .failed(failed)
                        .failures(failures)
                )
                .hits(h -> h.hits(List.of()))
        );
    }

    private static ShardSearchFailure shardFailure(String index, int shard, String type, String reason) {
        return ShardSearchFailure.of(f -> f
                .index(index)
                .shard(shard)
                .reason(c -> c
                        .type(type)
                        .reason(reason)
                )
        );
    }

}
