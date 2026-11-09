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

import com.sun.net.httpserver.HttpServer;
import org.craftercms.commons.rest.ManagementToken;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class StudioSiteListResolverTest {

	private static final String TOKEN = "management-token";
	private static final long TIMEOUT = 2000L;

	private HttpServer server;
	private ExecutorService executor;
	private String baseUrl;
	private final AtomicInteger requests = new AtomicInteger();
	private volatile int status = 200;
	private volatile String body = "{\"response\":{\"code\":0},\"sites\":[\"editorial\",\"editorial-staging\"]}";
	private volatile long bodyDelayMillis;
	private volatile String requestHeader;
	private volatile String requestQuery;

	@Before
	public void setUp() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		executor = Executors.newSingleThreadExecutor();
		server.setExecutor(executor);
		server.createContext(StudioSiteListResolver.SITES_PATH, exchange -> {
			requests.incrementAndGet();
			requestHeader = exchange.getRequestHeaders().getFirst(ManagementToken.HEADER_NAME);
			requestQuery = exchange.getRequestURI().getRawQuery();
			byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
			exchange.sendResponseHeaders(status, bytes.length);
			pause(bodyDelayMillis);
			exchange.getResponseBody().write(bytes);
			exchange.close();
		});
		server.start();
		baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
	}

	@After
	public void tearDown() {
		if (server != null) {
			server.stop(0);
		}
		if (executor != null) {
			executor.shutdownNow();
		}
	}

	@Test
	public void successReturnsSiteIdsFromHeaderAuthenticatedCall() {
		StudioSiteListResolver resolver = resolver(baseUrl + "/", TOKEN);

		assertEquals(List.of("editorial", "editorial-staging"), new ArrayList<>(resolver.getSiteList()));
		assertEquals(TOKEN, requestHeader);
		assertNull(requestQuery);
	}

	@Test
	public void emptySiteListIsReturned() {
		body = "{\"sites\":[]}";
		StudioSiteListResolver resolver = resolver(baseUrl, TOKEN);

		assertEquals(List.of(), new ArrayList<>(resolver.getSiteList()));
	}

	@Test
	public void delayedBodyTimesOut() {
		bodyDelayMillis = 8_000;
		StudioSiteListResolver resolver = new StudioSiteListResolver(baseUrl, TOKEN, TIMEOUT, 1_000);

		long started = System.nanoTime();
		StudioSiteListException error = assertThrows(StudioSiteListException.class, resolver::getSiteList);
		long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);

		assertTrue(error.getMessage().contains("timed out"));
		assertTrue("elapsed " + elapsedMillis + "ms", elapsedMillis < 4_000);
	}

	@Test
	public void slowStudioFallsBackToTheNextResolverWithinTheProbeBudget() {
		bodyDelayMillis = 8_000;
		FallbackSiteListResolver resolver = new FallbackSiteListResolver(List.of(
			new StudioSiteListResolver(baseUrl, TOKEN, 200, 200),
			() -> List.of("from-s3")));

		long started = System.nanoTime();
		assertEquals(List.of("from-s3"), new ArrayList<>(resolver.getSiteList()));
		long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);

		assertTrue("elapsed " + elapsedMillis + "ms", elapsedMillis < 3_000);
	}

	@Test
	public void unauthorizedResponseFails() {
		status = 401;
		body = "{\"response\":{\"code\":2001}}";
		StudioSiteListResolver resolver = resolver(baseUrl, TOKEN);

		StudioSiteListException error = assertThrows(StudioSiteListException.class, resolver::getSiteList);
		assertTrue(error.getMessage().contains("401"));
	}

	@Test
	public void nonJsonBodyFails() {
		body = "<html>down</html>";
		StudioSiteListResolver resolver = resolver(baseUrl, TOKEN);

		StudioSiteListException error = assertThrows(StudioSiteListException.class, resolver::getSiteList);
		assertTrue(error.getMessage().contains("not valid JSON"));
	}

	@Test
	public void missingSitesArrayFails() {
		body = "{\"response\":{\"code\":0}}";
		StudioSiteListResolver resolver = resolver(baseUrl, TOKEN);

		StudioSiteListException error = assertThrows(StudioSiteListException.class, resolver::getSiteList);
		assertTrue(error.getMessage().contains("no sites array"));
	}

	@Test
	public void blankUrlDoesNotCallStudio() {
		StudioSiteListResolver resolver = resolver("  ", TOKEN);

		assertNull(resolver.getSiteList());
		assertEquals(0, requests.get());
	}

	@Test
	public void blankTokenDoesNotCallStudio() {
		StudioSiteListResolver resolver = resolver(baseUrl, " ");

		assertNull(resolver.getSiteList());
		assertEquals(0, requests.get());
	}

	private static StudioSiteListResolver resolver(String studioUrl, String token) {
		return new StudioSiteListResolver(studioUrl, token, TIMEOUT, TIMEOUT);
	}

	private static void pause(long delayMillis) throws IOException {
		if (delayMillis <= 0) {
			return;
		}
		try {
			Thread.sleep(delayMillis);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new IOException("interrupted", e);
		}
	}

}
