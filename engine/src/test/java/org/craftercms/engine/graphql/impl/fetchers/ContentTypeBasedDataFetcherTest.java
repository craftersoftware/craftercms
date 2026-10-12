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
package org.craftercms.engine.graphql.impl.fetchers;

import graphql.execution.MergedField;
import graphql.language.Document;
import graphql.language.Field;
import graphql.language.FragmentDefinition;
import graphql.language.OperationDefinition;
import graphql.parser.Parser;
import graphql.schema.DataFetchingEnvironment;
import org.craftercms.search.opensearch.client.OpenSearchClientWrapper;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.opensearch.client.opensearch._types.query_dsl.Query;
import org.opensearch.client.opensearch.core.SearchRequest;
import org.opensearch.client.opensearch.core.SearchResponse;
import org.opensearch.client.opensearch.core.search.TotalHitsRelation;
import org.opensearch.client.util.ObjectBuilder;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for field exclusion and source-include deduplication in {@link ContentTypeBasedDataFetcher}.
 */
@RunWith(MockitoJUnitRunner.class)
public class ContentTypeBasedDataFetcherTest {

    @Mock
    private OpenSearchClientWrapper searchClient;

    private ContentTypeBasedDataFetcher dataFetcher;

    @Before
    public void setUp() throws Exception {
        dataFetcher = new ContentTypeBasedDataFetcher(10, "lastModifiedDate_dt", "DESC", searchClient,
                new String[]{" __typename ", "internalName", "seo", "", "  "});
        when(searchClient.search(anySearchRequest(), eq(Map.class))).thenReturn(emptySearchResponse());
    }

    @Test
    public void ignoredFieldsAreExcludedFromIncludesButFiltersStillApply() throws Exception {
        fetch("""
                {
                  contentItems {
                    items {
                      title_s
                      __typename
                      internalName(filter: { equals: "Home" })
                      sections {
                        title_s
                      }
                      seo {
                        title_s
                        description_t(filter: { matches: "news" })
                      }
                    }
                  }
                }
                """);

        SearchRequest request = capturedSearchRequest();
        List<String> includes = request.source().filter().includes();

        assertTrue(includes.contains("content-type"));
        assertTrue(includes.contains("title_s"));
        assertTrue(includes.contains("sections.title_s"));
        assertFalse(includes.contains("__typename"));
        assertFalse(includes.contains("internalName"));
        assertFalse(includes.contains("seo.title_s"));
        assertFalse(includes.contains("seo.description_t"));

        assertTrue(hasTermFilter(request.query(), "internalName", "Home"));
        assertFalse(hasMatchFilter(request.query(), "seo.description_t", "news"));
    }

    @Test
    public void duplicateSelectionsAreIncludedOnce() throws Exception {
        fetch("""
                {
                  contentItems {
                    items {
                      content__type
                      homeTitle: title_s(filter: { equals: "Home" })
                      pageTitle: title_s(filter: { matches: "Page" })
                      sections {
                        title_s
                      }
                      features_o {
                        item {
                          component {
                            title_s
                            content__type
                          }
                        }
                      }
                      ...ItemFields
                    }
                  }
                }

                fragment ItemFields on Item {
                  title_s
                  sections {
                    title_s
                    body_html
                  }
                  features_o {
                    item {
                      component {
                        body_html
                      }
                    }
                  }
                }
                """);

        SearchRequest request = capturedSearchRequest();
        List<String> includes = request.source().filter().includes();
        Set<String> expectedIncludes = Set.of(
                "content-type",
                "title_s",
                "sections.title_s",
                "sections.body_html",
                "features_o.item.component.content-type",
                "features_o.item.component.title_s",
                "features_o.item.component.body_html"
        );

        assertEquals(expectedIncludes, new HashSet<>(includes));
        assertEquals(expectedIncludes.size(), includes.size());
        assertTrue(hasTermFilter(request.query(), "title_s", "Home"));
        assertTrue(hasMatchFilter(request.query(), "title_s", "Page"));
    }

    private void fetch(String graphql) throws Exception {
        Document document = new Parser().parseDocument(graphql);
        OperationDefinition operation = document.getDefinitions().stream()
                .filter(OperationDefinition.class::isInstance)
                .map(OperationDefinition.class::cast)
                .findFirst()
                .orElseThrow();
        Map<String, FragmentDefinition> fragments = document.getDefinitions().stream()
                .filter(FragmentDefinition.class::isInstance)
                .map(FragmentDefinition.class::cast)
                .collect(Collectors.toMap(FragmentDefinition::getName, fragment -> fragment));
        Field field = (Field) operation.getSelectionSet().getSelections().get(0);

        DataFetchingEnvironment env = mock(DataFetchingEnvironment.class);
        when(env.getMergedField()).thenReturn(MergedField.newMergedField(field).build());
        if (!fragments.isEmpty()) {
            when(env.getFragmentsByName()).thenReturn(fragments);
        }
        dataFetcher.get(env);
    }

    private static Function<SearchRequest.Builder, ObjectBuilder<SearchRequest>> anySearchRequest() {
        return any();
    }

    @SuppressWarnings("unchecked")
    private SearchRequest capturedSearchRequest() throws Exception {
        ArgumentCaptor<Function<SearchRequest.Builder, ObjectBuilder<SearchRequest>>> captor =
                ArgumentCaptor.forClass(Function.class);
        verify(searchClient).search(captor.capture(), eq(Map.class));
        return SearchRequest.of(captor.getValue());
    }

    private static SearchResponse<Map> emptySearchResponse() {
        return SearchResponse.searchResponseOf(r -> r
                .took(1)
                .timedOut(false)
                .shards(s -> s
                        .total(1)
                        .successful(1)
                        .failed(0)
                )
                .hits(h -> h
                        .total(t -> t
                                .value(0)
                                .relation(TotalHitsRelation.Eq)
                        )
                        .hits(List.of())
                )
        );
    }

    private static boolean hasTermFilter(Query query, String field, String value) {
        if (query.isTerm()) {
            return field.equals(query.term().field()) && value.equals(query.term().value().stringValue());
        }
        return anyChildMatches(query, child -> hasTermFilter(child, field, value));
    }

    private static boolean hasMatchFilter(Query query, String field, String value) {
        if (query.isMatch()) {
            return field.equals(query.match().field()) && value.equals(query.match().query().stringValue());
        }
        return anyChildMatches(query, child -> hasMatchFilter(child, field, value));
    }

    private static boolean anyChildMatches(Query query, Predicate<Query> predicate) {
        if (!query.isBool()) {
            return false;
        }
        var bool = query.bool();
        return bool.filter().stream().anyMatch(predicate)
                || bool.must().stream().anyMatch(predicate)
                || bool.should().stream().anyMatch(predicate)
                || bool.mustNot().stream().anyMatch(predicate);
    }

}
