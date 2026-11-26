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

package org.craftercms.engine.service.context;

import org.apache.logging.log4j.Level;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@RunWith(MockitoJUnitRunner.class)
public class FallbackSiteListResolverTest {

	@Mock
	private SiteListResolver first;
	@Mock
	private SiteListResolver second;
	@Mock
	private SiteListResolver third;

	@Test
	public void firstSuccessDoesNotCallLaterResolvers() {
		when(first.getSiteList()).thenReturn(List.of("editorial", "editorial-staging"));
		FallbackSiteListResolver resolver = chain(first, second, third);

		assertEquals(List.of("editorial", "editorial-staging"), new ArrayList<>(resolver.getSiteList()));
		verify(second, never()).getSiteList();
		verify(third, never()).getSiteList();
	}

	@Test
	public void emptyListDoesNotCallLaterResolvers() {
		when(first.getSiteList()).thenReturn(List.of());
		FallbackSiteListResolver resolver = chain(first, second);

		assertEquals(List.of(), new ArrayList<>(resolver.getSiteList()));
		verify(second, never()).getSiteList();
	}

	@Test
	public void notConfiguredResolverTriesTheNext() {
		when(first.getSiteList()).thenReturn(null);
		when(second.getSiteList()).thenReturn(List.of("from-s3"));
		FallbackSiteListResolver resolver = chain(first, second, third);

		assertEquals(List.of("from-s3"), new ArrayList<>(resolver.getSiteList()));
		verify(third, never()).getSiteList();
	}

	@Test
	public void errorTriesResolversInOrder() {
		when(first.getSiteList()).thenThrow(new StudioSiteListException("Studio site list returned HTTP 401"));
		when(second.getSiteList()).thenThrow(new IllegalStateException("second failed"));
		when(third.getSiteList()).thenReturn(List.of("from-s3"));
		FallbackSiteListResolver resolver = chain(first, second, third);

		assertEquals(List.of("from-s3"), new ArrayList<>(resolver.getSiteList()));
	}

	@Test
	public void allUnconfiguredReturnsNull() {
		when(first.getSiteList()).thenReturn(null);
		when(second.getSiteList()).thenReturn(null);

		assertNull(chain(first, second).getSiteList());
	}

	@Test
	public void failureSuppressesEveryResolverError() {
		RuntimeException firstError = new RuntimeException("first");
		IllegalStateException secondError = new IllegalStateException("second");
		when(first.getSiteList()).thenThrow(firstError);
		when(second.getSiteList()).thenThrow(secondError);
		FallbackSiteListResolver resolver = chain(first, second);

		IllegalStateException error = assertThrows(IllegalStateException.class, resolver::getSiteList);
		assertEquals("Unable to list sites", error.getMessage());
		assertEquals(List.of(firstError, secondError), List.of(error.getSuppressed()));
	}

	@Test
	public void errorWithoutMessageIsDescribedInWarning() {
		when(first.getSiteList()).thenThrow(new RuntimeException());
		when(second.getSiteList()).thenReturn(List.of("from-s3"));
		FallbackSiteListResolver resolver = chain(first, second);

		List<String> events;
		try (LogCapture logs = new LogCapture(FallbackSiteListResolver.class, Level.INFO)) {
			assertEquals(List.of("from-s3"), new ArrayList<>(resolver.getSiteList()));
			events = logs.events();
		}

		List<String> warnings = events.stream().filter(event -> event.startsWith("WARN ")).toList();
		assertEquals(1, warnings.size());
		assertTrue(warnings.get(0), warnings.get(0).endsWith("(RuntimeException)"));
		assertFalse(warnings.get(0), warnings.get(0).contains("null"));
	}

	@Test
	public void successLogsWhichResolverSuppliedTheList() {
		when(first.getSiteList()).thenReturn(null);
		FallbackSiteListResolver resolver = chain(first, new StaticSiteListResolver("editorial", "editorial-staging"));

		List<String> events;
		try (LogCapture logs = new LogCapture(FallbackSiteListResolver.class, Level.DEBUG)) {
			resolver.getSiteList();
			events = logs.events();
		}

		assertTrue(events.toString(), events.contains("DEBUG Site list (2 sites) supplied by StaticSiteListResolver"));
	}

	private static FallbackSiteListResolver chain(SiteListResolver... resolvers) {
		return new FallbackSiteListResolver(List.of(resolvers));
	}

	private static final class StaticSiteListResolver implements SiteListResolver {

		private final List<String> siteNames;

		private StaticSiteListResolver(String... siteNames) {
			this.siteNames = List.of(siteNames);
		}

		@Override
		public Collection<String> getSiteList() {
			return siteNames;
		}

	}

}
