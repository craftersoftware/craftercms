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
package org.craftercms.engine.url.rewrite;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

import com.sun.net.httpserver.HttpServer;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.Assume;
import org.junit.Test;
import org.tuckey.web.filters.urlrewrite.Conf;
import org.tuckey.web.filters.urlrewrite.NormalRule;
import org.tuckey.web.filters.urlrewrite.UrlRewriter;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

public class SecuredConfTest {

	private static final String TUCKEY_40_PUBLIC_ID = "-//tuckey.org//DTD UrlRewrite 4.0//EN";
	private static final String SENTINEL = "XXE-SENTINEL-DO-NOT-LEAK";

	@Test
	public void testTuckeyDoctypeLoadsWithoutFetchingSystemId() throws Exception {
		try (ProbeServer probe = new ProbeServer()) {
			String xml = document(tuckeyDoctype(probe.url("/urlrewrite4.0.dtd")), "^/alpha/.*$", "/alpha");
			Conf conf = load(xml);

			assertTrue(conf.getErrors().toString(), conf.isOk());
			NormalRule rule = onlyRule(conf);
			assertEquals("^/alpha/.*$", rule.getFrom());
			assertEquals("/alpha", rule.getTo());
			assertEquals(0, probe.hits());
		}
	}

	@Test
	public void testKnownTuckeyPublicIdsLoad() throws Exception {
		String[] publicIds = {
			"-//tuckey.org//DTD UrlRewrite 1.0//EN",
			"-//tuckey.org//DTD UrlRewrite 4.0//EN",
			"-//tuckey.org//DTD UrlRewrite 5.1//EN"
		};
		try (ProbeServer probe = new ProbeServer()) {
			for (String publicId : publicIds) {
				String xml = document(publicDoctype(publicId, probe.url("/dtd")), "^/from$", "/to");
				Conf conf = load(xml);
				assertTrue(publicId + " " + conf.getErrors(), conf.isOk());
				assertEquals("^/from$", onlyRule(conf).getFrom());
			}
			assertEquals(0, probe.hits());
		}
	}

	@Test
	public void testXmlWithoutDoctypeLoads() {
		Conf conf = load(document(null, "^/some/olddir/(.*)$", "/very/newdir/$1"));

		assertTrue(conf.getErrors().toString(), conf.isOk());
		NormalRule rule = onlyRule(conf);
		assertEquals("^/some/olddir/(.*)$", rule.getFrom());
		assertEquals("/very/newdir/$1", rule.getTo());
	}

	@Test
	public void testPredefinedEntitiesAreExpanded() {
		Conf conf = load(document(null, "^/path?a=&amp;b=&lt;c&gt;&quot;d&apos;", "/c&amp;d"));

		assertTrue(conf.getErrors().toString(), conf.isOk());
		NormalRule rule = onlyRule(conf);
		assertEquals("^/path?a=&b=<c>\"d'", rule.getFrom());
		assertEquals("/c&d", rule.getTo());
	}

	@Test
	public void testModRewriteStyleConfStillLoads() {
		String rewriteConf = "RewriteRule ^/old/(.*)$ /new/$1 [R=301,L]\n";
		Conf conf = new SecuredConf(null, new ByteArrayInputStream(rewriteConf.getBytes(StandardCharsets.UTF_8)),
			"urlrewrite.conf", "", true);

		assertTrue(conf.getErrors().toString(), conf.isOk());
		NormalRule rule = onlyRule(conf);
		assertEquals("^/old/(.*)$", rule.getFrom());
		assertEquals("/new/$1", rule.getTo());
		assertEquals("permanent-redirect", rule.getToType());
	}

	@Test
	public void testEmptyStreamIsRejected() {
		Conf conf = new SecuredConf(null, new ByteArrayInputStream(new byte[0]), "urlrewrite.xml", "", false);

		assertRejected(conf);
		assertErrorContains(conf, "Parse error on line");
	}

	@Test
	public void testMalformedXmlIsRejectedWithParseError() {
		Conf conf = load("<?xml version=\"1.0\"?><urlrewrite><rule><from>unclosed");

		assertRejected(conf);
		assertErrorContains(conf, "Parse error on line");
	}

	@Test
	public void testEntityExpansionIsRejected() {
		String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
			+ "<!DOCTYPE urlrewrite ["
			+ "<!ENTITY lol \"lol\">"
			+ "<!ENTITY lol2 \"&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;\">"
			+ "<!ENTITY lol3 \"&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;\">"
			+ "]>"
			+ "<urlrewrite><rule><from>&lol3;</from><to>/x</to></rule></urlrewrite>";
		Conf conf = load(xml);

		assertRejected(conf);
		assertErrorContains(conf, "must not declare XML entities");
		assertFalse(conf.getErrors().toString().contains("lollol"));
	}

	@Test
	public void testFileEntityIsNotExpanded() throws Exception {
		Path secret = Files.createTempFile("secured-conf-xxe", ".txt");
		try {
			Files.writeString(secret, SENTINEL);
			String xml = document(internalSubset("<!ENTITY xxe SYSTEM \"" + secret.toUri() + "\">"),
				"&xxe;", "/stolen");
			Conf conf = load(xml);

			assertRejected(conf);
			assertErrorContains(conf, "must not declare XML entities");
			assertFalse(conf.getErrors().toString().contains(SENTINEL));
		} finally {
			Files.deleteIfExists(secret);
		}
	}

	@Test
	public void testFileEntityIsNotOpened() throws Exception {
		Assume.assumeFalse(System.getProperty("os.name").toLowerCase().contains("win"));
		Path dir = Files.createTempDirectory("secured-conf-xxe");
		Path fifo = dir.resolve("secret");
		Process mkfifo = new ProcessBuilder("mkfifo", fifo.toString()).start();
		assertEquals(0, mkfifo.waitFor());
		ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
			Thread thread = new Thread(runnable, "secured-conf-file-entity");
			thread.setDaemon(true);
			return thread;
		});
		try {
			String xml = document(internalSubset("<!ENTITY xxe SYSTEM \"" + fifo.toUri() + "\">"),
				"&xxe;", "/stolen");
			Future<Conf> future = executor.submit(() -> load(xml));
			Conf conf;
			try {
				conf = future.get(5, TimeUnit.SECONDS);
			} catch (TimeoutException e) {
				future.cancel(true);
				fail("URL rewrite parser blocked while opening an external file entity");
				return;
			}
			assertRejected(conf);
		} finally {
			executor.shutdownNow();
			Files.deleteIfExists(fifo);
			Files.deleteIfExists(dir);
		}
	}

	@Test
	public void testHttpEntityIsNotRequested() throws Exception {
		try (ProbeServer probe = new ProbeServer()) {
			String xml = document(internalSubset("<!ENTITY xxe SYSTEM \"" + probe.url("/xxe-f4-probe") + "\">"),
				"&xxe;", "/stolen");
			Conf conf = load(xml);

			assertRejected(conf);
			assertErrorContains(conf, "must not declare XML entities");
			assertEquals(0, probe.hits());
			assertFalse(conf.getErrors().toString().contains("OOB-HIT"));
		}
	}

	@Test
	public void testParameterEntityIsNotRequested() throws Exception {
		try (ProbeServer probe = new ProbeServer()) {
			String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
				+ "<!DOCTYPE urlrewrite [<!ENTITY % remote SYSTEM \"" + probe.url("/param") + "\"> %remote;]>"
				+ "<urlrewrite><rule><from>^/a$</from><to>/b</to></rule></urlrewrite>";
			Conf conf = load(xml);

			assertRejected(conf);
			assertErrorContains(conf, "must not declare XML entities");
			assertEquals(0, probe.hits());
		}
	}

	@Test
	public void testExternalSystemDoctypeIsRejected() throws Exception {
		try (ProbeServer probe = new ProbeServer()) {
			String xml = document("<!DOCTYPE urlrewrite SYSTEM \"" + probe.url("/evil.dtd") + "\">",
				"^/a$", "/b");
			Conf conf = load(xml);

			assertRejected(conf);
			assertEquals(0, probe.hits());
		}
	}

	@Test
	public void testUnknownPublicDoctypeIsRejected() throws Exception {
		try (ProbeServer probe = new ProbeServer()) {
			String xml = document(publicDoctype("-//evil//DTD UrlRewrite//EN", probe.url("/evil.dtd")),
				"^/a$", "/b");
			Conf conf = load(xml);

			assertRejected(conf);
			assertEquals(0, probe.hits());
		}
	}

	@Test
	public void testTuckeyDoctypeWithInternalSubsetIsRejected() throws Exception {
		try (ProbeServer probe = new ProbeServer()) {
			String doctype = "<!DOCTYPE urlrewrite PUBLIC \"" + TUCKEY_40_PUBLIC_ID + "\" \""
				+ probe.url("/urlrewrite4.0.dtd") + "\" ["
				+ "<!ENTITY xxe SYSTEM \"" + probe.url("/xxe-f4-probe") + "\">]>";
			Conf conf = load(document(doctype, "&xxe;", "/stolen"));

			assertRejected(conf);
			assertErrorContains(conf, "must not declare XML entities");
			assertEquals(0, probe.hits());
		}
	}

	@Test
	public void testMissingRewriterPassesRequestThrough() throws Exception {
		UrlRewriteFilter filter = new UrlRewriteFilter() {
			@Override
			protected UrlRewriter getUrlRewriter() {
				return null;
			}
		};
		HttpServletRequest request = mock(HttpServletRequest.class);
		HttpServletResponse response = mock(HttpServletResponse.class);
		FilterChain chain = mock(FilterChain.class);

		filter.doFilter(request, response, chain);

		verify(chain).doFilter(request, response);
	}

	@Test
	public void testXIncludeIsNotRequested() throws Exception {
		try (ProbeServer probe = new ProbeServer()) {
			String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
				+ "<urlrewrite xmlns:xi=\"http://www.w3.org/2001/XInclude\">"
				+ "<xi:include href=\"" + probe.url("/include") + "\"/>"
				+ "<rule><from>^/a$</from><to>/b</to></rule>"
				+ "</urlrewrite>";
			Conf conf = load(xml);

			assertTrue(conf.getErrors().toString(), conf.isOk());
			assertEquals("^/a$", onlyRule(conf).getFrom());
			assertEquals(0, probe.hits());
		}
	}

	/**
	 * The stock parser resolves a general entity system id. This locks the payload the
	 * secured parser is required to ignore.
	 */
	@Test
	public void testUnsecuredConfFetchesHttpEntity() throws Exception {
		try (ProbeServer probe = new ProbeServer()) {
			String xml = document(internalSubset("<!ENTITY xxe SYSTEM \"" + probe.url("/xxe-f4-probe") + "\">"),
				"&xxe;", "/stolen");
			Conf conf = new Conf(null, new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)),
				"urlrewrite.xml", "", false);

			assertTrue(probe.hits() > 0);
			assertFalse(conf.getRules().isEmpty());
			assertEquals("OOB-HIT", ((NormalRule) conf.getRules().getFirst()).getFrom());
		}
	}

	private static Conf load(String xml) {
		return new SecuredConf(null, new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)),
			"urlrewrite.xml", "", false);
	}

	private static void assertRejected(Conf conf) {
		assertFalse(conf.getErrors().toString(), conf.isOk());
		assertTrue(conf.getRules().isEmpty());
		assertFalse(conf.getErrors().isEmpty());
	}

	private static void assertErrorContains(Conf conf, String text) {
		assertTrue(conf.getErrors().toString(), conf.getErrors().toString().contains(text));
	}

	private static NormalRule onlyRule(Conf conf) {
		assertEquals(conf.getRules().toString(), 1, conf.getRules().size());
		return (NormalRule) conf.getRules().getFirst();
	}

	private static String tuckeyDoctype(String systemId) {
		return publicDoctype(TUCKEY_40_PUBLIC_ID, systemId);
	}

	private static String publicDoctype(String publicId, String systemId) {
		return "<!DOCTYPE urlrewrite PUBLIC \"" + publicId + "\" \"" + systemId + "\">";
	}

	private static String internalSubset(String declarations) {
		return "<!DOCTYPE urlrewrite [" + declarations + "]>";
	}

	private static String document(String doctype, String from, String to) {
		String declaration = doctype == null ? "" : doctype;
		return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
			+ declaration
			+ "<urlrewrite><rule match-type=\"regex\"><from>"
			+ from
			+ "</from><to>"
			+ to
			+ "</to></rule></urlrewrite>";
	}

	private static final class ProbeServer implements AutoCloseable {

		private final HttpServer server;
		private final ExecutorService executor;
		private final AtomicInteger hits = new AtomicInteger();

		private ProbeServer() throws IOException {
			server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			executor = Executors.newCachedThreadPool(runnable -> {
				Thread thread = new Thread(runnable, "secured-conf-probe");
				thread.setDaemon(true);
				return thread;
			});
			server.setExecutor(executor);
			server.createContext("/", exchange -> {
				hits.incrementAndGet();
				byte[] body = "OOB-HIT".getBytes(StandardCharsets.UTF_8);
				exchange.sendResponseHeaders(200, body.length);
				try (OutputStream response = exchange.getResponseBody()) {
					response.write(body);
				}
			});
			server.start();
		}

		private String url(String path) {
			return "http://127.0.0.1:" + server.getAddress().getPort() + path;
		}

		private int hits() {
			return hits.get();
		}

		@Override
		public void close() {
			server.stop(0);
			executor.shutdownNow();
		}
	}

}
